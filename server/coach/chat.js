// SupportFit AI Coach: แชตถาม-ตอบเรื่องการออกกำลังกายและโภชนาการกับ Gemini
//
// ประวัติการคุยเก็บฝั่ง client (ต่อ session) แล้วส่งมาทุกครั้ง server ไม่บันทึกบทสนทนา
// บริบทส่วนตัว (BMR/TDEE, น้ำหนัก, เป้าหมาย) สร้างจากโปรไฟล์ในฐานข้อมูล ไม่รับจาก client และใส่เฉพาะตัวเลข/ค่า enum
// API key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) ไม่ตั้ง = createCoachChat คืน null
// โมเดล/การลองโมเดลสำรอง: ดู parser/geminiModels.js (ล้มเหลว -> GeminiError ที่มี reason)

const { createGeminiCaller } = require('../parser/geminiModels')

const MAX_MESSAGE_LENGTH = 1000
// body JSON จำกัด 100kb (ไทย 1 ตัวอักษร = 3 ไบต์ใน UTF-8): 12 ข้อความ × 2000 ตัวอักษรไม่เกินนั้น
const MAX_HISTORY_MESSAGES = 12
const MAX_HISTORY_TEXT_LENGTH = 2000
// คำตอบแชตยาวกว่างานแปลงข้อความ จึงให้เวลาต่อโมเดลมากกว่าค่าเริ่มต้น
const CHAT_TIMEOUT_MS = 25000
const MAX_OUTPUT_TOKENS = 1500

// ตัวคูณเดียวกับ client/src/utils/macroCalculator.js
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
const ACTIVITY_LABELS = {
  sedentary: 'นั่งทำงาน ไม่ค่อยออกกำลังกาย',
  light: 'ออกกำลังกาย 1-3 วัน/สัปดาห์',
  moderate: 'ออกกำลังกาย 3-5 วัน/สัปดาห์',
  active: 'ออกกำลังกาย 6-7 วัน/สัปดาห์',
  very_active: 'ออกหนักทุกวันหรือทำงานใช้แรง',
}
const GOAL_LABELS = { lose_weight: 'ลดน้ำหนัก/ลดไขมัน', maintain: 'รักษาน้ำหนัก', gain_muscle: 'เพิ่มกล้ามเนื้อ' }
const GENDER_LABELS = { male: 'ชาย', female: 'หญิง' }

const SYSTEM_PROMPT = [
  'คุณคือ SupportFit AI Coach โค้ชออกกำลังกายและนักโภชนาการส่วนตัวในแอป SupportFit',
  'ตอบเฉพาะเรื่องการออกกำลังกาย โภชนาการ การฟื้นตัว การนอน และสุขภาพทั่วไป เรื่องอื่นให้ปฏิเสธสุภาพแล้วชวนกลับมาที่เรื่องสุขภาพ',
  'ตอบเป็นภาษาเดียวกับที่ผู้ใช้ถาม ใช้โทนเป็นกันเองแต่ตรงประเด็น',
  'ปรับคำแนะนำให้ตรงกับข้อมูลผู้ใช้ด้านล่าง และยกตัวเลขของผู้ใช้มาอ้างอิงเมื่อเกี่ยวข้อง ถ้าข้อมูลส่วนไหนไม่มีอย่าเดา ให้แนะนำแบบทั่วไปหรือถามกลับ',
  'รูปแบบคำตอบ: Markdown อย่างง่ายเท่านั้น ใช้ bullet ขึ้นต้นด้วย "- " หรือลำดับ "1. " และ **ตัวหนา** กับคำสำคัญ/ตัวเลขสำคัญ ห้ามใช้ตารางหรือหัวข้อ #',
  'ตอบกระชับ ไม่เกินราว 200 คำ เมื่อแนะนำอาหารให้บอกแคลอรีและโปรตีนโดยประมาณ',
  'ความปลอดภัย: ไม่วินิจฉัยโรค ถ้าเจ็บผิดปกติ บาดเจ็บ หรือมีโรคประจำตัว ให้แนะนำปรึกษาแพทย์หรือนักกายภาพ',
  'ห้ามแนะนำการอดอาหารสุดโต่ง การกินต่ำกว่าเกณฑ์ปลอดภัย (ต่ำกว่า 1,200 kcal/วัน) สารกระตุ้นต้องห้าม หรือยาที่ต้องสั่งโดยแพทย์',
].join('\n')

const isPositive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

