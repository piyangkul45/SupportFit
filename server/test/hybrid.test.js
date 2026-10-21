// ทดสอบ Hybrid parser ของ Voice Log: local ก่อน, Gemini เมื่อแยกได้ไม่ครบ (ใช้ stub แทน Gemini จริง)
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { createVoiceParser } = require('../parser/hybrid')

const silentLogger = { warn() {} }

// stub ที่จำว่าถูกเรียกกี่ครั้ง
function stubGemini(reply) {
  const calls = []
  const geminiParse = async (text) => {
    calls.push(text)
    if (reply instanceof Error) throw reply
    return reply
  }
  return { geminiParse, calls }
}

const pick = ({ exercise_name, weight_kg, reps }) => ({ exercise: exercise_name, weight: weight_kg, reps })

describe('Step 1: local matcher returns immediately when complete', () => {
  const cases = [
    ['ใบเสร็จไกร 10 กิโลกรัม 15 ครั้ง', { exercise: 'Bench Press', weight: 10, reps: 15 }],
    ['เบรนเพรส 50 กก 10 รอบ', { exercise: 'Bench Press', weight: 50, reps: 10 }],
    ['สควอช 60 โล 5 ที', { exercise: 'Squat', weight: 60, reps: 5 }],
    ['สก็อต 80 kg 8 reps', { exercise: 'Squat', weight: 80, reps: 8 }],
    ['สควัต 70 กิโล 6 rep', { exercise: 'Squat', weight: 70, reps: 6 }],
    ['เด็ดลิฟ 100 กิโล 5 ครั้ง', { exercise: 'Deadlift', weight: 100, reps: 5 }],
    ['เดดลิฟต์ 225 lbs 3 reps', { exercise: 'Deadlift', weight: 102.06, reps: 3 }],
  ]
  for (const [text, expected] of cases) {
    test(text, async () => {
      const { geminiParse, calls } = stubGemini(new Error('should not be called'))
      const result = await createVoiceParser({ geminiParse })(text)
      assert.deepEqual(pick(result), expected)
      assert.equal(result.source, 'local')
      assert.equal(calls.length, 0)
    })
  }

  test('bodyweight exercise without weight is complete', async () => {
    const { geminiParse, calls } = stubGemini(null)
    const result = await createVoiceParser({ geminiParse })('วิดพื้น 20 ครั้ง')
    assert.equal(result.source, 'local')
    assert.equal(calls.length, 0)
  })

  test('food is handled locally', async () => {
    const { geminiParse, calls } = stubGemini(null)
    const result = await createVoiceParser({ geminiParse })('กินข้าวอกไก่')
    assert.equal(result.type, 'food')
    assert.equal(calls.length, 0)
  })
})

describe('Step 2: Gemini fallback when local result is incomplete', () => {
  test('unknown name -> Gemini name mapped to canonical, local numbers kept', async () => {
    const { geminiParse, calls } = stubGemini({ exercise: 'bench press', weight: 999, reps: 999 })
    const result = await createVoiceParser({ geminiParse })('ไม้เสียบไก่ 40 กิโล 12 ครั้ง')
    assert.equal(calls.length, 1)
    assert.deepEqual(pick(result), { exercise: 'Bench Press', weight: 40, reps: 12 })
    assert.equal(result.source, 'gemini')
    assert.equal(result.match_type, 'ai')
  })

  test('missing reps -> filled by Gemini, known local name kept', async () => {
    const { geminiParse } = stubGemini({ exercise: 'Incline Bench Press', weight: 10, reps: 15 })
    const result = await createVoiceParser({ geminiParse })('ใบเสร็จไกร 10 กิโลกรัม ทำไปสิบห้า')
    assert.deepEqual(pick(result), { exercise: 'Bench Press', weight: 10, reps: 15 })
    assert.equal(result.source, 'gemini')
  })

  test('Gemini error -> falls back to local result', async () => {
    const { geminiParse } = stubGemini(new Error('503 UNAVAILABLE'))
    const result = await createVoiceParser({ geminiParse, logger: silentLogger })('ใบเสร็จไกร 10 กิโลกรัม')
    assert.deepEqual(pick(result), { exercise: 'Bench Press', weight: 10, reps: null })
    assert.equal(result.source, 'local')
  })

  test('Gemini says not an exercise and local has nothing -> null', async () => {
    const { geminiParse } = stubGemini(null)
    assert.equal(await createVoiceParser({ geminiParse })('สวัสดีครับ'), null)
  })

  test('no API key -> local only', async () => {
    const result = await createVoiceParser({ geminiParse: null })('ใบเสร็จไกร 10 กิโลกรัม')
    assert.equal(result.source, 'local')
  })
})
