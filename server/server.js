require('dotenv').config()
const express = require('express')
const cors = require('cors')
const supabase = require('./supabaseClient')
const otpAuth = require('./otpAuth')
const { runMigrations } = require('./migrate')
const { i18nMiddleware, translate } = require('./i18n')

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
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

// ---- Auth (Custom OTP ทางอีเมล) ----
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// ข้อความ error เมื่อ schema บน Supabase ยังไม่อัปเดต (ยังไม่ได้รัน migrate.js)
// t = req.t ของ request นั้น (หรือ translate ภาษาใดภาษาหนึ่งตอน start server)
function describeDbError(error, t) {
  if (/users\.email does not exist|otp_codes/i.test(error?.message || '')) {
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

// สุ่ม OTP 6 หลัก (หมดอายุใน 5 นาที) ส่งผ่าน Gmail SMTP แล้วคืน { status, body } ให้ route ตอบกลับ
// ใช้ร่วมกันทั้งตอนสมัคร, ขอรหัสใหม่, ล็อกอินด้วยบัญชีที่ยังไม่ยืนยันอีเมล และลืมรหัสผ่าน (purpose = 'reset')
// req ใช้เลือกภาษาของข้อความตอบกลับและของอีเมล
async function issueOtp(req, email, purpose = 'verify') {
  const { t } = req
  if (!otpAuth.isMailConfigured()) {
    return { status: 500, body: { error: t('mail.notConfigured') } }
  }

  try {
    const waitSeconds = await otpAuth.getResendWaitSeconds(email)
    if (waitSeconds > 0) {
      return {
        status: 429,
        body: { error: t('otp.waitBeforeResend', { seconds: waitSeconds }), retryAfter: waitSeconds },
      }
    }

    await otpAuth.sendOtp(email, purpose, req.lang)
    return { status: 200, body: { message: t('otp.sent', { email }), expiresIn: 300 } }
  } catch (error) {
    console.error('send-otp failed:', error)
    if (error.isMailError) {
      return { status: 502, body: { error: t('mail.sendFailed') } }
    }
    return { status: 500, body: { error: describeDbError(error, t) || t('mail.genericSendFailed') } }
  }
}

// สมัครสมาชิก: บันทึกอีเมล + password (hash) เป็นบัญชีที่ยังไม่ยืนยัน (is_verified = false) แล้วส่ง OTP
// ถ้าอีเมลนี้มีอยู่แล้วแต่ยังไม่ยืนยัน หรือเป็นบัญชีเดิมจาก Supabase Auth ที่ยังไม่มี password
// จะตั้ง password ใหม่ให้แถวเดิม (ข้อมูล workout/food เดิมยังอยู่ครบ)
app.post('/api/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim()
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: req.t('validation.invalidEmail') })
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: req.t('validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH }) })
  }

  try {
    const existing = await findUserByEmail(email)
    if (existing?.is_verified && existing.password_hash) {
      return res.status(409).json({ error: req.t('auth.emailTaken') })
    }

    const password_hash = await otpAuth.hashPassword(password)
    const { error } = existing
      ? await supabase
          .from('users')
          .update({ password_hash, ...(name ? { name } : {}) })
          .eq('id', existing.id)
      : await supabase
          .from('users')
          .insert({ email, name: name || email.split('@')[0], password_hash, is_verified: false })
    if (error) throw error
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: describeDbError(error, req.t) || req.t('auth.signupFailed') })
  }

  const { status, body } = await issueOtp(req, email)
  res.status(status).json(body)
})

// ขอรหัส OTP ใหม่ (ปุ่ม Resend) ใช้ได้เฉพาะอีเมลที่สมัครไว้แล้ว
app.post('/api/send-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: req.t('validation.invalidEmail') })

  try {
    const user = await findUserByEmail(email)
    if (!user?.password_hash) {
      return res.status(404).json({ error: req.t('auth.noSignup') })
    }
    if (user.is_verified) {
      return res.status(409).json({ error: req.t('auth.alreadyVerified') })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: describeDbError(error, req.t) || req.t('mail.genericSendFailed') })
  }

  const { status, body } = await issueOtp(req, email)
  res.status(status).json(body)
})

