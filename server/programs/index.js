// โปรแกรมฝึก: ตรวจข้อมูลโปรแกรมที่ผู้ใช้สร้าง, หาวันฝึกของ "วันนี้" ตามรอบตาราง, ค้นหาท่ามาตรฐาน
// ใช้ใน routes/programs.js (แยกเป็น pure function เพื่อทดสอบได้โดยไม่ต้องต่อฐานข้อมูล)

const { PRESET_PROGRAMS } = require('./presets')
const { EXERCISES } = require('../parser/dictionary')

const EXERCISE_NAMES = new Map(EXERCISES.map((exercise) => [exercise.name.toLowerCase(), exercise.name]))
// ~60 ท่าแรกของฐานข้อมูลคือท่ายอดฮิตที่มี alias ไทย ให้ขึ้นก่อนในผลค้นหา
const POPULAR_COUNT = 60

const LIMITS = {
  title: 80,
  description: 300,
  dayName: 60,
  days: 14,
  exercisesPerDay: 20,
  sets: [1, 20],
  reps: [1, 100],
  weight: [0, 1000],
}

// ชื่อท่าที่ผู้ใช้เลือก -> ชื่อมาตรฐาน (ตัวพิมพ์ตามฐานข้อมูล) หรือ null ถ้าไม่มีท่านี้
const canonicalExerciseName = (name) => EXERCISE_NAMES.get(String(name || '').trim().toLowerCase()) || null

function integerInRange(value, [min, max]) {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined
}

// body ของ POST/PUT /api/programs -> { values: { title, description, days } } หรือ { error: { key, params } }
// วันที่ไม่มีท่า = วันพัก ต้องมีวันฝึกอย่างน้อย 1 วัน
function validateProgramInput(body = {}) {
  const fail = (key, params) => ({ error: { key, params } })

  const title = String(body.title || '').trim()
  if (!title) return fail('programs.titleRequired')
  if (title.length > LIMITS.title) return fail('programs.titleTooLong', { max: LIMITS.title })
  const description = String(body.description || '').trim().slice(0, LIMITS.description)

  if (!Array.isArray(body.days) || body.days.length === 0) return fail('programs.daysRequired')
  if (body.days.length > LIMITS.days) return fail('programs.tooManyDays', { max: LIMITS.days })

  const days = []
  for (const [dayIndex, rawDay] of body.days.entries()) {
    const dayNumber = dayIndex + 1
    const exercises = Array.isArray(rawDay?.exercises) ? rawDay.exercises : []
    if (exercises.length > LIMITS.exercisesPerDay) {
      return fail('programs.tooManyExercises', { day: dayNumber, max: LIMITS.exercisesPerDay })
    }

    const day = { name: String(rawDay?.name || '').trim().slice(0, LIMITS.dayName), exercises: [] }
    for (const rawExercise of exercises) {
      const exercise_name = canonicalExerciseName(rawExercise?.exercise_name)
      if (!exercise_name) return fail('programs.unknownExercise', { day: dayNumber, name: String(rawExercise?.exercise_name || '') })
      const sets = integerInRange(rawExercise.sets, LIMITS.sets)
      const reps = integerInRange(rawExercise.reps, LIMITS.reps)
      const weightRaw = rawExercise.weight_kg
      const weight_kg = weightRaw === '' || weightRaw == null ? null : Number(weightRaw)
      if (sets === undefined || reps === undefined) return fail('programs.invalidTarget', { day: dayNumber, name: exercise_name })
      if (weight_kg != null && !(Number.isFinite(weight_kg) && weight_kg >= LIMITS.weight[0] && weight_kg <= LIMITS.weight[1])) {
        return fail('programs.invalidTarget', { day: dayNumber, name: exercise_name })
      }
      day.exercises.push({ exercise_name, sets, reps, weight_kg: weight_kg == null ? null : Math.round(weight_kg * 100) / 100 })
    }
    days.push(day)
  }

  if (!days.some((day) => day.exercises.length > 0)) return fail('programs.noTrainingDays')
  return { values: { title, description, days } }
}

// 'YYYY-MM-DD' -> จำนวนวันนับจาก epoch (เทียบแค่วันที่ ไม่สนเวลา/เขตเวลา)
function dayNumberOf(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''))
  if (!match) return null
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(time) ? null : Math.floor(time / 86400000)
}

const isDateString = (value) => dayNumberOf(value) != null

// วันที่เริ่มโปรแกรม = วันแรกของรอบ แล้ววนตามจำนวนวันในโปรแกรม
// today ก่อนวันเริ่ม (เปลี่ยนเขตเวลา/นาฬิกาเครื่องผิด) ถือเป็นวันแรก
function scheduledDay(program, startedOn, today) {
  const cycleLength = program.days.length
  const elapsed = Math.max(0, (dayNumberOf(today) ?? 0) - (dayNumberOf(startedOn) ?? 0))
  const dayIndex = elapsed % cycleLength
  const day = program.days[dayIndex]
  return {
    day_index: dayIndex,
    day_number: dayIndex + 1,
    cycle_length: cycleLength,
    week: Math.floor(elapsed / cycleLength) + 1,
    is_rest_day: day.exercises.length === 0,
    day,
  }
}

// ค้นหาท่าจากชื่อมาตรฐานหรือ alias (ไทย/อังกฤษ) เรียงตาม: ขึ้นต้นด้วยคำค้น > มีคำค้น, ท่ายอดฮิตก่อน
function searchExercises(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase()
  const results = []
  EXERCISES.forEach((exercise, index) => {
    const names = [exercise.name, ...exercise.aliases].map((name) => name.toLowerCase())
    let rank
    if (!q) rank = index < POPULAR_COUNT ? 2 : null
    else if (names.some((name) => name.startsWith(q))) rank = 0
    else if (names.some((name) => name.includes(q))) rank = 1
    if (rank == null) return
    results.push({ rank: rank * 2 + (index < POPULAR_COUNT ? 0 : 1), index, name: exercise.name })
  })
  return results
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ name }) => name)
}

module.exports = {
  PRESET_PROGRAMS,
  LIMITS,
  canonicalExerciseName,
  validateProgramInput,
  scheduledDay,
  isDateString,
  searchExercises,
}
