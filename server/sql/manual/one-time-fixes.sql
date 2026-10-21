-- SupportFit — งานแก้ฐานข้อมูลแบบครั้งเดียว (ไม่รันอัตโนมัติ)
-- migrate.js รันเฉพาะ sql/schema.sql ซึ่งอนุญาตแค่คำสั่งเพิ่มตาราง/คอลัมน์/index
-- คำสั่งในไฟล์นี้แก้ constraint หรือข้อมูลเดิม จึงต้องอ่านแล้วรันเองทีละข้อใน Supabase Dashboard > SQL Editor
-- ทุกข้อรันซ้ำได้ และไม่ลบแถวข้อมูลใด ๆ

-- 1) ฐานข้อมูลที่สร้างไว้ก่อนด้วย schema อื่นที่ตั้งคอลัมน์เหล่านี้เป็น NOT NULL
--    ผ่อนเป็น nullable เพราะผู้ใช้อาจพูดข้อมูลไม่ครบ (บอกแค่น้ำหนักไม่บอกจำนวนครั้ง)
--    (ไม่ลบข้อมูล แค่ยกเลิกข้อบังคับ ; ฐานข้อมูลที่สร้างจาก schema.sql เป็น nullable อยู่แล้ว)
alter table workout_logs alter column weight_kg drop not null;
alter table workout_logs alter column reps drop not null;
alter table food_logs alter column calories drop not null;
alter table food_logs alter column protein drop not null;

-- 2) คัดลอกอีเมลของผู้ใช้จาก Supabase Auth เดิม (เติมเฉพาะแถวที่ email ยังว่าง ไม่เขียนทับ)
update users u set email = lower(a.email)
  from auth.users a
  where u.auth_id = a.id and u.email is null;

-- 3) users.auth_id เดิมสร้างด้วย on delete cascade: ลบผู้ใช้ใน Authentication ของ Supabase
--    = แถว users ถูกลบ และ workout_logs/food_logs ของคนนั้นหายตามทั้งหมด
--    เปลี่ยนเป็น on delete set null (แค่เปลี่ยน constraint ไม่แตะข้อมูล)
--    ดูชื่อ constraint จริงก่อน: select conname from pg_constraint where conrelid = 'users'::regclass and contype = 'f';
alter table users drop constraint if exists users_auth_id_fkey;
alter table users add constraint users_auth_id_fkey
  foreign key (auth_id) references auth.users (id) on delete set null;
