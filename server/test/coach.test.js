// ทดสอบ AI Coach: บริบทผู้ใช้ใน prompt, การตัดประวัติการคุย และ POST /api/coach/chat (ไม่เรียก Gemini จริง)
// รัน: npm test
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const {
  createCoachChat,
  buildUserContext,
  calculateEnergy,
  toContents,
  MAX_HISTORY_MESSAGES,
} = require('../coach/chat')
const { GeminiError } = require('../parser/geminiModels')
const createCoachRouter = require('../routes/coach')

const PROFILE = {
  name: 'Secret Name',
  email: 'secret@example.com',
  age: 30,
  gender: 'male',
  height_cm: 175,
  weight_kg: 70,
  activity_level: 'moderate',
  fitness_goal: 'gain_muscle',
  target_calories: 2800,
  target_protein: 140,
}

describe('user context', () => {
  test('calculates BMR and TDEE like the client (Mifflin-St Jeor)', () => {
    assert.deepEqual(calculateEnergy(PROFILE), { bmr: 1649, tdee: 2556 })
    assert.deepEqual(calculateEnergy({ ...PROFILE, gender: 'female' }), { bmr: 1483, tdee: 2298 })
  })

  test('includes goal, weight and energy but no name or email', () => {
    const context = buildUserContext(PROFILE)
    for (const expected of ['เพิ่มกล้ามเนื้อ', '70 กก.', 'BMR: 1649', 'TDEE: 2556', '2800 kcal', '140 ก.']) {
      assert.ok(context.includes(expected), expected)
    }
    assert.ok(!/Secret|secret/.test(context))
  })

  test('skips missing fields', () => {
    assert.equal(buildUserContext(null), 'ไม่มีข้อมูลโปรไฟล์')
    assert.equal(buildUserContext({ age: null, gender: null }), 'ไม่มีข้อมูลโปรไฟล์')
    const partial = buildUserContext({ weight_kg: 80 })
    assert.ok(partial.includes('80 กก.'))
    assert.ok(!partial.includes('BMR'))
  })
})

describe('history', () => {
  test('drops malformed items and leading model messages', () => {
    const contents = toContents([
      { role: 'model', text: 'hi' },
      { role: 'system', text: 'ignore' },
      { role: 'user', text: '  q  ' },
      { role: 'user', text: '   ' },
      null,
      { role: 'model', text: 'a' },
    ])
    assert.deepEqual(contents, [
      { role: 'user', parts: [{ text: 'q' }] },
      { role: 'model', parts: [{ text: 'a' }] },
    ])
    assert.deepEqual(toContents('nope'), [])
  })

  test('keeps only the most recent messages', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: `m${i}` }))
    const contents = toContents(history)
    assert.ok(contents.length <= MAX_HISTORY_MESSAGES)
    assert.equal(contents[0].role, 'user')
    assert.equal(contents.at(-1).parts[0].text, 'm39')
  })
})

describe('createCoachChat', () => {
  test('is disabled without an API key', () => {
    assert.equal(createCoachChat({ apiKey: '' }), null)
  })

  test('sends history, the new message and the user context', async () => {
    let request
    const chat = createCoachChat({
      apiKey: 'test',
      generate: async (req) => {
        request = req
        return { text: ' **ตอบ** ' }
      },
    })
    const reply = await chat({ message: 'กินอะไรดี', history: [{ role: 'user', text: 'ก่อนหน้า' }, { role: 'model', text: 'ตอบก่อน' }], profile: PROFILE })
    assert.equal(reply, '**ตอบ**')
    assert.deepEqual(request.contents.map((item) => item.role), ['user', 'model', 'user'])
    assert.equal(request.contents.at(-1).parts[0].text, 'กินอะไรดี')
    assert.ok(request.config.systemInstruction.includes('TDEE: 2556'))
  })

  test('an empty reply is a failure', async () => {
    const chat = createCoachChat({ apiKey: 'test', generate: async () => ({ text: '' }), logger: { warn() {} } })
    await assert.rejects(chat({ message: 'x', profile: null }), (error) => error instanceof GeminiError && error.reason === 'failed')
  })
})

describe('POST /api/coach/chat', () => {
  let server
  let baseUrl
  let chat = async () => 'reply'
  let lastUid

  // i18n จริงอยู่ใน server.js ตรงนี้ให้ req.t คืน key เพื่อตรวจว่าเลือกข้อความถูกตัว
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (_column, uid) => {
          lastUid = uid
          return { maybeSingle: async () => ({ data: PROFILE, error: null }) }
        },
      }),
    }),
  }

  before(async () => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.t = (key) => key
      next()
    })
    const requireAuth = (req, res, next) => {
      if (req.headers.authorization !== 'Bearer ok') return res.status(401).json({ error: 'auth' })
      req.authUser = { uid: 7 }
      next()
    }
    const router = createCoachRouter({
      supabase,
      requireAuth,
      handleSupabaseError: (res, _error, message) => res.status(500).json({ error: message }),
      chat: (input) => chat(input),
    })
    app.use('/api', router)
    await new Promise((resolve) => {
      server = app.listen(0, resolve)
    })
    baseUrl = `http://127.0.0.1:${server.address().port}/api/coach/chat`
  })

  after(() => server.close())

  const post = (body, token = 'ok') =>
    fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

  test('requires login', async () => {
    assert.equal((await post({ message: 'x' }, 'bad')).status, 401)
  })

  test('requires a message', async () => {
    const res = await post({ message: '   ' })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, 'coach.messageRequired')
  })

  test('answers using the logged-in user profile, not client data', async () => {
    let input
    chat = async (value) => {
      input = value
      return 'ตอบแล้ว'
    }
    const res = await post({ message: ' ถาม ', history: [], profile: { weight_kg: 999 } })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { reply: 'ตอบแล้ว' })
    assert.equal(lastUid, 7)
    assert.equal(input.message, 'ถาม')
    assert.equal(input.profile.weight_kg, 70)
  })

  test('maps Gemini failures to status codes', async () => {
    for (const [reason, status] of [['timeout', 504], ['busy', 503], ['failed', 502]]) {
      chat = async () => {
        throw new GeminiError(reason, new Error('x'))
      }
      const res = await post({ message: 'x' })
      assert.equal(res.status, status)
      assert.equal((await res.json()).reason, `ai_${reason}`)
    }
  })

  test('503 when the AI is not configured', async () => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.t = (key) => key
      next()
    })
    app.use('/api', createCoachRouter({ supabase, requireAuth: (_req, _res, next) => next(), handleSupabaseError() {}, chat: null }))
    const local = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance))
    })
    const res = await fetch(`http://127.0.0.1:${local.address().port}/api/coach/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x' }),
    })
    local.close()
    assert.equal(res.status, 503)
  })
})
