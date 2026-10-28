// AI Meal Logger: ส่งข้อความที่ผู้ใช้พิมพ์/พูดว่ากินอะไรไปให้ Gemini ประเมินสารอาหาร
//
// บังคับให้ตอบเป็น JSON { items: [{ name, calories, protein_g, carbs_g, fat_g }] }
// ข้อความเดียวอาจมีหลายเมนู ("ข้าวมันไก่กับชาเย็น") จึงคืนเป็น array ข้อความที่ไม่ใช่อาหาร = items ว่าง
// API key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) ไม่ตั้ง = createMealAnalyzer คืน null
// โมเดล/timeout/การลองโมเดลสำรอง: ดู geminiModels.js (ล้มเหลว -> GeminiError ที่มี reason)

const { Type } = require('@google/genai')
const { createGeminiCaller, classifyError, GeminiError } = require('./geminiModels')

const MAX_ITEMS = 10

const SYSTEM_PROMPT = [
  'คุณคือนักโภชนาการ ผู้ใช้จะบอกว่ากินอะไรไป (ภาษาไทยหรืออังกฤษ อาจถอดเสียงเพี้ยน) จงประเมินสารอาหารและตอบเป็น JSON เท่านั้น',
  'แยกเป็นรายการละ 1 เมนู/เครื่องดื่ม ถ้าไม่ระบุปริมาณให้ใช้ 1 ที่/จานมาตรฐานแบบไทย ถ้าระบุจำนวน (เช่น ไข่ 2 ฟอง) ให้รวมเป็นรายการเดียว',
  'name: ชื่อเมนูตามภาษาที่ผู้ใช้พูด รวมปริมาณถ้ามี (เช่น "ข้าวมันไก่", "ไข่ต้ม 2 ฟอง")',
  'calories: กิโลแคลอรี, protein_g / carbs_g / fat_g: กรัม เป็นตัวเลขไม่ติดลบ',
  'ถ้าข้อความไม่เกี่ยวกับอาหารหรือเครื่องดื่ม ให้ตอบ items เป็น array ว่าง',
].join('\n')

const ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    calories: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    carbs_g: { type: Type.NUMBER },
    fat_g: { type: Type.NUMBER },
  },
  required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
  propertyOrdering: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: { items: { type: Type.ARRAY, items: ITEM_SCHEMA } },
  required: ['items'],
}

const toAmount = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value * 10 ** digits) / 10 ** digits : 0

// ตรวจและปัดค่าที่โมเดลตอบ ตัดรายการที่ไม่มีชื่อทิ้ง
function normalizeItems(data) {
  if (!Array.isArray(data?.items)) return []
  return data.items
    .map((item) => ({
      name: typeof item?.name === 'string' ? item.name.trim().slice(0, 120) : '',
      calories: toAmount(item?.calories, 0),
      protein_g: toAmount(item?.protein_g),
      carbs_g: toAmount(item?.carbs_g),
      fat_g: toAmount(item?.fat_g),
    }))
    .filter((item) => item.name)
    .slice(0, MAX_ITEMS)
}

// คืน async (text) => [{ name, calories, protein_g, carbs_g, fat_g }] ([] = ไม่ใช่อาหาร)
// ล้มเหลวทุกโมเดล -> throw GeminiError (ดู reason) ให้ route เลือกข้อความแจ้งผู้ใช้
// options อื่น (model, fallbackModel, generate, logger) ส่งต่อให้ createGeminiCaller
function createMealAnalyzer({ apiKey = process.env.GEMINI_API_KEY, ...options } = {}) {
  if (!apiKey) return null
  const callGemini = createGeminiCaller({ apiKey, label: 'meal', ...options })

  return function analyzeMeal(text) {
    return callGemini(
      {
        contents: text,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      },
      (response) => normalizeItems(JSON.parse(response.text || 'null'))
    )
  }
}

module.exports = { createMealAnalyzer, normalizeItems, classifyError, GeminiError, SYSTEM_PROMPT }
