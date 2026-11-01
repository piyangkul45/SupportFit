// บัญชี Demo สำหรับนำเสนอโปรเจกต์ (ชั่วคราว): กดปุ่มเดียวเข้า Dashboard พร้อมข้อมูลตัวอย่าง
//
// เปิดด้วย DEMO_LOGIN_ENABLED=true และ SKIP_EMAIL_OTP=true ข้าม OTP ตอนสมัคร/ล็อกอิน (ไม่ตั้ง = ปิด)
// session ของ demo เป็น token จริงของบัญชีนี้บัญชีเดียว เพราะทุก API ตรวจ token ฝั่ง server
// รหัสผ่านของบัญชีนี้เป็นค่าสุ่มที่ไม่มีใครรู้ เข้าได้ทางปุ่ม Demo เท่านั้น

const crypto = require('crypto')

const DEMO_EMAIL = 'demo@supportfit.invalid'
const SEED_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const isDemoLoginEnabled = () => process.env.DEMO_LOGIN_ENABLED === 'true'
const isOtpSkipped = () => process.env.SKIP_EMAIL_OTP === 'true'

// ข้าม OTP ตอนสมัครได้เฉพาะอีเมลใหม่ หรือแถวที่เคยสมัครค้างไว้ (มี password แต่ยังไม่ยืนยัน)
// แถวเดิมจาก Supabase Auth ไม่มี password แต่มีข้อมูลอยู่ ต้องพิสูจน์ด้วย OTP ไม่งั้นใครก็ตั้งรหัสแล้วเข้าบัญชีได้
const canSkipSignupOtp = (existing) => isOtpSkipped() && (!existing || Boolean(existing.password_hash))

// โปรไฟล์คนน้ำหนัก 72 กก. เป้าหมายเพิ่มกล้าม (เป้าหมายรายวันคำนวณแบบเดียวกับ client/src/utils/macroCalculator.js)
const DEMO_PROFILE = {
  name: 'Demo User',
  is_verified: true,
  is_onboarded: true,
  age: 28,
  gender: 'male',
  height_cm: 175,
  weight_kg: 72,
  activity_level: 'moderate',
  fitness_goal: 'gain_muscle',
  target_calories: 2902,
  target_protein: 144,
  target_carbs: 399,
  target_fat: 81,
}

const MEALS = [
  { food_name: 'ข้าวไข่เจียว', calories: 520, protein: 22, carbs: 58, fat: 22 },
  { food_name: 'ข้าวอกไก่ย่าง', calories: 610, protein: 45, carbs: 72, fat: 12 },
  { food_name: 'แซลมอนย่างกับมันเทศ', calories: 680, protein: 42, carbs: 55, fat: 28 },
  { food_name: 'เวย์โปรตีน', calories: 130, protein: 25, carbs: 4, fat: 2 },
]

// หมุนเวียนตามวัน [ชื่อท่า, น้ำหนัก, ครั้ง, เซต, แคลอรี]
const WORKOUT_DAYS = [
  [['Squat', 70, 8, 4, 28], ['Leg Press', 110, 10, 3, 21]],
  [['Bench Press', 55, 8, 4, 24], ['Overhead Press', 32.5, 10, 3, 18]],
  [['Deadlift', 90, 5, 4, 28], ['Barbell Row', 50, 10, 3, 21]],
]

function workoutRows(userId, dayOffset, createdAt) {
  const progress = (SEED_DAYS - dayOffset) * 0.5 // น้ำหนักค่อย ๆ เพิ่ม กราฟ Progressive Overload จะได้ขึ้น
  return WORKOUT_DAYS[dayOffset % WORKOUT_DAYS.length].map(([exercise_name, base, reps, sets, calories_burned]) => {
    const weight_kg = base + progress
    return {
      user_id: userId,
      exercise_name,
      weight_kg,
      reps,
      sets,
      activity_type: 'strength',
      calories_burned,
      estimated_1rm: weight_kg * (1 + reps / 30),
      volume_load: weight_kg * reps * sets,
      created_at: createdAt,
    }
  })
}

const dateOf = (time) => new Date(time).toISOString().slice(0, 10)

// เติมข้อมูลของวันที่ยังไม่มี (ย้อนหลัง SEED_DAYS วัน) กดซ้ำวันเดิมไม่เพิ่มแถว และวันถัดไปกดอีกจะมีข้อมูลของวันนั้น
// วันนี้ใช้เวลาย้อนหลังจากปัจจุบัน ไม่มีแถวที่ created_at อยู่ในอนาคต
async function seedDemoData(supabase, userId, now = Date.now()) {
  const since = new Date(now - SEED_DAYS * DAY_MS).toISOString()
  const { data: existing, error } = await supabase.from('food_logs').select('created_at').eq('user_id', userId).gte('created_at', since)
  if (error) throw error
  const seededDays = new Set(existing.map((row) => dateOf(row.created_at)))

  const foods = []
  const workouts = []
  const weights = []
  for (let dayOffset = 0; dayOffset < SEED_DAYS; dayOffset++) {
    const day = now - dayOffset * DAY_MS
    if (seededDays.has(dateOf(day))) continue
    MEALS.forEach((meal, index) => {
      foods.push({ user_id: userId, ...meal, created_at: new Date(day - (index + 1) * HOUR_MS).toISOString() })
    })
    if (dayOffset % 7 !== 6) workouts.push(...workoutRows(userId, dayOffset, new Date(day - HOUR_MS).toISOString())) // พัก 1 วันต่อสัปดาห์
    weights.push({ user_id: userId, weight_kg: Math.round((DEMO_PROFILE.weight_kg - dayOffset * 0.05) * 10) / 10, logged_on: dateOf(day) })
  }
  if (!foods.length) return { days: 0 }

  const results = await Promise.all([
    supabase.from('food_logs').insert(foods),
    supabase.from('workout_logs').insert(workouts),
    supabase.from('weight_logs').upsert(weights, { onConflict: 'user_id,logged_on' }),
  ])
  const failed = results.find((result) => result.error)
  if (failed) throw failed.error
  return { days: weights.length }
}

// คืนแถว users ของบัญชี Demo (ไม่มี = สร้างใหม่)
async function ensureDemoUser(supabase, hashPassword) {
  const { data: user, error } = await supabase.from('users').select('*').eq('email', DEMO_EMAIL).maybeSingle()
  if (error) throw error
  if (user) return user

  const password_hash = await hashPassword(crypto.randomBytes(32).toString('hex'))
  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({ email: DEMO_EMAIL, password_hash, ...DEMO_PROFILE })
    .select()
    .single()
  if (createError) throw createError
  return created
}

module.exports = { DEMO_EMAIL, DEMO_PROFILE, SEED_DAYS, isDemoLoginEnabled, isOtpSkipped, canSkipSignupOtp, ensureDemoUser, seedDemoData }
