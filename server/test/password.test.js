// ทดสอบมาตรฐาน hash รหัสผ่าน: hash ที่บันทึกไว้แล้วต้องตรวจผ่านตลอดไป ไม่ว่าจะ restart/deploy/เปลี่ยนโค้ด
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { hashPassword, verifyPassword } = require('../password')

const PASSWORD = 'Fit@รหัส2026'

// hash จริงที่สร้างไว้ครั้งเดียวแล้วฝังไว้ (เหมือนแถวใน users.password_hash ของผู้ใช้เดิม)
// ถ้าเทสต์นี้พัง = การเปลี่ยนแปลงล่าสุดจะทำให้ผู้ใช้เดิมล็อกอินไม่ได้ ห้ามแก้ค่าเหล่านี้
const STORED_HASHES = {
  bcrypt_2b: '$2b$10$HPuPOdeal2glBc/P3DQ6BuR4eTbda23EwuFhaWwG.TJPTNfnvu/7a',
  bcrypt_2a: '$2a$10$xL/Nkv5KY53w3s0NTUNQou8gd4A38.p0/fAvz2MpwDjLQwH1lrG8y',
  legacy_scrypt:
    'scrypt$00112233445566778899aabbccddeeff$ee634d925c1bd2a16b0ccf2623daeab51a93ba26e2819b8bed02ebcec695a709bb3bf81b2f28ddf9ebfe272fe2c8500e50a6febd271e7d1d9f2c5026aabb69f4',
}

describe('stored hashes from existing users keep working', () => {
  for (const [format, stored] of Object.entries(STORED_HASHES)) {
    test(`${format}: correct password`, async () => {
      assert.equal(await verifyPassword(PASSWORD, stored), true)
    })
    test(`${format}: wrong password`, async () => {
      assert.equal(await verifyPassword('Fit@รหัส2025', stored), false)
      assert.equal(await verifyPassword(` ${PASSWORD}`, stored), false)
    })
  }
})

describe('sign up -> login', () => {
  test('new hashes are bcrypt and verify', async () => {
    const stored = await hashPassword(PASSWORD)
    assert.match(stored, /^\$2[ab]\$10\$/)
    assert.equal(await verifyPassword(PASSWORD, stored), true)
    assert.equal(await verifyPassword('wrong-password', stored), false)
  })

  test('hash still verifies after a server restart (fresh module, no shared state)', async () => {
    const stored = await hashPassword(PASSWORD)
    const modulePath = require.resolve('../password')
    delete require.cache[modulePath]
    const restarted = require('../password')
    assert.equal(await restarted.verifyPassword(PASSWORD, stored), true)
  })

  test('does not depend on AUTH_SECRET', async () => {
    const previous = process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'secret-a'
    const stored = await hashPassword(PASSWORD)
    process.env.AUTH_SECRET = 'secret-b'
    try {
      assert.equal(await verifyPassword(PASSWORD, stored), true)
    } finally {
      if (previous === undefined) delete process.env.AUTH_SECRET
      else process.env.AUTH_SECRET = previous
    }
  })

  test('missing or malformed hash never verifies', async () => {
    for (const stored of [null, undefined, '', 'plain-text', 'scrypt$', 'scrypt$zz$', PASSWORD]) {
      assert.equal(await verifyPassword(PASSWORD, stored), false)
    }
  })
})
