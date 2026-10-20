// คำนวณเป้าหมายรายวันจากข้อมูลร่างกาย: BMR (Mifflin-St Jeor) -> TDEE (× ระดับกิจกรรม)
// -> แคลอรี่ตามเป้าหมาย (ไม่ต่ำกว่า 1,200 kcal หรือ BMR) -> โปรตีน/ไขมัน/คาร์บ
//
// โปรตีน 2.0 g ต่อ kg น้ำหนักตัว, ไขมัน 25% ของแคลอรี่, คาร์บ = แคลอรี่ที่เหลือ ÷ 4
// (โปรตีน/คาร์บ 4 kcal ต่อกรัม, ไขมัน 9 kcal ต่อกรัม)

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2, // นั่งทำงาน ไม่ค่อยออกกำลังกาย
  light: 1.375, // ออกกำลังกาย 1-3 วัน/สัปดาห์
  moderate: 1.55, // 3-5 วัน/สัปดาห์
  active: 1.725, // 6-7 วัน/สัปดาห์
  very_active: 1.9, // ออกหนักทุกวัน หรือทำงานใช้แรง
}

export const GOAL_CALORIE_ADJUSTMENTS = {
  lose_weight: -500,
  maintain: 0,
  gain_muscle: 300,
}

export const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS)
export const FITNESS_GOALS = Object.keys(GOAL_CALORIE_ADJUSTMENTS)
export const GENDERS = ['male', 'female']

// ช่วงค่าที่รับได้ (ตรงกับที่ server ตรวจใน PUT /api/users/me/profile)
export const PROFILE_LIMITS = {
  age: [13, 100],
  height_cm: [100, 250],
  weight_kg: [30, 300],
}

export const MIN_TARGET_CALORIES = 1200
const PROTEIN_G_PER_KG = 2.0
const FAT_CALORIE_SHARE = 0.25
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

const inRange = (value, [min, max]) => Number.isFinite(value) && value >= min && value <= max

// Mifflin-St Jeor: 10 × น้ำหนัก(kg) + 6.25 × ส่วนสูง(cm) − 5 × อายุ + (ชาย +5 / หญิง −161)
export function calculateBMR({ age, gender, height_cm, weight_kg }) {
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + (gender === 'male' ? 5 : -161)
}

export function calculateTDEE(bmr, activityLevel) {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

// ข้อมูลไม่ครบหรือไม่อยู่ในช่วง -> null (ฟอร์มยังไม่ต้องแสดงผลคำนวณ)
// คืน { bmr, tdee, calories, protein, carbs, fat } เป็นจำนวนเต็ม
export function calculateTargets(profile) {
  const age = Number(profile.age)
  const height_cm = Number(profile.height_cm)
  const weight_kg = Number(profile.weight_kg)
  const { gender, activity_level, fitness_goal } = profile

  const valid =
    inRange(age, PROFILE_LIMITS.age) &&
    inRange(height_cm, PROFILE_LIMITS.height_cm) &&
    inRange(weight_kg, PROFILE_LIMITS.weight_kg) &&
    GENDERS.includes(gender) &&
    activity_level in ACTIVITY_MULTIPLIERS &&
    fitness_goal in GOAL_CALORIE_ADJUSTMENTS
  if (!valid) return null

  const bmr = calculateBMR({ age, gender, height_cm, weight_kg })
  const tdee = calculateTDEE(bmr, activity_level)
  // ขั้นต่ำเพื่อความปลอดภัย: ไม่ต่ำกว่า 1,200 kcal และไม่ต่ำกว่า BMR (กันการลดน้ำหนักที่ขาดพลังงานเกินไป)
  const minimumCalories = Math.max(MIN_TARGET_CALORIES, bmr)
  const calories = Math.round(Math.max(tdee + GOAL_CALORIE_ADJUSTMENTS[fitness_goal], minimumCalories))
  const protein = Math.round(weight_kg * PROTEIN_G_PER_KG)
  const fat = Math.round((calories * FAT_CALORIE_SHARE) / KCAL_PER_G.fat)
  // แคลอรี่ต่ำมาก + น้ำหนักตัวมาก โปรตีน+ไขมันอาจเกินแคลอรี่ทั้งหมด -> คาร์บไม่ติดลบ
  const carbs = Math.max(0, Math.round((calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs))

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fat }
}
