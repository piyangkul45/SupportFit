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
].map((program) => ({ ...program, is_preset: true, category: 'standard' }))

// ---- Routine ของคนดัง (หน้า Programs ส่วน "Routine ของคนดัง") ----
// เป็น preset เหมือนด้านบน (เลือกเป็นโปรแกรมที่ใช้อยู่ได้ ตารางฝึกวันนี้ขึ้นบน Dashboard)
// เรียบเรียงจากแนวการฝึกที่คนดังเหล่านี้เคยเผยแพร่สาธารณะ ไม่ใช่โปรแกรมทางการ (client แสดงข้อความนี้กำกับ)
// celebrity: ชื่อที่แสดง ; difficulty: beginner | intermediate | advanced ; muscles: key ใน programs.muscles ของ client
// reps เป็นจำนวนเต็มตาม schema (ช่วง เช่น 8-10 ใช้ค่ากลาง/ค่าบน) ; HIT: 1 เซตทำงานจนหมดแรง ไม่นับเซตวอร์ม
const GOLDEN_SIX = {
  key: 'golden_six',
  name: 'Golden Six — Full Body',
  exercises: [ex('Squat', 4, 10), ex('Bench Press', 3, 10), ex('Chin Up', 3, 8), ex('Overhead Press', 4, 10), ex('Barbell Curl', 3, 10), ex('Sit Up', 3, 25)],
}

