# SupportFit

**Voice-to-Data Gym Log & Macro Assistant**

บันทึกการออกกำลังกายและมื้ออาหารด้วยเสียงภาษาไทย แปลงเป็นข้อมูลที่มีโครงสร้างโดยอัตโนมัติ

## โครงสร้างโปรเจกต์

```
SupportFit/
├── client/   # React + Vite + Tailwind CSS (frontend)
└── server/   # Node.js + Express + Supabase (PostgreSQL) (backend)
```

## ความต้องการเบื้องต้น

- [Node.js](https://nodejs.org/) เวอร์ชัน 18 ขึ้นไป (แนะนำ 20+)
- npm (ติดตั้งมาพร้อม Node.js)
- เบราว์เซอร์ที่รองรับ Web Speech API (แนะนำ Google Chrome) สำหรับทดสอบอัดเสียง

## การติดตั้ง

โคลนโปรเจกต์แล้วติดตั้ง dependencies ของทั้งสองฝั่งแยกกัน:

```bash
# ติดตั้งฝั่ง client
cd client
npm install

# ติดตั้งฝั่ง server
cd ../server
npm install
```

## การตั้งค่า Supabase (PostgreSQL)

โปรเจกต์นี้ใช้ [Supabase](https://supabase.com/) เป็นฐานข้อมูล (PostgreSQL) แทน SQLite

### 1. สร้างตารางในฐานข้อมูล

เปิด Supabase Dashboard ของโปรเจกต์ → **SQL Editor** → รันสคริปต์ทั้งหมดใน [`server/sql/schema.sql`](server/sql/schema.sql) (สร้างตาราง `users`, `workout_logs`, `food_logs` พร้อมเปิด Row Level Security)

### 2. ตั้งค่า environment variables

**server:**

```bash
cd server
cp .env.example .env
```

แก้ไข `server/.env`:

```
PORT=5000
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # แนะนำให้ใช้ (Settings > API > service_role secret)
SUPABASE_ANON_KEY=your_anon_or_publishable_key    # fallback ถ้าไม่ได้ตั้ง service_role key ด้านบน
EMAIL_USER=supportfit.official@gmail.com           # Gmail ที่ใช้ส่ง OTP
EMAIL_PASS=your_16_char_app_password              # Gmail App Password 16 หลัก
AUTH_SECRET=your_random_secret                    # ใช้เซ็น session token
```

> **Gmail App Password:** ต้องเปิด 2-Step Verification ของบัญชี Gmail ก่อน แล้วสร้างที่ Google Account > Security > App passwords นำรหัส 16 หลักมาใส่ใน `EMAIL_PASS`

> **สำคัญ:** `SUPABASE_SERVICE_ROLE_KEY` เป็นคีย์ลับที่ bypass RLS ได้ทั้งหมด ใช้ได้แค่ฝั่ง server เท่านั้น ห้ามใส่ในโค้ดฝั่ง client หรือ commit ขึ้น git (ไฟล์ `.env` ถูก gitignore ไว้แล้ว)

**client:**

```bash
cd client
cp .env.example .env
```

แก้ไข `client/.env`:

```
VITE_API_URL=http://localhost:5000
```

### ระบบเข้าสู่ระบบ (Custom OTP)

สมัคร/เข้าสู่ระบบด้วยอีเมลแบบไม่ใช้รหัสผ่าน: กรอกอีเมล → server สุ่ม OTP 6 หลัก (หมดอายุใน 5 นาที, กรอกผิดได้ไม่เกิน 5 ครั้ง, ขอใหม่ได้ทุก 60 วินาที) แล้วส่งผ่าน Gmail SMTP ด้วย Nodemailer → กรอกรหัสถูกต้องแล้ว server ออก session token (อายุ 7 วัน) ที่ client แนบไปกับทุก request ใน header `Authorization: Bearer <token>` โค้ดอยู่ที่ `server/otpAuth.js`

> หลังเปลี่ยนจาก Supabase Auth ต้องรันสคริปต์ `server/sql/schema.sql` อีกครั้ง (ส่วน migration ท้ายไฟล์) เพื่อเพิ่มคอลัมน์ `users.email`

## วิธีรันโปรเจกต์

เปิด 2 terminal แยกกันสำหรับ client และ server:

### 1. รัน Backend (server)

```bash
cd server
npm run dev     # ใช้ nodemon (auto-restart เมื่อไฟล์เปลี่ยน)
# หรือ
npm start       # รันแบบปกติ
```

Server จะรันที่ `http://localhost:5000`

ทดสอบ API เบื้องต้น:

```bash
curl http://localhost:5000/api/health
```

### 2. รัน Frontend (client)

```bash
cd client
npm run dev
```

Client (Vite dev server) จะรันที่ `http://localhost:5173` และเรียก API ที่ `http://localhost:5000` (ตั้งค่าได้ที่ `VITE_API_URL`)

เปิดเบราว์เซอร์ที่ `http://localhost:5173` แล้วกดปุ่ม "🎤 เริ่มพูด" เพื่อทดสอบแปลงเสียงภาษาไทยเป็นข้อความ

## API เบื้องต้น

endpoint ที่ต้องล็อกอินทั้งหมด (ทำเครื่องหมาย 🔒) ต้องแนบ header `Authorization: Bearer <session_token>` (ได้จาก `/api/verify-otp`) มาด้วย

| Method | Endpoint              | คำอธิบาย                          |
|--------|------------------------|-----------------------------------|
| GET    | `/api/health`          | ตรวจสอบสถานะเซิร์ฟเวอร์            |
| POST   | `/api/send-otp`        | ส่ง OTP 6 หลักไปที่อีเมล (`{ email }`) |
| POST   | `/api/verify-otp`      | ตรวจ OTP (`{ email, code, name? }`) ถ้าถูกต้องคืน `{ token, user }` และสร้างผู้ใช้ใหม่ให้อัตโนมัติ |
| POST   | `/api/users/me`        | 🔒 โปรไฟล์ (ตาราง `users`) ของผู้ใช้ที่ล็อกอินอยู่ |
| GET    | `/api/workout-logs`    | 🔒 รายการบันทึกการออกกำลังกาย (ต้องส่ง `?user_id=` และเป็นเจ้าของข้อมูลเท่านั้น) |
| POST   | `/api/workout-logs`    | 🔒 บันทึกการออกกำลังกายใหม่           |
| GET    | `/api/food-logs`       | 🔒 รายการบันทึกมื้ออาหาร (ต้องส่ง `?user_id=` และเป็นเจ้าของข้อมูลเท่านั้น) |
| POST   | `/api/food-logs`       | 🔒 บันทึกมื้ออาหารใหม่                |

## โครงสร้างฐานข้อมูล (Supabase / PostgreSQL)

ดูสคริปต์เต็มที่ [`server/sql/schema.sql`](server/sql/schema.sql)

- **users**: `id`, `email` (unique, ใช้ล็อกอินด้วย OTP), `name`, `auth_id` (เดิมจาก Supabase Auth ไม่ได้ใช้แล้ว), `target_calories` (default 2000), `target_protein` (default 150)
- **workout_logs**: `id`, `user_id`, `exercise_name`, `weight_kg`, `reps`, `sets`, `rpe`, `estimated_1rm`, `volume_load`, `created_at`
- **food_logs**: `id`, `user_id`, `food_name`, `calories`, `protein`, `carbs`, `fat`, `created_at`

`estimated_1rm` (สูตร Epley: `weight * (1 + reps / 30)`) และ `volume_load` (`weight * reps * sets`) คำนวณโดย server ทุกครั้งที่บันทึก workout log ใหม่ ใช้ตรวจ Personal Record (PR) โดยเทียบกับสถิติเดิมของท่าเดียวกันก่อน insert

## คำสั่งที่มีประโยชน์

| คำสั่ง (ใน `client/`)   | คำอธิบาย                     |
|--------------------------|-------------------------------|
| `npm run dev`             | รัน dev server                |
| `npm run build`           | build สำหรับ production       |
| `npm run preview`         | preview production build      |

| คำสั่ง (ใน `server/`)   | คำอธิบาย                     |
|--------------------------|-------------------------------|
| `npm run dev`             | รันด้วย nodemon (auto-restart) |
| `npm start`                | รันแบบปกติ                    |
