require('dotenv').config({ quiet: true })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const SCHEMA_PATH = path.join(__dirname, 'sql', 'schema.sql')

// Non-destructive เท่านั้น: ทุกคำสั่งใน schema.sql ต้องขึ้นต้นด้วยรูปแบบในรายการนี้
// และต้องไม่มีคำสั่งที่ลบ/เขียนทับข้อมูลหรือโครงสร้างเดิมแฝงอยู่ ("add column ..., drop column ...")
// ผิดกฎแม้แต่คำสั่งเดียว = ไม่รันอะไรเลย (งานแก้ข้อมูล/constraint เดิมอยู่ใน sql/manual/ รันเอง)
const ALLOWED_STATEMENTS = [
  /^create table if not exists \S+/i,
  /^create (unique )?index if not exists \S+/i,
  /^alter table (only )?\S+ add column if not exists \S+/i,
  /^alter table \S+ enable row level security$/i,
]
const FORBIDDEN_KEYWORDS =
  /\b(drop|truncate|rename|delete\s+from|update\s+\S+\s+set|insert\s+into|alter\s+column|set\s+data\s+type|grant|revoke)\b/i

function splitStatements(sql) {
  const body = sql.replace(/--.*$/gm, '')
  // function body ($$ ... $$) มี ; ข้างใน แยกคำสั่งแบบนี้ไม่ได้ จึงไม่อนุญาตใน schema.sql
  if (body.includes('$$')) throw new Error('schema.sql: ไม่รองรับ $$ (function/DO block) ใส่ไว้ใน sql/manual/ แทน')
  return body
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// โยน error พร้อมรายการคำสั่งที่ผิดกฎ ; ผ่าน = คืนจำนวนคำสั่ง
function assertNonDestructive(sql) {
  const statements = splitStatements(sql)
  const rejected = statements.filter(
    (statement) => !ALLOWED_STATEMENTS.some((pattern) => pattern.test(statement)) || FORBIDDEN_KEYWORDS.test(statement)
  )
  if (rejected.length > 0) {
    throw new Error(`schema.sql มีคำสั่งที่ไม่ใช่แบบ non-destructive (ไม่ได้รันอะไรเลย):\n${rejected.map((s) => `  - ${s}`).join('\n')}`)
  }
  return statements.length
}

// รัน sql/schema.sql ทั้งไฟล์บน Supabase ผ่าน Postgres connection ตรง (DATABASE_URL)
// เพราะ supabase-js / PostgREST สร้างตารางหรือเพิ่มคอลัมน์ (DDL) ไม่ได้
// schema.sql เขียนแบบ idempotent + non-destructive ทั้งหมด (ตรวจด้วย assertNonDestructive ก่อนต่อฐานข้อมูล)
// จึงรันซ้ำทุกครั้งที่ start server ได้ปลอดภัย ข้อมูลเดิมใน Supabase ไม่ถูกลบหรือเขียนทับ
async function runMigrations() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return { skipped: true }

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
  assertNonDestructive(schema)

  const client = new Client({
    connectionString,
    // Supabase บังคับ SSL แต่ใช้ cert ที่ Node ไม่มี CA ในตัว
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    // รันใน transaction เดียว ถ้าคำสั่งไหนพัง จะไม่มีอะไรถูกเปลี่ยนเลย
    await client.query('begin')
    await client.query(schema)
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

module.exports = { runMigrations, assertNonDestructive, SCHEMA_PATH }
