// ทดสอบบัญชี Demo และเงื่อนไขการข้าม OTP (ไม่แตะฐานข้อมูลจริง)
// รัน: npm test
const { test, describe, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { DEMO_EMAIL, SEED_DAYS, canSkipSignupOtp, isDemoLoginEnabled, ensureDemoUser, seedDemoData } = require('../demo/account')

// เก็บแถวที่ insert/upsert ไว้ใน tables และตอบ select จาก food_logs
function fakeSupabase(tables = {}) {
  const rowsOf = (table) => (tables[table] ??= [])
  return {
    tables,
    from(table) {
      return {
        select() {
          return {
            eq: (column, value) => ({
              gte: async () => ({ data: rowsOf(table).filter((row) => row[column] === value), error: null }),
              maybeSingle: async () => ({ data: rowsOf(table).find((row) => row[column] === value) ?? null, error: null }),
            }),
          }
        },
        async insert(rows) {
          rowsOf(table).push(...rows)
          return { error: null }
        },
        async upsert(rows) {
          rowsOf(table).push(...rows)
          return { error: null }
        },
      }
    },
  }
}

const NOW = Date.parse('2026-11-02T12:00:00Z')

describe('feature flags', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  test('both are off unless set to exactly "true"', () => {
    delete process.env.DEMO_LOGIN_ENABLED
    delete process.env.SKIP_EMAIL_OTP
    assert.equal(isDemoLoginEnabled(), false)
    assert.equal(canSkipSignupOtp(null), false)
    process.env.DEMO_LOGIN_ENABLED = '1'
    assert.equal(isDemoLoginEnabled(), false)
    process.env.DEMO_LOGIN_ENABLED = 'true'
    assert.equal(isDemoLoginEnabled(), true)
  })

  test('skips OTP for new emails and pending signups only', () => {
    process.env.SKIP_EMAIL_OTP = 'true'
    assert.equal(canSkipSignupOtp(null), true)
    assert.equal(canSkipSignupOtp({ password_hash: 'x', is_verified: false }), true)
  })

  test('legacy accounts without a password still need OTP (prevents account takeover)', () => {
    process.env.SKIP_EMAIL_OTP = 'true'
    assert.equal(canSkipSignupOtp({ password_hash: null, is_verified: true }), false)
    assert.equal(canSkipSignupOtp({ password_hash: null, is_verified: false }), false)
  })
})

describe('demo user', () => {
  test('creates one verified, onboarded user with an unknown password, then reuses it', async () => {
    const db = fakeSupabase()
    db.from = ((from) => (table) => ({
      ...from(table),
      insert: (row) => ({
        select: () => ({
          single: async () => {
            const created = { id: 'demo', ...row }
            db.tables.users.push(created)
            return { data: created, error: null }
          },
        }),
      }),
    }))(db.from)
    db.tables.users = []
    const hashes = []
    const hash = async (password) => {
      hashes.push(password)
      return 'hashed'
    }
    const first = await ensureDemoUser(db, hash)
    assert.equal(first.email, DEMO_EMAIL)
    assert.equal(first.is_verified, true)
    assert.equal(first.is_onboarded, true)
    assert.ok(hashes[0].length >= 64)
    await ensureDemoUser(db, hash)
    assert.equal(db.tables.users.length, 1)
    assert.equal(hashes.length, 1)
  })
})

describe('seedDemoData', () => {
  test('fills every day with food, weight and workouts, never in the future', async () => {
    const db = fakeSupabase()
    assert.deepEqual(await seedDemoData(db, 'u', NOW), { days: SEED_DAYS })
    const { food_logs, workout_logs, weight_logs } = db.tables
    assert.equal(weight_logs.length, SEED_DAYS)
    assert.ok(food_logs.length >= SEED_DAYS)
    assert.ok(workout_logs.length > 0)
    for (const row of [...food_logs, ...workout_logs]) {
      assert.equal(row.user_id, 'u')
      assert.ok(Date.parse(row.created_at) <= NOW)
    }
    assert.ok(food_logs.some((row) => row.created_at.startsWith('2026-11-02')))
  })

  test('calories and macros are whole numbers (database integer columns)', async () => {
    const db = fakeSupabase()
    await seedDemoData(db, 'u', NOW)
    for (const row of db.tables.food_logs) {
      for (const field of ['calories', 'protein', 'carbs', 'fat']) assert.ok(Number.isInteger(row[field]), field)
    }
  })

  test('workouts progress over time for the progress chart', async () => {
    const db = fakeSupabase()
    await seedDemoData(db, 'u', NOW)
    const squats = db.tables.workout_logs.filter((row) => row.exercise_name === 'Squat').sort((a, b) => a.created_at.localeCompare(b.created_at))
    assert.ok(squats.length >= 2)
    assert.ok(squats.at(-1).weight_kg > squats[0].weight_kg)
  })

  test('a second press the same day adds nothing; the next day adds one day', async () => {
    const db = fakeSupabase()
    await seedDemoData(db, 'u', NOW)
    const foods = db.tables.food_logs.length
    assert.deepEqual(await seedDemoData(db, 'u', NOW), { days: 0 })
    assert.equal(db.tables.food_logs.length, foods)
    assert.deepEqual(await seedDemoData(db, 'u', NOW + 24 * 60 * 60 * 1000), { days: 1 })
  })
})
