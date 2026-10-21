// พจนานุกรมคำพ้อง: คำที่คนไทยพูดจริง / STT ถอดผิด / คำทับศัพท์ -> ชื่อมาตรฐานภาษาอังกฤษ
//
// ท่าออกกำลังกาย: ฐานหลักคือ exerciseDatabase.json (~926 ท่า จาก free-exercise-db + alias ไทย ~60 ท่ายอดฮิต)
// EXERCISE_SYNONYMS ด้านล่างเพิ่มคำที่ฟังผิดบ่อยเข้าไปในท่าเดิม (ชื่อท่าต้องตรงกับ name ในไฟล์ JSON)
// เพื่อให้ชื่อที่บันทึกตรงกับโปรแกรมใน client/src/utils/workoutPrograms.js
//
// อาหาร: ชื่อมาตรฐาน + สารอาหารโดยประมาณต่อ 1 ที่ (serving_g กรัม) ใช้เติมค่าเมื่อผู้ใช้ไม่ได้พูดตัวเลขมา

const EXERCISE_DATABASE = require('./exerciseDatabase.json')

const EXERCISE_SYNONYMS = {
  Squat: ['สควอท', 'สคอท', 'สควัต', 'สควอต', 'สะควัต', 'สคว็อท', 'สควอช', 'สก็อต', 'squats', 'squat', 'back squat'],
  'Bench Press': ['เบนช์เพรส', 'เบนเพรซ', 'เบนเพรส', 'เบ้นเพรส', 'เบรนเพรส', 'ใบเสร็จไกร', 'เบนช์', 'เบ็นช์', 'ベンチ', 'ベンチプレス', 'bench', 'bench press'],
  Deadlift: ['เดดลิฟต์', 'เดทลิฟ', 'เดดลิฟ', 'เด็ดลิฟ', 'เดธลิฟ', 'dead lift', 'deadlifts'],
  'Lat Pulldown': ['ลาตดึงหลัง', 'แลตพูลดาวน์', 'ลาตพูลดาวน์', 'แลทพูลดาวน์', 'ลัดพูลดาวน์', 'แลตดึงหลัง', 'lat pull', 'lat pull down', 'lat pulldown'],
  'Cable Fly': ['อกเคเบิล', 'เคเบิลฟลาย', 'เคเบิ้ลฟลาย', 'เคเบิลครอสโอเวอร์', 'cable flies', 'cable crossover'],
  'Shoulder Press': ['ชอลเดอร์เพรส', 'โชลเดอร์เพรส', 'โชว์เดอเพรส', 'โชลเดอร์', 'โชวเดอร์', 'เชาลเดอร์'],
  'Overhead Press': ['ohp', 'โอเอชพี'],
  'Leg Press': ['เล็กเพรส', 'เลคเพรส', 'เลกเพรซ'],
  'Leg Extension': ['เล็กเอ็กเทนชั่น', 'เลกเอ็กเทนชั่น'],
  // สำเนียงไทยมักออกเสียงตัวสะกด ป เป็น ด/บ ("ใบเสด", "ไบเสบ") และ STT ถอด "bicep" เป็น "baised"
  'Bicep Curl': ['ไบเซ็ปเคิร์ล', 'ไบเซ็ปส์เคิร์ล', 'ไบเซฟเคิล', 'ไบเซ็ป', 'ไบเซป', 'ไบเสป', 'ไบเสบ', 'ใบเสด', 'baised', 'biceps curl', 'bicep curls'],
  'Tricep Extension': ['ไตรเซป', 'ไตรเสด', 'ไตรเสบ', 'triceps extension'],
  'Push Up': ['พุชอัป', 'พุซอัพ', 'push ups', 'pushups'],
  'Pull Up': ['พูลอัป', 'พูลอั๊พ', 'pull ups', 'pullups'],
  'Hip Thrust': ['ฮิปทรัช', 'ฮิพทรัส'],
  'Lateral Raise': ['ลาเทอรัลเรส', 'แลทเทอรัลเรซ', 'side raise', 'ยกดัมเบลข้าง'],
  'Romanian Deadlift': ['โรมาเนียนเดทลิฟ'],
  'Barbell Row': ['บาร์เบลโร', 'bent over row'],
}

