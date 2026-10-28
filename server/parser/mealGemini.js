// AI Meal Logger: ส่งข้อความที่ผู้ใช้พิมพ์/พูดว่ากินอะไรไปให้ Gemini ประเมินสารอาหาร
//
// บังคับให้ตอบเป็น JSON { items: [{ name, calories, protein_g, carbs_g, fat_g }] }
// ข้อความเดียวอาจมีหลายเมนู ("ข้าวมันไก่กับชาเย็น") จึงคืนเป็น array ข้อความที่ไม่ใช่อาหาร = items ว่าง
// API key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) ไม่ตั้ง = createMealAnalyzer คืน null
//
// โมเดล: GEMINI_MODEL (ไม่ตั้ง = DEFAULT_MODEL) ถ้าหมดเวลา/คนใช้เยอะ/โมเดลถูกปิด จะลอง FALLBACK_MODEL อีกครั้ง
// ใช้รุ่น flash-lite เพราะรุ่น flash ตัวใหญ่ตอบช้าเกิน 10 วินาทีบ่อย (504) สำหรับงานประเมินอาหารสั้น ๆ แค่นี้
// ล้มเหลวทุกโมเดล -> โยน MealAnalyzerError ที่มี reason: 'timeout' | 'busy' | 'model_unavailable' | 'failed'

const { GoogleGenAI, Type } = require('@google/genai')

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_MODEL = 'gemini-flash-lite-latest'
// ต่อหนึ่งโมเดล (Gemini รับ deadline ขั้นต่ำ 10 วินาที) ลอง 2 โมเดล = รอนานสุดราว 20 วินาที
const TIMEOUT_MS = 10000
const MAX_ITEMS = 10
// error แบบนี้ลองโมเดลสำรองได้ ส่วน 'failed' (เช่น key ผิด, request ผิด) ลองใหม่ก็ไม่หาย
const RETRYABLE = new Set(['timeout', 'busy', 'model_unavailable'])

class MealAnalyzerError extends Error {
  constructor(reason, cause) {
    super(`Gemini meal analysis ${reason}: ${cause?.message || cause}`)
    this.name = 'MealAnalyzerError'
    this.reason = reason
    this.cause = cause
  }
}

// ApiError ของ @google/genai มี status (HTTP code) ส่วน timeout ฝั่ง client เป็น AbortError
function classifyError(error) {
  const status = Number(error?.status ?? error?.code) || Number(/"code":\s*(\d{3})/.exec(error?.message || '')?.[1])
  const message = String(error?.message || '')
  if (status === 504 || status === 408 || error?.name === 'AbortError' || /deadline|timed? ?out|aborted/i.test(message)) {
    return 'timeout'
  }
  if (status === 503 || status === 429 || /high demand|overloaded|resource.?exhausted/i.test(message)) return 'busy'
  if (status === 404 || /no longer available|not found/i.test(message)) return 'model_unavailable'
  return 'failed'
}

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
// ล้มเหลวทุกโมเดล -> throw MealAnalyzerError (ดู reason) ให้ route เลือกข้อความแจ้งผู้ใช้
// generate: ใช้แทน ai.models.generateContent ตอนทดสอบ
function createMealAnalyzer({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  fallbackModel = FALLBACK_MODEL,
  generate,
  logger = console,
} = {}) {
  if (!apiKey) return null
  const ai = generate ? null : new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } })
  const generateContent = generate || ((request) => ai.models.generateContent(request))
  const models = [...new Set([model, fallbackModel].filter(Boolean))]

  return async function analyzeMeal(text) {
    let lastError
    for (const name of models) {
      try {
        const response = await generateContent({
          model: name,
          contents: text,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        })
        return normalizeItems(JSON.parse(response.text || 'null'))
      } catch (error) {
        const reason = error instanceof SyntaxError ? 'failed' : classifyError(error)
        lastError = new MealAnalyzerError(reason, error)
        logger.warn(`[meal] ${name} ล้มเหลว (${reason}): ${String(error?.message || error).slice(0, 200)}`)
        if (!RETRYABLE.has(reason)) break
      }
    }
    throw lastError
  }
}

module.exports = { createMealAnalyzer, normalizeItems, classifyError, MealAnalyzerError, SYSTEM_PROMPT, DEFAULT_MODEL, FALLBACK_MODEL }
