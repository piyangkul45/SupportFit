// ทดสอบ AI ออกแบบโปรแกรม: ตรวจ input, รายชื่อท่าตามอุปกรณ์ และการตรวจ/ปัดผลจาก Gemini (ไม่เรียก Gemini จริง)
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { validateGenerateInput, normalizeProgram, allowedExercises, createProgramGenerator } = require('../programs/aiGenerator')
const { validateProgramInput } = require('../programs')

describe('validateGenerateInput', () => {
  test('accepts a valid request and drops unknown equipment', () => {
    const { values } = validateGenerateInput({ days_per_week: 4, goal: 'gain_muscle', equipment: ['barbell', 'laser', 'barbell'] })
    assert.deepEqual(values, { daysPerWeek: 4, goal: 'gain_muscle', level: 'beginner', equipment: ['barbell'] })
  })

  test('rejects out-of-range days and unknown goals', () => {
    assert.equal(validateGenerateInput({ days_per_week: 7, goal: 'general' }).error, 'programs.ai.invalidDays')
    assert.equal(validateGenerateInput({ days_per_week: 3, goal: 'fly' }).error, 'programs.ai.invalidGoal')
  })
})

describe('allowedExercises', () => {
  test('bodyweight only excludes barbell lifts', () => {
    const names = allowedExercises([])
    assert.ok(names.includes('Push Up'))
    assert.ok(!names.includes('Bench Press'))
  })

  test('adding barbell unlocks barbell lifts', () => {
    assert.ok(allowedExercises(['barbell']).includes('Bench Press'))
  })
})

describe('normalizeProgram', () => {
  const names = allowedExercises(['barbell', 'dumbbell'])

  test('pads to 7 days, drops unknown/duplicate exercises and clamps targets', () => {
    const program = normalizeProgram(
      {
        title: 'Strength',
        description: 'x',
        days: [
          {
            name: 'Day A',
            exercises: [
              { exercise_name: 'Squat', sets: 12, reps: 0 },
              { exercise_name: 'Squat', sets: 3, reps: 5 },
              { exercise_name: 'Laser Curl', sets: 3, reps: 5 },
            ],
          },
          { name: 'Rest', exercises: [] },
        ],
      },
      names
    )
    assert.equal(program.days.length, 7)
    assert.deepEqual(program.days[0].exercises, [{ exercise_name: 'Squat', sets: 6, reps: 1, weight_kg: null }])
    // ผลที่ปัดแล้วต้องผ่านการตรวจเดียวกับโปรแกรมที่ผู้ใช้สร้างเอง
    assert.ok(validateProgramInput(program).values)
  })
})

describe('createProgramGenerator', () => {
  test('is disabled without an API key', () => {
    assert.equal(createProgramGenerator({ apiKey: '' }), null)
  })

  test('sends the allowed exercise list and parses the reply', async () => {
    let request
    const generate = async (req) => {
      request = req
      return { text: JSON.stringify({ title: 'Full Body', description: '', days: [{ name: 'A', exercises: [{ exercise_name: 'Push Up', sets: 3, reps: 12 }] }] }) }
    }
    const generateProgram = createProgramGenerator({ apiKey: 'k', model: 'm', fallbackModel: null, generate, logger: { warn() {} } })
    const program = await generateProgram({ daysPerWeek: 3, goal: 'general', level: 'beginner', equipment: [] }, 'th')
    assert.equal(program.days[0].exercises[0].exercise_name, 'Push Up')
    assert.match(request.contents, /Thai/)
    assert.deepEqual(request.config.responseSchema.properties.days.items.properties.exercises.items.properties.exercise_name.enum, allowedExercises([]))
  })
})
