// API โปรแกรมฝึก: preset + โปรแกรมที่ผู้ใช้สร้าง, โปรแกรมที่ใช้อยู่ และตารางฝึกของวันนี้
//
// ตาราง: workout_programs -> program_days -> program_exercises (ดู programs/store.js)
// โปรแกรมที่ใช้อยู่เก็บใน users.active_program_id (uuid ของ workout_programs รวมแถว preset)
// วันเริ่มรอบเก็บใน users.active_program_started_on ถ้ามีคอลัมน์นี้ ถ้าไม่มี รอบตารางนับตามปฏิทิน
// (วันที่ 1 = วันจันทร์) วันที่ใช้เป็นวันที่ตามเครื่องผู้ใช้ (client ส่งมา) ไม่ใช่วันที่ของ server เพราะเขตเวลาต่างกัน

const express = require('express')
const { validateProgramInput, scheduledDay, isDateString, searchExercises } = require('../programs')
const { createProgramStore } = require('../programs/store')
const { createProgramGenerator, validateGenerateInput } = require('../programs/aiGenerator')

// ยังไม่ได้สร้างตาราง workout_programs / program_days / program_exercises หรือคอลัมน์ users.active_program_id
const isSchemaMissing = (error) => ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error?.code)
const isMissingColumn = (error, column) => isSchemaMissing(error) && String(error?.message || '').includes(column)

const todayUtc = () => new Date().toISOString().slice(0, 10)
// ไม่มีคอลัมน์วันเริ่ม: นับรอบจากวันจันทร์ 5 ม.ค. 1970 -> โปรแกรม 7 วัน วันที่ 1 = วันจันทร์เสมอ
const CALENDAR_ANCHOR = '1970-01-05'

// GeminiError.reason -> [HTTP status, message key ใน i18n.js]
const AI_FAILURES = {
  timeout: [504, 'programs.ai.timeout'],
  busy: [503, 'programs.ai.busy'],
  model_unavailable: [502, 'programs.ai.generateFailed'],
  failed: [502, 'programs.ai.generateFailed'],
}

