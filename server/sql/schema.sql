-- SupportFit — Supabase (PostgreSQL) schema
-- รันอัตโนมัติทุกครั้งที่ start server (migrate.js) ถ้าตั้ง DATABASE_URL ไว้ หรือรันเองด้วย npm run migrate
-- ทุกคำสั่งเขียนแบบ idempotent รันซ้ำได้ปลอดภัย (หรือคัดลอกไปรันใน Supabase Dashboard > SQL Editor ก็ได้)
--
-- กฎ Non-destructive (migrate.js ตรวจทุกคำสั่งก่อนรัน เจอคำสั่งนอกรายการนี้ = ไม่รันอะไรเลย):
--   create table if not exists / create [unique] index if not exists
--   alter table ... add column if not exists / alter table ... enable row level security
-- ห้าม drop, truncate, delete, update, rename, alter column หรือคำสั่งใดที่ลบ/เขียนทับข้อมูลเดิม
-- งานที่ต้องแก้ข้อมูลหรือ constraint เดิม ให้เขียนใน sql/manual/ แล้วรันเองหลังตรวจแล้ว
--
-- หมายเหตุเรื่องชนิดข้อมูล: ใช้ double precision (float8) แทน numeric สำหรับค่าที่ไม่ใช่จำนวนเต็ม
-- เพราะ PostgREST/supabase-js ส่งค่า numeric กลับมาเป็น string (เพื่อรักษาความละเอียดของทศนิยม)
-- ถ้าใช้ numeric ฝั่ง client (Progressive Overload Chart, Macro Dashboard) ที่บวกเลขต่อจาก API
-- จะพังเงียบๆ เพราะ "0" + "120" กลายเป็น string ต่อกัน ("0120") ไม่ใช่การบวกเลข

create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  target_calories integer default 2000,
  target_protein integer default 150
);

create table if not exists workout_logs (
  id bigint generated always as identity primary key,
  user_id bigint not null references users (id) on delete cascade,
  exercise_name text not null,
  weight_kg double precision,
  reps integer,
  sets integer,
  rpe double precision,
  estimated_1rm double precision,
  volume_load double precision,
  created_at timestamptz not null default now()
);

create table if not exists food_logs (
  id bigint generated always as identity primary key,
  user_id bigint not null references users (id) on delete cascade,
  food_name text not null,
  calories double precision,
  protein double precision,
  carbs double precision,
  fat double precision,
  created_at timestamptz not null default now()
);

create index if not exists workout_logs_user_id_idx on workout_logs (user_id);
create index if not exists workout_logs_exercise_idx on workout_logs (user_id, exercise_name);
create index if not exists food_logs_user_id_idx on food_logs (user_id);

-- เปิด Row Level Security แต่ไม่เพิ่ม policy ให้ anon/authenticated เลย
-- => เข้าถึงข้อมูลได้จาก service_role key เท่านั้น (ฝั่ง server ของเราเท่านั้น)
-- Service role bypass RLS โดยธรรมชาติ ไม่ต้องเขียน policy เพิ่ม
alter table users enable row level security;
alter table workout_logs enable row level security;
alter table food_logs enable row level security;

-- (โปรเจกต์ที่สร้างไว้ก่อนด้วย schema อื่นที่ตั้ง weight_kg/reps/calories/protein เป็น NOT NULL
--  ดู sql/manual/one-time-fixes.sql ข้อ 1)

-- auth_id: เชื่อมกับ Supabase Auth (auth.users) จากระบบ login เดิม ปัจจุบันใช้ email แทนแล้ว
-- on delete set null: ลบผู้ใช้ใน auth.users แล้วแถว users + workout/food logs ต้องไม่หายตาม
alter table users add column if not exists auth_id uuid unique references auth.users (id) on delete set null;
create index if not exists users_auth_id_idx on users (auth_id);

-- Custom OTP ทางอีเมล (server/otpAuth.js): ผู้ใช้ระบุตัวตนด้วยคอลัมน์ email
-- (คัดลอกอีเมลของผู้ใช้จาก Supabase Auth เดิม: sql/manual/one-time-fixes.sql ข้อ 2)
alter table users add column if not exists email text unique;

-- ตารางเก็บ OTP ที่รอยืนยัน (1 แถวต่ออีเมล ขอรหัสใหม่จะเขียนทับแถวเดิม)
-- เก็บเฉพาะ hash ของรหัส (sha256) ไม่เก็บรหัสจริง
create table if not exists otp_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  attempts integer not null default 0
);
create index if not exists otp_codes_expires_at_idx on otp_codes (expires_at);
alter table otp_codes enable row level security;

-- ระบบสมัครสมาชิก: อีเมล + password (scrypt hash) แล้วยืนยันอีเมลด้วย OTP ก่อนใช้งาน
alter table users add column if not exists password_hash text;
alter table users add column if not exists is_verified boolean not null default false;

-- Onboarding + เป้าหมายสารอาหาร (TDEE/BMR): ข้อมูลร่างกายและเป้าหมายรายวันที่คำนวณจาก
-- client/src/utils/macroCalculator.js เก็บในตาราง users (= โปรไฟล์ของผู้ใช้ ที่ /api/users/me คืนให้)
-- ผู้ใช้เดิมได้ is_onboarded = false จึงเห็นหน้า onboarding ครั้งถัดไปที่เข้าแอป
alter table users add column if not exists age integer;
alter table users add column if not exists gender text check (gender in ('male', 'female'));
alter table users add column if not exists height_cm double precision;
alter table users add column if not exists weight_kg double precision;
alter table users add column if not exists activity_level text
  check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active'));
alter table users add column if not exists fitness_goal text
  check (fitness_goal in ('lose_weight', 'maintain', 'gain_muscle'));
alter table users add column if not exists target_carbs integer;
alter table users add column if not exists target_fat integer;
alter table users add column if not exists is_onboarded boolean not null default false;

-- โปรแกรมฝึก: workout_programs -> program_days -> program_exercises (ดู server/programs/store.js)
-- preset = แถว is_preset = true, user_id = null (server สร้างจาก server/programs/presets.js ครั้งแรกที่ใช้)
-- วันที่ไม่มีท่า = วันพัก ; ลำดับท่าในวัน = ลำดับที่ insert
create table if not exists workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  title text not null,
  description text,
  is_preset boolean default false,
  created_at timestamptz default timezone('utc'::text, now())
);
create table if not exists program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references workout_programs (id) on delete cascade,
  day_name text not null,
  day_order integer not null
);
create table if not exists program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references program_days (id) on delete cascade,
  exercise_name text not null,
  target_sets integer default 3,
  target_reps integer default 10,
  target_weight_kg double precision default 0
);
create index if not exists workout_programs_user_id_idx on workout_programs (user_id);
create index if not exists program_days_program_id_idx on program_days (program_id);
create index if not exists program_exercises_day_id_idx on program_exercises (day_id);
alter table workout_programs enable row level security;
alter table program_days enable row level security;
alter table program_exercises enable row level security;

-- โปรแกรมที่ใช้อยู่ ; started_on = วันแรกของรอบตาราง (วันที่ตามเครื่องผู้ใช้)
-- ไม่มี started_on ก็ใช้ได้ แต่รอบตารางจะนับตามปฏิทิน (วันที่ 1 = วันจันทร์)
alter table users add column if not exists active_program_id uuid references workout_programs (id) on delete set null;
alter table users add column if not exists active_program_started_on date;
