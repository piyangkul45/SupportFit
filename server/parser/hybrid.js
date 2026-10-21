// Hybrid parser สำหรับ Voice Log: parser ในเครื่องก่อน (เร็ว ฟรี) ถ้าแยกได้ไม่ครบจึงถาม Gemini
//
// Step 1 (local, parser/index.js): regex ตัวเลข+หน่วย + alias/fuzzy match ชื่อท่า
//   ครบ = รู้จักชื่อท่าแน่ (match_type 'exact' | 'hint') + reps + weight (ท่า bodyweight ไม่ต้องมี weight)
//   ผลแบบอาหารถือว่าครบเสมอ (Gemini schema รองรับแค่ท่าออกกำลังกาย)
// Step 2 (Gemini, parser/gemini.js): ได้ { exercise, weight, reps } แล้วแปลงชื่อท่าเป็นชื่อมาตรฐาน
//   ในฐานข้อมูล ตัวเลขที่ regex จับได้แล้วใช้ค่าเดิม (แม่นกว่าโมเดล) Gemini เติมเฉพาะที่ขาด
//   Gemini ล้มเหลว/ไม่ได้ตั้ง key -> คืนผลจาก Step 1 ตามเดิม
//
// ผลลัพธ์รูปเดียวกับ parseCommand + source: 'local' | 'gemini' (match_type 'ai' เมื่อชื่อท่ามาจาก Gemini)

const { parseCommand } = require('./index')
const { createMatcher } = require('./matcher')
const { EXERCISES } = require('./dictionary')
const { toTitleCase } = require('./normalize')
const { createGeminiParser } = require('./gemini')
const EXERCISE_DATABASE = require('./exerciseDatabase.json')

const matchExercise = createMatcher(EXERCISES)
const BODYWEIGHT_EXERCISES = new Set(
  EXERCISE_DATABASE.filter((exercise) => ['bodyweight', 'none'].includes(exercise.equipment)).map((exercise) => exercise.name)
)
const KNOWN_NAME_MATCHES = new Set(['exact', 'hint'])

const round = (value, digits) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits)

function isComplete(result) {
  if (!result) return false
  if (result.type !== 'workout') return true
  if (!KNOWN_NAME_MATCHES.has(result.match_type) || result.reps == null) return false
  return result.weight_kg != null || BODYWEIGHT_EXERCISES.has(result.exercise_name)
}

function mergeGemini(local, ai) {
  const keepLocalName = local?.type === 'workout' && KNOWN_NAME_MATCHES.has(local.match_type)
  const match = matchExercise(ai.exercise)
  return {
    type: 'workout',
    exercise_name: keepLocalName ? local.exercise_name : match.name || toTitleCase(ai.exercise),
    weight_kg: round(local?.weight_kg ?? ai.weight, 2),
    reps: round(local?.reps ?? ai.reps, 0),
    sets: local?.sets ?? null,
    food_name: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    confidence: keepLocalName ? local.confidence : match.score,
    match_type: keepLocalName ? local.match_type : 'ai',
    spoken_name: local?.spoken_name ?? null,
    macros_estimated: false,
    source: 'gemini',
  }
}

// geminiParse: (text) => Promise<{ exercise, weight, reps } | null> (ส่ง null = ปิด fallback; ใช้ stub ในเทสต์)
function createVoiceParser({ geminiParse = createGeminiParser(), logger = console } = {}) {
  return async function parseVoice(text, options) {
    const local = parseCommand(text, options)
    const localResult = local && { ...local, source: 'local' }
    if (isComplete(local) || !geminiParse) return localResult

    try {
      const ai = await geminiParse(text)
      return ai ? mergeGemini(local, ai) : localResult
    } catch (err) {
      logger.warn(`[parse-voice] Gemini fallback failed: ${err.message}`)
      return localResult
    }
  }
}

module.exports = { createVoiceParser, isComplete }
