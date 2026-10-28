// โมเดล Gemini ที่ใช้ร่วมกันของ Voice Log parser (gemini.js) และ AI Meal Logger (mealGemini.js)
//
// โมเดล: GEMINI_MODEL (ไม่ตั้ง = DEFAULT_MODEL) ถ้าหมดเวลา/คนใช้เยอะ/โมเดลถูกปิด จะลอง FALLBACK_MODEL อีกครั้ง
// ใช้รุ่น flash-lite เพราะรุ่น flash ตัวใหญ่ตอบช้าเกิน 10 วินาทีบ่อย (504) สำหรับงานแปลงข้อความสั้น ๆ แค่นี้
// ล้มเหลวทุกโมเดล -> โยน GeminiError ที่มี reason: 'timeout' | 'busy' | 'model_unavailable' | 'failed'

const { GoogleGenAI } = require('@google/genai')

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_MODEL = 'gemini-flash-lite-latest'
// ต่อหนึ่งโมเดล (Gemini รับ deadline ขั้นต่ำ 10 วินาที) ลอง 2 โมเดล = รอนานสุดราว 20 วินาที
const TIMEOUT_MS = 10000
// error แบบนี้ลองโมเดลสำรองได้ ส่วน 'failed' (เช่น key ผิด, request ผิด) ลองใหม่ก็ไม่หาย
const RETRYABLE = new Set(['timeout', 'busy', 'model_unavailable'])

class GeminiError extends Error {
  constructor(reason, cause) {
    super(`Gemini ${reason}: ${cause?.message || cause}`)
    this.name = 'GeminiError'
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

// คืน async (request ไม่ต้องมี model) => ผลจาก parse(response) ไล่ลองโมเดลตามลำดับ
// generate: ใช้แทน ai.models.generateContent ตอนทดสอบ ; timeoutMs: ต่อหนึ่งโมเดล (รูปภาพใช้เวลานานกว่าข้อความ)
function createGeminiCaller({
  apiKey,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  fallbackModel = FALLBACK_MODEL,
  generate,
  logger = console,
  label = 'gemini',
  timeoutMs = TIMEOUT_MS,
}) {
  const ai = generate ? null : new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } })
  const generateContent = generate || ((request) => ai.models.generateContent(request))
  const models = [...new Set([model, fallbackModel].filter(Boolean))]

  return async function callGemini(request, parse) {
    let lastError
    for (const name of models) {
      try {
        return parse(await generateContent({ ...request, model: name }))
      } catch (error) {
        const reason = error instanceof SyntaxError ? 'failed' : classifyError(error)
        lastError = new GeminiError(reason, error)
        logger.warn(`[${label}] ${name} ล้มเหลว (${reason}): ${String(error?.message || error).slice(0, 200)}`)
        if (!RETRYABLE.has(reason)) break
      }
    }
    throw lastError
  }
}

module.exports = { createGeminiCaller, classifyError, GeminiError, DEFAULT_MODEL, FALLBACK_MODEL, TIMEOUT_MS }