const CELEBRITY_PROGRAMS = [
  {
    key: 'arnold_golden_six',
    title: "Arnold's Golden Six",
    description: 'Six classic full-body lifts three times a week, the routine Arnold Schwarzenegger used to build his foundation.',
    celebrity: 'Arnold Schwarzenegger',
    difficulty: 'beginner',
    muscles: ['fullBody', 'chest', 'back', 'legs', 'shoulders', 'abs'],
    days: [GOLDEN_SIX, REST, GOLDEN_SIX, REST, GOLDEN_SIX, REST, REST],
  },
  {
    key: 'cbum_classic',
    title: "CBum's Classic Physique 5-Day Split",
    description: 'Chris Bumstead-style split for a wide V-taper: upper chest, lats and side delts with full-range, controlled reps.',
    celebrity: 'Chris Bumstead',
    difficulty: 'intermediate',
    muscles: ['chest', 'upperChest', 'back', 'lats', 'shoulders', 'legs'],
    days: [
      {
        key: 'cbum_chest',
        name: 'Chest & Triceps',
        exercises: [ex('Incline Dumbbell Press', 4, 8), ex('Bench Press', 3, 8), ex('Cable Fly', 3, 12), ex('Dips', 3, 10), ex('Skull Crusher', 3, 10), ex('Triceps Pushdown', 3, 12)],
      },
      {
        key: 'cbum_back',
        name: 'Back & Biceps',
        exercises: [ex('Deadlift', 3, 5), ex('Pull Up', 4, 8), ex('Barbell Row', 3, 10), ex('Lat Pulldown', 3, 12), ex('Barbell Curl', 3, 10), ex('Hammer Curl', 3, 12)],
      },
      {
        key: 'cbum_legs',
        name: 'Legs',
        exercises: [ex('Squat', 4, 8), ex('Leg Press', 3, 12), ex('Romanian Deadlift', 3, 10), ex('Leg Extension', 3, 15), ex('Leg Curl', 3, 12), ex('Calf Raise', 4, 15)],
      },
      REST,
      {
        key: 'cbum_shoulders',
        name: 'Shoulders & Arms',
        exercises: [ex('Shoulder Press', 4, 10), ex('Lateral Raise', 4, 15), ex('Rear Delt Fly', 3, 15), ex('Preacher Curl', 3, 12), ex('Close Grip Bench Press', 3, 10)],
      },
      {
        key: 'cbum_vtaper',
        name: 'V-Taper — Upper Chest, Lats & Delts',
        exercises: [ex('Incline Bench Press', 3, 10), ex('T-Bar Row', 3, 10), ex('Seated Cable Row', 3, 12), ex('Lateral Raise', 3, 15), ex('Face Pull', 3, 15)],
      },
      REST,
    ],
  },
  {
    key: 'rock_hercules',
    title: "The Rock's Hercules Routine",
    description: 'High-volume bodybuilding split in the style Dwayne Johnson trained for Hercules: one muscle group a day, heavy and dense.',
    celebrity: 'Dwayne "The Rock" Johnson',
    difficulty: 'advanced',
    muscles: ['back', 'chest', 'legs', 'shoulders', 'biceps', 'triceps'],
    days: [
      {
        key: 'rock_back',
        name: 'Back',
        exercises: [ex('Pull Up', 4, 10), ex('Deadlift', 4, 8), ex('Barbell Row', 4, 10), ex('Lat Pulldown', 3, 12), ex('Seated Cable Row', 3, 12)],
      },
      {
        key: 'rock_chest',
        name: 'Chest',
        exercises: [ex('Incline Bench Press', 4, 10), ex('Bench Press', 4, 8), ex('Dumbbell Press', 3, 12), ex('Cable Fly', 3, 15), ex('Dips', 3, 12)],
      },
      {
        key: 'rock_legs_a',
        name: 'Legs A — Quads',
        exercises: [ex('Squat', 5, 10), ex('Leg Press', 4, 15), ex('Leg Extension', 3, 20), ex('Lunge', 3, 12), ex('Calf Raise', 4, 20)],
      },
      {
        key: 'rock_shoulders',
        name: 'Shoulders & Traps',
        exercises: [ex('Overhead Press', 4, 8), ex('Shoulder Press', 3, 10), ex('Lateral Raise', 4, 15), ex('Rear Delt Fly', 3, 15), ex('Shrug', 4, 12)],
      },
      {
        key: 'rock_arms',
        name: 'Arms',
        exercises: [
          ex('Barbell Curl', 4, 10),
          ex('Hammer Curl', 3, 12),
          ex('Preacher Curl', 3, 12),
          ex('Close Grip Bench Press', 4, 8),
          ex('Skull Crusher', 3, 10),
          ex('Triceps Pushdown', 3, 15),
        ],
      },
      {
        key: 'rock_legs_b',
        name: 'Legs B — Hamstrings & Glutes',
        exercises: [ex('Front Squat', 4, 8), ex('Romanian Deadlift', 4, 10), ex('Hack Squat', 3, 12), ex('Leg Curl', 4, 12), ex('Calf Raise', 5, 20)],
      },
      REST,
    ],
  },
  {
    key: 'thor_superhero',
    title: 'Thor Superhero Workout',
    description: 'Hybrid training in the style Chris Hemsworth used for Thor: heavy compound lifts plus conditioning to build muscle and burn fat.',
    celebrity: 'Chris Hemsworth',
    difficulty: 'intermediate',
    muscles: ['fullBody', 'chest', 'back', 'legs', 'explosive', 'core'],
    days: [
      {
        key: 'thor_upper',
        name: 'Upper Strength + Finisher',
        exercises: [ex('Bench Press', 4, 8), ex('Pull Up', 4, 10), ex('Overhead Press', 3, 10), ex('Dumbbell Row', 3, 12), ex('Burpee', 3, 12)],
      },
      {
        key: 'thor_lower',
        name: 'Lower Power',
        exercises: [ex('Squat', 4, 8), ex('Romanian Deadlift', 3, 10), ex('Kettlebell Swing', 4, 15), ex('Box Jump', 3, 10), ex('Lunge', 3, 12)],
      },
      REST,
      {
        key: 'thor_full',
        name: 'Full Body Strength',
        exercises: [ex('Deadlift', 4, 6), ex('Incline Dumbbell Press', 3, 10), ex('Chin Up', 3, 10), ex('Push Up', 3, 20), ex('Hanging Leg Raise', 3, 12)],
      },
      {
        key: 'thor_conditioning',
        name: 'Conditioning Circuit',
        exercises: [ex('Jump Rope', 5, 50), ex('Burpee', 4, 15), ex('Mountain Climber', 4, 30), ex('Kettlebell Swing', 4, 20), ex('Box Jump', 3, 10)],
      },
      REST,
      REST,
    ],
  },
  {
    key: 'mentzer_hit',
    title: "Mike Mentzer's Heavy Duty (HIT)",
    description: 'High-Intensity Training: one all-out working set per exercise after warm-ups, then plenty of rest for full recovery.',
    celebrity: 'Mike Mentzer',
    difficulty: 'advanced',
    muscles: ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps'],
    days: [
      {
        key: 'hit_chest_back',
        name: 'Chest & Back',
        exercises: [ex('Chest Fly', 1, 8), ex('Incline Bench Press', 1, 6), ex('Lat Pulldown', 1, 8), ex('Barbell Row', 1, 8)],
      },
      REST,
      {
        key: 'hit_legs',
        name: 'Legs',
        exercises: [ex('Leg Extension', 1, 10), ex('Leg Press', 1, 10), ex('Leg Curl', 1, 8), ex('Calf Raise', 1, 15)],
      },
      REST,
      {
        key: 'hit_shoulders_arms',
        name: 'Shoulders & Arms',
        exercises: [ex('Lateral Raise', 1, 8), ex('Shoulder Press', 1, 6), ex('Barbell Curl', 1, 8), ex('Triceps Pushdown', 1, 8), ex('Dips', 1, 8)],
      },
      REST,
      REST,
    ],
  },
  {
    key: 'nippard_4day',
    title: "Jeff Nippard's Science-Based 4-Day",
    description: "Evidence-based Upper/Lower split in Jeff Nippard's style: each muscle twice a week, a strength day and a hypertrophy day.",
    celebrity: 'Jeff Nippard',
    difficulty: 'intermediate',
    muscles: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'glutes'],
    days: [
      {
        key: 'nip_upper_strength',
        name: 'Upper — Strength',
        exercises: [ex('Bench Press', 4, 6), ex('T-Bar Row', 3, 8), ex('Overhead Press', 3, 8), ex('Lat Pulldown', 3, 10), ex('Skull Crusher', 2, 12), ex('Bicep Curl', 2, 12)],
      },
      {
        key: 'nip_lower_strength',
        name: 'Lower — Strength',
        exercises: [ex('Squat', 4, 6), ex('Romanian Deadlift', 3, 8), ex('Leg Press', 3, 10), ex('Leg Curl', 3, 12), ex('Calf Raise', 3, 15)],
      },
      REST,
      {
        key: 'nip_upper_hypertrophy',
        name: 'Upper — Hypertrophy',
        exercises: [
          ex('Incline Dumbbell Press', 3, 10),
          ex('Pull Up', 3, 8),
          ex('Dumbbell Row', 3, 10),
          ex('Lateral Raise', 3, 15),
          ex('Cable Fly', 3, 15),
          ex('Hammer Curl', 2, 12),
          ex('Triceps Pushdown', 2, 12),
        ],
      },
      {
        key: 'nip_lower_hypertrophy',
        name: 'Lower — Hypertrophy',
        exercises: [ex('Deadlift', 3, 5), ex('Bulgarian Split Squat', 3, 10), ex('Hip Thrust', 3, 10), ex('Leg Extension', 3, 15), ex('Calf Raise', 3, 15), ex('Hanging Leg Raise', 3, 12)],
      },
      REST,
      REST,
    ],
  },
].map((program) => ({ ...program, is_preset: true, category: 'celebrity' }))

PRESET_PROGRAMS.push(...CELEBRITY_PROGRAMS)

module.exports = { PRESET_PROGRAMS }
