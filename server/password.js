// Hash/ตรวจรหัสผ่าน — มาตรฐานเดียวที่ใช้ทั้ง Sign up, Login และ Reset password
//
// hash เก็บใน users.password_hash (ฐานข้อมูล) ทั้งหมด ไม่ขึ้นกับ AUTH_SECRET หรือค่าใด ๆ ในหน่วยความจำ
// ผู้ใช้เดิมจึงล็อกอินได้เสมอแม้ server จะ restart/deploy ใหม่ หรือเปลี่ยน AUTH_SECRET
// (AUTH_SECRET มีผลแค่ session token เท่านั้น)
//
// รูปแบบที่รองรับ (test/password.test.js ล็อกไว้ด้วย hash จริง ห้ามเลิกรองรับรูปแบบไหนที่เคยบันทึกไปแล้ว):
//   bcrypt  $2a$/$2b$<cost>$...   ใช้กับ hash ใหม่ทั้งหมด (cost ฝังอยู่ใน hash เปลี่ยน BCRYPT_ROUNDS ได้
//                                 โดยไม่กระทบ hash เดิม)
//   scrypt  scrypt$<salt>$<hash>  รูปแบบเก่าก่อนเปลี่ยนมาใช้ bcrypt (ตรวจได้อย่างเดียว)
// รหัสผ่านใช้ตามที่ผู้ใช้พิมพ์ทุกตัวอักษร (ไม่ trim/normalize) ทั้งตอน hash และตอนตรวจ

const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const BCRYPT_ROUNDS = 10
const SCRYPT_KEYLEN = 64

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS)
}

async function verifyPassword(password, stored) {
  const value = String(stored || '')
  if (value.startsWith('$2')) return bcrypt.compare(String(password), value)

  const [scheme, saltHex, hashHex] = value.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const key = await scryptAsync(String(password), Buffer.from(saltHex, 'hex'))
  const expected = Buffer.from(hashHex, 'hex')
  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}

module.exports = { hashPassword, verifyPassword }
