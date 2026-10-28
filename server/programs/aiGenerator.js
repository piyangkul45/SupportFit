// ให้ Gemini ออกแบบโปรแกรมฝึก (รอบ 7 วัน) จากจำนวนวันฝึก/สัปดาห์, อุปกรณ์ที่มี, เป้าหมาย และระดับประสบการณ์
//
// ชื่อท่าต้องตรงกับฐานข้อมูล (validateProgramInput ตรวจ) จึงบังคับด้วย enum ใน responseSchema
// ให้เลือกได้เฉพาะท่ายอดฮิตในฐานข้อมูลที่ใช้อุปกรณ์ที่ผู้ใช้มี (bodyweight ใช้ได้เสมอ)
// ผลลัพธ์รูปเดียวกับ body ของ POST /api/programs ({ title, description, days }) แล้วตรวจซ้ำด้วย validateProgramInput
// โมเดล/timeout/การลองโมเดลสำรอง: ดู parser/geminiModels.js (ล้มเหลว -> GeminiError ที่มี reason)

const { Type } = require('@google/genai')
const { createGeminiCaller } = require('../parser/geminiModels')
const EXERCISE_DATABASE = require('../parser/exerciseDatabase.json')

const CYCLE_DAYS = 7
// ~60 ท่าแรกของฐานข้อมูลคือท่ายอดฮิตที่มี alias ไทย (เหมือน POPULAR_COUNT ใน programs/index.js)
const POPULAR_COUNT = 60

// ตัวเลือกอุปกรณ์ในฟอร์ม -> ค่า equipment ในฐานข้อมูลท่า
const EQUIPMENT_GROUPS = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  machine: ['machine', 'cable'],
  kettlebell: ['kettlebell'],
}
const ALWAYS_AVAILABLE = ['bodyweight', 'none', 'rope']

const GOALS = {
  lose_weight: 'fat loss while keeping muscle (moderate weights, higher reps, include conditioning such as Burpee, Jump Rope, Running)',
  gain_muscle: 'muscle hypertrophy (8-12 reps, 3-4 sets, enough weekly volume per muscle group)',
  strength: 'maximal strength (compound lifts, 3-6 reps, 3-5 sets)',
  endurance: 'muscular endurance and fitness (12-20 reps, circuits, conditioning)',
  general: 'general health and fitness (balanced full-body work)',
}
const LEVELS = {
  beginner: 'beginner (simple movements, 3-5 exercises per day)',
  intermediate: 'intermediate (4-6 exercises per day)',
  advanced: 'advanced (5-7 exercises per day, higher volume)',
}
const DAYS_PER_WEEK = [2, 6]

// body ของ POST /api/programs/generate -> { values } หรือ { error: key }
function validateGenerateInput(body = {}) {
  const daysPerWeek = Number(body.days_per_week)
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < DAYS_PER_WEEK[0] || daysPerWeek > DAYS_PER_WEEK[1]) {
    return { error: 'programs.ai.invalidDays' }
  }
  if (!GOALS[body.goal]) return { error: 'programs.ai.invalidGoal' }
  const level = LEVELS[body.level] ? body.level : 'beginner'
  const equipment = Array.isArray(body.equipment) ? [...new Set(body.equipment.filter((item) => EQUIPMENT_GROUPS[item]))] : []
  return { values: { daysPerWeek, goal: body.goal, level, equipment } }
}

function allowedExercises(equipment) {
  const types = new Set([...ALWAYS_AVAILABLE, ...equipment.flatMap((item) => EQUIPMENT_GROUPS[item])])
  return EXERCISE_DATABASE.slice(0, POPULAR_COUNT)
    .filter((exercise) => types.has(exercise.equipment))
    .map((exercise) => exercise.name)
}

