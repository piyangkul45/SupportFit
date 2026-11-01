require('dotenv').config()
const express = require('express')
const cors = require('cors')
const supabase = require('./supabaseClient')
const auth = require('./auth')
const { runMigrations } = require('./migrate')
const { i18nMiddleware, translate } = require('./i18n')
const { parseCommand } = require('./parser')
const { createVoiceParser } = require('./parser/hybrid')
const { createMealAnalyzer, createMealImageAnalyzer } = require('./parser/mealGemini')
const createProgramsRouter = require('./routes/programs')
const createWeightRouter = require('./routes/weight')
const createCoachRouter = require('./routes/coach')
const createCommunityRouter = require('./routes/community')
const { DEMO_EMAIL, isDemoLoginEnabled, ensureDemoUser, seedDemoData } = require('./demo/account')

const app = express()
const PORT = process.env.PORT || 5000

// CORS_ORIGIN = origin ของ frontend ที่อนุญาต คั่นด้วย , (เช่น https://supportfit.vercel.app) ไม่ตั้ง = อนุญาตทุก origin (ตอน dev)
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean)
app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : undefined))
// body JSON ปกติจำกัด 100kb ; รูปอาหาร (base64) ใช้ parser ของตัวเองที่รับได้ใหญ่กว่า (ดู /api/meals/analyze-image)
const MEAL_IMAGE_PATH = '/api/meals/analyze-image'
const jsonParser = express.json()
app.use((req, res, next) => (req.path === MEAL_IMAGE_PATH ? next() : jsonParser(req, res, next)))
// เลือกภาษาของข้อความ API/อีเมลจาก Accept-Language (client ส่งตามภาษาที่ผู้ใช้เลือก) -> req.t()
app.use(i18nMiddleware)

function handleSupabaseError(res, error, fallbackMessage) {
  console.error(error)
  res.status(500).json({ error: error?.message || fallbackMessage })
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SupportFit API is running' })
})

// ---- Auth (Demo Account / อีเมล + password) ----
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// ข้อความ error เมื่อ schema บน Supabase ยังไม่อัปเดต (ยังไม่ได้รัน migrate.js)
// t = req.t ของ request นั้น (หรือ translate ภาษาใดภาษาหนึ่งตอน start server)
function describeDbError(error, t) {
  if (/users\.email does not exist/i.test(error?.message || '')) {
    return t('data.dbNotReady')
  }
  return error?.message
}

const MIN_PASSWORD_LENGTH = 6

// ไม่ส่ง password_hash กลับไปที่ client
function publicUser(user) {
  const { password_hash: _passwordHash, ...rest } = user
  return rest
}

async function findUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
  if (error) throw error
  return data
}

// สมัครสมาชิก: บันทึกอีเมล + password (hash) แล้วออก session ทันที (ไม่พิสูจน์ความเป็นเจ้าของอีเมล)
// แถวเดิมที่สมัครค้างไว้ (มี password แต่ยังไม่ยืนยัน) สมัครทับได้ เพราะยังไม่เคยเข้าใช้จึงไม่มีข้อมูล
// แถวเดิมจาก Supabase Auth ไม่มี password แต่มีข้อมูลอยู่ ห้ามสมัครทับ ไม่งั้นใครก็ตั้งรหัสแล้วเข้าบัญชีนั้นได้
app.post('/api/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim()
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: req.t('validation.invalidEmail') })
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: req.t('validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH }) })
  }
  if (email === DEMO_EMAIL) return res.status(409).json({ error: req.t('auth.emailTaken') })

  try {
    const existing = await findUserByEmail(email)
    if (existing && (existing.is_verified || !existing.password_hash)) {
      return res.status(409).json({ error: req.t('auth.emailTaken') })
    }

    const password_hash = await auth.hashPassword(password)
    const { data: saved, error } = existing
      ? await supabase
          .from('users')
          .update({ password_hash, is_verified: true, ...(name ? { name } : {}) })
          .eq('id', existing.id)
          .select()
          .single()
      : await supabase
          .from('users')
          .insert({ email, name: name || email.split('@')[0], password_hash, is_verified: true })
          .select()
          .single()
    if (error) throw error
    res.json({ token: auth.createSessionToken(saved), user: publicUser(saved) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: describeDbError(error, req.t) || req.t('auth.signupFailed') })
  }
})

