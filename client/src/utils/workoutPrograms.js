// Template โปรแกรมออกกำลังกายของคนดัง — ชื่อท่าตรงกับ Master Exercise List
// (exerciseDatabase.data.json) เพื่อให้ระบบเช็คว่าท่าไหนบันทึกไปแล้ววันนี้ได้ถูกต้อง
// ข้อความที่แสดงผลอยู่ในไฟล์แปลภาษา: programs.taglines.<id>, programs.difficulty.<key>,
// programs.muscles.<key> และ programs.reps.<key> (reps ที่เป็น object = มีหน่วยต้องแปล)

export const WORKOUT_PROGRAMS = [
  {
    id: 'arnold-golden-six',
    name: "Arnold's Golden Six",
    celebrity: 'Arnold Schwarzenegger',
    emoji: '🏛️',
    difficulty: 'beginner',
    accent: 'from-amber-500 to-orange-600',
    days: [
      {
        name: 'Full Body',
        exercises: [
          { name: 'Squat', sets: 3, reps: '10', muscles: ['thighs', 'glutes'] },
          { name: 'Bench Press', sets: 3, reps: '10', muscles: ['chest'] },
          { name: 'Pull Up', sets: 3, reps: { key: 'toFailure', count: 8 }, muscles: ['back'] },
          { name: 'Overhead Press', sets: 3, reps: '10', muscles: ['shoulders'] },
          { name: 'Barbell Row', sets: 3, reps: '10', muscles: ['back'] },
          { name: 'Sit Up', sets: 3, reps: '25', muscles: ['abs'] },
        ],
      },
    ],
  },
  {
    id: 'hemsworth-thor',
    name: 'Thor Workout',
    celebrity: 'Chris Hemsworth',
    emoji: '⚡',
    difficulty: 'advanced',
    accent: 'from-sky-500 to-blue-700',
    days: [
      {
        name: 'Full Body Conditioning',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '6', muscles: ['back', 'hamstrings'] },
          { name: 'Bench Press', sets: 4, reps: '8', muscles: ['chest'] },
          { name: 'Pull Up', sets: 4, reps: '10', muscles: ['back'] },
          { name: 'Kettlebell Swing', sets: 4, reps: '15', muscles: ['glutes', 'hamstrings'] },
          { name: 'Box Jump', sets: 4, reps: '10', muscles: ['legs', 'explosive'] },
          { name: "Farmer's Walk", sets: 3, reps: { key: 'meters', count: 40 }, muscles: ['fullBody', 'grip'] },
          { name: 'Plank', sets: 3, reps: { key: 'seconds', count: 60 }, muscles: ['core'] },
        ],
      },
    ],
  },
  {
    id: 'cbum-ppl',
    name: 'CBum PPL Split',
    celebrity: 'Chris Bumstead',
    emoji: '🏆',
    difficulty: 'intermediate',
    accent: 'from-fuchsia-500 to-purple-700',
    days: [
      {
        name: 'Day 1 — Push',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '8-10', muscles: ['chest'] },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', muscles: ['upperChest'] },
          { name: 'Shoulder Press', sets: 3, reps: '10-12', muscles: ['shoulders'] },
          { name: 'Lateral Raise', sets: 3, reps: '12-15', muscles: ['sideDelts'] },
          { name: 'Triceps Pushdown', sets: 3, reps: '12-15', muscles: ['triceps'] },
          { name: 'Skull Crusher', sets: 3, reps: '10-12', muscles: ['triceps'] },
        ],
      },
      {
        name: 'Day 2 — Pull',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '6-8', muscles: ['back', 'hamstrings'] },
          { name: 'Pull Up', sets: 4, reps: '10', muscles: ['back', 'lats'] },
          { name: 'Seated Cable Row', sets: 3, reps: '10-12', muscles: ['back'] },
          { name: 'Face Pull', sets: 3, reps: '15', muscles: ['traps', 'rearDelts'] },
          { name: 'Barbell Curl', sets: 3, reps: '10-12', muscles: ['biceps'] },
          { name: 'Hammer Curl', sets: 3, reps: '12', muscles: ['biceps', 'forearms'] },
        ],
      },
      {
        name: 'Day 3 — Legs',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8-10', muscles: ['quads', 'glutes'] },
          { name: 'Romanian Deadlift', sets: 3, reps: '10-12', muscles: ['hamstrings', 'glutes'] },
          { name: 'Leg Press', sets: 3, reps: '12-15', muscles: ['quads'] },
          { name: 'Leg Curl', sets: 3, reps: '12-15', muscles: ['hamstrings'] },
          { name: 'Leg Extension', sets: 3, reps: '12-15', muscles: ['quads'] },
          { name: 'Calf Raise', sets: 4, reps: '15-20', muscles: ['calves'] },
        ],
      },
    ],
  },
  {
    id: 'rock-leg-day',
    name: "The Rock's Leg Day",
    celebrity: 'Dwayne "The Rock" Johnson',
    emoji: '🔥',
    difficulty: 'advanced',
    accent: 'from-red-600 to-rose-800',
    days: [
      {
        name: 'Leg Day',
        exercises: [
          { name: 'Squat', sets: 5, reps: '10-12', muscles: ['quads', 'glutes'] },
          { name: 'Leg Press', sets: 4, reps: '12-15', muscles: ['quads'] },
          { name: 'Romanian Deadlift', sets: 4, reps: '10', muscles: ['hamstrings', 'glutes'] },
          { name: 'Leg Extension', sets: 3, reps: '15-20', muscles: ['quads'] },
          { name: 'Leg Curl', sets: 3, reps: '15-20', muscles: ['hamstrings'] },
          { name: 'Lunge', sets: 3, reps: { key: 'perSide', count: 12 }, muscles: ['glutes', 'quads'] },
          { name: 'Calf Raise', sets: 4, reps: '20', muscles: ['calves'] },
        ],
      },
    ],
  },
]

// reps เป็น string (เช่น '8-10') หรือ { key, count } ที่ต้องแปลหน่วย เช่น { key: 'meters', count: 40 }
export function formatReps(reps, t) {
  return typeof reps === 'string' ? reps : t(`programs.reps.${reps.key}`, { count: reps.count })
}