// เข้าสู่ระบบด้วยอีเมล + password ถ้ายังไม่ได้ยืนยันอีเมล จะส่ง OTP ให้แล้วตอบ 403 (reason: unverified)
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

  if (!user?.password_hash || !(await otpAuth.verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: req.t('auth.wrongCredentials') })
  }

  if (!user.is_verified) {
    const { status, body } = await issueOtp(req, email)
    if (status !== 200 && status !== 429) return res.status(status).json(body)
    return res.status(403).json({
      error: req.t('auth.unverified'),
      reason: 'unverified',
      retryAfter: body.retryAfter ?? 60,
    })
  }

  res.json({ token: otpAuth.createSessionToken(user), user: publicUser(user) })
})

// [HTTP status, message key ใน i18n.js]
const OTP_FAILURES = {
  invalid: [400, 'otp.invalid'],
  expired: [410, 'otp.expired'],
  not_found: [410, 'otp.notFound'],
  too_many_attempts: [429, 'otp.tooManyAttempts'],
}

// ตรวจสอบ OTP ถ้าถูกต้องและยังไม่หมดอายุ -> ตั้ง is_verified = true แล้วออก session token
app.post('/api/verify-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const code = String(req.body?.code || '').trim()
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: req.t('validation.emailAndCodeRequired'), reason: 'invalid' })
  }

  try {
    const result = await otpAuth.verifyOtp(email, code)
    if (result !== 'ok') {
      const [status, messageKey] = OTP_FAILURES[result]
      return res.status(status).json({ error: req.t(messageKey), reason: result })
    }

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('email', email)
      .select()
      .maybeSingle()
    if (updateError) throw updateError
    if (!user) {
      return res.status(404).json({ error: req.t('auth.noSignup') })
    }

    res.json({ token: otpAuth.createSessionToken(user), user: publicUser(user) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: describeDbError(error, req.t) || req.t('auth.loginFailed') })
  }
})

// ---- Forgot / Reset password ----
// หาผู้ใช้และส่ง OTP เบื้องหลัง หลังตอบ client ไปแล้ว เพื่อให้เวลาตอบกลับเท่ากันไม่ว่าจะมีบัญชีหรือไม่
// (req ใช้เลือกภาษาของอีเมล)
async function sendResetOtpInBackground(req, email) {
  try {
    const user = await findUserByEmail(email)
    if (!user?.is_verified) return
    const { status, body } = await issueOtp(req, email, 'reset')
    if (status !== 200 && status !== 429) console.error('forgot-password: ส่ง OTP ไม่สำเร็จ', status, body.error)
  } catch (error) {
    console.error('forgot-password:', error)
  }
}

// ขอรหัส OTP สำหรับตั้งรหัสผ่านใหม่ ส่งจริงเฉพาะบัญชีที่ยืนยันอีเมลแล้ว แต่ตอบเหมือนกันทุกกรณี
app.post('/api/auth/forgot-password', (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: req.t('validation.invalidEmail') })
  // เช็คก่อนแตะข้อมูลผู้ใช้ จึงไม่เปิดเผยว่าอีเมลนี้มีบัญชีหรือไม่
  if (!otpAuth.isMailConfigured()) {
    return res.status(500).json({ error: req.t('mail.unavailable') })
  }

  // ข้อความเดียวกันทุกกรณี (มี/ไม่มีบัญชี, ยังไม่ยืนยัน, ติด cooldown) กันการไล่เช็คว่าอีเมลไหนมีบัญชี
  res.json({
    message: req.t('auth.forgotPasswordSent'),
    expiresIn: 300,
    retryAfter: otpAuth.RESEND_COOLDOWN_SECONDS,
  })
  sendResetOtpInBackground(req, email)
})

