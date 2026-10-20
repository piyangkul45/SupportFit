// โปรแกรมสำเร็จรูป (global presets) ทุกผู้ใช้เห็นเหมือนกัน — programs/store.js สร้างเป็นแถว is_preset ในตาราง
// (จับคู่จาก title: เปลี่ยน title = ได้แถว preset ใหม่) id ของ preset มาจากตาราง
//
// 1 โปรแกรม = รอบตารางฝึก (days) วนซ้ำตามปฏิทินนับจากวันที่เริ่มใช้โปรแกรม
// วันที่ไม่มีท่า (exercises ว่าง) = วันพัก
// ชื่อท่าต้องตรงกับ name ใน parser/exerciseDatabase.json (ทดสอบใน test/programs.test.js)
// title/description/ชื่อวันเป็นภาษาอังกฤษสำรอง client แปลจาก key: programs.presets.<key>, programs.dayNames.<key>

const ex = (exercise_name, sets, reps, weight_kg = null) => ({ exercise_name, sets, reps, weight_kg })
const REST = { key: 'rest', name: 'Rest', exercises: [] }

const PRESET_PROGRAMS = [
  {
    key: 'ppl',
    title: 'Push / Pull / Legs (6-Day)',
    description: 'Classic bodybuilding split: each muscle group trained twice a week, one rest day.',
    days: [
      {
        key: 'push_a',
        name: 'Push A — Chest, Shoulders & Triceps',
        exercises: [ex('Bench Press', 4, 8), ex('Shoulder Press', 3, 10), ex('Incline Dumbbell Press', 3, 10), ex('Lateral Raise', 3, 15), ex('Tricep Pushdown', 3, 12)],
      },
      {
        key: 'pull_a',
        name: 'Pull A — Back & Biceps',
        exercises: [ex('Deadlift', 3, 5), ex('Pull Up', 3, 8), ex('Barbell Row', 3, 10), ex('Face Pull', 3, 15), ex('Bicep Curl', 3, 12)],
      },
      {
        key: 'legs_a',
        name: 'Legs A — Quads & Calves',
        exercises: [ex('Squat', 4, 8), ex('Leg Press', 3, 12), ex('Leg Extension', 3, 12), ex('Leg Curl', 3, 12), ex('Calf Raise', 4, 15)],
      },
      {
        key: 'push_b',
        name: 'Push B — Shoulders, Chest & Triceps',
        exercises: [ex('Overhead Press', 4, 8), ex('Incline Bench Press', 3, 10), ex('Cable Fly', 3, 12), ex('Lateral Raise', 3, 15), ex('Tricep Extension', 3, 12)],
      },
      {
        key: 'pull_b',
        name: 'Pull B — Lats & Biceps',
        exercises: [ex('Lat Pulldown', 4, 10), ex('Seated Cable Row', 3, 10), ex('Dumbbell Row', 3, 10), ex('Face Pull', 3, 15), ex('Hammer Curl', 3, 12)],
      },
      {
        key: 'legs_b',
        name: 'Legs B — Hamstrings & Glutes',
        exercises: [ex('Romanian Deadlift', 4, 8), ex('Hip Thrust', 3, 10), ex('Lunge', 3, 12), ex('Leg Curl', 3, 12), ex('Calf Raise', 4, 15)],
      },
      REST,
    ],
  },
  {
    key: 'upper_lower',
    title: 'Upper / Lower (4-Day)',
    description: 'Balanced strength and size: two upper and two lower body sessions per week.',
    days: [
      {
        key: 'upper_a',
        name: 'Upper A — Strength',
        exercises: [ex('Bench Press', 4, 6), ex('Barbell Row', 4, 6), ex('Overhead Press', 3, 8), ex('Pull Up', 3, 8), ex('Bicep Curl', 2, 12), ex('Tricep Pushdown', 2, 12)],
      },
      {
        key: 'lower_a',
        name: 'Lower A — Strength',
        exercises: [ex('Squat', 4, 6), ex('Romanian Deadlift', 3, 8), ex('Leg Press', 3, 10), ex('Calf Raise', 4, 12), ex('Hanging Leg Raise', 3, 12)],
      },
      REST,
      {
        key: 'upper_b',
        name: 'Upper B — Hypertrophy',
        exercises: [ex('Incline Dumbbell Press', 3, 10), ex('Lat Pulldown', 3, 10), ex('Shoulder Press', 3, 10), ex('Seated Cable Row', 3, 12), ex('Lateral Raise', 3, 15), ex('Hammer Curl', 2, 12)],
      },
      {
        key: 'lower_b',
        name: 'Lower B — Hypertrophy',
        exercises: [ex('Deadlift', 3, 5), ex('Front Squat', 3, 8), ex('Lunge', 3, 12), ex('Leg Curl', 3, 12), ex('Calf Raise', 4, 15)],
      },
      REST,
      REST,
    ],
  },
  {
    key: 'full_body',
    title: 'Full Body (3-Day)',
    description: 'Great for beginners: train every major muscle three times a week with a rest day in between.',
    days: [
      {
        key: 'full_a',
        name: 'Full Body A',
        exercises: [ex('Squat', 3, 8), ex('Bench Press', 3, 8), ex('Barbell Row', 3, 8), ex('Crunch', 3, 15)],
      },
      REST,
      {
        key: 'full_b',
        name: 'Full Body B',
        exercises: [ex('Deadlift', 3, 5), ex('Overhead Press', 3, 8), ex('Lat Pulldown', 3, 10), ex('Lunge', 3, 10)],
      },
      REST,
      {
        key: 'full_c',
        name: 'Full Body C',
        exercises: [ex('Leg Press', 3, 10), ex('Incline Dumbbell Press', 3, 10), ex('Seated Cable Row', 3, 10), ex('Hip Thrust', 3, 10)],
      },
      REST,
      REST,
    ],
  },
].map((program) => ({ ...program, is_preset: true }))

module.exports = { PRESET_PROGRAMS }