// เข้าสู่ระบบด้วยอีเมล + password ; บัญชีที่สมัครค้างไว้สมัยมี OTP จะถูกยืนยันให้เมื่อ password ถูก
app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  if (!EMAIL_PATTERN.test(email) || !password) {
    return res.status(400).json({ error: req.t('validation.emailAndPasswordRequired') })
  }

  let user
  try {
    user = await findUserByEmail(email)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: describeDbError(error, req.t) || req.t('auth.loginFailed') })
  }

  if (!user?.password_hash || !(await auth.verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: req.t('auth.wrongCredentials') })
  }

  if (!user.is_verified) {
    const { error } = await supabase.from('users').update({ is_verified: true }).eq('id', user.id)
    if (error) return handleSupabaseError(res, error, req.t('auth.loginFailed'))
  }

  res.json({ token: auth.createSessionToken(user), user: publicUser(user) })
})

// ปุ่ม Demo Account (ทางเข้าหลัก ดู demo/account.js): ออก session ของบัญชี Demo บัญชีเดียว ไม่แตะบัญชีผู้ใช้อื่น
// ข้อมูลตัวอย่างเติมไม่สำเร็จก็ยังเข้าได้ แค่ Dashboard มีข้อมูลน้อยลง
app.post('/api/auth/demo', async (req, res) => {
  if (!isDemoLoginEnabled()) return res.status(404).json({ error: req.t('auth.demoDisabled'), reason: 'demo_disabled' })

  try {
    const user = await ensureDemoUser(supabase, auth.hashPassword)
    await seedDemoData(supabase, user.id).catch((error) => console.error('demo seed failed:', error.message))
    res.json({ token: auth.createSessionToken(user), user: publicUser(user) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: req.t('auth.loginFailed') })
  }
})

// ตรวจสอบ session token จาก header Authorization: Bearer <token>
// เทียบลายนิ้วมือรหัสผ่านใน token กับฐานข้อมูล (token ที่ออกก่อนเปลี่ยนรหัสผ่านจะถูกปฏิเสธ)
// แล้วแนบ req.authUser ({ uid, email }) ไว้ให้ route ถัดไปใช้
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: req.t('auth.noToken') })

  const session = auth.verifySessionToken(token)
  if (!session) return res.status(401).json({ error: req.t('auth.sessionExpired') })

  const { data: user, error } = await supabase
    .from('users')
    .select('password_hash, is_verified')
    .eq('id', session.uid)
    .maybeSingle()
  if (error) return handleSupabaseError(res, error, req.t('auth.sessionCheckFailed'))
  if (!user?.is_verified || !auth.isSessionCurrent(session, user.password_hash)) {
    return res.status(401).json({ error: req.t('auth.sessionRevoked') })
  }

  req.authUser = session
  next()
}

// ยืนยันว่า userId ที่ขอเป็นของผู้ใช้ที่ล็อกอินอยู่ ก่อนให้อ่าน/เขียน workout_logs หรือ food_logs
async function verifyOwnership(authUser, userId) {
  return String(authUser.uid) === String(userId)
}

// ---- Users ----
// คืนโปรไฟล์ (ตาราง users) ของผู้ใช้ที่ล็อกอินอยู่
app.post('/api/users/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.authUser.uid)
    .maybeSingle()
  if (error) return handleSupabaseError(res, error, req.t('data.profileLoadFailed'))
  if (!data) return res.status(401).json({ error: req.t('auth.userNotFound') })
  res.json(publicUser(data))
})

