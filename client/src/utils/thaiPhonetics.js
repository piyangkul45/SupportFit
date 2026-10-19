// Thai Phonetic / Fuzzy Normalizer
//
// STT (Web Speech API) มักถอดเสียงคำทับศัพท์ภาษาอังกฤษผิดในรูปแบบที่คาดเดาได้ระดับหนึ่ง เช่น
// สับสนพยัญชนะที่ออกเสียงใกล้กัน (ร/ล, ช/ซ, ท/ธ) การเปรียบเทียบตัวอักษรตรง ๆ แบบ fuzzy match
// ทั่วไปจึงพลาดบ่อย ฟังก์ชันนี้ลด "รูปตัวอักษร" ให้เหลือ "กลุ่มเสียง" ก่อนนำไปเทียบ
// เพื่อให้คำที่ออกเสียงใกล้เคียงกันมีค่าความคล้ายสูงขึ้น

const CONSONANT_CLASSES = [
  ['ก', 'ข', 'ค', 'ฆ'],
  ['ง'],
  ['จ', 'ฉ', 'ช', 'ฌ'],
  ['ซ', 'ศ', 'ษ', 'ส'],
  ['ญ', 'ย'],
  ['ฎ', 'ด'],
  ['ฏ', 'ต'],
  ['ฐ', 'ถ', 'ท', 'ธ', 'ฑ', 'ฒ'],
  ['ณ', 'น'],
  ['บ'],
  ['ป'],
  ['ผ', 'พ', 'ภ'],
  ['ฝ', 'ฟ'],
  ['ม'],
  ['ร', 'ล', 'ฬ'], // ร/ล เป็นคู่ที่คนไทยพูด/ฟังสับสนกันบ่อยที่สุด
  ['ว'],
  ['ห', 'ฮ'],
]

const CONSONANT_MAP = new Map()
CONSONANT_CLASSES.forEach((group, classIndex) => {
  group.forEach((char) => CONSONANT_MAP.set(char, String(classIndex)))
})

// วรรณยุกต์ + การันต์ + เครื่องหมายที่ไม่ส่งผลต่อเสียงพยัญชนะหลัก ตัดทิ้งก่อนเทียบ
const DIACRITICS_RE = /[่้๊๋์ๆฯ็]/g

export function normalizePhonetic(text) {
  return (text || '')
    .replace(DIACRITICS_RE, '')
    .replace(/\s+/g, '')
    .split('')
    .map((char) => CONSONANT_MAP.get(char) ?? char)
    .join('')
}

// คำขยะที่ผู้พูดมักพูดนำหน้าประโยคจริง (ไม่ใช่ส่วนหนึ่งของชื่อท่า/อาหาร)
const FILLER_WORDS_RE = /^(บันทึก|เอาเป็นว่า|เอาเป็น|คือว่า|เอ่อ)\s*/

export function stripFillerWords(text) {
  return (text || '').replace(FILLER_WORDS_RE, '').trim()
}
