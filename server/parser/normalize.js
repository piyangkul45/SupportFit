// ทำความสะอาดข้อความจาก Speech-to-Text ก่อนแยกความหมาย + ลดรูปคำให้เหลือ "กลุ่มเสียง" ก่อนเทียบชื่อ
//
// STT ภาษาไทยมักถอดคำทับศัพท์ผิดแบบคาดเดาได้: สับสนพยัญชนะเสียงใกล้กัน (ร/ล, ด/ท/ต, ช/ซ/ส),
// ใส่/ไม่ใส่วรรณยุกต์และการันต์ (เดดลิฟต์/เดทลิฟ) หรือแทรกสระ ะ (สะควอท) เราจึงเทียบชื่อบนรูปที่
// ลดแล้ว ไม่ใช่ตัวอักษรดิบ

// ---- ตัวเลข ----
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'

const THAI_NUMBER_DIGITS = {
  ศูนย์: 0, หนึ่ง: 1, เอ็ด: 1, สอง: 2, ยี่: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9,
}
const THAI_NUMBER_MULTIPLIERS = { สิบ: 10, ร้อย: 100, พัน: 1000, หมื่น: 10000 }
const THAI_NUMBER_WORD = Object.keys({ ...THAI_NUMBER_DIGITS, ...THAI_NUMBER_MULTIPLIERS }).join('|')

// ตัวเลขที่พูดออกมา: "60", "62.5", "ยี่สิบห้า", "สิบเอ็ด", "ห้าสิบครึ่ง"
// ใช้เป็นส่วนหนึ่งของ regex หน่วยต่าง ๆ (ตัวเลขต้องอยู่ติดหน่วย จึงไม่แปลงคำอย่าง "เก้าอี้" ผิด)
// lookahead ท้ายกันไม่ให้ regex ตัดตัวเลขกลางคัน ("20" -> "2", "สิบห้า" -> "สิบ")
const NUMBER_SOURCE = `(?:\\d+(?:\\.\\d+)?|(?:${THAI_NUMBER_WORD})+(?:ครึ่ง)?|ครึ่ง)(?![\\d.]|${THAI_NUMBER_WORD}|ครึ่ง)`

// "ยี่สิบห้า" -> 25, "สองร้อยห้าสิบ" -> 250, "ห้าสิบครึ่ง" -> 50.5, "ครึ่ง" -> 0.5, "60" -> 60
function parseNumber(token) {
  const value = String(token || '').trim()
  if (/^\d+(\.\d+)?$/.test(value)) return parseFloat(value)

  const half = value.endsWith('ครึ่ง') ? 0.5 : 0
  if (value === 'ครึ่ง') return half
  const words = value.replace(/ครึ่ง$/, '').match(new RegExp(THAI_NUMBER_WORD, 'g'))
  if (!words) return null

  let total = 0
  let pending = null
  for (const word of words) {
    if (word in THAI_NUMBER_DIGITS) {
      pending = THAI_NUMBER_DIGITS[word]
    } else {
      total += (pending ?? 1) * THAI_NUMBER_MULTIPLIERS[word]
      pending = null
    }
  }
  return total + (pending ?? 0) + half
}

// ---- ทำความสะอาดประโยค ----
// คำนำหน้า/ลงท้ายที่ไม่ใช่ส่วนของชื่อท่าหรืออาหาร
const LEADING_FILLERS_RE = /^(?:บันทึก|เอาเป็นว่า|เอาเป็น|คือว่า|คือ|เอ่อ|อ่า|อืม|วันนี้|เมื่อกี้|เมื่อกี๊|ตะกี้|log|record)\s*/i
const TRAILING_PARTICLES_RE = /\s*(?:นะครับ|นะคะ|ครับผม|ครับ|ค่ะ|คะ|นะ|จ้า|จ้ะ|ฮะ)$/

function stripFillers(text) {
  let result = text
  let previous
  do {
    previous = result
    result = result.replace(LEADING_FILLERS_RE, '').replace(TRAILING_PARTICLES_RE, '').trim()
  } while (result !== previous)
  return result
}

// เลขไทย -> อารบิก, ตัด comma ในตัวเลข (1,200), ช่องว่างซ้ำ, คำขยะหัว/ท้ายประโยค
function cleanText(rawText) {
  const text = String(rawText || '')
    .normalize('NFC')
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return stripFillers(text)
}

// ---- Phonetic key ----
// พยัญชนะที่ STT/ผู้พูดสับสนกันบ่อยอยู่กลุ่มเดียวกัน
const CONSONANT_CLASSES = [
  ['ก', 'ข', 'ค', 'ฆ'],
  ['ง'],
  ['จ', 'ฉ', 'ช', 'ฌ', 'ซ', 'ศ', 'ษ', 'ส'], // ช/ซ/ส: พุชอัพ / พุซอัพ, เบนช์ / เบนซ์
  ['ญ', 'ย'],
  ['ฎ', 'ด', 'ฏ', 'ต', 'ฐ', 'ถ', 'ท', 'ธ', 'ฑ', 'ฒ'], // เสียงสะกด ด/ต/ท เหมือนกัน: สควอท / สควอต
  ['ณ', 'น'],
  ['บ', 'ป', 'ผ', 'พ', 'ภ'],
  ['ฝ', 'ฟ'],
  ['ม'],
  ['ร', 'ล', 'ฬ'], // ร/ล คู่ที่สับสนกันบ่อยที่สุด
  ['ว'],
  ['ห', 'ฮ'],
]

const CONSONANT_MAP = new Map()
CONSONANT_CLASSES.forEach((group, index) => {
  group.forEach((char) => CONSONANT_MAP.set(char, String.fromCharCode(0x41 + index)))
})

// รูปที่ใช้เทียบความคล้าย (ไม่ใช่รูปที่แสดงผล):
// ตัวการันต์ทั้งตัว (ฟต์ -> ฟ), วรรณยุกต์, ไม้ไต่คู้, สระ ะ, ช่องว่าง/ขีด, ไ/ใ ถือว่าเหมือนกัน
// แล้วแทนพยัญชนะด้วยกลุ่มเสียง ภาษาอังกฤษเป็นตัวพิมพ์เล็กและตัด s พหูพจน์ท้ายคำ
function phoneticKey(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[ก-ฮ]์/g, '')
    .replace(/[่้๊๋็ะๆฯ์]/g, '')
    .replace(/ใ/g, 'ไ')
    .replace(/\b([a-z]{3,})s\b/g, '$1')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .split('')
    .map((char) => CONSONANT_MAP.get(char) ?? char)
    .join('')
}

function toTitleCase(text) {
  return String(text || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => (/^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

module.exports = { NUMBER_SOURCE, parseNumber, cleanText, phoneticKey, toTitleCase }