// สารอาหารเป็นค่าประมาณต่อ 1 ที่ (USDA / ฉลากโภชนาการไทยทั่วไป) ไม่ใช่ค่าแม่นยำ
const FOODS = [
  { name: 'Grilled Chicken Breast with Rice', aliases: ['ข้าวอกไก่', 'อกไก่ย่าง', 'อกไก่', 'ข้าวอกไก่ย่าง', 'ข้าวไก่ย่าง', 'อกไก่ต้ม', 'chicken breast', 'chicken breast rice'], serving_g: 350, calories: 450, protein: 40, carbs: 50, fat: 8 },
  { name: 'Hainanese Chicken Rice', aliases: ['ข้าวมันไก่', 'ข้าวมันไก่ต้ม', 'chicken rice'], serving_g: 350, calories: 600, protein: 25, carbs: 75, fat: 22 },
  { name: 'Basil Chicken with Rice', aliases: ['ข้าวกะเพราไก่', 'กะเพราไก่', 'กระเพราไก่', 'ข้าวผัดกะเพรา', 'ผัดกะเพรา', 'กะเพา', 'basil chicken'], serving_g: 350, calories: 550, protein: 25, carbs: 65, fat: 20 },
  { name: 'Fried Rice', aliases: ['ข้าวผัด', 'ข้าวผัดไก่', 'ข้าวผัดหมู', 'fried rice'], serving_g: 300, calories: 520, protein: 15, carbs: 70, fat: 18 },
  { name: 'Omelette with Rice', aliases: ['ข้าวไข่เจียว', 'ไข่เจียว', 'omelette rice', 'omelette'], serving_g: 300, calories: 550, protein: 16, carbs: 58, fat: 28 },
  { name: 'Stewed Pork Leg with Rice', aliases: ['ข้าวขาหมู', 'ขาหมู'], serving_g: 350, calories: 690, protein: 30, carbs: 70, fat: 32 },
  { name: 'Grilled Pork with Sticky Rice', aliases: ['ข้าวเหนียวหมูปิ้ง', 'หมูปิ้ง', 'หมูปิ้งข้าวเหนียว'], serving_g: 250, calories: 470, protein: 20, carbs: 60, fat: 16 },
  { name: 'Pad Thai', aliases: ['ผัดไทย', 'ผัดไท', 'pad thai'], serving_g: 350, calories: 600, protein: 20, carbs: 80, fat: 22 },
  { name: 'Noodle Soup', aliases: ['ก๋วยเตี๋ยว', 'ก๋วยเตี๋ยวน้ำ', 'ก๊วยเตี๋ยว', 'ก๋วยเตี๋ยวไก่', 'noodle soup'], serving_g: 350, calories: 350, protein: 18, carbs: 45, fat: 10 },
  { name: 'Papaya Salad', aliases: ['ส้มตำ', 'ส้มตำไทย', 'ตำไทย', 'som tam', 'papaya salad'], serving_g: 200, calories: 120, protein: 3, carbs: 25, fat: 1.5 },
  { name: 'Fried Chicken', aliases: ['ไก่ทอด', 'fried chicken'], serving_g: 150, calories: 380, protein: 30, carbs: 12, fat: 23 },
  { name: 'Boiled Egg', aliases: ['ไข่ต้ม', 'ไข่ต้มสุก', 'ไข่ต้มยางมะตูม', 'boiled egg', 'boiled eggs', 'egg'], serving_g: 50, calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  { name: 'Egg White', aliases: ['ไข่ขาว', 'ไข่ขาวต้ม', 'egg white', 'egg whites'], serving_g: 33, calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1 },
  { name: 'Whey Protein Shake', aliases: ['เวย์', 'เวย์โปรตีน', 'เวโปรตีน', 'เวร์โปรตีน', 'โปรตีนเชค', 'โปรตีนเชก', 'whey', 'whey protein', 'protein shake'], serving_g: 30, calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: 'Protein Bar', aliases: ['โปรตีนบาร์', 'protein bar'], serving_g: 60, calories: 200, protein: 20, carbs: 22, fat: 7 },
  { name: 'White Rice', aliases: ['ข้าวสวย', 'ข้าวเปล่า', 'ข้าวขาว', 'white rice', 'rice'], serving_g: 200, calories: 260, protein: 5, carbs: 57, fat: 0.6 },
  { name: 'Brown Rice', aliases: ['ข้าวกล้อง', 'ข้าวไรซ์เบอร์รี่', 'brown rice'], serving_g: 195, calories: 216, protein: 5, carbs: 45, fat: 1.8 },
  { name: 'Oatmeal', aliases: ['ข้าวโอ๊ต', 'โอ๊ต', 'โอ๊ตมีล', 'โอ้ตมีล', 'oatmeal', 'oats'], serving_g: 40, calories: 150, protein: 5, carbs: 27, fat: 2.5 },
  { name: 'Sweet Potato', aliases: ['มันหวาน', 'มันเทศ', 'มันม่วง', 'มันญี่ปุ่น', 'sweet potato'], serving_g: 150, calories: 130, protein: 2.4, carbs: 30, fat: 0.2 },
  { name: 'Salmon', aliases: ['แซลมอน', 'ปลาแซลมอน', 'แซลม่อน', 'salmon'], serving_g: 100, calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Canned Tuna', aliases: ['ทูน่า', 'ทูน่ากระป๋อง', 'ปลาทูน่า', 'tuna'], serving_g: 100, calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name: 'Tofu', aliases: ['เต้าหู้', 'เต้าหู้ไข่', 'tofu'], serving_g: 100, calories: 76, protein: 8, carbs: 2, fat: 4.8 },
  { name: 'Greek Yogurt', aliases: ['กรีกโยเกิร์ต', 'โยเกิร์ต', 'โยเกิร์ตกรีก', 'greek yogurt', 'yogurt'], serving_g: 170, calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { name: 'Milk', aliases: ['นมจืด', 'นมสด', 'นม', 'milk'], serving_g: 200, calories: 130, protein: 6.4, carbs: 9.6, fat: 7 },
  { name: 'Banana', aliases: ['กล้วย', 'กล้วยหอม', 'กล้วยน้ำว้า', 'banana'], serving_g: 118, calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple', aliases: ['แอปเปิ้ล', 'แอปเปิล', 'แอ๊ปเปิ้ล', 'apple'], serving_g: 182, calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Avocado', aliases: ['อะโวคาโด', 'อาโวคาโด้', 'อโวคาโด', 'avocado'], serving_g: 100, calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name: 'Almonds', aliases: ['อัลมอนด์', 'อัลม่อน', 'เม็ดอัลมอนด์', 'almond', 'almonds'], serving_g: 28, calories: 164, protein: 6, carbs: 6, fat: 14 },
  { name: 'Peanut Butter', aliases: ['เนยถั่ว', 'peanut butter'], serving_g: 32, calories: 190, protein: 7, carbs: 7, fat: 16 },
  { name: 'Salad', aliases: ['สลัด', 'สลัดผัก', 'salad'], serving_g: 150, calories: 80, protein: 3, carbs: 10, fat: 3 },
  { name: 'Black Coffee', aliases: ['กาแฟดำ', 'อเมริกาโน่', 'อเมริกาโน', 'americano', 'black coffee'], serving_g: 240, calories: 5, protein: 0.3, carbs: 0, fat: 0 },
]

// รวม synonyms เข้ากับฐานข้อมูลท่า (ชื่อท่าใน EXERCISE_SYNONYMS ต้องมีอยู่จริง)
function buildExerciseCatalog() {
  const byName = new Map(EXERCISE_DATABASE.map((exercise) => [exercise.name, exercise]))
  for (const name of Object.keys(EXERCISE_SYNONYMS)) {
    if (!byName.has(name)) throw new Error(`EXERCISE_SYNONYMS: ไม่พบท่า "${name}" ใน exerciseDatabase.json`)
  }
  return EXERCISE_DATABASE.map((exercise) => ({
    name: exercise.name,
    aliases: [...exercise.aliases, ...(EXERCISE_SYNONYMS[exercise.name] || [])],
  }))
}

const EXERCISES = buildExerciseCatalog()

module.exports = { EXERCISES, FOODS, EXERCISE_SYNONYMS }
