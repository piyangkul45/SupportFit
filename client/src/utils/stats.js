// ข้อมูลของหน้า "สถิติ": แคลอรีรายวันย้อนหลัง และประวัติอาหาร/การออกกำลังกายแยกตามวัน
// วันที่ทั้งหมดเป็นวันตามเครื่องผู้ใช้ (localDateString) ไม่ใช่วันที่ UTC ของ created_at
// (UTC ทำให้รายการตอนเช้ามืดในไทยไปตกวันก่อนหน้า)

import { caloriesForLog } from './calories'
import { localDateString } from './date'

const dayOf = (log) => (log.created_at ? localDateString(new Date(log.created_at)) : '')

// ['YYYY-MM-DD', ...] ย้อนหลัง count วัน จนถึงวันนี้ เรียงจากเก่าไปใหม่
export function lastNDates(count, today = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (count - 1 - i))
    return localDateString(date)
  })
}

// Calories In (food_logs) และ Calories Out (workout_logs) ของแต่ละวันใน dates (วันที่ไม่มีข้อมูล = 0)
export function dailyCalorieSeries(foodLogs, workoutLogs, dates, bodyWeightKg) {
  const rows = new Map(dates.map((date) => [date, { date, caloriesIn: 0, caloriesOut: 0 }]))
  for (const log of foodLogs) {
    const row = rows.get(dayOf(log))
    if (row) row.caloriesIn += Number(log.calories) || 0
  }
  for (const log of workoutLogs) {
    const row = rows.get(dayOf(log))
    if (row) row.caloriesOut += caloriesForLog(log, bodyWeightKg)
  }
  return dates.map((date) => {
    const row = rows.get(date)
    return { ...row, caloriesIn: Math.round(row.caloriesIn), caloriesOut: Math.round(row.caloriesOut) }
  })
}

// [{ date, foods, workouts, totals: { calories, protein, carbs, fat, caloriesOut } }] เฉพาะวันที่มีบันทึก ใหม่ไปเก่า
export function historyByDate(foodLogs, workoutLogs, bodyWeightKg) {
  const days = new Map()
  const entry = (date) => {
    if (!days.has(date)) days.set(date, { date, foods: [], workouts: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, caloriesOut: 0 } })
    return days.get(date)
  }
  for (const log of foodLogs) {
    const date = dayOf(log)
    if (!date) continue
    const day = entry(date)
    day.foods.push(log)
    for (const field of ['calories', 'protein', 'carbs', 'fat']) day.totals[field] += Number(log[field]) || 0
  }
  for (const log of workoutLogs) {
    const date = dayOf(log)
    if (!date) continue
    const day = entry(date)
    day.workouts.push(log)
    day.totals.caloriesOut += caloriesForLog(log, bodyWeightKg)
  }
  const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at)
  return Array.from(days.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((day) => ({ ...day, foods: day.foods.sort(byTime), workouts: day.workouts.sort(byTime) }))
}

// แกน X: 'YYYY-MM-DD' -> "28 ต.ค." / "Oct 28"
export function shortDate(date, language) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })
}

export function longDate(date, language) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
