// Master Exercise List — Full Dataset
//
// โครงสร้างเดิม (~50 ท่า) เขียนมือทั้งหมด ตอนนี้รวมกับข้อมูลจริงจาก free-exercise-db
// (https://github.com/yuhonas/free-exercise-db, MIT license, ~870 ท่า) ซึ่งเป็นชุดข้อมูล
// ท่าออกกำลังกายสากลแบบเปิดที่ใช้แทน ExerciseDB ได้ (ExerciseDB ตัวเต็มอยู่หลัง paid API
// ของ RapidAPI ต้องมี API key จึงไม่ได้ดึงมาโดยตรง — ใช้แหล่งข้อมูลเปิดที่ครอบคลุมกลุ่ม
// กล้ามเนื้อเดียวกันแทน)
//
// แบ่งเป็น 2 ชั้นคุณภาพโดยตั้งใจ (ดู scripts/mergeExerciseDatabase ถ้าต้องการรันใหม่):
//   1. ท่ายอดฮิตที่คนไทยพูดในยิมจริง ~60 ท่า — มี aliases ภาษาไทย/คำทับศัพท์/คำที่ STT
//      มักฟังผิด ที่ทดสอบแล้วว่า fuzzy match ได้ถูกต้อง (มาจาก Phase 5)
//   2. ท่าที่เหลือจาก free-exercise-db ~866 ท่า — ครอบคลุมทุกกลุ่มกล้ามเนื้อและอุปกรณ์
//      แต่ยังไม่มี Thai alias ที่ตรวจสอบแล้ว (alias เริ่มต้น = ชื่ออังกฤษตัวพิมพ์เล็ก
//      เพื่อให้ค้นหาได้อย่างน้อยเมื่อพูดชื่อทับศัพท์ตรงตัว) เพิ่ม alias ภาษาไทยที่มั่นใจ
//      ได้เรื่อย ๆ ในอนาคตโดยแก้ที่ exerciseDatabase.data.json

import data from './exerciseDatabase.data.json' with { type: 'json' }

export const EXERCISE_DATABASE = data

if (typeof window !== 'undefined' && window.console) {
  console.log(`[SupportFit] โหลด Master Exercise List: ${EXERCISE_DATABASE.length} ท่า`)
}
