// AI Parser: ข้อความจาก Voice/Text -> ข้อมูลบันทึกการออกกำลังกายหรือมื้ออาหารแบบมีโครงสร้าง
//
// ขั้นตอน: ทำความสะอาดข้อความ -> ดึงตัวเลข+หน่วย (รองรับคำพูดไทยแบบภาษาพูด: โล/ที/รอบ/ชุด/แคล,
// ตัวเลขคำไทย, เลขไทย) -> ส่วนที่เหลือคือชื่อท่า/อาหาร -> fuzzy match กับพจนานุกรม (matcher.js)
//
// ผลลัพธ์มีทุก field เสมอ (field ที่ไม่เกี่ยวกับ type นั้นเป็น null):
// { type: 'workout' | 'food', exercise_name, weight_kg, reps, sets, food_name, calories, protein,
//   carbs, fat, confidence, match_type: 'exact' | 'fuzzy' | 'none', spoken_name, macros_estimated }
// คืน null เมื่อแยกความหมายไม่ได้

const { NUMBER_SOURCE: N, parseNumber, cleanText, toTitleCase } = require('./normalize')
const { createMatcher } = require('./matcher')
const { EXERCISES, FOODS } = require('./dictionary')

const matchExercise = createMatcher(EXERCISES)
const matchFood = createMatcher(FOODS)

const LB_TO_KG = 0.45359237
const EN_END = '(?![a-z])'

// ---- หน่วย (ลำดับสำคัญ: แคลอรี่ก่อนน้ำหนัก เพราะ "กิโลแคล" ขึ้นต้นด้วย "กิโล") ----
const CALORIES_RES = [
  new RegExp(`(${N})\\s*(?:กิโลแคลอรี่|กิโลแคลอรี|กิโลแคล|แคลอรี่|แคลอรี|แคล|kcal|calories|calorie|cals?)${EN_END}`, 'i'),
  new RegExp(`(?:แคลอรี่|แคลอรี|แคล|kcal|calories)\\s*(${N})`, 'i'),
]

// ไม่นับเป็นกรัมของสารอาหารถ้าตามด้วยหน่วยเสิร์ฟ ("เวย์โปรตีน 2 สกู๊ป")
const SERVING_UNITS = 'จาน|ชาม|ฟอง|ลูก|ผล|แก้ว|ถ้วย|ชิ้น|สกู๊ป|กล่อง|ห่อ|ไม้|ที่|scoops?|servings?|pieces?|cups?|bowls?|plates?'
const GRAMS = '(?:กรัม|grams?|g)'

function macroPatterns(keywords) {
  return [
    new RegExp(`(?<!เวย์\\s?)(?:${keywords})\\s*(${N})(?!\\s*(?:${SERVING_UNITS}))\\s*(?:${GRAMS}${EN_END})?`, 'i'),
    new RegExp(`(${N})\\s*${GRAMS}\\s*(?:${keywords})`, 'i'),
  ]
}
const PROTEIN_RES = macroPatterns('โปรตีน|protein')
const CARBS_RES = macroPatterns('คาร์โบไฮเดรต|คาร์โบ|คาร์บ|carbohydrates?|carbs?')
const FAT_RES = macroPatterns('ไขมัน|fat')

const WEIGHT_KG_RE = new RegExp(`(${N})\\s*(?:กิโลกรัม|กิโล(?!แคล)|กก\\.?|โล|kgs?|kilograms?|kilos?)${EN_END}`, 'i')
const WEIGHT_LB_RE = new RegExp(`(${N})\\s*(?:ปอนด์|lbs?|pounds?)${EN_END}`, 'i')
// "ที" ต้องไม่ใช่ "ที่" (หน่วยเสิร์ฟ) หรือ "ทีบาร์" (T-Bar Row)
const REPS_RE = new RegExp(`(${N})\\s*(?:ครั้ง|ที(?![่-๋]|บาร์)|รอบ|เที่ยว|reps?|times)${EN_END}`, 'i')
const SETS_RE = new RegExp(`(${N})\\s*(?:เซ็ต|เซต|เซ็ท|เซท|เช็ต|ชุด|sets?)${EN_END}`, 'i')
// "5x5", "3 x 10" = เซต x ครั้ง
const SETS_X_REPS_RE = /(\d+)\s*[x×]\s*(\d+)(?!\d)/i