// ตรวจ OTP แล้วตั้งรหัสผ่านใหม่ (bcrypt) รหัส OTP ถูกลบทันทีเมื่อใช้สำเร็จ
app.post('/api/auth/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const code = String(req.body?.otp || '').trim()
  const newPassword = String(req.body?.newPassword || '')
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: req.t('validation.emailAndCodeRequired'), reason: 'invalid' })
  }
  // ตรวจ password ก่อนตรวจ OTP เพื่อไม่ให้รหัส OTP ถูกนับครั้งผิด/ถูกใช้ไปเพราะ password สั้นเกิน
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: req.t('validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH }) })
  }

  try {
    // อีเมลที่ไม่มีบัญชีตอบเหมือน "ไม่พบรหัส" ทุกประการ ไม่บอกว่าบัญชีมีอยู่หรือไม่
    const user = await findUserByEmail(email)
    if (!user?.is_verified) {
      const [status, messageKey] = OTP_FAILURES.not_found
      return res.status(status).json({ error: req.t(messageKey), reason: 'not_found' })
    }

    const result = await otpAuth.verifyOtp(email, code)
    if (result !== 'ok') {
      const [status, messageKey] = OTP_FAILURES[result]
      return res.status(status).json({ error: req.t(messageKey), reason: result })
    }

    const { error } = await supabase
      .from('users')
      .update({ password_hash: await otpAuth.hashPassword(newPassword) })
      .eq('id', user.id)
    if (error) throw error

    // password_hash เปลี่ยนแล้ว -> session token เดิมทุกอุปกรณ์ใช้ไม่ได้อีก (ดู requireAuth)
    res.json({ message: req.t('auth.passwordResetDone') })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: describeDbError(error, req.t) || req.t('auth.passwordResetFailed') })
  }
})

// ตรวจสอบ session token จาก header Authorization: Bearer <token>
// เทียบลายนิ้วมือรหัสผ่านใน token กับฐานข้อมูล (token ที่ออกก่อนเปลี่ยนรหัสผ่านจะถูกปฏิเสธ)
// แล้วแนบ req.authUser ({ uid, email }) ไว้ให้ route ถัดไปใช้
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: req.t('auth.noToken') })

  const session = otpAuth.verifySessionToken(token)
  if (!session) return res.status(401).json({ error: req.t('auth.sessionExpired') })

  const { data: user, error } = await supabase
    .from('users')
    .select('password_hash, is_verified')
    .eq('id', session.uid)
    .maybeSingle()
  if (error) return handleSupabaseError(res, error, req.t('auth.sessionCheckFailed'))
  if (!user?.is_verified || !otpAuth.isSessionCurrent(session, user.password_hash)) {
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

  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (error) return handleSupabaseError(res, error, req.t('data.workoutLoadFailed'))
  res.json(data)
})

app.post('/api/workout-logs', requireAuth, async (req, res) => {
  const { user_id, exercise_name, weight_kg, reps, sets, rpe } = req.body
  if (!user_id || !exercise_name) {
    return res.status(400).json({ error: 'user_id and exercise_name are required' })
  }

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

// ---- Food logs ----
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

  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
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
      calories: calories ?? null,
      protein: protein ?? null,
      carbs: carbs ?? null,
      fat: fat ?? null,
    })
    .select()
    .single()

  if (error) return handleSupabaseError(res, error, req.t('data.foodSaveFailed'))
  res.status(201).json(data)
})

// อัปเดต schema บน Supabase อัตโนมัติ (ถ้าตั้ง DATABASE_URL) แล้วเช็คว่าตาราง/คอลัมน์ที่ระบบ OTP ใช้พร้อมหรือยัง
async function prepareDatabase() {
  try {
    const { skipped } = await runMigrations()
    console.log(skipped ? '⚠️  ไม่พบ DATABASE_URL — ข้ามการอัปเดต schema อัตโนมัติ' : '✅ อัปเดต schema บน Supabase แล้ว')
  } catch (error) {
    console.error('❌ อัปเดต schema ไม่สำเร็จ:', error.message)
  }

  const checks = await Promise.all([
    supabase.from('users').select('email').limit(1),
    supabase.from('otp_codes').select('email').limit(1),
  ])
  const failed = checks.find(({ error }) => error)
  if (failed) console.error('❌ ฐานข้อมูลยังไม่พร้อมสำหรับระบบ OTP:', describeDbError(failed.error, (key) => translate('th', key)))
  else console.log('✅ ฐานข้อมูลพร้อมใช้งาน (users.email, otp_codes)')
}

prepareDatabase().finally(() => {
  app.listen(PORT, () => {
    console.log(`SupportFit API listening on http://localhost:${PORT}`)
  })
})