// ข้อมูลร่างกาย + เป้าหมายรายวันจาก Onboarding / Profile Settings
// เป้าหมายคำนวณที่ client (client/src/utils/macroCalculator.js) server ตรวจแค่ชนิดและช่วงค่าที่เป็นไปได้
const PROFILE_ENUMS = {
  gender: ['male', 'female'],
  activity_level: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  fitness_goal: ['lose_weight', 'maintain', 'gain_muscle'],
}
// [field, ต่ำสุด, สูงสุด, จำนวนเต็มหรือไม่]
const PROFILE_NUMBERS = [
  ['age', 13, 100, true],
  ['height_cm', 100, 250, false],
  ['weight_kg', 30, 300, false],
  ['target_calories', 500, 10000, true],
  ['target_protein', 0, 1000, true],
  ['target_carbs', 0, 2000, true],
  ['target_fat', 0, 1000, true],
]

function readProfileFields(body = {}) {
  const values = { is_onboarded: true }
  for (const [field, allowed] of Object.entries(PROFILE_ENUMS)) {
    if (!allowed.includes(body[field])) return { invalidField: field }
    values[field] = body[field]
  }
  for (const [field, min, max, integer] of PROFILE_NUMBERS) {
    const number = Number(body[field])
    if (body[field] === '' || body[field] == null || !Number.isFinite(number) || number < min || number > max) {
      return { invalidField: field }
    }
    values[field] = integer ? Math.round(number) : Math.round(number * 10) / 10
  }
  return { values }
}

app.put('/api/users/me/profile', requireAuth, async (req, res) => {
  const { values, invalidField } = readProfileFields(req.body)
  if (invalidField) return res.status(400).json({ error: req.t('data.invalidProfile', { field: invalidField }) })

  const { data, error } = await supabase
    .from('users')
    .update(values)
    .eq('id', req.authUser.uid)
    .select()
    .maybeSingle()
  if (error) {
    // ยังไม่ได้เพิ่มคอลัมน์ onboarding (PGRST204 = ไม่พบคอลัมน์ใน schema cache)
    if (error.code === 'PGRST204' || /column/i.test(error.message || '')) {
      console.error(error)
      return res.status(500).json({ error: req.t('data.profileDbNotReady') })
    }
    return handleSupabaseError(res, error, req.t('data.profileSaveFailed'))
  }
  if (!data) return res.status(401).json({ error: req.t('auth.userNotFound') })
  res.json(publicUser(data))
})

// ---- AI Parser ----
// ข้อความจาก Voice/Text -> { type: 'workout' | 'food', ... } (ดู parser/index.js)
// แยกความหมายไม่ได้ -> 422 reason 'not_understood'
const MAX_PARSE_TEXT_LENGTH = 500

// exercise_hint (ไม่บังคับ): ท่าที่เลือกไว้ใน "ตารางฝึกวันนี้" ใช้แทนเมื่อพูดแค่ตัวเลข ("100 โล 8 ครั้ง")
app.post('/api/parse', requireAuth, (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: req.t('parser.textRequired') })

  const result = parseCommand(text.slice(0, MAX_PARSE_TEXT_LENGTH), { exerciseHint: req.body?.exercise_hint })
  if (!result) return res.status(422).json({ error: req.t('parser.notUnderstood'), reason: 'not_understood' })
  res.json(result)
})

// Voice Log: parser ในเครื่องก่อน ถ้าแยกได้ไม่ครบจึงถาม Gemini (ดู parser/hybrid.js)
// API key ของ Gemini อยู่ฝั่ง server เท่านั้น ผลลัพธ์รูปเดียวกับ /api/parse + source: 'local' | 'gemini'
const parseVoice = createVoiceParser()

app.post('/api/parse-voice', requireAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: req.t('parser.textRequired') })

  const result = await parseVoice(text.slice(0, MAX_PARSE_TEXT_LENGTH), { exerciseHint: req.body?.exercise_hint })
  if (!result) return res.status(422).json({ error: req.t('parser.notUnderstood'), reason: 'not_understood' })
  res.json(result)
})

