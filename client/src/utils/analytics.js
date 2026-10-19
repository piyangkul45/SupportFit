import { toDateOnly } from './date'

// รายชื่อท่าที่มีการบันทึกไว้ทั้งหมด (ไม่ซ้ำ, เรียงตามตัวอักษร)
export function getExerciseNames(workoutLogs) {
  const names = new Set(workoutLogs.map((log) => log.exercise_name))
  return Array.from(names).sort()
}

// ข้อมูลแนวโน้ม 1RM และ Volume Load ของท่าที่เลือก เรียงจากเก่าไปใหม่
export function getExerciseSeries(workoutLogs, exerciseName) {
  return workoutLogs
    .filter((log) => log.exercise_name === exerciseName)
    .map((log) => ({
      date: toDateOnly(log.created_at),
      estimated_1rm:
        log.estimated_1rm != null ? Number(log.estimated_1rm.toFixed(1)) : null,
      volume_load: log.volume_load,
    }))
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
}

// ผลรวมแคลอรี/โปรตีนรายวัน ย้อนหลังสูงสุด `days` วัน เรียงจากเก่าไปใหม่
export function getDailyMacroSeries(foodLogs, days = 30) {
  const totals = new Map()

  for (const log of foodLogs) {
    const date = toDateOnly(log.created_at)
    if (!date) continue
    const entry = totals.get(date) || { date, calories: 0, protein: 0 }
    entry.calories += log.calories || 0
    entry.protein += log.protein || 0
    totals.set(date, entry)
  }

  return Array.from(totals.values())
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
    .slice(-days)
}
