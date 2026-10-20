// Fuzzy matching ชื่อที่พูดมา -> ชื่อมาตรฐานในพจนานุกรม บน phoneticKey (ดู normalize.js)
//
// คะแนน 0-1 ต่อ alias = ค่าที่สูงสุดของ
//   - ตรงกันทั้งคำ: 1
//   - Levenshtein: 1 - ระยะแก้ไข / ความยาวคำที่ยาวกว่า
//   - alias อยู่ในคำที่พูด (มีคำอื่นติดมา เช่น "บาร์เบลสควอทหนัก"): 0.7 + 0.3 × สัดส่วนความยาว
//     alias ที่ยาวกว่าจึงชนะ ("ฟรอนต์สควอท" ได้ Front Squat ไม่ใช่ Squat)
//
// ผลลัพธ์แบ่ง 3 ระดับ:
//   exact  (>= HIGH_CONFIDENCE) ใช้ชื่อมาตรฐาน
//   fuzzy  (>= LOW_CONFIDENCE)  ไม่มั่นใจเต็มที่ แต่เลือกชื่อที่ใกล้ที่สุดให้แทนการ error
//   none   (< LOW_CONFIDENCE หรือกำกวม) ไม่ใกล้ชื่อไหนพอ เก็บชื่อที่พูดมาตามเดิม กันการบันทึกผิดท่า
//
// { force: true } (ใช้กับท่าออกกำลังกาย): ข้ามเกณฑ์ขั้นต่ำและการเช็คกำกวม เลือกชื่อที่คะแนนสูงสุดเสมอ
// (ได้ 'fuzzy' ถ้าไม่ถึง HIGH_CONFIDENCE) คะแนนเท่ากันเลือกท่าที่อยู่ก่อนในฐานข้อมูล = ท่ายอดฮิต
// คืน 'none' เฉพาะเมื่อไม่มีเสียงไหนคล้ายเลย (คะแนน 0)

const { phoneticKey } = require('./normalize')

const HIGH_CONFIDENCE = 0.85
const LOW_CONFIDENCE = 0.6
// คำสั้น (<= 3 เสียง) แก้ 1 ตัวก็กลายเป็นอีกคำได้ง่าย จึงต้องคล้ายมากกว่า
const SHORT_KEY_LENGTH = 3
const SHORT_KEY_MIN_SCORE = 0.75
const MIN_CONTAINED_ALIAS_LENGTH = 3
const AMBIGUITY_MARGIN = 0.03

function levenshtein(a, b) {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

function similarity(query, alias) {
  if (query === alias) return 1
  let score = 1 - levenshtein(query, alias) / Math.max(query.length, alias.length)
  if (alias.length >= MIN_CONTAINED_ALIAS_LENGTH && query.includes(alias)) {
    score = Math.max(score, 0.7 + 0.3 * (alias.length / query.length))
  }
  return score
}

// entries: [{ name, aliases }] -> matcher(rawName) => { name, score, match }
function createMatcher(entries) {
  const index = entries.map((entry) => ({
    entry,
    keys: [...new Set([entry.name, ...entry.aliases].map(phoneticKey).filter(Boolean))],
  }))

  return function match(rawName, { force = false } = {}) {
    const query = phoneticKey(rawName)
    if (!query) return { name: null, entry: null, score: 0, match: 'none' }

    let best = null
    let bestScore = 0
    let runnerUpScore = 0 // คะแนนสูงสุดของท่า/อาหาร "อื่น"
    let containingEntries = 0 // จำนวนท่า/อาหารที่มีคำที่พูดเป็นส่วนหนึ่งของชื่อ
    for (const { entry, keys } of index) {
      const entryScore = Math.max(...keys.map((key) => similarity(query, key)))
      if (keys.some((key) => key !== query && key.includes(query))) containingEntries++
      if (entryScore > bestScore) {
        runnerUpScore = bestScore
        best = entry
        bestScore = entryScore
      } else if (entryScore > runnerUpScore) {
        runnerUpScore = entryScore
      }
    }

    const minScore = query.length <= SHORT_KEY_LENGTH ? Math.max(LOW_CONFIDENCE, SHORT_KEY_MIN_SCORE) : LOW_CONFIDENCE
    // ไม่มั่นใจ และมีชื่ออื่นใกล้พอ ๆ กัน หรือคำที่พูดเป็นแค่ส่วนหนึ่งของหลายชื่อ
    // ("press" อยู่ในทุกท่า Press) = เดาสุ่ม จึงไม่เลือก
    const ambiguous =
      bestScore < HIGH_CONFIDENCE && (bestScore - runnerUpScore < AMBIGUITY_MARGIN || containingEntries > 1)
    const score = Math.round(bestScore * 100) / 100
    const rejected = force ? bestScore <= 0 : bestScore < minScore || ambiguous
    if (!best || rejected) return { name: null, entry: null, score, match: 'none' }
    return { name: best.name, entry: best, score, match: bestScore >= HIGH_CONFIDENCE ? 'exact' : 'fuzzy' }
  }
}

module.exports = { createMatcher, levenshtein, similarity, HIGH_CONFIDENCE, LOW_CONFIDENCE }