// ---- AI Meal Logger ----
// ข้อความว่ากินอะไรไป -> { items: [{ name, calories, protein_g, carbs_g, fat_g }] } (ยังไม่บันทึก)
// client ให้ผู้ใช้ตรวจ/แก้ก่อน แล้วบันทึกผ่าน POST /api/food-logs ตามเดิม
const analyzeMeal = createMealAnalyzer()

// GeminiError.reason -> [HTTP status, message key ใน i18n.js]
const MEAL_FAILURES = {
  timeout: [504, 'meal.timeout'],
  busy: [503, 'meal.busy'],
  model_unavailable: [502, 'meal.modelUnavailable'],
  failed: [502, 'meal.analyzeFailed'],
}

// รูปอาหาร: { image: base64 (ไม่มี prefix data:), mime_type, note? } -> { items } เหมือน /api/meals/analyze
// client ย่อรูปเหลือด้านยาวไม่เกิน ~1280px ก่อนส่ง (ราว 100-400KB) จำกัดรูปจริงไม่เกิน 5MB
const analyzeMealImage = createMealImageAnalyzer()
const MEAL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_MEAL_IMAGE_BYTES = 5 * 1024 * 1024

app.post(MEAL_IMAGE_PATH, requireAuth, express.json({ limit: '8mb' }), async (req, res) => {
  if (!analyzeMealImage) return res.status(503).json({ error: req.t('meal.aiUnavailable'), reason: 'ai_unavailable' })
  const image = String(req.body?.image || '').replace(/^data:[^,]*,/, '')
  const mimeType = String(req.body?.mime_type || '').toLowerCase()
  if (!image || !/^[A-Za-z0-9+/=\s]+$/.test(image)) return res.status(400).json({ error: req.t('meal.imageRequired') })
  if (!MEAL_IMAGE_TYPES.includes(mimeType)) return res.status(400).json({ error: req.t('meal.imageType') })
  if (Buffer.byteLength(image, 'base64') > MAX_MEAL_IMAGE_BYTES) return res.status(413).json({ error: req.t('meal.imageTooLarge') })

  try {
    const items = await analyzeMealImage({
      data: image,
      mimeType,
      note: String(req.body?.note || '').trim().slice(0, MAX_PARSE_TEXT_LENGTH),
      language: req.lang,
    })
    if (!items.length) return res.status(422).json({ error: req.t('meal.noFoodInImage'), reason: 'not_food' })
    res.json({ items })
  } catch (error) {
    console.error('meal image analyze failed:', error.message)
    const [status, messageKey] = MEAL_FAILURES[error.reason] || MEAL_FAILURES.failed
    res.status(status).json({ error: req.t(messageKey), reason: `ai_${error.reason || 'failed'}` })
  }
})

app.post('/api/meals/analyze', requireAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: req.t('parser.textRequired') })
  if (!analyzeMeal) return res.status(503).json({ error: req.t('meal.aiUnavailable'), reason: 'ai_unavailable' })

  try {
    const items = await analyzeMeal(text.slice(0, MAX_PARSE_TEXT_LENGTH))
    if (!items.length) return res.status(422).json({ error: req.t('meal.notFood'), reason: 'not_food' })
    res.json({ items })
  } catch (error) {
    console.error('meal analyze failed:', error.message)
    const [status, messageKey] = MEAL_FAILURES[error.reason] || MEAL_FAILURES.failed
    res.status(status).json({ error: req.t(messageKey), reason: `ai_${error.reason || 'failed'}` })
  }
})

// ---- Workout logs ----
// Estimated 1RM ด้วยสูตร Epley: weight * (1 + reps / 30)
function calculateEstimated1RM(weight_kg, reps) {
  return weight_kg != null && reps != null ? weight_kg * (1 + reps / 30) : null
}

function calculateVolumeLoad(weight_kg, reps, sets) {
  return weight_kg != null && reps != null && sets != null
    ? weight_kg * reps * sets
    : null
}

function maxOf(rows, field) {
  return rows.reduce((max, row) => {
    const value = row[field]
    if (value == null) return max
    return max == null || value > max ? value : max
  }, null)
}

