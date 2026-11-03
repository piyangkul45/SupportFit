// ภาพสาธิตท่าฝึก + กลุ่มรูปแบบการเคลื่อนไหว (ใช้เลือกคำแนะนำสำหรับมือใหม่)
//
// ภาพจาก Free Exercise DB (https://github.com/yuhonas/free-exercise-db, Public Domain / Unlicense)
// แต่ละท่ามี 2 เฟรม (ท่าเริ่ม 0.jpg / ท่าจบ 1.jpg) สลับกันเป็นภาพเคลื่อนไหวแบบ GIF
// โหลดผ่าน jsDelivr CDN ; ท่าที่ไม่มีภาพในฐานข้อมูล (กีฬา, ว่ายน้ำ, โยคะ ...) -> null แล้ว UI ใช้รูป Anatomy แทน
import { findExercise } from './exerciseCatalog.js'

export const MEDIA_SOURCE = { name: 'Free Exercise DB', url: 'https://github.com/yuhonas/free-exercise-db' }
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises'

// ชื่อท่าใน exerciseCatalog -> id ใน Free Exercise DB
export const MEDIA_IDS = {
  // ---- เวทเทรนนิ่ง ----
  'Squat': 'Barbell_Squat',
  'Bench Press': 'Barbell_Bench_Press_-_Medium_Grip',
  'Deadlift': 'Barbell_Deadlift',
  'Overhead Press': 'Standing_Military_Press',
  'Barbell Row': 'Bent_Over_Barbell_Row',
  'Romanian Deadlift': 'Romanian_Deadlift',
  'Leg Press': 'Leg_Press',
  'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  'Incline Bench Press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Dumbbell Bench Press': 'Dumbbell_Bench_Press',
  'Hip Thrust': 'Barbell_Hip_Thrust',
  'Lunge': 'Bodyweight_Walking_Lunge',
  'Bicep Curl': 'Dumbbell_Bicep_Curl',
  'Tricep Pushdown': 'Triceps_Pushdown',
  'Lateral Raise': 'Side_Lateral_Raise',
  'Leg Extension': 'Leg_Extensions',
  'Leg Curl': 'Lying_Leg_Curls',
  'Cable Fly': 'Cable_Crossover',
  'Clean and Jerk': 'Clean_and_Jerk',
  'Kettlebell Swing': 'One-Arm_Kettlebell_Swings',

  // ---- คาร์ดิโอ ----
  'Running': 'Running_Treadmill',
  'Treadmill Running': 'Jogging_Treadmill',
  'Walking': 'Walking_Treadmill',
  'Hiking': 'Trail_Running_Walking',
  'Cycling': 'Bicycling',
  'Stationary Bike': 'Bicycling_Stationary',
  'Rowing Machine': 'Rowing_Stationary',
  'Elliptical': 'Elliptical_Trainer',
  'Stair Climber': 'Stairmaster',
  'Jump Rope': 'Rope_Jumping',

  // ---- สตรีทเวิร์กเอาต์ ----
  'Push Up': 'Pushups',
  'Pull Up': 'Pullups',
  'Chin Up': 'Chin-Up',
  'Dips': 'Dips_-_Triceps_Version',
  'Muscle Up': 'Muscle_Up',
  'Inverted Row': 'Inverted_Row',
  'Handstand Push Up': 'Handstand_Push-Ups',
  'Pistol Squat': 'Kettlebell_Pistol_Squat',
  'Bodyweight Squat': 'Bodyweight_Squat',
  'Jump Squat': 'Freehand_Jump_Squat',
  'Mountain Climber': 'Mountain_Climbers',
  'Hanging Leg Raise': 'Hanging_Leg_Raise',
  'Plank': 'Plank',
  'Crunch': 'Crunches',
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

const frameUrl = (id, index) => `${CDN_BASE}/${id}/${index}.jpg`
// object เดิมทุกครั้ง (การ์ดที่ memo ไว้จะไม่ render ซ้ำ)
const MEDIA = new Map(Object.entries(MEDIA_IDS).map(([name, id]) => [name, { id, frames: [frameUrl(id, 0), frameUrl(id, 1)] }]))

// ท่าในรายการ -> { id, frames: [ท่าเริ่ม, ท่าจบ] } ; ไม่มีภาพ / ท่าพิมพ์เอง -> null
export function getExerciseMedia(name) {
  const exercise = findExercise(name)
  return (exercise && MEDIA.get(exercise.name)) || null
}

// ท่าในรายการ -> key ของชุดคำแนะนำ ; ไม่รู้จัก -> 'general'
export function getGuidePattern(name) {
  const exercise = findExercise(name)
  return (exercise && GUIDE_PATTERNS[exercise.name]) || 'general'
}