const PORTION_RE = new RegExp(`(${N})\\s*${GRAMS}${EN_END}`, 'i')
const SERVINGS_RE = new RegExp(`(${N})\\s*(?:${SERVING_UNITS})${EN_END}`, 'i')

const FOOD_VERBS_RE = /^(?:รับประทาน|กิน|ทาน|ดื่ม|eat|ate|eating|drink|drank|had)\s*/i
const WORKOUT_VERBS_RE = /^(?:ออกกำลังกาย|ทำท่า|เล่น|ยก|ทำ|ฝึก|ท่า|did|do|doing)\s*/i
// คำเชื่อมที่เหลือหลังตัดตัวเลขออก ("3 เซต เซตละ 10 ครั้ง" -> "เซตละ")
const LEFTOVER_RE = /(?:เซ็?[ตท]|ชุด|ครั้ง|set|rep)\s*ละ|(?:^|\s)(?:ละ|และ|กับ|with|and|of|x|at|for)(?=\s|$)|[,.:;!?()"']/gi

// หาค่าแรกที่ตรงกับ pattern ใด pattern หนึ่ง แล้วตัดออกจากข้อความ (ส่วนที่เหลือคือชื่อ)
function take(state, patterns) {
  for (const pattern of [].concat(patterns)) {
    const found = state.text.match(pattern)
    if (found) {
      state.text = state.text.replace(found[0], ' ')
      return found
    }
  }
  return null
}

const takeNumber = (state, patterns) => {
  const found = take(state, patterns)
  return found ? parseNumber(found[1]) : null
}

const round = (value, digits = 1) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits)
const toInt = (value) => (value == null ? null : Math.round(value))

function cleanName(text) {
  return text.replace(LEFTOVER_RE, ' ').replace(/\s+/g, ' ').trim()
}

// เทียบทั้งแบบมีและไม่มีคำกริยานำหน้า เพราะบางท่ามีคำกริยาเป็นชื่อ ("ยกขา" = Leg Raise, "เล่นอก" = Bench Press)
// options.force: บังคับเลือกชื่อมาตรฐานที่ใกล้ที่สุด (ดู matcher.js)
function matchBest(matcher, name, verbsRe, options) {
  const withoutVerb = cleanName(name.replace(verbsRe, ''))
  const candidates = [...new Set([name, withoutVerb].filter(Boolean))]
  let best = null
  for (const candidate of candidates) {
    const result = { ...matcher(candidate, options), spoken: candidate }
    if (!best || result.score > best.score) best = result
  }
  // ไม่ตรงกับชื่อไหนเลย: เก็บชื่อที่พูดโดยตัดคำกริยาออก ("ท่าพิเศษ" -> "พิเศษ")
  if (best?.match === 'none' && withoutVerb) best.spoken = withoutVerb
  return best
}

function emptyResult() {
  return {
    type: null,
    exercise_name: null,
    weight_kg: null,
    reps: null,
    sets: null,
    food_name: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    confidence: 0,
    match_type: 'none',
    spoken_name: null,
    macros_estimated: false,
  }
}

