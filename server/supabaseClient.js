require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
// ใช้ service_role key ถ้ามี (bypass RLS, ปลอดภัยเพราะรันอยู่ฝั่ง server เท่านั้น)
// ถ้าไม่มีให้ fallback ไปที่ anon key (ต้องเปิด policy ให้ anon เขียน/อ่านได้เอง)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'ไม่พบ SUPABASE_URL หรือคีย์ใน server/.env กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY (แนะนำ) หรือ SUPABASE_ANON_KEY'
  )
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

module.exports = supabase