// Mifflin-St Jeor เหมือน client/src/utils/macroCalculator.js ข้อมูลไม่ครบ -> null
function calculateEnergy({ age, gender, height_cm, weight_kg, activity_level }) {
  if (!isPositive(age) || !isPositive(height_cm) || !isPositive(weight_kg) || !GENDER_LABELS[gender]) return null
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (gender === 'male' ? 5 : -161)
  const multiplier = ACTIVITY_MULTIPLIERS[activity_level]
  return { bmr: Math.round(bmr), tdee: multiplier ? Math.round(bmr * multiplier) : null }
}

// แถวจากตาราง users -> ข้อความบริบทใน prompt (ไม่ใส่ชื่อ/อีเมล) ข้อมูลที่ไม่มีจะไม่ถูกใส่
function buildUserContext(profile) {
  if (!profile) return 'ไม่มีข้อมูลโปรไฟล์'
  const { age, gender, height_cm, weight_kg, activity_level, fitness_goal } = profile
  const energy = calculateEnergy(profile)
  const lines = [
    fitness_goal in GOAL_LABELS && `เป้าหมาย: ${GOAL_LABELS[fitness_goal]}`,
    gender in GENDER_LABELS && `เพศ: ${GENDER_LABELS[gender]}`,
    isPositive(age) && `อายุ: ${age} ปี`,
    isPositive(height_cm) && `ส่วนสูง: ${height_cm} ซม.`,
    isPositive(weight_kg) && `น้ำหนักตัว: ${weight_kg} กก.`,
    activity_level in ACTIVITY_LABELS && `ระดับกิจกรรม: ${ACTIVITY_LABELS[activity_level]}`,
    energy && `BMR: ${energy.bmr} kcal/วัน`,
    energy?.tdee && `TDEE: ${energy.tdee} kcal/วัน`,
    isPositive(profile.target_calories) && `เป้าหมายแคลอรี: ${profile.target_calories} kcal/วัน`,
    isPositive(profile.target_protein) && `เป้าหมายโปรตีน: ${profile.target_protein} ก./วัน`,
    isPositive(profile.target_carbs) && `เป้าหมายคาร์บ: ${profile.target_carbs} ก./วัน`,
    isPositive(profile.target_fat) && `เป้าหมายไขมัน: ${profile.target_fat} ก./วัน`,
  ].filter(Boolean)
  return lines.length ? lines.map((line) => `- ${line}`).join('\n') : 'ไม่มีข้อมูลโปรไฟล์'
}

// ประวัติจาก client -> contents ของ Gemini: ตัดรายการผิดรูปแบบ เก็บเฉพาะข้อความล่าสุด และต้องขึ้นต้นด้วย user
function toContents(history) {
  if (!Array.isArray(history)) return []
  const contents = history
    .filter((item) => ['user', 'model'].includes(item?.role) && typeof item.text === 'string' && item.text.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, text }) => ({ role, parts: [{ text: text.trim().slice(0, MAX_HISTORY_TEXT_LENGTH) }] }))
  const firstUser = contents.findIndex((item) => item.role === 'user')
  return firstUser === -1 ? [] : contents.slice(firstUser)
}

// คืน async ({ message, history, profile }) => ข้อความตอบกลับ (Markdown)
// โมเดลไม่ตอบ (เช่น ถูกบล็อก) หรือล้มเหลวทุกโมเดล -> throw GeminiError
// options อื่น (model, fallbackModel, generate, logger) ส่งต่อให้ createGeminiCaller
function createCoachChat({ apiKey = process.env.GEMINI_API_KEY, ...options } = {}) {
  if (!apiKey) return null
  const callGemini = createGeminiCaller({ apiKey, label: 'coach', timeoutMs: CHAT_TIMEOUT_MS, ...options })

  return function chat({ message, history, profile }) {
    return callGemini(
      {
        contents: [...toContents(history), { role: 'user', parts: [{ text: message.slice(0, MAX_MESSAGE_LENGTH) }] }],
        config: {
          systemInstruction: `${SYSTEM_PROMPT}\n\nข้อมูลผู้ใช้:\n${buildUserContext(profile)}`,
          temperature: 0.6,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      },
      (response) => {
        const reply = response.text?.trim()
        if (!reply) throw new Error('empty reply')
        return reply
      }
    )
  }
}

module.exports = { createCoachChat, buildUserContext, calculateEnergy, toContents, MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES, SYSTEM_PROMPT }
