// แสดงผลโปรแกรมฝึกจาก API (server/programs): preset แปลจาก key, โปรแกรมของผู้ใช้ใช้ข้อความที่ผู้ใช้ตั้ง
// วันที่ไม่มีท่า = วันพัก

export const isRestDay = (day) => !day?.exercises?.length

export const programTitle = (program, t) =>
  program.key ? t(`programs.presets.${program.key}.title`, { defaultValue: program.title }) : program.title

export const programDescription = (program, t) =>
  program.key ? t(`programs.presets.${program.key}.description`, { defaultValue: program.description }) : program.description

// index = ตำแหน่งในรอบ (เริ่ม 0)
export function dayName(day, index, t) {
  if (day.key) return t(`programs.dayNames.${day.key}`, { defaultValue: day.name })
  if (day.name) return day.name
  return isRestDay(day) ? t('programs.restDay') : t('programs.dayFallback', { number: index + 1 })
}

export const trainingDayCount = (program) => program.days.filter((day) => !isRestDay(day)).length

// เซตที่ทำไปแล้ววันนี้ของแต่ละท่า (ชื่อตัวพิมพ์เล็ก -> จำนวนเซต) log ที่ไม่ได้ระบุเซตนับเป็น 1 เซต
export function countSetsByExercise(logs) {
  const counts = new Map()
  for (const log of logs) {
    const name = (log.exercise_name || '').toLowerCase()
    counts.set(name, (counts.get(name) || 0) + (log.sets || 1))
  }
  return counts
}

// preset หรือโปรแกรมของผู้ใช้ -> ค่าเริ่มต้นของฟอร์มสร้าง/แก้ไขโปรแกรม (copy: คัดลอก preset เป็นโปรแกรมใหม่)
export function toBuilderDraft(program, t, { copy = false } = {}) {
  if (!program) return { title: '', description: '', days: [{ name: '', exercises: [] }] }
  return {
    title: copy ? t('programs.builder.copyTitle', { title: programTitle(program, t) }) : program.title,
    description: programDescription(program, t),
    days: program.days.map((day, index) => ({
      name: day.key || program.key ? (isRestDay(day) ? '' : dayName(day, index, t)) : day.name,
      exercises: day.exercises.map((exercise) => ({ ...exercise, weight_kg: exercise.weight_kg ?? '' })),
    })),
  }
}
