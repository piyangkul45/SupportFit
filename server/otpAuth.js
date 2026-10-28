require('dotenv').config()
const crypto = require('crypto')
const supabase = require('./supabaseClient')
const { hashPassword, verifyPassword } = require('./password')
const { renderOtpEmail, renderOtpText } = require('./emailTemplate')
const { translate } = require('./i18n')

const OTP_LENGTH = 6
const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5
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

// ส่งอีเมล OTP ผ่าน Resend API (HTTPS) ด้วย RESEND_API_KEY
// (Render แผน Free บล็อกพอร์ต SMTP จึงส่งผ่าน HTTPS แทน)
const RESEND_API_URL = 'https://api.resend.com/emails'
// ยังไม่ได้ยืนยันโดเมนกับ Resend ใช้ได้แค่ onboarding@resend.dev (ส่งถึงอีเมลเจ้าของบัญชี Resend เท่านั้น)
const RESEND_FROM = process.env.RESEND_FROM || 'SupportFit <onboarding@resend.dev>'

function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

// ---- OTP store (ตาราง otp_codes บน Supabase) ----
// 1 แถวต่ออีเมล: { email, code_hash, expires_at, sent_at, attempts } เก็บเฉพาะ hash ไม่เก็บรหัสจริง
// อยู่รอดแม้ server restart

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex')

function generateOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

async function findOtp(email) {
  const { data, error } = await supabase.from('otp_codes').select('*').eq('email', email).maybeSingle()
  if (error) throw error
  return data
}

async function deleteOtp(email) {
  const { error } = await supabase.from('otp_codes').delete().eq('email', email)
  if (error) throw error
}

async function getResendWaitSeconds(email) {
  const entry = await findOtp(email)
  if (!entry) return 0
  const sentAt = new Date(entry.sent_at).getTime()
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000))
}

// ข้อความทั้งหมดในอีเมลตามภาษาผู้ใช้ และจุดประสงค์ของรหัส: 'verify' (ยืนยันอีเมลตอนสมัคร) | 'reset' (รีเซ็ตรหัสผ่าน)
function buildEmailCopy({ lang, purpose, code, email }) {
  const t = (key, params) => translate(lang, `email.${key}`, params)
  const minutes = OTP_TTL_MS / 60000
  return {
    lang,
    subject: t(`${purpose}.subject`),
    heading: t(`${purpose}.heading`),
    intro: t(`${purpose}.intro`),
    preheader: t('preheader', { code, minutes }),
    codeLabel: t('codeLabel'),
    codeLine: t('codeLine', { code }),
    expiry: t('expiry', { minutes }),
    expiryText: t('expiryText', { minutes }),
    securityNote: t('securityNote'),
    ignoreNote: t('ignoreNote'),
    sentTo: t('sentTo', { email }),
  }
}

async function sendOtp(email, purpose = 'verify', lang = 'en') {
  const code = generateOtp()
  const now = Date.now()

  // บันทึกก่อนส่ง เพื่อให้ผู้ใช้ได้รหัสที่อยู่ในฐานข้อมูลแน่นอน ถ้าส่งไม่ผ่านจะลบทิ้ง (ไม่ติด cooldown)
  const { error } = await supabase.from('otp_codes').upsert({
    email,
    code_hash: hashCode(code),
    expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    sent_at: new Date(now).toISOString(),
    attempts: 0,
  })
  if (error) throw error

  try {
    await mailOtp(email, code, buildEmailCopy({ lang, purpose, code, email }))
  } catch (mailError) {
    await deleteOtp(email).catch(() => {})
    mailError.isMailError = true
    throw mailError
  }
}

async function mailOtp(email, code, copy) {
  if (!isMailConfigured()) throw new Error('RESEND_API_KEY is not set')
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: `${copy.subject}: ${code}`,
      text: renderOtpText({ copy }),
      html: renderOtpEmail({ code, copy }),
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    // Resend ตอบ { statusCode, name, message } เช่น ส่งถึงอีเมลอื่นตอนยังไม่ได้ยืนยันโดเมน
    const body = await response.json().catch(() => ({}))
    throw new Error(`Resend ${response.status}: ${body.message || response.statusText}`)
  }
}

// คืนค่า 'ok' | 'not_found' | 'expired' | 'too_many_attempts' | 'invalid'
async function verifyOtp(email, code) {
  const entry = await findOtp(email)
  if (!entry) return 'not_found'
  if (Date.now() > new Date(entry.expires_at).getTime()) {
    await deleteOtp(email)
    return 'expired'
  }
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(email)
    return 'too_many_attempts'
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(entry.code_hash, 'hex'),
    Buffer.from(hashCode(code), 'hex')
  )
  if (!matches) {
    const { error } = await supabase
      .from('otp_codes')
      .update({ attempts: entry.attempts + 1 })
      .eq('email', email)
    if (error) throw error
    return 'invalid'
  }

  await deleteOtp(email)
  return 'ok'
}

// ล้าง OTP ที่หมดอายุแล้วทุก 10 นาที กันตารางโต
setInterval(() => {
  supabase
    .from('otp_codes')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .then(({ error }) => error && console.error('ล้าง OTP หมดอายุไม่สำเร็จ:', error.message))
}, 10 * 60 * 1000).unref()

// ---- Session token ----
// รูปแบบ <payload base64url>.<HMAC-SHA256 base64url> คล้าย JWT แต่ไม่ต้องพึ่ง library เพิ่ม
function sign(data) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url')
}

// ลายนิ้วมือของ password_hash ปัจจุบัน ฝังไว้ใน token (pv) แล้ว requireAuth เทียบกับค่าในฐานข้อมูลทุก request
// เมื่อเปลี่ยน/รีเซ็ตรหัสผ่าน hash เปลี่ยน -> token เก่าทุกอันบนทุกอุปกรณ์ใช้ไม่ได้ทันที (ไม่ต้องมีตาราง session)
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
  OTP_LENGTH,
  isMailConfigured,
  getResendWaitSeconds,
  sendOtp,
  verifyOtp,
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isSessionCurrent,
  RESEND_COOLDOWN_SECONDS: RESEND_COOLDOWN_MS / 1000,
}
