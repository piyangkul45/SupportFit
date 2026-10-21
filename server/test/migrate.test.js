// ทดสอบว่า migration อัตโนมัติ (schema.sql) เป็นแบบ non-destructive เสมอ
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const { assertNonDestructive, SCHEMA_PATH } = require('../migrate')

describe('schema.sql', () => {
  test('passes the non-destructive guard', () => {
    assert.ok(assertNonDestructive(fs.readFileSync(SCHEMA_PATH, 'utf8')) > 0)
  })

  test('no foreign key cascades from auth.users (deleting an auth user must not delete app data)', () => {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8').replace(/--.*$/gm, '')
    assert.doesNotMatch(schema, /references auth\.users \(id\) on delete cascade/i)
  })
})

describe('guard', () => {
  const allowed = [
    'create table if not exists t (id bigint primary key, user_id bigint references users (id) on delete cascade)',
    'create index if not exists t_idx on t (id)',
    'create unique index if not exists t_uidx on t (id)',
    "alter table users add column if not exists gender text check (gender in ('male', 'female'))",
    'alter table t enable row level security',
    '-- drop table users; (comment only)\ncreate table if not exists t (id int)',
  ]
  for (const sql of allowed) {
    test(`allows: ${sql.split('\n').pop()}`, () => {
      assert.doesNotThrow(() => assertNonDestructive(sql))
    })
  }

  const rejected = [
    'drop table users',
    'drop table if exists users',
    'truncate workout_logs',
    'delete from food_logs',
    "update users set email = 'x'",
    'insert into users (name) values (1)',
    'create table users (id int)',
    'alter table users drop column email',
    'alter table users add column if not exists x int, drop column email',
    'alter table users alter column weight_kg drop not null',
    'alter table users alter column age type text',
    'alter table users rename column email to mail',
    'alter table users add column x int',
    'do $$ begin drop table users; end $$',
  ]
  for (const sql of rejected) {
    test(`rejects: ${sql}`, () => {
      assert.throws(() => assertNonDestructive(`create table if not exists ok (id int);\n${sql};`), /non-destructive|\$\$/)
    })
  }
})