// log ทั้งหมดของผู้ใช้ ใหม่ไปเก่า since (ISO timestamp, ไม่บังคับ) = เฉพาะที่ created_at >= since
// ดึงทีละหน้า เพราะ Supabase คืนไม่เกิน 1000 แถวต่อ query (เกินนั้นข้อมูลเก่าจะหายไปเงียบ ๆ)
const LOG_PAGE_SIZE = 1000

async function selectUserLogs(table, userId, since) {
  const sinceTime = since ? new Date(since) : null
  const rows = []
  for (let from = 0; ; from += LOG_PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + LOG_PAGE_SIZE - 1)
    if (sinceTime && !Number.isNaN(sinceTime.getTime())) query = query.gte('created_at', sinceTime.toISOString())
    const { data, error } = await query
    if (error) return { error }
    rows.push(...data)
    if (data.length < LOG_PAGE_SIZE) return { data: rows }
  }
}

// ประเภทกิจกรรมของ Workout Tracker (ตรงกับ check constraint ของ workout_logs.activity_type)
const ACTIVITY_TYPES = ['strength', 'cardio', 'street']

app.get('/api/workout-logs', requireAuth, async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  try {
    if (!(await verifyOwnership(req.authUser, user_id))) {
      return res.status(403).json({ error: req.t('data.forbiddenRead') })
    }
  } catch (error) {
    return handleSupabaseError(res, error, req.t('data.ownershipCheckFailed'))
  }

  const { data, error } = await selectUserLogs('workout_logs', user_id, req.query.since)
  if (error) return handleSupabaseError(res, error, req.t('data.workoutLoadFailed'))
  res.json(data)
})

app.post('/api/workout-logs', requireAuth, async (req, res) => {
  const { user_id, exercise_name, weight_kg, reps, sets, rpe } = req.body
  if (!user_id || !exercise_name) {
    return res.status(400).json({ error: 'user_id and exercise_name are required' })
  }
  // Workout Tracker: ประเภทกิจกรรม, เวลา/ระยะทางของคาร์ดิโอ, แคลอรีที่ client คำนวณจาก MET (ไม่ส่ง = null)
  const activity_type = ACTIVITY_TYPES.includes(req.body.activity_type) ? req.body.activity_type : null
  const activity = {
    duration_min: optionalNumber(req.body.duration_min),
    distance_km: optionalNumber(req.body.distance_km),
    calories_burned: optionalNumber(req.body.calories_burned),
  }
  const invalidField = Object.keys(activity).find((field) => activity[field] === undefined)
  if (invalidField) return res.status(400).json({ error: req.t('data.invalidNumber', { field: invalidField }) })

  try {
    if (!(await verifyOwnership(req.authUser, user_id))) {
      return res.status(403).json({ error: req.t('data.forbiddenWrite') })
    }
  } catch (error) {
    return handleSupabaseError(res, error, req.t('data.ownershipCheckFailed'))
  }

  const estimated_1rm = calculateEstimated1RM(weight_kg, reps)
  const volume_load = calculateVolumeLoad(weight_kg, reps, sets)

  // ดึงสถิติเดิมของท่านี้ไว้ก่อน insert เพื่อเช็คว่ารอบนี้ทำลายสถิติหรือไม่ (PR)
  const { data: history, error: historyError } = await supabase
    .from('workout_logs')
    .select('volume_load, estimated_1rm')
    .eq('user_id', user_id)
    .eq('exercise_name', exercise_name)

  if (historyError) {
    return handleSupabaseError(res, historyError, req.t('data.workoutHistoryFailed'))
  }

  const previousMaxVolume = maxOf(history, 'volume_load')
  const previousMax1RM = maxOf(history, 'estimated_1rm')

  const { data: log, error: insertError } = await supabase
    .from('workout_logs')
    .insert({
      user_id,
      exercise_name,
      weight_kg: weight_kg ?? null,
      reps: reps ?? null,
      sets: sets ?? null,
      rpe: rpe ?? null,
      estimated_1rm,
      volume_load,
      // ส่งเฉพาะเมื่อมีค่า: client เดิม (Voice Log) ยังบันทึกได้แม้ฐานข้อมูลยังไม่มีคอลัมน์ใหม่
      ...(activity_type ? { activity_type } : {}),
      ...Object.fromEntries(Object.entries(activity).filter(([, value]) => value != null)),
    })
    .select()
    .single()

  if (insertError) return handleSupabaseError(res, insertError, req.t('data.workoutSaveFailed'))

  const is_volume_pr =
    volume_load != null && (previousMaxVolume == null || volume_load > previousMaxVolume)
  const is_1rm_pr =
    estimated_1rm != null && (previousMax1RM == null || estimated_1rm > previousMax1RM)

  res.status(201).json({ ...log, is_volume_pr, is_1rm_pr })
})

