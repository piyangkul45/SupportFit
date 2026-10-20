// เก็บโปรแกรมฝึกในตารางของ Supabase: workout_programs -> program_days -> program_exercises
//
// API/client ใช้รูปแบบเดียว: { id, is_preset, key, title, description, days: [{ key?, name, exercises: [{ exercise_name, sets, reps, weight_kg }] }] }
// preset เก็บเป็นแถว is_preset = true (user_id = null) สร้างอัตโนมัติจาก presets.js ครั้งแรกที่ใช้
// เพราะ users.active_program_id เป็น uuid ที่อ้างถึง workout_programs.id — เนื้อหา preset ที่ส่งให้ client
// ยังมาจาก presets.js (มี key สำหรับแปลชื่อ) แค่ใช้ id จากตาราง
//
// program_exercises ไม่มีคอลัมน์ลำดับ: ลำดับท่าในวันอาศัยลำดับที่ insert (แก้โปรแกรม = ลบวันเดิมแล้ว insert ใหม่ทั้งหมด)

const { PRESET_PROGRAMS } = require('./presets')

const PROGRAM_COLUMNS =
  'id, user_id, title, description, is_preset, created_at, program_days(id, day_name, day_order, program_exercises(id, exercise_name, target_sets, target_reps, target_weight_kg))'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value) => UUID_RE.test(String(value || ''))

// แถว workout_programs (พร้อม program_days/program_exercises ที่ embed มา) -> รูปแบบของ API
function rowToProgram(row) {
  const days = [...(row.program_days || [])]
    .sort((a, b) => a.day_order - b.day_order)
    .map((day) => ({
      name: day.day_name || '',
      exercises: (day.program_exercises || []).map((exercise) => ({
        exercise_name: exercise.exercise_name,
        sets: exercise.target_sets,
        reps: exercise.target_reps,
        // คอลัมน์มี default 0 = ไม่ได้ตั้งน้ำหนักเป้าหมาย
        weight_kg: exercise.target_weight_kg ? exercise.target_weight_kg : null,
      })),
    }))
  return {
    id: String(row.id),
    is_preset: Boolean(row.is_preset),
    key: null,
    title: row.title,
    description: row.description || '',
    days,
    created_at: row.created_at,
  }
}

// วันของโปรแกรม -> แถว program_exercises (dayIds เรียงตาม day_order)
function exerciseRows(days, dayIds) {
  return days.flatMap((day, index) =>
    day.exercises.map((exercise) => ({
      day_id: dayIds[index],
      exercise_name: exercise.exercise_name,
      target_sets: exercise.sets,
      target_reps: exercise.reps,
      target_weight_kg: exercise.weight_kg,
    })),
  )
}

