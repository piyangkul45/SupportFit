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

// ช่วงเวลา 'all' = ทั้งหมด ; ตัวเลข = จำนวนวันย้อนหลังรวมวันนี้
export const ALL_TIME = 'all'

// เวลาเริ่มของช่วง (เที่ยงคืนตามเวลาเครื่องของวันแรก) เป็น ISO สำหรับ ?since= ; 'all' = undefined (ไม่กรอง)
export function sinceForRange(range, today = new Date()) {
  if (range === ALL_TIME) return undefined
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (range - 1))
  return start.toISOString()
}

// วันที่ในช่วง: ตัวเลข = lastNDates ; 'all' = ตั้งแต่วันแรกที่มีบันทึกจนถึงวันนี้
export function datesForRange(range, logs, today = new Date()) {
  if (range !== ALL_TIME) return lastNDates(range, today)
  const first = logs.reduce((min, log) => {
    const day = dayOf(log)
    return day && (!min || day < min) ? day : min
  }, '')
  if (!first) return lastNDates(7, today)
  const count = Math.round((new Date(`${localDateString(today)}T00:00:00`) - new Date(`${first}T00:00:00`)) / 86400000) + 1
  return lastNDates(Math.max(count, 1), today)
}

// ช่วงยาว (> 30 วัน) แสดงเป็นรายสัปดาห์ (เริ่มวันจันทร์) แท่งรายวันหลายร้อยแท่งจะบางจนอ่านไม่ได้
export const isWeeklyRange = (dates) => dates.length > 31

// แถวรายวัน -> รายสัปดาห์: ค่าเฉลี่ยต่อวัน "เฉพาะวันที่มีบันทึก" (hasData) ของแต่ละ field
// date ของแถว = วันจันทร์ต้นสัปดาห์ (สัปดาห์แรกอาจเริ่มกลางสัปดาห์)
export function toWeekly(rows, fields, hasData) {
  const weeks = new Map()
  for (const row of rows) {
    const date = new Date(`${row.date}T00:00:00`)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = localDateString(date)
    if (!weeks.has(key)) weeks.set(key, { date: key, days: 0, sums: Object.fromEntries(fields.map((field) => [field, 0])) })
    if (!hasData(row)) continue
    const week = weeks.get(key)
    week.days += 1
    for (const field of fields) week.sums[field] += row[field]
  }
  return Array.from(weeks.values()).map(({ date, days, sums }) => ({
    date,
    weekly: true,
    loggedDays: days,
    ...Object.fromEntries(fields.map((field) => [field, days ? Math.round(sums[field] / days) : 0])),
  }))
}

// แคลอรี/โปรตีนที่กินแต่ละวันใน dates (วันที่ไม่มีบันทึก = 0)
export function dailyMacroSeries(foodLogs, dates) {
  const rows = new Map(dates.map((date) => [date, { date, calories: 0, protein: 0, meals: 0 }]))
  for (const log of foodLogs) {
    const row = rows.get(dayOf(log))
    if (!row) continue
    row.calories += Number(log.calories) || 0
    row.protein += Number(log.protein) || 0
    row.meals += 1
  }
  return dates.map((date) => {
    const row = rows.get(date)
    return { ...row, calories: Math.round(row.calories), protein: Math.round(row.protein) }
  })
}

// เก็บเฉพาะ log ที่อยู่ในช่วงวันที่ (ใช้กรองข้อมูลที่โหลดมาเผื่อช่วงยาวกว่า)
export function logsInDates(logs, dates) {
  const first = dates[0]
  return logs.filter((log) => dayOf(log) >= first)
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