function buildPrompt({ daysPerWeek, goal, level, equipment }, language) {
  return [
    `Design a ${CYCLE_DAYS}-day repeating workout program.`,
    `Training days per week: exactly ${daysPerWeek}. The other ${CYCLE_DAYS - daysPerWeek} days are rest days with an empty exercises array.`,
    'Spread rest days sensibly (avoid more than 3 training days in a row when possible).',
    `Goal: ${GOALS[goal]}.`,
    `Experience level: ${LEVELS[level]}.`,
    `Equipment available: ${equipment.length ? equipment.join(', ') : 'none'} plus bodyweight.`,
    'Use only exercise names from the allowed list. Do not repeat an exercise within the same day.',
    'sets: 1-6, reps: 1-30 (for Plank or holds, reps = seconds / 5).',
    `Write title, description and day names in ${language === 'th' ? 'Thai' : 'English'}. Day names describe the focus, e.g. "Push — Chest & Triceps"; rest days are named "${language === 'th' ? 'วันพัก' : 'Rest'}".`,
    'Title at most 60 characters, description at most 200 characters.',
  ].join('\n')
}

function responseSchema(exerciseNames) {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  exercise_name: { type: Type.STRING, enum: exerciseNames },
                  sets: { type: Type.INTEGER },
                  reps: { type: Type.INTEGER },
                },
                required: ['exercise_name', 'sets', 'reps'],
                propertyOrdering: ['exercise_name', 'sets', 'reps'],
              },
            },
          },
          required: ['name', 'exercises'],
          propertyOrdering: ['name', 'exercises'],
        },
      },
    },
    required: ['title', 'description', 'days'],
    propertyOrdering: ['title', 'description', 'days'],
  }
}

const clamp = (value, min, max, fallback) => {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback
}

// ผลจาก Gemini -> body ของ POST /api/programs: ตัดชื่อท่าที่ไม่อยู่ในรายการ/ซ้ำในวัน, จำกัดเซต/ครั้ง, รอบ 7 วัน
function normalizeProgram(data, exerciseNames) {
  const allowed = new Set(exerciseNames)
  const days = (Array.isArray(data?.days) ? data.days : []).slice(0, CYCLE_DAYS).map((day) => {
    const seen = new Set()
    const exercises = (Array.isArray(day?.exercises) ? day.exercises : [])
      .filter((exercise) => allowed.has(exercise?.exercise_name) && !seen.has(exercise.exercise_name) && seen.add(exercise.exercise_name))
      .slice(0, 10)
      .map((exercise) => ({
        exercise_name: exercise.exercise_name,
        sets: clamp(exercise.sets, 1, 6, 3),
        reps: clamp(exercise.reps, 1, 30, 10),
        weight_kg: null,
      }))
    return { name: String(day?.name || '').trim().slice(0, 60), exercises }
  })
  while (days.length < CYCLE_DAYS) days.push({ name: '', exercises: [] })
  return {
    title: String(data?.title || '').trim().slice(0, 80),
    description: String(data?.description || '').trim().slice(0, 300),
    days,
  }
}

// คืน async (values, language) => { title, description, days } หรือ null ถ้าไม่ได้ตั้ง GEMINI_API_KEY
// options อื่น (model, fallbackModel, generate, logger) ส่งต่อให้ createGeminiCaller
function createProgramGenerator({ apiKey = process.env.GEMINI_API_KEY, ...options } = {}) {
  if (!apiKey) return null
  const callGemini = createGeminiCaller({ apiKey, label: 'program', ...options })

  return function generateProgram(values, language = 'en') {
    const exerciseNames = allowedExercises(values.equipment)
    return callGemini(
      {
        contents: buildPrompt(values, language),
        config: {
          systemInstruction: [
            'You are an experienced strength and conditioning coach. Reply with JSON only.',
            `Allowed exercise names: ${exerciseNames.join(', ')}`,
          ].join('\n'),
          responseMimeType: 'application/json',
          responseSchema: responseSchema(exerciseNames),
          temperature: 0.4,
        },
      },
      (response) => normalizeProgram(JSON.parse(response.text || 'null'), exerciseNames)
    )
  }
}

module.exports = { createProgramGenerator, validateGenerateInput, normalizeProgram, allowedExercises, EQUIPMENT_GROUPS, GOALS, LEVELS }