function createProgramStore(supabase) {
  let presetsPromise = null

  // insert วัน + ท่าของโปรแกรม (programId มีอยู่แล้ว)
  async function insertDays(programId, days) {
    const { data: dayRows, error } = await supabase
      .from('program_days')
      .insert(days.map((day, index) => ({ program_id: programId, day_name: day.name || '', day_order: index + 1 })))
      .select('id, day_order')
    if (error) return { error }
    const dayIds = [...dayRows].sort((a, b) => a.day_order - b.day_order).map((day) => day.id)
    const rows = exerciseRows(days, dayIds)
    if (rows.length === 0) return {}
    const { error: exerciseError } = await supabase.from('program_exercises').insert(rows)
    return exerciseError ? { error: exerciseError } : {}
  }

  // ลบวัน + ท่าของโปรแกรม (ไม่พึ่ง on delete cascade ของ foreign key)
  async function deleteDays(programId) {
    const { data: dayRows, error } = await supabase.from('program_days').select('id').eq('program_id', programId)
    if (error) return { error }
    if (dayRows.length === 0) return {}
    const dayIds = dayRows.map((day) => day.id)
    const { error: exerciseError } = await supabase.from('program_exercises').delete().in('day_id', dayIds)
    if (exerciseError) return { error: exerciseError }
    const { error: dayError } = await supabase.from('program_days').delete().eq('program_id', programId)
    return dayError ? { error: dayError } : {}
  }

  async function deleteProgramRows(programId) {
    const { error } = await deleteDays(programId)
    if (error) return { error }
    const { error: programError } = await supabase.from('workout_programs').delete().eq('id', programId)
    return programError ? { error: programError } : {}
  }

  async function insertProgram(fields, days) {
    const { data, error } = await supabase.from('workout_programs').insert(fields).select('id').single()
    if (error) return { error }
    const { error: daysError } = await insertDays(data.id, days)
    if (daysError) {
      // ไม่มี transaction: ลบส่วนที่ insert ไปแล้ว ไม่ให้เหลือโปรแกรมครึ่ง ๆ กลาง ๆ
      await deleteProgramRows(data.id)
      return { error: daysError }
    }
    return { id: data.id }
  }

  // preset ทั้งหมดพร้อม id จากตาราง (สร้างแถวที่ยังไม่มี) -> { presets: [...], error? }
  // จับคู่แถวกับ presets.js จาก title
  async function loadPresets() {
    const { data, error } = await supabase.from('workout_programs').select('id, title').eq('is_preset', true).is('user_id', null)
    if (error) return { error }
    const idByTitle = new Map()
    for (const row of data) if (!idByTitle.has(row.title)) idByTitle.set(row.title, String(row.id))

    for (const preset of PRESET_PROGRAMS) {
      if (idByTitle.has(preset.title)) continue
      const { id, error: insertError } = await insertProgram(
        { user_id: null, title: preset.title, description: preset.description, is_preset: true },
        preset.days,
      )
      if (insertError) return { error: insertError }
      idByTitle.set(preset.title, String(id))
    }
    return { presets: PRESET_PROGRAMS.map((preset) => ({ ...preset, id: idByTitle.get(preset.title) })) }
  }

  // โหลดครั้งเดียวต่อ process (ล้มเหลว = ลองใหม่ครั้งหน้า)
  function presets() {
    if (!presetsPromise) {
      presetsPromise = loadPresets().then((result) => {
        if (result.error) presetsPromise = null
        return result
      })
    }
    return presetsPromise
  }

  return {
    presets,

    async listOwn(userId) {
      const { data, error } = await supabase
        .from('workout_programs')
        .select(PROGRAM_COLUMNS)
        .eq('user_id', userId)
        .eq('is_preset', false)
        .order('created_at', { ascending: false })
      if (error) return { error }
      return { programs: data.map(rowToProgram) }
    },

    // preset หรือโปรแกรมของผู้ใช้คนนี้ (ของคนอื่น/ไม่มี = program: null)
    async find(userId, programId) {
      if (!isUuid(programId)) return { program: null }
      const { presets: presetList, error: presetError } = await presets()
      if (presetError) return { error: presetError }
      const preset = presetList.find((program) => program.id === String(programId))
      if (preset) return { program: preset }

      const { data, error } = await supabase
        .from('workout_programs')
        .select(PROGRAM_COLUMNS)
        .eq('id', programId)
        .eq('user_id', userId)
        .eq('is_preset', false)
        .maybeSingle()
      if (error) return { error }
      return { program: data ? rowToProgram(data) : null }
    },

    async isPreset(programId) {
      if (!isUuid(programId)) return {}
      const { presets: presetList, error } = await presets()
      if (error) return { error }
      return { preset: presetList.some((program) => program.id === String(programId)) }
    },

    // values จาก validateProgramInput
    async create(userId, { title, description, days }) {
      const { id, error } = await insertProgram({ user_id: userId, title, description, is_preset: false }, days)
      if (error) return { error }
      return this.find(userId, id)
    },

    async update(userId, programId, { title, description, days }) {
      if (!isUuid(programId)) return { program: null }
      const { data, error } = await supabase
        .from('workout_programs')
        .update({ title, description })
        .eq('id', programId)
        .eq('user_id', userId)
        .eq('is_preset', false)
        .select('id')
        .maybeSingle()
      if (error) return { error }
      if (!data) return { program: null }
      const { error: deleteError } = await deleteDays(programId)
      if (deleteError) return { error: deleteError }
      const { error: insertError } = await insertDays(programId, days)
      if (insertError) return { error: insertError }
      return this.find(userId, programId)
    },

    // -> { deleted: boolean }
    async remove(userId, programId) {
      if (!isUuid(programId)) return { deleted: false }
      const { data, error } = await supabase
        .from('workout_programs')
        .select('id')
        .eq('id', programId)
        .eq('user_id', userId)
        .eq('is_preset', false)
        .maybeSingle()
      if (error) return { error }
      if (!data) return { deleted: false }
      // users.active_program_id อ้างถึงโปรแกรมนี้ ต้องล้างก่อนลบ
      const { error: clearError } = await supabase.from('users').update({ active_program_id: null }).eq('active_program_id', programId)
      if (clearError) return { error: clearError }
      const { error: deleteError } = await deleteProgramRows(programId)
      return deleteError ? { error: deleteError } : { deleted: true }
    },
  }
}

module.exports = { createProgramStore, rowToProgram, exerciseRows, isUuid }
