// ประมาณแคลอรีที่เผาผลาญจาก workout_logs (ตารางไม่มีคอลัมน์แคลอรี จึงประมาณจากจำนวนเซต)
//
// สูตร MET: kcal = MET × น้ำหนักตัว (kg) × เวลา (ชั่วโมง)
// เวทเทรนนิ่งหนัก-ปานกลาง MET ≈ 5 และ 1 เซตใช้เวลาราว 3 นาทีรวมพัก
// -> 1 เซต ≈ 5 × น้ำหนักตัว × 0.05 ชม. (คน 70 กก. ≈ 17.5 kcal/เซต, 20 เซต ≈ 350 kcal)
// ไม่ได้กรอกน้ำหนักตัวใน Profile = ใช้ 70 กก.

const STRENGTH_MET = 5
const MINUTES_PER_SET = 3
export const DEFAULT_BODY_WEIGHT_KG = 70

export function estimateWorkoutCalories(logs, bodyWeightKg) {
  const weight = Number(bodyWeightKg) > 0 ? Number(bodyWeightKg) : DEFAULT_BODY_WEIGHT_KG
  const sets = logs.reduce((sum, log) => sum + (Number(log.sets) > 0 ? Number(log.sets) : 1), 0)
  return Math.round(STRENGTH_MET * weight * ((sets * MINUTES_PER_SET) / 60))
}
