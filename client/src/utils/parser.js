// แปลงข้อความจาก Web Speech API (th-TH) ให้เป็นข้อมูลบันทึกการออกกำลังกาย/มื้ออาหาร
//
// การจับคู่ชื่อท่าออกกำลังกาย (fuzzy + phonetic matching) อยู่ใน exerciseMatcher.js /
// exerciseDatabase.js / thaiPhonetics.js แยกเป็นโมดูลต่างหาก ไฟล์นี้ทำหน้าที่แค่
// ตัดคำขยะ + สกัดตัวเลข (น้ำหนัก/ครั้ง/เซต/แคล/โปรตีน) แล้วส่งชื่อท่า/อาหารที่เหลือไปจับคู่

import { matchExercise } from './exerciseMatcher.js'
import { stripFillerWords } from './thaiPhonetics.js'

const WORKOUT_VERBS_RE = /^(เล่น|ยก|ทำท่า|ฝึก|ออกกำลังกาย|ท่า)\s*/
const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*(กิโลกรัม|กิโล|กก\.?|โล)/
const REPS_RE = /(\d+)\s*(ครั้ง|เที่ยว|ที)/
const SETS_RE = /(\d+)\s*(เซต|เซ็ต|set)/i

const FOOD_VERBS_RE = /^(กิน|ทาน|ดื่ม)\s*/
const CALORIES_RE = /(\d+(?:\.\d+)?)\s*(กิโลแคลอรี่|แคลอรี่|แคล|kcal)/i
const PROTEIN_RE = /โปรตีน\s*(\d+(?:\.\d+)?)(?:\s*กรัม|\s*g)?/i
const CARBS_RE = /คาร์โบไฮเดรต|(?:คาร์บ)\s*(\d+(?:\.\d+)?)(?:\s*กรัม|\s*g)?/i
const FAT_RE = /ไขมัน\s*(\d+(?:\.\d+)?)(?:\s*กรัม|\s*g)?/i

function parseWorkout(text) {
  const weightMatch = text.match(WEIGHT_RE)
  const repsMatch = text.match(REPS_RE)
  const setsMatch = text.match(SETS_RE)

  if (!weightMatch && !repsMatch && !setsMatch) return null

  let name = text.replace(WORKOUT_VERBS_RE, '')
  if (weightMatch) name = name.replace(weightMatch[0], ' ')
  if (repsMatch) name = name.replace(repsMatch[0], ' ')
  if (setsMatch) name = name.replace(setsMatch[0], ' ')
  name = name.replace(/\s+/g, ' ').trim()

  if (!name) return null

  return {
    type: 'WORKOUT',
    exercise_name: matchExercise(name),
    weight_kg: weightMatch ? parseFloat(weightMatch[1]) : null,
    reps: repsMatch ? parseInt(repsMatch[1], 10) : null,
    sets: setsMatch ? parseInt(setsMatch[1], 10) : null,
  }
}

function parseFood(text) {
  const hasVerb = FOOD_VERBS_RE.test(text)
  const caloriesMatch = text.match(CALORIES_RE)

  if (!hasVerb && !caloriesMatch) return null

  const proteinMatch = text.match(PROTEIN_RE)
  const carbsMatch = text.match(CARBS_RE)
  const fatMatch = text.match(FAT_RE)

  let name = text.replace(FOOD_VERBS_RE, '')
  if (caloriesMatch) name = name.replace(caloriesMatch[0], ' ')
  if (proteinMatch) name = name.replace(proteinMatch[0], ' ')
  if (carbsMatch) name = name.replace(carbsMatch[0], ' ')
  if (fatMatch) name = name.replace(fatMatch[0], ' ')
  name = name.replace(/\s+/g, ' ').trim()

  if (!name) return null

  return {
    type: 'FOOD',
    food_name: name,
    calories: caloriesMatch ? parseFloat(caloriesMatch[1]) : null,
    protein: proteinMatch ? parseFloat(proteinMatch[1]) : null,
    carbs: carbsMatch ? parseFloat(carbsMatch[1]) : null,
    fat: fatMatch ? parseFloat(fatMatch[1]) : null,
  }
}

// รับข้อความจาก Speech-to-Text แล้วคืนค่า { type: 'WORKOUT' | 'FOOD', ... } หรือ null ถ้าแยกความหมายไม่ได้
export function parseVoiceText(rawText) {
  const cleaned = stripFillerWords((rawText || '').trim().replace(/\s+/g, ' '))
  if (!cleaned) return null

  return parseWorkout(cleaned) || parseFood(cleaned)
}
