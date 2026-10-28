// Fallback ของ Voice Log parser: ส่งข้อความที่ parser ในเครื่องแยกได้ไม่ครบไปให้ Gemini ตีความ
//
// บังคับให้ตอบเป็น JSON ตาม schema { exercise: string, weight: number | null, reps: number | null }
// (weight/reps เป็น null ได้ เพื่อไม่ให้โมเดลเดาตัวเลขที่ผู้ใช้ไม่ได้พูด)
// API key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) ไม่ตั้ง = ปิด fallback, createGeminiParser คืน null
// โมเดล/timeout/การลองโมเดลสำรอง: ดู geminiModels.js

const { Type } = require('@google/genai')
const { createGeminiCaller } = require('./geminiModels')

const SYSTEM_PROMPT = [
  "คุณคือผู้ช่วยถอดความการออกกำลังกาย คำที่รับมาอาจเป็นภาษาไทยหรือถอดเสียงเพี้ยน เช่น 'ใบเสร็จไกร' หมายถึง 'Bench Press' จงแปลงข้อความให้อยู่ในรูปแบบ JSON เท่านั้น",
  'exercise: ชื่อท่ามาตรฐานภาษาอังกฤษ (เช่น Bench Press, Squat, Deadlift) หรือ "" ถ้าข้อความไม่ใช่การออกกำลังกาย',
  'weight: น้ำหนักเป็นกิโลกรัม (แปลงปอนด์เป็นกิโลกรัม) หรือ null ถ้าไม่ได้พูด',
  'reps: จำนวนครั้ง หรือ null ถ้าไม่ได้พูด',
].join('\n')

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    exercise: { type: Type.STRING },
    weight: { type: Type.NUMBER, nullable: true },
    reps: { type: Type.NUMBER, nullable: true },
  },
  required: ['exercise', 'weight', 'reps'],
  propertyOrdering: ['exercise', 'weight', 'reps'],
}

const toNumberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null)

// คืน async (text) => { exercise, weight, reps } | null (null = ไม่ใช่คำสั่งออกกำลังกาย)
// ล้มเหลวทุกโมเดล -> throw GeminiError ให้ผู้เรียกตัดสินใจ (hybrid.js ใช้ผลจาก parser ในเครื่องแทน)
// options อื่น (model, fallbackModel, generate, logger) ส่งต่อให้ createGeminiCaller
function createGeminiParser({ apiKey = process.env.GEMINI_API_KEY, ...options } = {}) {
  if (!apiKey) return null
  const callGemini = createGeminiCaller({ apiKey, label: 'voice', ...options })

  return function parseWithGemini(text) {
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
      (response) => {
        const data = JSON.parse(response.text || 'null')
        const exercise = typeof data?.exercise === 'string' ? data.exercise.trim() : ''
        if (!exercise) return null
        return { exercise, weight: toNumberOrNull(data.weight), reps: toNumberOrNull(data.reps) }
      }
    )
  }
}

module.exports = { createGeminiParser, SYSTEM_PROMPT }
