require('dotenv').config()
const crypto = require('crypto')
const { hashPassword, verifyPassword } = require('./password')

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// AUTH_SECRET ใช้เซ็น session token ถ้าไม่ได้ตั้งไว้จะสุ่มใหม่ทุกครั้งที่ start server
// (ใช้งานได้ แต่ผู้ใช้ทุกคนจะถูก logout เมื่อ server restart)
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET is required in production (sessions would reset on every restart)')
}
if (!process.env.AUTH_SECRET) {
  console.warn('⚠️  ไม่พบ AUTH_SECRET ใน server/.env — ใช้คีย์ชั่วคราว (session จะหายเมื่อ restart)')
}

// ---- Session token ----
// รูปแบบ <payload base64url>.<HMAC-SHA256 base64url> คล้าย JWT แต่ไม่ต้องพึ่ง library เพิ่ม
function sign(data) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url')
}

// ลายนิ้วมือของ password_hash ปัจจุบัน ฝังไว้ใน token (pv) แล้ว requireAuth เทียบกับค่าในฐานข้อมูลทุก request
// เมื่อเปลี่ยนรหัสผ่าน hash เปลี่ยน -> token เก่าทุกอันบนทุกอุปกรณ์ใช้ไม่ได้ทันที (ไม่ต้องมีตาราง session)
function passwordFingerprint(passwordHash) {
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`pv:${passwordHash || ''}`)
    .digest('base64url')
    .slice(0, 22)
}

function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.id,
      email: user.email,
      pv: passwordFingerprint(user.password_hash),
      exp: Date.now() + SESSION_TTL_MS,
    })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

// token ยังตรงกับรหัสผ่านปัจจุบันของผู้ใช้หรือไม่ (เทียบแบบ constant-time)
function isSessionCurrent(session, passwordHash) {
  const expected = Buffer.from(passwordFingerprint(passwordHash))
  const actual = Buffer.from(String(session?.pv || ''))
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function verifySessionToken(token) {
  const [payload, signature] = String(token).split('.')
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp > Date.now() ? data : null
  } catch {
    return null
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isSessionCurrent,
}
