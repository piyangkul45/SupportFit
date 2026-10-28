// ทดสอบโปรแกรมฝึก: preset ใช้ชื่อท่ามาตรฐาน, ตรวจข้อมูลโปรแกรมที่สร้างเอง, ตารางฝึกวันนี้, ค้นหาท่า
// และการผูกคำสั่งเสียงแบบย่อ ("100 kg 8 reps") กับท่าที่เลือกไว้
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const {
  PRESET_PROGRAMS,
  validateProgramInput,
  scheduledDay,
  searchExercises,
  canonicalExerciseName,
} = require('../programs')
const { parseCommand } = require('../parser')
const { rowToProgram, exerciseRows, isUuid } = require('../programs/store')

describe('preset programs', () => {
  test('PPL 6-day, Upper/Lower 4-day and Full Body 3-day are available', () => {
    const trainingDays = Object.fromEntries(
      PRESET_PROGRAMS.map((program) => [program.key, program.days.filter((day) => day.exercises.length).length])
    )
    assert.deepEqual(trainingDays, {
      ppl: 6,
      upper_lower: 4,
      full_body: 3,
      arnold_golden_six: 3,
      cbum_classic: 5,
      rock_hercules: 6,
      thor_superhero: 4,
      mentzer_hit: 3,
      nippard_4day: 4,
    })
  })

  test('celebrity routines carry a celebrity, difficulty and muscle tags', () => {
    const celebrity = PRESET_PROGRAMS.filter((program) => program.category === 'celebrity')
    assert.equal(celebrity.length, 6)
    for (const program of celebrity) {
      assert.ok(program.celebrity, program.key)
      assert.ok(['beginner', 'intermediate', 'advanced'].includes(program.difficulty), program.key)
      assert.ok(program.muscles.length > 0, program.key)
    }
  })

  test('preset titles are unique (store matches preset rows by title)', () => {
    const titles = PRESET_PROGRAMS.map((program) => program.title)
    assert.equal(new Set(titles).size, titles.length)
  })

  test('every preset is a weekly cycle', () => {
    for (const program of PRESET_PROGRAMS) assert.equal(program.days.length, 7, program.key)
  })

  test('every preset exercise is a canonical exercise name', () => {
    for (const program of PRESET_PROGRAMS) {
      for (const day of program.days) {
        for (const exercise of day.exercises) {
          assert.equal(canonicalExerciseName(exercise.exercise_name), exercise.exercise_name, `${program.key} / ${day.key}`)
        }
      }
    }
  })

  test('presets pass the same validation as custom programs', () => {
    for (const program of PRESET_PROGRAMS) assert.ok(validateProgramInput(program).values, program.key)
  })
})

describe('custom program validation', () => {
  const valid = {
    title: '  My Split  ',
    description: 'Two days',
    days: [
      { name: 'Chest & Triceps', exercises: [{ exercise_name: 'bench press', sets: '3', reps: 8, weight_kg: '60' }] },
      { name: 'Rest', exercises: [] },
    ],
  }

  test('normalises title, exercise names and numbers', () => {
    const { values } = validateProgramInput(valid)
    assert.equal(values.title, 'My Split')
    assert.deepEqual(values.days[0].exercises[0], { exercise_name: 'Bench Press', sets: 3, reps: 8, weight_kg: 60 })
    assert.deepEqual(values.days[1].exercises, [])
  })

  test('target weight is optional', () => {
    const body = { ...valid, days: [{ name: 'A', exercises: [{ exercise_name: 'Pull Up', sets: 3, reps: 10, weight_kg: '' }] }] }
    assert.equal(validateProgramInput(body).values.days[0].exercises[0].weight_kg, null)
  })

  const rejected = [
    ['missing title', { ...valid, title: ' ' }, 'programs.titleRequired'],
    ['no days', { ...valid, days: [] }, 'programs.daysRequired'],
    ['only rest days', { ...valid, days: [{ name: 'Rest', exercises: [] }] }, 'programs.noTrainingDays'],
    ['unknown exercise', { ...valid, days: [{ name: 'A', exercises: [{ exercise_name: 'ใบเสด', sets: 3, reps: 8 }] }] }, 'programs.unknownExercise'],
    ['zero sets', { ...valid, days: [{ name: 'A', exercises: [{ exercise_name: 'Squat', sets: 0, reps: 8 }] }] }, 'programs.invalidTarget'],
    ['fractional reps', { ...valid, days: [{ name: 'A', exercises: [{ exercise_name: 'Squat', sets: 3, reps: 8.5 }] }] }, 'programs.invalidTarget'],
    ['negative weight', { ...valid, days: [{ name: 'A', exercises: [{ exercise_name: 'Squat', sets: 3, reps: 8, weight_kg: -5 }] }] }, 'programs.invalidTarget'],
    ['too many days', { ...valid, days: Array.from({ length: 15 }, () => valid.days[0]) }, 'programs.tooManyDays'],
  ]
  for (const [label, body, key] of rejected) {
    test(`rejects ${label}`, () => assert.equal(validateProgramInput(body).error?.key, key))
  }
})

