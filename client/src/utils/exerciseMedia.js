// วิดีโอสาธิตท่าแบบหุ่นจำลอง 3D (3D Mannequin) + กลุ่มรูปแบบการเคลื่อนไหว (ใช้เลือกคำแนะนำสำหรับมือใหม่)
//
// วิดีโอวนซ้ำ (MP4 + WebM) และ poster (WebP) อยู่ใน client/public/mannequin สร้างด้วย scripts/build-mannequin-videos.mjs
// เรนเดอร์จากหุ่น 3D ของแอปเอง (scripts/mannequin: three.js) พื้นหลัง #0e1a24 เท่าสีการ์ด กล้ามเนื้อเป้าหมายเรืองแสงส้ม-แดง
// มาตรฐานสื่อทั้งเว็บ: ทุกท่าในรายการต้องมีแอนิเมชันหุ่น 3D ห้ามภาพถ่ายคนจริง และห้ามหุ่นอนาโตมีนิ่งยืนตรงแทนคลิป
// (มีเทสต์บังคับใน exerciseMedia.test.js)
import { findExercise } from './exerciseCatalog.js'

export const MEDIA_SOURCE = { name: 'SupportFit 3D Mannequin', license: 'Original animation', url: null }
const VIDEO_BASE = '/mannequin'

