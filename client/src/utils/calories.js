// แคลอรีที่เผาผลาญจากการออกกำลังกาย (Calories Out)
//
// สูตร MET: kcal = MET × น้ำหนักตัว (kg) × เวลา (ชั่วโมง) ค่า MET ของแต่ละท่าอยู่ใน utils/exerciseCatalog.js
// - เวท / สตรีทเวิร์กเอาต์: เวลา = จำนวนเซต × 3 นาที (รวมพัก) -> คน 70 กก. ท่า MET 5 ≈ 17.5 kcal/เซต
// - คาร์ดิโอ: ใช้เวลาที่กรอก ถ้าเป็นวิ่ง/เดินและกรอกระยะทาง ใช้ kcalPerKgKm × น้ำหนักตัว × ระยะทาง แทน
// ไม่ได้กรอกน้ำหนักตัวใน Profile = ใช้ 70 กก.

import { DEFAULT_MET, findExercise } from './exerciseCatalog'

const MINUTES_PER_SET = 3
export const DEFAULT_BODY_WEIGHT_KG = 70

const positive = (value) => (Number(value) > 0 ? Number(value) : 0)
const bodyWeightOf = (bodyWeightKg) => positive(bodyWeightKg) || DEFAULT_BODY_WEIGHT_KG

// { category, met?, kcalPerKgKm?, sets?, durationMin?, distanceKm? } -> kcal (จำนวนเต็ม)
export function calculateCaloriesBurned({ category, met, kcalPerKgKm, sets, durationMin, distanceKm }, bodyWeightKg) {
  const weight = bodyWeightOf(bodyWeightKg)
  const activityMet = positive(met) || DEFAULT_MET[category] || DEFAULT_MET.strength

  if (category === 'cardio') {
    const distance = positive(distanceKm)
    if (kcalPerKgKm && distance) return Math.round(kcalPerKgKm * weight * distance)
    return Math.round(activityMet * weight * (positive(durationMin) / 60))
  }
  const setCount = positive(sets) || 1
  return Math.round(activityMet * weight * ((setCount * MINUTES_PER_SET) / 60))
}

// แคลอรีของ log หนึ่งแถว: ใช้ค่าที่บันทึกไว้ (calories_burned) ถ้าไม่มี (log เก่า/Voice Log) ประมาณจากท่าและจำนวนเซต
export function caloriesForLog(log, bodyWeightKg) {
  if (log.calories_burned != null) return Number(log.calories_burned) || 0
  return calculateCaloriesBurned(logToActivity(log), bodyWeightKg)
}

// ข้อมูลที่ใช้คำนวณของ log (ใช้ตอนแก้ไข log แล้วคำนวณแคลอรีใหม่)
export function logToActivity(log) {
  const exercise = findExercise(log.exercise_name)
  const category = log.activity_type || exercise?.category || 'strength'
  return {
    category,
    met: exercise?.category === category ? exercise.met : undefined,
    kcalPerKgKm: exercise?.kcalPerKgKm,
    sets: log.sets,
    durationMin: log.duration_min,
    distanceKm: log.distance_km,
  }
}

export function estimateWorkoutCalories(logs, bodyWeightKg) {
  return logs.reduce((sum, log) => sum + caloriesForLog(log, bodyWeightKg), 0)
}
