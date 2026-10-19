require('dotenv').config({ quiet: true })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const SCHEMA_PATH = path.join(__dirname, 'sql', 'schema.sql')

// รัน sql/schema.sql ทั้งไฟล์บน Supabase ผ่าน Postgres connection ตรง (DATABASE_URL)
// เพราะ supabase-js / PostgREST สร้างตารางหรือเพิ่มคอลัมน์ (DDL) ไม่ได้
// schema.sql เขียนแบบ idempotent ทั้งหมด จึงรันซ้ำทุกครั้งที่ start server ได้ปลอดภัย
async function runMigrations() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return { skipped: true }

  const client = new Client({
    connectionString,
    // Supabase บังคับ SSL แต่ใช้ cert ที่ Node ไม่มี CA ในตัว
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    // รันใน transaction เดียว ถ้าคำสั่งไหนพัง จะไม่มีอะไรถูกเปลี่ยนเลย
    await client.query('begin')
    await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'))
    // ให้ PostgREST โหลด schema ใหม่ทันที ไม่งั้น API จะยังไม่เห็นคอลัมน์/ตารางที่เพิ่งสร้าง
    await client.query("notify pgrst, 'reload schema'")
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    await client.end()
  }
  return { skipped: false }
}

// รันเองได้ด้วย: npm run migrate
if (require.main === module) {
  runMigrations()
    .then(({ skipped }) => {
      if (skipped) {
        console.error('ไม่พบ DATABASE_URL ใน server/.env (Supabase > Connect > Session pooler)')
        process.exit(1)
      }
      console.log('✅ อัปเดต schema บน Supabase เรียบร้อย')
    })
    .catch((error) => {
      console.error('❌ migration ล้มเหลว:', error.message)
      process.exit(1)
    })
}

module.exports = { runMigrations }
