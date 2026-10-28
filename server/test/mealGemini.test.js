// ทดสอบการตรวจ/ปัดค่าที่ Gemini ตอบกลับของ AI Meal Logger (ไม่เรียก Gemini จริง)
// รัน: npm test
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createMealAnalyzer, normalizeItems } = require('../parser/mealGemini')

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
