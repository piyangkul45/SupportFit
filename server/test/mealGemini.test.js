// ทดสอบการตรวจ/ปัดค่าที่ Gemini ตอบกลับของ AI Meal Logger (ไม่เรียก Gemini จริง)
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { createMealAnalyzer, createMealImageAnalyzer, normalizeItems, classifyError, GeminiError } = require('../parser/mealGemini')

test('rounds amounts and keeps the expected fields', () => {
  const items = normalizeItems({
    items: [{ name: ' ข้าวมันไก่ ', calories: 596.6, protein_g: 23.456, carbs_g: 74.04, fat_g: 21.95, extra: 'x' }],
  })
  assert.deepEqual(items, [{ name: 'ข้าวมันไก่', calories: 597, protein_g: 23.5, carbs_g: 74, fat_g: 22 }])
})

test('drops unnamed items and replaces invalid numbers with 0', () => {
  const items = normalizeItems({
    items: [
      { name: '', calories: 100 },
      { name: 'ชาเย็น', calories: -5, protein_g: 'many', carbs_g: Number.NaN, fat_g: null },
    ],
  })
  assert.deepEqual(items, [{ name: 'ชาเย็น', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }])
})

test('returns [] for malformed responses', () => {
  assert.deepEqual(normalizeItems(null), [])
  assert.deepEqual(normalizeItems({ items: 'nope' }), [])
})

test('caps the number of items', () => {
  const items = normalizeItems({ items: Array.from({ length: 20 }, (_, i) => ({ name: `food ${i}` })) })
  assert.equal(items.length, 10)
})

test('is disabled without an API key', () => {
  assert.equal(createMealAnalyzer({ apiKey: '' }), null)
})

const silentLogger = { warn() {} }
const apiError = (status, message) => Object.assign(new Error(`{"error":{"code":${status},"message":"${message}"}}`), { status })
const okResponse = { text: JSON.stringify({ items: [{ name: 'ชาเย็น', calories: 180, protein_g: 2, carbs_g: 30, fat_g: 6 }] }) }

// stub ที่จำว่าเรียกโมเดลไหน ตอบตามลำดับใน replies
function stubGenerate(...replies) {
  const models = []
  const generate = async ({ model }) => {
    models.push(model)
    const reply = replies[models.length - 1]
    if (reply instanceof Error) throw reply
    return reply
  }
  return { generate, models }
}

describe('classifyError', () => {
  test('maps Gemini failures to reasons', () => {
    assert.equal(classifyError(apiError(504, 'Deadline expired before operation could complete.')), 'timeout')
    assert.equal(classifyError(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), 'timeout')
    assert.equal(classifyError(apiError(503, 'This model is currently experiencing high demand.')), 'busy')
    assert.equal(classifyError(apiError(429, 'Resource exhausted')), 'busy')
    assert.equal(classifyError(apiError(404, 'This model is no longer available to new users.')), 'model_unavailable')
    assert.equal(classifyError(apiError(400, 'API key not valid')), 'failed')
  })
})

describe('model fallback', () => {
  test('uses the primary model when it answers', async () => {
    const { generate, models } = stubGenerate(okResponse)
    const analyze = createMealAnalyzer({ apiKey: 'k', model: 'a', fallbackModel: 'b', generate, logger: silentLogger })
    assert.equal((await analyze('ชาเย็น')).length, 1)
    assert.deepEqual(models, ['a'])
  })

  test('falls back on timeout', async () => {
    const { generate, models } = stubGenerate(apiError(504, 'Deadline expired'), okResponse)
    const analyze = createMealAnalyzer({ apiKey: 'k', model: 'a', fallbackModel: 'b', generate, logger: silentLogger })
    assert.equal((await analyze('ชาเย็น'))[0].name, 'ชาเย็น')
    assert.deepEqual(models, ['a', 'b'])
  })

  test('throws the last reason when every model fails', async () => {
    const { generate, models } = stubGenerate(apiError(503, 'high demand'), apiError(504, 'Deadline expired'))
    const analyze = createMealAnalyzer({ apiKey: 'k', model: 'a', fallbackModel: 'b', generate, logger: silentLogger })
    await assert.rejects(analyze('ชาเย็น'), (error) => error instanceof GeminiError && error.reason === 'timeout')
    assert.deepEqual(models, ['a', 'b'])
  })

  test('does not retry non-retryable errors', async () => {
    const { generate, models } = stubGenerate(apiError(400, 'API key not valid'), okResponse)
    const analyze = createMealAnalyzer({ apiKey: 'k', model: 'a', fallbackModel: 'b', generate, logger: silentLogger })
    await assert.rejects(analyze('ชาเย็น'), (error) => error.reason === 'failed')
    assert.deepEqual(models, ['a'])
  })
})

describe('createMealImageAnalyzer', () => {
  test('sends the photo as inline data with the user note and language', async () => {
    let request
    const generate = async (req) => {
      request = req
      return okResponse
    }
    const analyze = createMealImageAnalyzer({ apiKey: 'k', model: 'a', fallbackModel: null, generate, logger: silentLogger })
    const items = await analyze({ data: 'aGVsbG8=', mimeType: 'image/jpeg', note: 'ไม่กินหนัง', language: 'en' })
    assert.equal(items[0].name, 'ชาเย็น')
    const [image, text] = request.contents[0].parts
    assert.deepEqual(image, { inlineData: { mimeType: 'image/jpeg', data: 'aGVsbG8=' } })
    assert.match(text.text, /ไม่กินหนัง/)
    assert.match(text.text, /อังกฤษ/)
  })

  test('is disabled without an API key', () => {
    assert.equal(createMealImageAnalyzer({ apiKey: '' }), null)
  })
})