// generateProgram: ใช้แทน Gemini ตอนทดสอบ (null = ไม่ได้ตั้ง GEMINI_API_KEY ปิดฟีเจอร์ AI)
module.exports = function createProgramsRouter({ supabase, requireAuth, handleSupabaseError, generateProgram = createProgramGenerator() }) {
  const router = express.Router()
  const store = createProgramStore(supabase)
  // มีคอลัมน์ users.active_program_started_on ไหม (undefined = ยังไม่รู้ ลองครั้งแรกแล้วจำไว้)
  let hasStartColumn

  function sendDbError(req, res, error, failKey) {
    if (isSchemaMissing(error)) {
      console.error(error)
      return res.status(500).json({ error: req.t('programs.dbNotReady') })
    }
    return handleSupabaseError(res, error, req.t(failKey))
  }

  async function loadActive(userId) {
    if (hasStartColumn !== false) {
      const { data, error } = await supabase
        .from('users')
        .select('active_program_id, active_program_started_on')
        .eq('id', userId)
        .maybeSingle()
      if (!error) {
        hasStartColumn = true
        return { active: data?.active_program_id ? { program_id: String(data.active_program_id), started_on: data.active_program_started_on } : null }
      }
      if (!isMissingColumn(error, 'active_program_started_on')) return { error }
      hasStartColumn = false
    }
    const { data, error } = await supabase.from('users').select('active_program_id').eq('id', userId).maybeSingle()
    if (error) return { error }
    return { active: data?.active_program_id ? { program_id: String(data.active_program_id), started_on: null } : null }
  }

  async function saveActive(userId, programId, startedOn) {
    if (hasStartColumn !== false) {
      const { error } = await supabase
        .from('users')
        .update({ active_program_id: programId, active_program_started_on: programId ? startedOn : null })
        .eq('id', userId)
      if (!error) {
        hasStartColumn = true
        return { started_on: programId ? startedOn : null }
      }
      if (!isMissingColumn(error, 'active_program_started_on')) return { error }
      hasStartColumn = false
    }
    const { error } = await supabase.from('users').update({ active_program_id: programId }).eq('id', userId)
    return error ? { error } : { started_on: null }
  }

  // ---- ท่ามาตรฐานสำหรับช่องค้นหาในตัวสร้างโปรแกรม ----
  router.get('/exercises', requireAuth, (req, res) => {
    res.json(searchExercises(req.query.q))
  })

  // ---- โปรแกรม ----
  router.get('/programs', requireAuth, async (req, res) => {
    const userId = req.authUser.uid
    const [presetResult, ownResult, activeResult] = await Promise.all([store.presets(), store.listOwn(userId), loadActive(userId)])
    const error = presetResult.error || ownResult.error || activeResult.error
    if (error) {
      if (!isSchemaMissing(error)) return handleSupabaseError(res, error, req.t('programs.loadFailed'))
      console.error(error)
      return res.json({ programs: [], active: null, db_ready: false })
    }
    res.json({ programs: [...presetResult.presets, ...ownResult.programs], active: activeResult.active, db_ready: true })
  })

  router.post('/programs', requireAuth, async (req, res) => {
    const { values, error: invalid } = validateProgramInput(req.body)
    if (invalid) return res.status(400).json({ error: req.t(invalid.key, invalid.params) })

    const { program, error } = await store.create(req.authUser.uid, values)
    if (error) return sendDbError(req, res, error, 'programs.saveFailed')
    res.status(201).json(program)
  })

  // ให้ AI ออกแบบโปรแกรม แล้วบันทึกเป็นโปรแกรมของผู้ใช้ทันที (แก้ต่อได้ใน builder เหมือนโปรแกรมที่สร้างเอง)
  // body: { days_per_week: 2-6, equipment: ['barbell'|'dumbbell'|'machine'|'kettlebell'], goal, level? }
  router.post('/programs/generate', requireAuth, async (req, res) => {
    if (!generateProgram) return res.status(503).json({ error: req.t('programs.ai.unavailable'), reason: 'ai_unavailable' })
    const { values: input, error: invalidInput } = validateGenerateInput(req.body)
    if (invalidInput) return res.status(400).json({ error: req.t(invalidInput) })

    let generated
    try {
      generated = await generateProgram(input, req.lang)
    } catch (error) {
      console.error('program generate failed:', error.message)
      const [status, messageKey] = AI_FAILURES[error.reason] || AI_FAILURES.failed
      return res.status(status).json({ error: req.t(messageKey), reason: `ai_${error.reason || 'failed'}` })
    }

    const { values, error: invalid } = validateProgramInput(generated)
    if (invalid) {
      console.error('program generate: invalid program from AI', invalid, JSON.stringify(generated).slice(0, 500))
      return res.status(502).json({ error: req.t('programs.ai.generateFailed'), reason: 'ai_invalid' })
    }

    const { program, error } = await store.create(req.authUser.uid, values)
    if (error) return sendDbError(req, res, error, 'programs.saveFailed')
    res.status(201).json(program)
  })

  router.put('/programs/:id', requireAuth, async (req, res) => {
    const { preset, error: presetError } = await store.isPreset(req.params.id)
    if (presetError) return sendDbError(req, res, presetError, 'programs.saveFailed')
    if (preset) return res.status(403).json({ error: req.t('programs.presetReadOnly') })
    const { values, error: invalid } = validateProgramInput(req.body)
    if (invalid) return res.status(400).json({ error: req.t(invalid.key, invalid.params) })

    const { program, error } = await store.update(req.authUser.uid, req.params.id, values)
    if (error) return sendDbError(req, res, error, 'programs.saveFailed')
    if (!program) return res.status(404).json({ error: req.t('programs.notFound') })
    res.json(program)
  })

  // ลบโปรแกรมที่กำลังใช้อยู่ = เลิกใช้โปรแกรม (store ล้าง users.active_program_id ให้)
  router.delete('/programs/:id', requireAuth, async (req, res) => {
    const { preset, error: presetError } = await store.isPreset(req.params.id)
    if (presetError) return sendDbError(req, res, presetError, 'programs.deleteFailed')
    if (preset) return res.status(403).json({ error: req.t('programs.presetReadOnly') })

    const { deleted, error } = await store.remove(req.authUser.uid, req.params.id)
    if (error) return sendDbError(req, res, error, 'programs.deleteFailed')
    if (!deleted) return res.status(404).json({ error: req.t('programs.notFound') })
    res.status(204).end()
  })

  // ---- โปรแกรมที่ใช้อยู่ ----
  // body: { program_id, started_on? } — program_id = null คือเลิกใช้โปรแกรม
  // started_on (YYYY-MM-DD ตามเครื่องผู้ใช้) = วันแรกของรอบ ไม่ส่งมาใช้วันนี้ตาม UTC
  router.post('/users/me/active-program', requireAuth, async (req, res) => {
    const userId = req.authUser.uid
    const programId = req.body?.program_id == null ? null : String(req.body.program_id)
    const startedOn = isDateString(req.body?.started_on) ? req.body.started_on : todayUtc()

    let program = null
    if (programId) {
      const found = await store.find(userId, programId)
      if (found.error) return sendDbError(req, res, found.error, 'programs.activateFailed')
      if (!found.program) return res.status(404).json({ error: req.t('programs.notFound') })
      program = found.program
    }

    const saved = await saveActive(userId, programId, startedOn)
    if (saved.error) return sendDbError(req, res, saved.error, 'programs.activateFailed')
    res.json({ active: programId ? { program_id: programId, started_on: saved.started_on } : null, program })
  })

  // ?date=YYYY-MM-DD (วันที่ตามเครื่องผู้ใช้) -> { program, active, today } หรือ { program: null } ถ้าไม่ได้ใช้โปรแกรม
  // today.week = null เมื่อไม่มีวันเริ่ม (นับตามปฏิทิน)
  router.get('/users/me/active-program/today', requireAuth, async (req, res) => {
    const userId = req.authUser.uid
    const today = isDateString(req.query.date) ? req.query.date : todayUtc()

    const { active, error } = await loadActive(userId)
    if (error) {
      if (isSchemaMissing(error)) return res.json({ program: null, active: null, today: null, db_ready: false })
      return handleSupabaseError(res, error, req.t('programs.loadFailed'))
    }
    if (!active) return res.json({ program: null, active: null, today: null })

    const found = await store.find(userId, active.program_id)
    if (found.error) return sendDbError(req, res, found.error, 'programs.loadFailed')
    // โปรแกรมถูกลบไปแล้ว (เช่น จากอีกอุปกรณ์)
    if (!found.program) return res.json({ program: null, active: null, today: null })

    const schedule = scheduledDay(found.program, active.started_on || CALENDAR_ANCHOR, today)
    if (!active.started_on) schedule.week = null
    res.json({ program: found.program, active, today: { date: today, ...schedule } })
  })

  return router
}