// ---- แก้ไข / ลบ log ----
// ค่าจากฟอร์มแก้ไข: ว่าง = null, ต้องเป็นตัวเลขไม่ติดลบ (คืน undefined เมื่อไม่ถูกต้อง)
function optionalNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

const optionalInteger = (value) => {
  const number = optionalNumber(value)
  return number == null ? number : Math.round(number)
}

const MAX_NAME_LENGTH = 100

// ตรวจชื่อ + ตัวเลขทุก field คืน { values } หรือ { error } (field ชื่อเป็น string ไม่ว่าง)
function readLogFields(req, nameField, numberFields) {
  const name = String(req.body?.[nameField] || '').trim().slice(0, MAX_NAME_LENGTH)
  if (!name) return { error: req.t('data.nameRequired') }

  const values = { [nameField]: name }
  for (const [field, parse] of Object.entries(numberFields)) {
    values[field] = parse(req.body?.[field])
    if (values[field] === undefined) return { error: req.t('data.invalidNumber', { field }) }
  }
  return { values }
}

// update/delete เฉพาะแถวที่เป็นของผู้ใช้ที่ล็อกอิน (ไม่พบ = ไม่มีแถวนั้น หรือเป็นของคนอื่น -> 404)
async function updateOwnLog(req, res, table, values, failKey) {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq('id', req.params.id)
    .eq('user_id', req.authUser.uid)
    .select()
    .maybeSingle()
  if (error) return handleSupabaseError(res, error, req.t(failKey))
  if (!data) return res.status(404).json({ error: req.t('data.logNotFound') })
  res.json(data)
}

async function deleteOwnLog(req, res, table) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.authUser.uid)
    .select('id')
  if (error) return handleSupabaseError(res, error, req.t('data.deleteFailed'))
  if (!data?.length) return res.status(404).json({ error: req.t('data.logNotFound') })
  res.status(204).end()
}

app.put('/api/workout-logs/:id', requireAuth, (req, res) => {
  const { values, error } = readLogFields(req, 'exercise_name', {
    weight_kg: optionalNumber,
    reps: optionalInteger,
    sets: optionalInteger,
  })
  if (error) return res.status(400).json({ error })

  // ฟิลด์ของ Workout Tracker แก้เฉพาะที่ส่งมา (ฟอร์มแก้ไขส่งแคลอรีที่คำนวณใหม่มาด้วย)
  for (const field of ['duration_min', 'distance_km', 'calories_burned']) {
    if (!(field in (req.body || {}))) continue
    values[field] = optionalNumber(req.body[field])
    if (values[field] === undefined) return res.status(400).json({ error: req.t('data.invalidNumber', { field }) })
  }

  // คำนวณค่าที่ได้จาก weight/reps/sets ใหม่ให้ตรงกับข้อมูลที่แก้
  values.estimated_1rm = calculateEstimated1RM(values.weight_kg, values.reps)
  values.volume_load = calculateVolumeLoad(values.weight_kg, values.reps, values.sets)
  updateOwnLog(req, res, 'workout_logs', values, 'data.workoutSaveFailed')
})

app.delete('/api/workout-logs/:id', requireAuth, (req, res) => deleteOwnLog(req, res, 'workout_logs'))