// มีตัวเลขท่าออกกำลังกายแล้ว = ผู้ใช้กำลังบันทึกท่าแน่ ๆ จึงบังคับเป็นชื่อท่ามาตรฐานที่ใกล้ที่สุด
// แทนการเก็บคำที่ฟังผิด ("ใบเสด") ผู้ใช้เห็นคำที่ได้ยินใน preview (match_type 'fuzzy') และแก้ทีหลังได้
function buildWorkout(name, { weight, reps, sets }) {
  const match = matchBest(matchExercise, name, WORKOUT_VERBS_RE, { force: true })
  if (!match?.spoken) return null
  return {
    ...emptyResult(),
    type: 'workout',
    exercise_name: match.name || toTitleCase(match.spoken),
    weight_kg: round(weight, 2),
    reps: toInt(reps),
    sets: toInt(sets),
    confidence: match.score,
    match_type: match.match,
    spoken_name: match.spoken,
  }
}

function buildFood(name, { calories, protein, carbs, fat, portionGrams, servings }) {
  const match = matchBest(matchFood, name, FOOD_VERBS_RE)
  if (!match?.spoken) return null

  const spoken = { calories, protein, carbs, fat }
  const values = { ...spoken }
  let estimated = false
  // อาหารที่รู้จัก: เติมค่าที่ไม่ได้พูดมาจากค่าประมาณต่อที่ คูณตามปริมาณ (กรัม หรือจำนวนที่)
  if (match.entry) {
    const factor = portionGrams ? portionGrams / match.entry.serving_g : servings || 1
    for (const key of Object.keys(values)) {
      if (values[key] == null) {
        values[key] = match.entry[key] * factor
        estimated = true
      }
    }
  }

  return {
    ...emptyResult(),
    type: 'food',
    food_name: match.name || toTitleCase(match.spoken),
    // จำนวนเต็มให้ตรงกับคอลัมน์ integer ของ food_logs (preview = ค่าที่บันทึกจริง)
    calories: round(values.calories, 0),
    protein: round(values.protein, 0),
    carbs: round(values.carbs, 0),
    fat: round(values.fat, 0),
    confidence: match.score,
    match_type: match.match,
    spoken_name: match.spoken,
    macros_estimated: estimated,
  }
}

function parseCommand(rawText) {
  const text = cleanText(rawText)
  if (!text) return null

  const hasFoodVerb = FOOD_VERBS_RE.test(text)
  const state = { text: text.replace(FOOD_VERBS_RE, '') }

  const macros = {
    calories: takeNumber(state, CALORIES_RES),
    protein: takeNumber(state, PROTEIN_RES),
    carbs: takeNumber(state, CARBS_RES),
    fat: takeNumber(state, FAT_RES),
  }
  const hasMacros = Object.values(macros).some((value) => value != null)

  if (!hasFoodVerb) {
    const pounds = takeNumber(state, WEIGHT_LB_RE)
    const workout = {
      weight: takeNumber(state, WEIGHT_KG_RE) ?? (pounds == null ? null : pounds * LB_TO_KG),
      sets: takeNumber(state, SETS_RE),
      reps: takeNumber(state, REPS_RE),
    }
    const setsByReps = take(state, SETS_X_REPS_RE)
    if (setsByReps) {
      workout.sets ??= parseInt(setsByReps[1], 10)
      workout.reps ??= parseInt(setsByReps[2], 10)
    }
    if (Object.values(workout).some((value) => value != null)) {
      return buildWorkout(cleanName(state.text), workout)
    }
  }

  const portion = {
    portionGrams: takeNumber(state, PORTION_RE),
    servings: takeNumber(state, SERVINGS_RE),
  }
  const name = cleanName(state.text)
  if (!name) return null

  if (hasFoodVerb || hasMacros || portion.portionGrams != null || portion.servings != null) {
    return buildFood(name, { ...macros, ...portion })
  }

  // ไม่มีตัวเลขเลย: รับเฉพาะชื่ออาหารที่มั่นใจ ("ข้าวอกไก่") ชื่อท่าเฉย ๆ ไม่มีข้อมูลพอจะบันทึก
  const food = buildFood(name, {})
  return food?.match_type === 'exact' ? food : null
}

module.exports = { parseCommand }
