// รายชื่อท่า/กิจกรรมของ Workout Tracker แยก 3 หมวด พร้อมค่า MET (Compendium of Physical Activities)
// ใช้คำนวณแคลอรีที่เผาผลาญใน utils/calories.js
//
// category: 'strength' (เวทเทรนนิ่ง) | 'cardio' (คาร์ดิโอ) | 'street' (สตรีทเวิร์กเอาต์ / bodyweight)
// kcalPerKgKm: กิจกรรมที่ใช้ระยะทางคำนวณได้แม่นกว่าเวลา (วิ่ง ≈ 1 kcal ต่อ กก. ต่อ กม., เดิน ≈ 0.5)
// aliases: ชื่อไทย/ชื่อเรียกอื่น ใช้ค้นหา

export const CATEGORIES = ['strength', 'cardio', 'street']

// ใช้กับชื่อที่พิมพ์เองซึ่งไม่อยู่ในรายการ
export const DEFAULT_MET = { strength: 5, cardio: 6, street: 6 }

export const EXERCISES = [
  // ---- เวทเทรนนิ่ง ----
  { name: 'Squat', category: 'strength', met: 6, aliases: ['สควอท', 'สควอช', 'back squat'] },
  { name: 'Bench Press', category: 'strength', met: 6, aliases: ['เบนช์เพรส', 'ดันอก'] },
  { name: 'Deadlift', category: 'strength', met: 6, aliases: ['เดดลิฟต์', 'เด็ดลิฟ'] },
  { name: 'Overhead Press', category: 'strength', met: 5, aliases: ['โอเวอร์เฮดเพรส', 'shoulder press', 'ดันไหล่'] },
  { name: 'Barbell Row', category: 'strength', met: 5, aliases: ['บาร์เบลโรว์', 'bent over row'] },
  { name: 'Romanian Deadlift', category: 'strength', met: 6, aliases: ['โรมาเนียนเดดลิฟต์', 'rdl'] },
  { name: 'Leg Press', category: 'strength', met: 5, aliases: ['เลกเพรส', 'ถีบขา'] },
  { name: 'Lat Pulldown', category: 'strength', met: 3.5, aliases: ['แลตพูลดาวน์', 'ดึงหลัง'] },
  { name: 'Incline Bench Press', category: 'strength', met: 5, aliases: ['อินไคลน์เบนช์', 'ดันอกบน'] },
  { name: 'Dumbbell Bench Press', category: 'strength', met: 5, aliases: ['ดัมเบลเบนช์'] },
  { name: 'Hip Thrust', category: 'strength', met: 5, aliases: ['ฮิปทรัสต์', 'ดันสะโพก'] },
  { name: 'Lunge', category: 'strength', met: 4, aliases: ['ลันจ์', 'ลันช์'] },
  { name: 'Bicep Curl', category: 'strength', met: 3.5, aliases: ['ไบเซปเคิร์ล', 'เคิร์ลแขน', 'curl'] },
  { name: 'Tricep Pushdown', category: 'strength', met: 3.5, aliases: ['ไตรเซปพุชดาวน์', 'กดแขนหลัง'] },
  { name: 'Lateral Raise', category: 'strength', met: 3.5, aliases: ['ยกดัมเบลข้าง', 'side raise'] },
  { name: 'Leg Extension', category: 'strength', met: 3.5, aliases: ['เลกเอ็กซ์เทนชัน', 'เตะขา'] },
  { name: 'Leg Curl', category: 'strength', met: 3.5, aliases: ['เลกเคิร์ล', 'พับขา'] },
  { name: 'Cable Fly', category: 'strength', met: 3.5, aliases: ['เคเบิลฟลาย', 'บีบอก'] },
  { name: 'Clean and Jerk', category: 'strength', met: 6, aliases: ['คลีนแอนด์เจิร์ก', 'ยกน้ำหนัก'] },
  { name: 'Kettlebell Swing', category: 'strength', met: 9.8, aliases: ['เคตเทิลเบลสวิง'] },

  // ---- คาร์ดิโอ ----
  { name: 'Running', category: 'cardio', met: 9.8, kcalPerKgKm: 1, aliases: ['วิ่ง', 'จ็อกกิ้ง', 'jogging', 'run'] },
  { name: 'Treadmill Running', category: 'cardio', met: 9, kcalPerKgKm: 1, aliases: ['วิ่งลู่', 'ลู่วิ่ง', 'treadmill'] },
  { name: 'Walking', category: 'cardio', met: 3.5, kcalPerKgKm: 0.5, aliases: ['เดิน', 'เดินเร็ว', 'walk'] },
  { name: 'Hiking', category: 'cardio', met: 6, aliases: ['เดินป่า', 'ปีนเขา'] },
  { name: 'Cycling', category: 'cardio', met: 7.5, aliases: ['ปั่นจักรยาน', 'จักรยาน', 'bike', 'bicycling'] },
  { name: 'Stationary Bike', category: 'cardio', met: 6.8, aliases: ['จักรยานปั่นอยู่กับที่', 'spinning', 'สปินนิ่ง'] },
  { name: 'Swimming', category: 'cardio', met: 7, aliases: ['ว่ายน้ำ', 'swim'] },
  { name: 'Rowing Machine', category: 'cardio', met: 7, aliases: ['เครื่องกรรเชียงบก', 'rower', 'พายเรือ'] },
  { name: 'Elliptical', category: 'cardio', met: 5, aliases: ['อีลิปติคอล', 'เครื่องเดินวงรี'] },
  { name: 'Stair Climber', category: 'cardio', met: 9, aliases: ['ขึ้นบันได', 'stairmaster'] },
  { name: 'Jump Rope', category: 'cardio', met: 11.8, aliases: ['กระโดดเชือก', 'skipping'] },
  { name: 'HIIT', category: 'cardio', met: 8, aliases: ['ไฮท์', 'interval training'] },
  { name: 'Boxing', category: 'cardio', met: 7.8, aliases: ['ชกมวย', 'มวยไทย', 'muay thai'] },
  { name: 'Badminton', category: 'cardio', met: 5.5, aliases: ['แบดมินตัน', 'ตีแบด'] },
  { name: 'Football', category: 'cardio', met: 7, aliases: ['ฟุตบอล', 'เตะบอล', 'soccer'] },
  { name: 'Basketball', category: 'cardio', met: 6.5, aliases: ['บาสเกตบอล', 'บาส'] },
  { name: 'Dancing', category: 'cardio', met: 5, aliases: ['เต้น', 'แอโรบิก', 'aerobics', 'zumba'] },
  { name: 'Yoga', category: 'cardio', met: 2.5, aliases: ['โยคะ'] },

  // ---- สตรีทเวิร์กเอาต์ ----
  { name: 'Push Up', category: 'street', met: 3.8, aliases: ['วิดพื้น', 'pushup', 'push-up'] },
  { name: 'Pull Up', category: 'street', met: 8, aliases: ['ดึงข้อ', 'pullup', 'pull-up'] },
  { name: 'Chin Up', category: 'street', met: 8, aliases: ['ชินอัพ', 'ดึงข้อมือหงาย'] },
  { name: 'Dips', category: 'street', met: 8, aliases: ['ดิปส์', 'ดิป', 'บาร์คู่'] },
  { name: 'Muscle Up', category: 'street', met: 8, aliases: ['มัสเซิลอัพ'] },
  { name: 'Inverted Row', category: 'street', met: 3.8, aliases: ['ออสเตรเลียนพูลอัพ', 'australian pull up'] },
  { name: 'Handstand Push Up', category: 'street', met: 8, aliases: ['แฮนด์สแตนด์พุชอัพ', 'วิดพื้นกลับหัว'] },
  { name: 'Pistol Squat', category: 'street', met: 5, aliases: ['พิสทอลสควอท', 'สควอทขาเดียว'] },
  { name: 'Bodyweight Squat', category: 'street', met: 5, aliases: ['สควอทตัวเปล่า', 'air squat'] },
  { name: 'Jump Squat', category: 'street', met: 8, aliases: ['สควอทกระโดด'] },
  { name: 'Burpee', category: 'street', met: 8, aliases: ['เบอร์พี'] },
  { name: 'Mountain Climber', category: 'street', met: 8, aliases: ['เมาท์เทนไคลม์เบอร์', 'ปีนเขาอยู่กับที่'] },
  { name: 'Hanging Leg Raise', category: 'street', met: 3.8, aliases: ['ห้อยยกขา', 'leg raise'] },
  { name: 'Plank', category: 'street', met: 3.8, aliases: ['แพลงก์', 'แพลงค์'] },
  { name: 'Crunch', category: 'street', met: 3.8, aliases: ['ครันช์', 'ซิทอัพ', 'sit up'] },
]

const normalize = (text) => String(text || '').trim().toLowerCase()
const BY_NAME = new Map(EXERCISES.map((exercise) => [normalize(exercise.name), exercise]))

// หาท่าจากชื่อที่บันทึกไว้ (ใช้กับ log เก่าที่ไม่มี activity_type / calories_burned)
export function findExercise(name) {
  return BY_NAME.get(normalize(name)) || null
}

// พิมพ์ค้นหา = ค้นทุกหมวด (ชื่อหรือ alias) ไม่พิมพ์ = แสดงท่าทั้งหมดของหมวดที่เลือก
export function searchExercises(query, category) {
  const q = normalize(query)
  if (!q) return EXERCISES.filter((exercise) => exercise.category === category)
  return EXERCISES.filter(
    (exercise) => normalize(exercise.name).includes(q) || exercise.aliases.some((alias) => normalize(alias).includes(q))
  ).sort((a, b) => (a.category === category ? 0 : 1) - (b.category === category ? 0 : 1))
}
