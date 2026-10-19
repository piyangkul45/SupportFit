import Fuse from 'fuse.js'
import { EXERCISE_DATABASE } from './exerciseDatabase.js'
import { normalizePhonetic } from './thaiPhonetics.js'

// Fuse.js distance: 0 = ตรงเป๊ะ, 1 = ไม่เกี่ยวกันเลย
// 0.45 ≈ เกณฑ์ "คล้ายกันเกิน 60%" ตามที่กำหนด (ยืนยันด้วยการทดสอบกับกรณีจริง)
const SIMILARITY_THRESHOLD = 0.45

// เก็บ index เดียวต่อหนึ่งท่า (ไม่ flatten ทีละ alias เหมือนก่อนหน้า) แล้วให้ Fuse ค้นหา
// พร้อมกันทั้งฟิลด์ name และ aliases ตามที่กำหนด โดยให้น้ำหนัก aliases สูงกว่า เพราะเป็น
// คำที่คนไทยพูดจริง ส่วน name (ภาษาอังกฤษ) ไว้จับกรณี STT ถอดเสียงออกมาเป็นคำทับศัพท์ตรงตัว
// ทั้งสองฟิลด์ผ่าน normalizePhonetic ก่อนเทียบเพื่อให้ยังคุมเกณฑ์ความคล้ายเสียงแบบเดียวกัน
const searchIndex = EXERCISE_DATABASE.map((exercise) => ({
  ...exercise,
  _normalizedName: normalizePhonetic(exercise.name),
  _normalizedAliases: exercise.aliases.map(normalizePhonetic),
}))

const fuse = new Fuse(searchIndex, {
  keys: [
    { name: '_normalizedAliases', weight: 0.7 },
    { name: '_normalizedName', weight: 0.3 },
  ],
  includeScore: true,
  threshold: SIMILARITY_THRESHOLD,
  distance: 100,
  ignoreLocation: true,
})

function toTitleCase(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((word) =>
      /^[a-zA-Z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word
    )
    .join(' ')
}

// จับคู่ชื่อท่าที่พูดมากับ Master Exercise List ด้วย fuzzy search บนคำที่ผ่าน phonetic
// normalization แล้ว หากไม่มีคำที่คล้ายพอ (> 60%) จะคืนค่าชื่อที่ทำความสะอาดแล้วแทน
// การ auto-correct แบบไม่มั่นใจ
export function matchExercise(rawName) {
  const trimmed = (rawName || '').trim()
  if (!trimmed) return trimmed

  const [best] = fuse.search(normalizePhonetic(trimmed))
  if (best) return best.item.name

  return toTitleCase(trimmed)
}

// เหมือน matchExercise แต่คืนรายละเอียดเพิ่มสำหรับ debug/แสดงผล confidence
export function matchExerciseWithConfidence(rawName) {
  const trimmed = (rawName || '').trim()
  if (!trimmed) return { name: trimmed, confidence: 0, matched: false }

  const [best] = fuse.search(normalizePhonetic(trimmed))
  if (best) {
    return { name: best.item.name, confidence: 1 - best.score, matched: true }
  }

  return { name: toTitleCase(trimmed), confidence: 0, matched: false }
}
