import i18n from '../i18n'

const API_ORIGIN =import.meta.env.VITE_API_URL || 'http://localhost:5000'
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

  return res.json()
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

export const getWorkoutLogs = (userId) => request(`/workout-logs?user_id=${userId}`)

export const createWorkoutLog = (data) =>
  request('/workout-logs', { method: 'POST', body: JSON.stringify(data) })

export const getFoodLogs = (userId) => request(`/food-logs?user_id=${userId}`)

export const createFoodLog = (data) =>
  request('/food-logs', { method: 'POST', body: JSON.stringify(data) })
