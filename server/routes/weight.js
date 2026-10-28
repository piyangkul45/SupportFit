// API น้ำหนักตัวรายวัน (หน้า "สถิติ"): ตาราง weight_logs 1 แถวต่อผู้ใช้ต่อวัน
//
// logged_on = วันที่ตามเครื่องผู้ใช้ (client ส่งมา เพราะเขตเวลาต่างจาก server) บันทึกซ้ำวันเดิม = แก้ค่าเดิม (upsert)
// บันทึกวันที่ใหม่สุดของผู้ใช้ -> อัปเดต users.weight_kg ด้วย เพื่อให้การคำนวณแคลอรีที่เผาผลาญใช้น้ำหนักล่าสุด

const express = require('express')
const { isDateString } = require('../programs')

const WEIGHT_RANGE = [20, 400]
const MAX_DAYS = 365
const DEFAULT_DAYS = 90

// วันที่ 'YYYY-MM-DD' ย้อนหลัง days วันจาก today (นับแบบ UTC ล้วน ไม่ขึ้นกับเขตเวลาของ server)
function daysBefore(today, days) {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

module.exports = function createWeightRouter({ supabase, requireAuth, handleSupabaseError }) {
  const router = express.Router()

  // ?days=90&today=YYYY-MM-DD -> weight_logs ช่วงนั้น เรียงจากเก่าไปใหม่
  router.get('/weight-logs', requireAuth, async (req, res) => {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || DEFAULT_DAYS, 1), MAX_DAYS)
    const today = isDateString(req.query.today) ? req.query.today : new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('weight_logs')
      .select('id, weight_kg, logged_on')
      .eq('user_id', req.authUser.uid)
      .gte('logged_on', daysBefore(today, days - 1))
      .lte('logged_on', today)
      .order('logged_on', { ascending: true })
    if (error) return handleSupabaseError(res, error, req.t('weight.loadFailed'))
    res.json(data)
  })

  // body: { weight_kg, logged_on } -> { log, profile_weight_kg } (profile_weight_kg = null ถ้าไม่ใช่วันล่าสุด)
  router.post('/weight-logs', requireAuth, async (req, res) => {
    const weight = Number(req.body?.weight_kg)
    if (!(Number.isFinite(weight) && weight >= WEIGHT_RANGE[0] && weight <= WEIGHT_RANGE[1])) {
      return res.status(400).json({ error: req.t('weight.invalidWeight', { min: WEIGHT_RANGE[0], max: WEIGHT_RANGE[1] }) })
    }
    if (!isDateString(req.body?.logged_on)) return res.status(400).json({ error: req.t('weight.invalidDate') })

    const userId = req.authUser.uid
    const weight_kg = Math.round(weight * 10) / 10
    const { data: log, error } = await supabase
      .from('weight_logs')
      .upsert({ user_id: userId, weight_kg, logged_on: req.body.logged_on }, { onConflict: 'user_id,logged_on' })
      .select('id, weight_kg, logged_on')
      .single()
    if (error) return handleSupabaseError(res, error, req.t('weight.saveFailed'))

    // เป็นวันที่ใหม่สุดของผู้ใช้หรือไม่ (ย้อนบันทึกวันเก่า = ไม่แตะน้ำหนักในโปรไฟล์)
    const { data: latest, error: latestError } = await supabase
      .from('weight_logs')
      .select('logged_on')
      .eq('user_id', userId)
      .order('logged_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    let profile_weight_kg = null
    if (!latestError && latest?.logged_on === log.logged_on) {
      const { error: profileError } = await supabase.from('users').update({ weight_kg }).eq('id', userId)
      if (profileError) console.error('weight: อัปเดต users.weight_kg ไม่สำเร็จ', profileError.message)
      else profile_weight_kg = weight_kg
    }

    res.status(201).json({ log, profile_weight_kg })
  })

  router.delete('/weight-logs/:id', requireAuth, async (req, res) => {
    const { data, error } = await supabase
      .from('weight_logs')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.authUser.uid)
      .select('id')
    if (error) return handleSupabaseError(res, error, req.t('weight.deleteFailed'))
    if (!data?.length) return res.status(404).json({ error: req.t('data.logNotFound') })
    res.status(204).end()
  })

  return router
}