// ชื่อท่า -> ชื่อไฟล์ ("Bench Press" -> "bench-press")
export const mediaSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ชื่อท่าใน exerciseCatalog -> แอนิเมชันหุ่น 3D (key ใน scripts/mannequin/motions.js)
// ท่าหลักใช้แอนิเมชันตรงท่า ; ท่าเฉพาะทางใช้แอนิเมชันของรูปแบบการเคลื่อนไหวใกล้เคียงที่สุด (ระบุไว้ในคอมเมนต์)
// เพิ่มท่าใหม่: ใส่ที่นี่ (หรือปล่อยว่างให้ใช้ PATTERN_MOTIONS ตามกลุ่ม) แล้วรัน scripts/build-mannequin-videos.mjs
export const MANNEQUIN_MOTIONS = {
  // ---- เวทเทรนนิ่ง ----
  'Squat': 'barbell-squat',
  'Bench Press': 'bench-press',
  'Deadlift': 'deadlift',
  'Overhead Press': 'overhead-press',
  'Barbell Row': 'barbell-row',
  'Romanian Deadlift': 'rdl',
  'Leg Press': 'leg-press',
  'Lat Pulldown': 'lat-pulldown',
  'Incline Bench Press': 'incline-bench',
  'Dumbbell Bench Press': 'dumbbell-bench',
  'Hip Thrust': 'hip-thrust',
  'Lunge': 'lunge',
  'Bicep Curl': 'bicep-curl',
  'Tricep Pushdown': 'tricep-pushdown',
  'Lateral Raise': 'lateral-raise',
  'Leg Extension': 'leg-extension',
  'Leg Curl': 'leg-curl',
  'Cable Fly': 'cable-fly',
  'Clean and Jerk': 'clean-jerk', // ดึงจากพื้น -> รับบาร์ที่ไหล่ -> ดันขึ้นแบบแยกขา (ย่อขั้นตอน)
  'Kettlebell Swing': 'kettlebell-swing',

  // ---- คาร์ดิโอ ----
  'Running': 'run',
  'Treadmill Running': 'treadmill-run',
  'Walking': 'walk',
  'Hiking': 'hike',
  'Cycling': 'cycling',
  'Stationary Bike': 'stationary-bike',
  'Swimming': 'swim',
  'Rowing Machine': 'rowing',
  'Elliptical': 'elliptical',
  'Stair Climber': 'stair-climber',
  'Jump Rope': 'jump-rope',
  'HIIT': 'jumping-jack', // HIIT เป็นรูปแบบการฝึก ไม่ใช่ท่าเดียว -> ใช้ท่ากระโดดตบ (Jumping Jack) เป็นตัวแทน

  // ---- กีฬา ----
  'Boxing': 'boxing',
  'Badminton': 'badminton',
  'Football': 'football',
  'Basketball': 'basketball',
  'Dancing': 'dance',
  'Yoga': 'yoga-flow', // ท่าไหว้พระอาทิตย์ช่วงแรก: ยืน -> ชูแขน -> ก้มพับตัว

  // ---- สตรีทเวิร์กเอาต์ / บอดี้เวท ----
  'Push Up': 'push-up',
  'Pull Up': 'pull-up',
  'Chin Up': 'chin-up',
  'Dips': 'dips',
  'Muscle Up': 'muscle-up',
  'Inverted Row': 'inverted-row',
  'Handstand Push Up': 'handstand-push-up',
  'Pistol Squat': 'pistol-squat',
  'Bodyweight Squat': 'bodyweight-squat',
  'Jump Squat': 'jump-squat',
  'Burpee': 'burpee',
  'Mountain Climber': 'mountain-climber',
  'Hanging Leg Raise': 'hanging-leg-raise',
  'Plank': 'plank',
  'Crunch': 'crunch',
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

// Smart 3D Movement Fallback: ท่าที่ยังไม่มีแอนิเมชันเฉพาะ -> แอนิเมชันหลักของกลุ่มการเคลื่อนไหวเดียวกัน (GUIDE_PATTERNS)
export const PATTERN_MOTIONS = {
  squat: 'bodyweight-squat', hinge: 'deadlift', bridge: 'hip-thrust', olympic: 'clean-jerk', lunge: 'lunge',
  push: 'push-up', dips: 'dips', overhead: 'overhead-press', pull: 'barbell-row', hang: 'pull-up',
  arms: 'bicep-curl', machine: 'leg-extension', core: 'crunch', plyo: 'jump-squat', cardio: 'run',
  cycle: 'stationary-bike', swim: 'swim', yoga: 'yoga-flow', sport: 'jumping-jack',
}

// ท่าในรายการ -> ชื่อแอนิเมชัน (ตรงท่า หรือแอนิเมชันของกลุ่ม) ; ท่าที่ไม่รู้จัก -> null
export function motionFor(name) {
  const exercise = findExercise(name)
  if (!exercise) return null
  return MANNEQUIN_MOTIONS[exercise.name] || PATTERN_MOTIONS[GUIDE_PATTERNS[exercise.name]] || null
}

const toMedia = (name, motion) => {
  const base = `${VIDEO_BASE}/${mediaSlug(name)}`
  return {
    id: motion,
    motion,
    source: MEDIA_SOURCE,
    // MP4 (H.264) ก่อน: ไฟล์เล็กกว่าและเล่นได้ทุกเบราว์เซอร์รวม iOS ; WebM สำรองสำหรับเบราว์เซอร์ที่ไม่มี H.264
    sources: [
      { src: `${base}.mp4`, type: 'video/mp4' },
      { src: `${base}.webm`, type: 'video/webm' },
    ],
    poster: `${base}-poster.webp`,
  }
}
// object เดิมทุกครั้ง (การ์ดที่ memo ไว้จะไม่ render ซ้ำ)
const MEDIA = new Map()

// ท่าในรายการ -> { id, motion, sources: [{ src, type }], poster } ; ท่าพิมพ์เอง (ไม่อยู่ในรายการ) -> null
export function getExerciseMedia(name) {
  const exercise = findExercise(name)
  const motion = exercise && motionFor(exercise.name)
  if (!motion) return null
  if (!MEDIA.has(exercise.name)) MEDIA.set(exercise.name, toMedia(exercise.name, motion))
  return MEDIA.get(exercise.name)
}

// ท่าในรายการ -> key ของชุดคำแนะนำ ; ไม่รู้จัก -> 'general'
export function getGuidePattern(name) {
  const exercise = findExercise(name)
  return (exercise && GUIDE_PATTERNS[exercise.name]) || 'general'
}
