// ข้อมูลกายวิภาค (Visual Muscle Anatomy) ของท่าใน utils/exerciseCatalog.js
// primary = กล้ามเนื้อหลัก (Target) / secondary = กล้ามเนื้อรอง (Secondary)
// level: 'beginner' | 'intermediate' | 'advanced' ; equipment: true = ต้องใช้อุปกรณ์ (ดัมเบล, บาร์, เครื่อง, ลูกบอล ...)
import { EXERCISES, findExercise } from './exerciseCatalog.js'

// กล้ามเนื้อที่วาดได้ใน MuscleIcon (view = ด้านที่มองเห็นกล้ามเนื้อนั้นชัดที่สุด)
export const MUSCLES = {
  chest: { view: 'front' },
  shoulders: { view: 'front' },
  biceps: { view: 'front' },
  forearms: { view: 'front' },
  abs: { view: 'front' },
  quads: { view: 'front' },
  back: { view: 'back' },
  triceps: { view: 'back' },
  glutes: { view: 'back' },
  hamstrings: { view: 'back' },
  calves: { view: 'back' },
  fullbody: { view: 'front' },
}

// Quick Filter ตามส่วนร่างกาย: ท่าจะอยู่ในส่วนไหนดูจาก "กล้ามเนื้อหลัก" เท่านั้น
export const BODY_PARTS = {
  chest: ['chest'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  glutes: ['glutes'],
  core: ['abs'],
  arms: ['biceps', 'triceps', 'forearms'],
  back: ['back'],
  shoulders: ['shoulders'],
}
export const BODY_PART_KEYS = Object.keys(BODY_PARTS)
// ไอคอนของปุ่ม filter: ไฮไลต์กล้ามเนื้อเหล่านี้บนรูปร่างกาย
export const BODY_PART_ICON = {
  chest: ['chest'],
  legs: ['quads'],
  glutes: ['glutes'],
  core: ['abs'],
  arms: ['biceps', 'forearms'],
  back: ['back'],
  shoulders: ['shoulders'],
}

export const LEVELS = ['beginner', 'intermediate', 'advanced']

const a = (primary, secondary, level, equipment) => ({ primary, secondary, level, equipment })

const ANATOMY = {
  // ---- เวทเทรนนิ่ง ----
  'Squat': a(['quads', 'glutes'], ['hamstrings', 'abs'], 'intermediate', true),
  'Bench Press': a(['chest'], ['triceps', 'shoulders'], 'intermediate', true),
  'Deadlift': a(['back', 'hamstrings', 'glutes'], ['forearms', 'quads'], 'intermediate', true),
  'Overhead Press': a(['shoulders'], ['triceps', 'abs'], 'intermediate', true),
  'Barbell Row': a(['back'], ['biceps', 'forearms'], 'intermediate', true),
  'Romanian Deadlift': a(['hamstrings', 'glutes'], ['back'], 'intermediate', true),
  'Leg Press': a(['quads'], ['glutes', 'hamstrings'], 'beginner', true),
  'Lat Pulldown': a(['back'], ['biceps'], 'beginner', true),
  'Incline Bench Press': a(['chest'], ['shoulders', 'triceps'], 'intermediate', true),
  'Dumbbell Bench Press': a(['chest'], ['triceps', 'shoulders'], 'beginner', true),
  'Hip Thrust': a(['glutes'], ['hamstrings'], 'beginner', true),
  'Lunge': a(['quads', 'glutes'], ['hamstrings', 'calves'], 'beginner', false),
  'Bicep Curl': a(['biceps'], ['forearms'], 'beginner', true),
  'Tricep Pushdown': a(['triceps'], [], 'beginner', true),
  'Lateral Raise': a(['shoulders'], [], 'beginner', true),
  'Leg Extension': a(['quads'], [], 'beginner', true),
  'Leg Curl': a(['hamstrings'], ['calves'], 'beginner', true),
  'Cable Fly': a(['chest'], ['shoulders'], 'beginner', true),
  'Clean and Jerk': a(['quads', 'glutes', 'shoulders'], ['back', 'triceps'], 'advanced', true),
  'Kettlebell Swing': a(['glutes', 'hamstrings'], ['back', 'shoulders', 'abs'], 'intermediate', true),

  // ---- คาร์ดิโอ ----
  'Running': a(['quads', 'calves'], ['hamstrings', 'glutes', 'abs'], 'beginner', false),
  'Treadmill Running': a(['quads', 'calves'], ['hamstrings', 'glutes', 'abs'], 'beginner', true),
  'Walking': a(['quads', 'calves'], ['glutes'], 'beginner', false),
  'Hiking': a(['quads', 'glutes'], ['calves', 'hamstrings'], 'beginner', false),
  'Cycling': a(['quads'], ['hamstrings', 'calves', 'glutes'], 'beginner', true),
  'Stationary Bike': a(['quads'], ['hamstrings', 'calves', 'glutes'], 'beginner', true),
  'Swimming': a(['back', 'shoulders'], ['chest', 'triceps', 'abs'], 'intermediate', false),
  'Rowing Machine': a(['back', 'quads'], ['biceps', 'hamstrings', 'abs'], 'beginner', true),
  'Elliptical': a(['quads', 'glutes'], ['hamstrings', 'shoulders'], 'beginner', true),
  'Stair Climber': a(['quads', 'glutes'], ['calves'], 'beginner', true),
  'Jump Rope': a(['calves'], ['quads', 'shoulders'], 'beginner', true),
  'HIIT': a(['fullbody'], [], 'intermediate', false),
  'Boxing': a(['shoulders', 'abs'], ['chest', 'back', 'calves'], 'intermediate', false),
  'Badminton': a(['quads', 'shoulders'], ['calves', 'forearms'], 'beginner', true),
  'Football': a(['quads', 'hamstrings'], ['calves', 'glutes', 'abs'], 'beginner', true),
  'Basketball': a(['quads', 'calves'], ['shoulders', 'abs'], 'beginner', true),
  'Dancing': a(['fullbody'], [], 'beginner', false),
  'Yoga': a(['abs'], ['back', 'hamstrings', 'shoulders'], 'beginner', false),

  // ---- สตรีทเวิร์กเอาต์ ----
  'Push Up': a(['chest'], ['triceps', 'shoulders', 'abs'], 'beginner', false),
  'Pull Up': a(['back'], ['biceps', 'forearms'], 'intermediate', true),
  'Chin Up': a(['back', 'biceps'], ['forearms'], 'intermediate', true),
  'Dips': a(['triceps', 'chest'], ['shoulders'], 'intermediate', true),
  'Muscle Up': a(['back', 'chest'], ['triceps', 'biceps', 'shoulders'], 'advanced', true),
  'Inverted Row': a(['back'], ['biceps'], 'beginner', true),
  'Handstand Push Up': a(['shoulders'], ['triceps', 'abs'], 'advanced', false),
  'Pistol Squat': a(['quads', 'glutes'], ['hamstrings', 'abs'], 'advanced', false),
  'Bodyweight Squat': a(['quads', 'glutes'], ['hamstrings'], 'beginner', false),
  'Jump Squat': a(['quads', 'glutes'], ['calves'], 'intermediate', false),
  'Burpee': a(['fullbody'], [], 'intermediate', false),
  'Mountain Climber': a(['abs'], ['shoulders', 'quads'], 'beginner', false),
  'Hanging Leg Raise': a(['abs'], ['forearms'], 'intermediate', true),
  'Plank': a(['abs'], ['shoulders', 'glutes'], 'beginner', false),
  'Crunch': a(['abs'], [], 'beginner', false),
}

// ท่าในรายการ -> ข้อมูลกายวิภาค ; ท่าที่พิมพ์เอง/ไม่รู้จัก -> null
export function getAnatomy(name) {
  const exercise = findExercise(name)
  return (exercise && ANATOMY[exercise.name]) || null
}

export function matchesBodyPart(name, bodyPart) {
  if (!bodyPart) return true
  const anatomy = getAnatomy(name)
  return Boolean(anatomy?.primary.some((muscle) => BODY_PARTS[bodyPart].includes(muscle)))
}

// ท่าที่ตรงกับส่วนร่างกาย (ทุกหมวด) เรียงมือใหม่ก่อน
export function exercisesForBodyPart(bodyPart, { level } = {}) {
  return EXERCISES.filter((exercise) => matchesBodyPart(exercise.name, bodyPart))
    .filter((exercise) => !level || getAnatomy(exercise.name).level === level)
    .sort((x, y) => LEVELS.indexOf(getAnatomy(x.name).level) - LEVELS.indexOf(getAnatomy(y.name).level))
}

// ---- หาท่าจากข้อความของ AI Coach (เพื่อแสดงรูปกล้ามเนื้อประกอบ) ----
const normalize = (text) => String(text || '').trim().toLowerCase()
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ชื่ออังกฤษ + alias ที่ยาวพอจะไม่ชนคำทั่วไป เรียงยาวไปสั้น ("Bodyweight Squat" ก่อน "Squat")
const NAME_PATTERNS = EXERCISES.flatMap((exercise) =>
  [exercise.name, ...exercise.aliases.filter((alias) => alias.length >= 4)].map((label) => ({ label: normalize(label), exercise }))
)
  .sort((x, y) => y.label.length - x.label.length)
  .map(({ label, exercise }) => ({
    // ภาษาอังกฤษต้องเป็นคำเต็ม (ไม่ให้ "run" ไปตรงกับ "brunch") ภาษาไทยไม่มีช่องว่างระหว่างคำจึงหาเป็น substring
    test: /[a-z]/.test(label)
      ? new RegExp(`(^|[^a-z])${escapeRegExp(label).replace(/[\s-]+/g, '[\\s-]?')}s?($|[^a-z])`)
      : { test: (text) => text.includes(label) },
    exercise,
  }))

// ข้อความหนึ่งข้อในคำตอบ -> ท่าในรายการ (ดูส่วน **ตัวหนา** ก่อน แล้วค่อยดูทั้งบรรทัด) ไม่พบ -> null
export function findExerciseInText(text) {
  const bold = /\*\*([^*]+)\*\*/.exec(text)?.[1]
  for (const candidate of [bold, text]) {
    if (!candidate) continue
    const value = normalize(candidate)
    const hit = NAME_PATTERNS.find((pattern) => pattern.test.test(value))
    if (hit) return hit.exercise
  }
  return null
}
