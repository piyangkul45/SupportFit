// วิดีโอ Anatomy ของท่าฝึก + กลุ่มรูปแบบการเคลื่อนไหว (ใช้เลือกคำแนะนำสำหรับมือใหม่)
//
// วิดีโอวนซ้ำ (MP4 + WebM) และ poster (WebP) อยู่ใน client/public/anatomy สร้างด้วย scripts/build-exercise-videos.mjs
// จากภาพวาด SVG ของ Everkinetic (https://github.com/everkinetic/data, CC BY-SA 4.0): ท่าเริ่ม <-> ท่าเกร็ง
// เป็นเส้นขาว-เทาบนพื้นดำสนิท UI ใช้ mix-blend-mode: screen (.anatomy-art ใน index.css) ให้พื้นโปร่งบน Dark Mode
// still = SVG ต้นฉบับบน CDN ใช้เมื่อโหลด poster ไม่ได้ (UI กลับสีด้วย filter เอง)
// กล้ามเนื้อเป้าหมายสีแดงมาจากรูป Anatomy ของแอปเอง (MuscleIcon) เพราะภาพต้นฉบับไม่ได้แยกกล้ามเนื้อ
// ท่าที่ไม่มีวิดีโอ -> null แล้ว UI ใช้ Silhouette Anatomy แบบโปร่ง (ขาว-เทา + แดง) แทน
import { findExercise } from './exerciseCatalog.js'

export const MEDIA_SOURCE = { name: 'Everkinetic', license: 'CC BY-SA 4.0', url: 'https://github.com/everkinetic/data' }
// ล็อก commit ไว้ ภาพจะไม่เปลี่ยนเองเมื่อ repo ต้นทางอัปเดต
export const EVERKINETIC_SVG_BASE = 'https://cdn.jsdelivr.net/gh/everkinetic/data@446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6/dist/svg'
const VIDEO_BASE = '/anatomy'

// ชื่อท่า -> ชื่อไฟล์ ("Bench Press" -> "bench-press")
export const mediaSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ชื่อท่าใน exerciseCatalog -> id_num ของ Everkinetic (ไฟล์ <id>-relaxation.svg / <id>-tension.svg)
// เพิ่มท่าใหม่: ใส่ id ที่นี่ แล้วรัน scripts/build-exercise-videos.mjs
export const EVERKINETIC_IDS = {
  // ---- เวทเทรนนิ่ง ----
  'Squat': '0122', // barbell-squat
  'Bench Press': '0042', // bench-press
  'Deadlift': '0099', // barbell-dead-lifts
  'Overhead Press': '0004', // seated-military-press
  'Barbell Row': '0026', // reverse-grips-bent-over-barbell-rows
  'Romanian Deadlift': '0118', // romanian-dead-lift
  'Leg Press': '0127', // leg-press
  'Lat Pulldown': '0096', // v-bar-pull-down
  'Incline Bench Press': '0043', // incline-bench-press
  'Dumbbell Bench Press': '0055', // bench-press-dumbbell
  'Hip Thrust': '0109', // bridging
  'Lunge': '0121', // walking-lunges
  'Bicep Curl': '0224', // biceps-curl-with-dumbbell
  'Tricep Pushdown': '0205', // triceps-pushdown-with-cable
  'Lateral Raise': '0018', // lateral-dumbbell-raises
  'Leg Extension': '0142', // leg-extensions
  'Leg Curl': '0117', // lying-leg-curl-machine
  'Cable Fly': '0048', // cable-crossover

  // ---- สตรีทเวิร์กเอาต์ ----
  'Push Up': '0077', // push-ups
  'Pull Up': '0087', // pull-ups
  'Chin Up': '0090', // narrow-parallel-grip-chin-ups
  'Dips': '0172', // tricep-dips-using-body-weight
  'Inverted Row': '0086', // body-row
  'Crunch': '0291', // crunches
}

// ท่า -> รูปแบบการเคลื่อนไหว (คำแนะนำ 3 ข้อ: การวางเท้า / การหายใจ / ข้อควรระวัง อยู่ใน locales: exerciseLibrary.tips.<pattern>)
export const GUIDE_PATTERNS = {
  'Squat': 'squat', 'Leg Press': 'squat', 'Bodyweight Squat': 'squat', 'Pistol Squat': 'squat', 'Jump Squat': 'plyo',
  'Deadlift': 'hinge', 'Romanian Deadlift': 'hinge', 'Hip Thrust': 'bridge', 'Kettlebell Swing': 'hinge',
  'Clean and Jerk': 'olympic',
  'Lunge': 'lunge',
  'Bench Press': 'push', 'Incline Bench Press': 'push', 'Dumbbell Bench Press': 'push', 'Push Up': 'push', 'Cable Fly': 'push',
  'Dips': 'dips',
  'Overhead Press': 'overhead', 'Lateral Raise': 'overhead', 'Handstand Push Up': 'overhead',
  'Barbell Row': 'pull', 'Lat Pulldown': 'pull', 'Inverted Row': 'pull',
  'Pull Up': 'hang', 'Chin Up': 'hang', 'Muscle Up': 'hang', 'Hanging Leg Raise': 'hang',
  'Bicep Curl': 'arms', 'Tricep Pushdown': 'arms',
  'Leg Extension': 'machine', 'Leg Curl': 'machine',
  'Plank': 'core', 'Crunch': 'core', 'Mountain Climber': 'core',
  'Burpee': 'plyo', 'Jump Rope': 'plyo', 'HIIT': 'plyo',
  'Running': 'cardio', 'Treadmill Running': 'cardio', 'Walking': 'cardio', 'Hiking': 'cardio',
  'Stair Climber': 'cardio', 'Elliptical': 'cardio',
  'Cycling': 'cycle', 'Stationary Bike': 'cycle', 'Rowing Machine': 'cycle',
  'Swimming': 'swim', 'Yoga': 'yoga',
  'Boxing': 'sport', 'Badminton': 'sport', 'Football': 'sport', 'Basketball': 'sport', 'Dancing': 'sport',
}
export const GUIDE_KEYS = ['stance', 'breathing', 'caution']

const toMedia = (name, id) => {
  const base = `${VIDEO_BASE}/${mediaSlug(name)}`
  return {
    id,
    // MP4 (H.264) ก่อน: ไฟล์เล็กกว่าและเล่นได้ทุกเบราว์เซอร์รวม iOS ; WebM สำรองสำหรับเบราว์เซอร์ที่ไม่มี H.264
    sources: [
      { src: `${base}.mp4`, type: 'video/mp4' },
      { src: `${base}.webm`, type: 'video/webm' },
    ],
    poster: `${base}-poster.webp`,
    still: `${EVERKINETIC_SVG_BASE}/${id}-relaxation.svg`,
  }
}
// object เดิมทุกครั้ง (การ์ดที่ memo ไว้จะไม่ render ซ้ำ)
const MEDIA = new Map(Object.entries(EVERKINETIC_IDS).map(([name, id]) => [name, toMedia(name, id)]))

// ท่าในรายการ -> { id, sources: [{ src, type }], poster, still } ; ไม่มีวิดีโอ / ท่าพิมพ์เอง -> null
export function getExerciseMedia(name) {
  const exercise = findExercise(name)
  return (exercise && MEDIA.get(exercise.name)) || null
}

// ท่าในรายการ -> key ของชุดคำแนะนำ ; ไม่รู้จัก -> 'general'
export function getGuidePattern(name) {
  const exercise = findExercise(name)
  return (exercise && GUIDE_PATTERNS[exercise.name]) || 'general'
}
