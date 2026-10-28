import i18n from '../i18n'

// ค่าเริ่มต้นเป็น '' = เรียก /api บน origin เดียวกับหน้าเว็บ (Vite proxy ต่อไปที่ backend)
// ใช้ได้ทั้ง localhost, IP ในวง LAN และ tunnel HTTPS ตั้ง VITE_API_URL เฉพาะเมื่อ backend อยู่คนละที่
const API_ORIGIN = import.meta.env.VITE_API_URL || ''
const BASE_URL = `${API_ORIGIN}/api`

const SESSION_KEY = 'supportfit_session'
export const SESSION_EXPIRED_EVENT = 'supportfit:session-expired'

export function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null
  } catch {
    return null
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

function authHeaders() {
  const token = readStoredSession()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    // server ใช้เลือกภาษาของข้อความ error และอีเมล OTP ให้ตรงกับภาษาที่ผู้ใช้เลือก
    'Accept-Language': i18n.resolvedLanguage || 'en',
    ...authHeaders(),
    ...(options.headers || {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 && headers.Authorization) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    const error = new Error(body.error || `Request failed: ${res.status}`)
    Object.assign(error, { status: res.status, reason: body.reason, retryAfter: body.retryAfter })
    throw error
  }

  return res.status === 204 ? null : res.json()
}

// ---- Auth (Email + Password + OTP) ----
// สมัครสมาชิก: บันทึกบัญชี (ยังไม่ยืนยัน) แล้ว server ส่ง OTP ไปที่อีเมล
export const signup = ({ name, email, password }) =>
  request('/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) })

// สำเร็จจะได้ { token, user } ถ้ายังไม่ยืนยันอีเมลจะ throw error ที่มี reason = 'unverified'
export const login = (email, password) =>
  request('/login', { method: 'POST', body: JSON.stringify({ email, password }) })

// ขอรหัส OTP ใหม่ (ปุ่ม Resend)
export const resendOtp = (email) =>
  request('/send-otp', { method: 'POST', body: JSON.stringify({ email }) })

// ลืมรหัสผ่าน: ขอ OTP ไปที่อีเมล แล้วตั้งรหัสผ่านใหม่ด้วย OTP นั้น
export const forgotPassword = (email) =>
  request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })

export const resetPassword = ({ email, otp, newPassword }) =>
  request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) })