describe("today's scheduled day", () => {
  const ppl = PRESET_PROGRAMS.find((program) => program.key === 'ppl')

  test('the start date is day 1', () => {
    const today = scheduledDay(ppl, '2026-10-20', '2026-10-20')
    assert.equal(today.day_number, 1)
    assert.equal(today.day.key, 'push_a')
    assert.equal(today.is_rest_day, false)
  })

  test('advances one day per calendar day and wraps after the cycle', () => {
    assert.equal(scheduledDay(ppl, '2026-10-20', '2026-10-22').day.key, 'legs_a')
    const rest = scheduledDay(ppl, '2026-10-20', '2026-10-26')
    assert.equal(rest.is_rest_day, true)
    const nextWeek = scheduledDay(ppl, '2026-10-20', '2026-10-27')
    assert.equal(nextWeek.day.key, 'push_a')
    assert.equal(nextWeek.week, 2)
  })

  test('crosses month and year boundaries by calendar date', () => {
    assert.equal(scheduledDay(ppl, '2026-12-30', '2027-01-02').day_number, 4)
  })

  test('a date before the start date is treated as day 1', () => {
    assert.equal(scheduledDay(ppl, '2026-10-20', '2026-10-19').day_number, 1)
  })
})

describe('exercise search', () => {
  test('finds canonical names by English prefix, popular exercises first', () => {
    assert.equal(searchExercises('bench')[0], 'Bench Press')
  })
  test('finds exercises by Thai alias', () => assert.ok(searchExercises('สควอท').includes('Squat')))
  test('empty query lists popular exercises', () => {
    const results = searchExercises('')
    assert.equal(results.length, 20)
    assert.equal(results[0], 'Bench Press')
  })
  test('respects the result limit', () => assert.equal(searchExercises('press', 5).length, 5))
})

describe('abbreviated voice commands bound to the selected exercise', () => {
  test('"100 kg 8 reps" uses the hinted exercise', () => {
    const result = parseCommand('100 kg 8 reps', { exerciseHint: 'Bench Press' })
    assert.equal(result.exercise_name, 'Bench Press')
    assert.equal(result.match_type, 'hint')
    assert.equal(result.weight_kg, 100)
    assert.equal(result.reps, 8)
  })
  test('Thai units with a leading verb also use the hint', () =>
    assert.equal(parseCommand('ยก 100 โล 8 ครั้ง', { exerciseHint: 'Squat' }).exercise_name, 'Squat'))
  test('a spoken exercise name wins over the hint', () =>
    assert.equal(parseCommand('สควอท 100 โล 8 ครั้ง', { exerciseHint: 'Bench Press' }).exercise_name, 'Squat'))
  test('a hint that is not a canonical exercise is ignored', () =>
    assert.equal(parseCommand('100 kg 8 reps', { exerciseHint: 'Made Up Lift' }), null))
  test('without a hint, numbers alone are still not understood', () => assert.equal(parseCommand('100 kg 8 reps'), null))
})

describe('database rows (workout_programs -> program_days -> program_exercises)', () => {
  const row = {
    id: '6f1c2a9e-0000-4000-8000-000000000001',
    title: 'My Split',
    description: null,
    is_preset: false,
    program_days: [
      { id: 'd2', day_name: 'Rest', day_order: 2, program_exercises: [] },
      {
        id: 'd1',
        day_name: 'Chest',
        day_order: 1,
        program_exercises: [
          { exercise_name: 'Bench Press', target_sets: 4, target_reps: 8, target_weight_kg: 60 },
          { exercise_name: 'Push Up', target_sets: 3, target_reps: 15, target_weight_kg: 0 },
        ],
      },
    ],
  }

  test('days come back in day_order and a 0 kg target means no target weight', () => {
    const program = rowToProgram(row)
    assert.deepEqual(program.days.map((day) => day.name), ['Chest', 'Rest'])
    assert.deepEqual(program.days[0].exercises[0], { exercise_name: 'Bench Press', sets: 4, reps: 8, weight_kg: 60 })
    assert.equal(program.days[0].exercises[1].weight_kg, null)
    assert.equal(program.description, '')
    assert.equal(scheduledDay(program, '2026-10-20', '2026-10-21').is_rest_day, true)
  })

  test('exercises are written against the id of their day', () => {
    const days = rowToProgram(row).days
    assert.deepEqual(
      exerciseRows(days, ['day-1', 'day-2']).map((exercise) => [exercise.day_id, exercise.exercise_name, exercise.target_sets]),
      [['day-1', 'Bench Press', 4], ['day-1', 'Push Up', 3]],
    )
  })

  test('only uuids are looked up', () => {
    assert.equal(isUuid(row.id), true)
    assert.equal(isUuid('preset-ppl'), false)
    assert.equal(isUuid('1'), false)
  })
})