// ---- Food logs ----
// คอลัมน์ calories/protein/carbs/fat บน Supabase จริงเป็น integer (insert ทศนิยมจะ error) จึงปัดเป็นจำนวนเต็ม
const wholeOrNull = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)))

app.get('/api/food-logs', requireAuth, async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  try {
    if (!(await verifyOwnership(req.authUser, user_id))) {
      return res.status(403).json({ error: req.t('data.forbiddenRead') })
    }
  } catch (error) {
    return handleSupabaseError(res, error, req.t('data.ownershipCheckFailed'))
  }

  const { data, error } = await selectUserLogs('food_logs', user_id, req.query.since)
  if (error) return handleSupabaseError(res, error, req.t('data.foodLoadFailed'))
  res.json(data)
})

app.post('/api/food-logs', requireAuth, async (req, res) => {
  const { user_id, food_name, calories, protein, carbs, fat } = req.body
  if (!user_id || !food_name) {
    return res.status(400).json({ error: 'user_id and food_name are required' })
  }

  try {
    if (!(await verifyOwnership(req.authUser, user_id))) {
      return res.status(403).json({ error: req.t('data.forbiddenWrite') })
    }
  } catch (error) {
    return handleSupabaseError(res, error, req.t('data.ownershipCheckFailed'))
  }

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id,
      food_name,
      calories: wholeOrNull(calories),
      protein: wholeOrNull(protein),
      carbs: wholeOrNull(carbs),
      fat: wholeOrNull(fat),
    })
    .select()
    .single()

  if (error) return handleSupabaseError(res, error, req.t('data.foodSaveFailed'))
  res.status(201).json(data)
})

app.put('/api/food-logs/:id', requireAuth, (req, res) => {
  const { values, error } = readLogFields(req, 'food_name', {
    calories: optionalInteger,
    protein: optionalInteger,
    carbs: optionalInteger,
    fat: optionalInteger,
  })
  if (error) return res.status(400).json({ error })
  updateOwnLog(req, res, 'food_logs', values, 'data.foodSaveFailed')
})

app.delete('/api/food-logs/:id', requireAuth, (req, res) => deleteOwnLog(req, res, 'food_logs'))

// ---- โปรแกรมฝึก (routes/programs.js) ----
app.use('/api', createProgramsRouter({ supabase, requireAuth, handleSupabaseError }))

// ---- น้ำหนักตัวรายวัน (routes/weight.js) ----
app.use('/api', createWeightRouter({ supabase, requireAuth, handleSupabaseError }))

// ---- SupportFit AI Coach (routes/coach.js) ----
app.use('/api', createCoachRouter({ supabase, requireAuth, handleSupabaseError }))

// ---- SupportFit Community (routes/community.js) ----
app.use('/api', createCommunityRouter({ supabase, requireAuth, handleSupabaseError }))

// อัปเดต schema บน Supabase อัตโนมัติ (ถ้าตั้ง DATABASE_URL) แล้วเช็คว่าตาราง users พร้อมหรือยัง
async function prepareDatabase() {
  try {
    const { skipped } = await runMigrations()
    console.log(skipped ? '⚠️  ไม่พบ DATABASE_URL — ข้ามการอัปเดต schema อัตโนมัติ' : '✅ อัปเดต schema บน Supabase แล้ว')
  } catch (error) {
    console.error('❌ อัปเดต schema ไม่สำเร็จ:', error.message)
  }

  const { error } = await supabase.from('users').select('email').limit(1)
  if (error) console.error('❌ ฐานข้อมูลยังไม่พร้อม:', describeDbError(error, (key) => translate('th', key)))
  else console.log('✅ ฐานข้อมูลพร้อมใช้งาน (users.email)')
}

prepareDatabase().finally(() => {
  app.listen(PORT, () => {
    console.log(`SupportFit API listening on port ${PORT}`)
    if (!CORS_ORIGINS.length) console.warn("⚠️  ไม่ได้ตั้ง CORS_ORIGIN — อนุญาตทุก origin")
  })
})