// สำเร็จจะได้ { token, user } กลับมา
export const verifyOtp = (email, code) =>
  request('/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) })

// โปรไฟล์ผู้ใช้ (ตาราง users) ของบัญชีที่ล็อกอินอยู่
export const getMe = () => request('/users/me', { method: 'POST' })

// บันทึกข้อมูลร่างกาย + เป้าหมายรายวัน (Onboarding / Profile Settings) คืนโปรไฟล์ที่อัปเดตแล้ว
export const updateProfile = (data) =>
  request('/users/me/profile', { method: 'PUT', body: JSON.stringify(data) })

// แปลงข้อความจากเสียง/พิมพ์เป็น { type: 'workout' | 'food', ..., source: 'local' | 'gemini' } (422 = ไม่เข้าใจคำสั่ง)
// server ใช้ parser ในเครื่องก่อน แยกได้ไม่ครบจึงถาม Gemini (server/parser/hybrid.js)
// exerciseHint: ท่าที่เลือกไว้ในตารางฝึกวันนี้ ใช้เมื่อพูดแค่ตัวเลข ("100 kg 8 reps")
export const parseCommand = (text, exerciseHint) =>
  request('/parse-voice', { method: 'POST', body: JSON.stringify({ text, exercise_hint: exerciseHint || undefined }) })

// AI Meal Logger: ข้อความว่ากินอะไรไป -> { items: [{ name, calories, protein_g, carbs_g, fat_g }] } (Gemini ฝั่ง server)
// ยังไม่บันทึก ให้ผู้ใช้ตรวจก่อนแล้วบันทึกด้วย createFoodLog (422 = ไม่พบอาหาร, 503 = ไม่ได้ตั้ง GEMINI_API_KEY)
export const analyzeMeal = (text) => request('/meals/analyze', { method: 'POST', body: JSON.stringify({ text }) })

// รูปอาหาร (Gemini Vision): image = base64 ไม่มี prefix data: ; note = ข้อความเสริม (ไม่บังคับ) -> { items } เหมือน analyzeMeal
export const analyzeMealImage = ({ image, mimeType, note }) =>
  request('/meals/analyze-image', { method: 'POST', body: JSON.stringify({ image, mime_type: mimeType, note: note || undefined }) })

// since (ISO timestamp, ไม่บังคับ) = เฉพาะรายการตั้งแต่เวลานั้น (หน้าสถิติโหลดตามช่วงที่เลือก)
const sinceParam = (since) => (since ? `&since=${encodeURIComponent(since)}` : '')

export const getWorkoutLogs = (userId, since) => request(`/workout-logs?user_id=${userId}${sinceParam(since)}`)

export const createWorkoutLog = (data) =>
  request('/workout-logs', { method: 'POST', body: JSON.stringify(data) })

export const updateWorkoutLog = (id, data) =>
  request(`/workout-logs/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteWorkoutLog = (id) => request(`/workout-logs/${id}`, { method: 'DELETE' })

export const getFoodLogs = (userId, since) => request(`/food-logs?user_id=${userId}${sinceParam(since)}`)

export const createFoodLog = (data) =>
  request('/food-logs', { method: 'POST', body: JSON.stringify(data) })

export const updateFoodLog = (id, data) =>
  request(`/food-logs/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteFoodLog = (id) => request(`/food-logs/${id}`, { method: 'DELETE' })

// ---- น้ำหนักตัวรายวัน (หน้า "สถิติ") ----
// [{ id, weight_kg, logged_on }] ย้อนหลัง days วันนับจาก today (วันที่ตามเครื่องผู้ใช้) เรียงเก่าไปใหม่
export const getWeightLogs = (days, today) =>
  request(`/weight-logs?days=${days}&today=${encodeURIComponent(today)}`)

// บันทึกซ้ำวันเดิม = แก้ค่าเดิม คืน { log, profile_weight_kg } (profile_weight_kg != null = อัปเดตน้ำหนักในโปรไฟล์แล้ว)
export const saveWeightLog = (weightKg, loggedOn) =>
  request('/weight-logs', { method: 'POST', body: JSON.stringify({ weight_kg: weightKg, logged_on: loggedOn }) })

export const deleteWeightLog = (id) => request(`/weight-logs/${id}`, { method: 'DELETE' })

// ---- โปรแกรมฝึก ----
// { programs: [...preset, ...ของผู้ใช้], active: { program_id, started_on } | null, db_ready }
export const getPrograms = () => request('/programs')

export const createProgram = (data) => request('/programs', { method: 'POST', body: JSON.stringify(data) })

export const updateProgram = (id, data) =>
  request(`/programs/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ให้ AI (Gemini ฝั่ง server) ออกแบบโปรแกรมแล้วบันทึกเป็นโปรแกรมของฉัน คืนโปรแกรมที่สร้าง
// { days_per_week: 2-6, equipment: ['barbell'|'dumbbell'|'machine'|'kettlebell'], goal, level }
export const generateProgram = (data) => request('/programs/generate', { method: 'POST', body: JSON.stringify(data) })

export const deleteProgram = (id) => request(`/programs/${id}`, { method: 'DELETE' })

// programId = null คือเลิกใช้โปรแกรม; วันที่ตามเครื่องผู้ใช้ = วันแรกของรอบ
export const setActiveProgram = (programId, startedOn) =>
  request('/users/me/active-program', {
    method: 'POST',
    body: JSON.stringify({ program_id: programId, started_on: startedOn }),
  })

// { program, active, today: { date, day_number, cycle_length, week, is_rest_day, day } } หรือ { program: null }
export const getTodayRoutine = (date) =>
  request(`/users/me/active-program/today?date=${encodeURIComponent(date)}`)

// ชื่อท่ามาตรฐาน (ค้นได้ทั้งชื่ออังกฤษและ alias ไทย)
export const searchExercises = (query) => request(`/exercises?q=${encodeURIComponent(query)}`)
