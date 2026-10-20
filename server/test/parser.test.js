// ทดสอบ AI Parser: คำที่คนไทยพูดผิด/STT ถอดผิด, หน่วยภาษาพูด, ตัวเลขคำไทย และกรณีที่ต้องไม่เดา
// รัน: npm test
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { parseCommand } = require('../parser')
const { phoneticKey, parseNumber } = require('../parser/normalize')
const { EXERCISES } = require('../parser/dictionary')

const CANONICAL_EXERCISES = new Set(EXERCISES.map((exercise) => exercise.name))

// ตรวจเฉพาะ field ที่ระบุใน expected
function expectParsed(text, expected) {
  const result = parseCommand(text)
  assert.ok(result, `"${text}" ควรแยกความหมายได้`)
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(result[key], value, `"${text}" -> ${key}: ได้ ${JSON.stringify(result[key])}`)
  }
  return result
}

describe('exercise synonyms (Thai mispronunciations -> canonical)', () => {
  const cases = [
    ['สควอท 60 กิโล 5 ครั้ง', 'Squat'],
    ['สคอท 60 กิโล 5 ครั้ง', 'Squat'],
    ['สควัต 60 กิโล 5 ครั้ง', 'Squat'],
    ['สะควอต 60 โล 5 ที', 'Squat'],
    ['squats 60 kg 5 reps', 'Squat'],
    ['เบนช์เพรส 80 กิโล 8 ครั้ง', 'Bench Press'],
    ['เบนเพรซ 80 กิโล 8 ครั้ง', 'Bench Press'],
    ['ベンチ 80 kg 8 reps', 'Bench Press'],
    ['bench 80 kg 8 reps', 'Bench Press'],
    ['เดดลิฟต์ 120 กิโล 5 ครั้ง', 'Deadlift'],
    ['เดทลิฟ 120 กิโล 5 ครั้ง', 'Deadlift'],
    ['dead lift 120 kg 5 reps', 'Deadlift'],
    ['ลาตดึงหลัง 50 กิโล 12 ครั้ง', 'Lat Pulldown'],
    ['แลตพูลดาวน์ 50 กิโล 12 ครั้ง', 'Lat Pulldown'],
    ['lat pull 50 kg 12 reps', 'Lat Pulldown'],
    ['อกเคเบิล 15 กิโล 12 ครั้ง', 'Cable Fly'],
    ['เคเบิลฟลาย 15 กิโล 12 ครั้ง', 'Cable Fly'],
  ]
  for (const [text, name] of cases) {
    test(text, () => expectParsed(text, { type: 'workout', exercise_name: name, match_type: 'exact' }))
  }
})

describe('Thai-accented arm and body exercises', () => {
  test('"ใบเสด 10 กิโล 12 ครั้ง" -> Bicep Curl 10 kg x 12', () =>
    expectParsed('ใบเสด 10 กิโล 12 ครั้ง', { type: 'workout', exercise_name: 'Bicep Curl', weight_kg: 10, reps: 12 }))

  const cases = [
    ...['ใบเสด', 'ไบเสบ', 'ไบเซป', 'ไบเซ็ป', 'ไบเสป', 'baised'].map((name) => [name, 'Bicep Curl']),
    ...['ไตรเสด', 'ไตรเซป', 'ไตรเสบ'].map((name) => [name, 'Tricep Extension']),
    ...['โชลเดอร์', 'โชวเดอร์', 'เชาลเดอร์'].map((name) => [name, 'Shoulder Press']),
    ...['เลกเพรส', 'เล็กเพรส', 'เลกเพรซ'].map((name) => [name, 'Leg Press']),
  ]
  for (const [spoken, name] of cases) {
    test(`${spoken} -> ${name}`, () =>
      expectParsed(`${spoken} 20 กิโล 10 ครั้ง`, { exercise_name: name, match_type: 'exact', weight_kg: 20, reps: 10 }))
  }

  // ไม่อยู่ในพจนานุกรม ต้องได้ท่ามาตรฐานที่ใกล้ที่สุด ไม่ใช่คำที่ฟังผิด
  const unlisted = [
    ['ใบเส็ดเคิล 10 กิโล 12 ครั้ง', 'Bicep Curl'],
    ['baisep curl 10 kg 12 reps', 'Bicep Curl'],
    ['โชวเด้อเพรด 20 กิโล 10 ครั้ง', 'Shoulder Press'],
    ['เล็กเพด 100 กิโล 10 ครั้ง', 'Leg Press'],
  ]
  for (const [text, name] of unlisted) {
    test(`unlisted variant: ${text}`, () => {
      const result = expectParsed(text, { exercise_name: name })
      assert.notEqual(result.match_type, 'none')
    })
  }
})

describe('fuzzy matching (variants not in the dictionary)', () => {
  const cases = [
    ['สะควัท 60 กิโล 5 ครั้ง', 'Squat'], // ะ + ด/ต/ท สลับกัน
    ['เดธลิฟท์ 100 กิโล 5 ครั้ง', 'Deadlift'],
    ['เบ็นเพรด 70 กิโล 10 ครั้ง', 'Bench Press'], // STT ถอดเสียงท้ายผิด
    ['แลดพูลดาว 40 กิโล 12 ครั้ง', 'Lat Pulldown'],
    ['พุซอั๊บ 20 ครั้ง', 'Push Up'],
    ['ฟรอนต์สควอท 50 กิโล 5 ครั้ง', 'Front Squat'], // alias ยาวกว่าต้องชนะ Squat
    ['บาร์เบลสควอทหนัก 100 กิโล 3 ครั้ง', 'Squat'], // มีคำอื่นติดมา
  ]
  for (const [text, name] of cases) {
    test(text, () => {
      const result = expectParsed(text, { type: 'workout', exercise_name: name })
      assert.ok(result.confidence >= 0.6, `confidence ${result.confidence}`)
    })
  }

  test('low-but-close confidence still picks the closest canonical name', () => {
    const result = expectParsed('เบ็นเพรด 70 กิโล 10 ครั้ง', { exercise_name: 'Bench Press' })
    assert.ok(['exact', 'fuzzy'].includes(result.match_type))
  })

  test('unrelated name is forced to the nearest canonical exercise, keeping what was heard', () => {
    const result = expectParsed('ท่าพิเศษของโค้ชโบ๊ท 10 ครั้ง', { type: 'workout', match_type: 'fuzzy' })
    assert.ok(CANONICAL_EXERCISES.has(result.exercise_name), result.exercise_name)
    assert.match(result.spoken_name, /พิเศษของโค้ชโบ๊ท/)
    assert.ok(result.confidence < 0.6)
  })

  test('ambiguous partial name still resolves to a canonical exercise', () => {
    const result = expectParsed('press 50 kg 10 reps', { match_type: 'fuzzy', weight_kg: 50, reps: 10 })
    assert.ok(CANONICAL_EXERCISES.has(result.exercise_name), result.exercise_name)
  })

  test('verbs that are part of an exercise name are kept ("ยกขา" = Leg Raise)', () => {
    expectParsed('ยกขา 20 ครั้ง 3 เซต', { exercise_name: 'Leg Raise' })
    expectParsed('เล่นสควอท 60 กิโล 5 ครั้ง', { exercise_name: 'Squat' })
  })
})

describe('units and casual Thai quantities', () => {
  test('โล / ที / ชุด', () =>
    expectParsed('สควอท 60 โล 10 ที 3 ชุด', { weight_kg: 60, reps: 10, sets: 3 }))
  test('กิโลกรัม / รอบ / เซ็ต', () =>
    expectParsed('เดดลิฟต์ 100 กิโลกรัม 5 รอบ 2 เซ็ต', { weight_kg: 100, reps: 5, sets: 2 }))
  test('kg / reps / sets in English', () =>
    expectParsed('bench press 72.5 kg 8 reps 4 sets', { exercise_name: 'Bench Press', weight_kg: 72.5, reps: 8, sets: 4 }))
  test('Thai number words', () =>
    expectParsed('สควอท ยี่สิบห้ากิโล สิบครั้ง สามเซต', { weight_kg: 25, reps: 10, sets: 3 }))
  test('Thai digits', () => expectParsed('สควอท ๖๐ กิโล ๕ ครั้ง', { weight_kg: 60, reps: 5 }))
  test('half kilo ("ห้าสิบครึ่ง")', () => expectParsed('เบนช์เพรส ห้าสิบครึ่งโล 8 ครั้ง', { weight_kg: 50.5 }))
  test('"3 เซต เซตละ 10 ครั้ง"', () =>
    expectParsed('สควอท 60 กิโล 3 เซต เซตละ 10 ครั้ง', { exercise_name: 'Squat', sets: 3, reps: 10, match_type: 'exact' }))
  test('"5x5" = sets x reps', () => expectParsed('squat 100kg 5x5', { weight_kg: 100, sets: 5, reps: 5 }))
  test('pounds are converted to kg', () => expectParsed('bench press 135 lbs 5 reps', { weight_kg: 61.23 }))
  test('fillers and polite particles are ignored', () =>
    expectParsed('เอ่อ บันทึก สควอท 60 กิโล 5 ครั้งครับ', { exercise_name: 'Squat', weight_kg: 60, reps: 5 }))
  test('"ทีบาร์โรว์" is not read as reps', () =>
    expectParsed('ทีบาร์โรว์ 40 กิโล 10 ครั้ง', { exercise_name: 'T-Bar Row', reps: 10 }))
  test('bodyweight exercise without weight', () =>
    expectParsed('วิดพื้น 20 ครั้ง', { exercise_name: 'Push Up', weight_kg: null, reps: 20 }))
})

describe('food parsing', () => {
  test('ข้าวอกไก่ / อกไก่ย่าง / อกไก่ -> canonical name', () => {
    for (const text of ['กินข้าวอกไก่', 'กินอกไก่ย่าง', 'กินอกไก่']) {
      expectParsed(text, { type: 'food', food_name: 'Grilled Chicken Breast with Rice', match_type: 'exact' })
    }
  })
  test('spoken macros win over estimates (แคล / โปรตีน กรัม)', () =>
    expectParsed('กินข้าวอกไก่ 500 แคล โปรตีน 45 กรัม', {
      food_name: 'Grilled Chicken Breast with Rice', calories: 500, protein: 45, carbs: 50, fat: 8, macros_estimated: true,
    }))
  test('"กิโลแคล" is calories, not kilograms', () =>
    expectParsed('ข้าวมันไก่ 650 กิโลแคล', { type: 'food', food_name: 'Hainanese Chicken Rice', calories: 650 }))
  test('macros before keyword ("35 กรัมโปรตีน")', () =>
    expectParsed('ข้าวไก่ย่าง 450 แคล 35 กรัมโปรตีน', { calories: 450, protein: 35 }))
  test('estimated macros when nothing is spoken', () =>
    expectParsed('ข้าวอกไก่', { type: 'food', calories: 450, protein: 40, macros_estimated: true }))
  test('servings multiply estimates ("ไข่ต้ม 2 ฟอง")', () =>
    expectParsed('กินไข่ต้ม 2 ฟอง', { food_name: 'Boiled Egg', calories: 156, protein: 13 }))
  test('grams scale estimates ("อกไก่ 175 กรัม")', () =>
    expectParsed('กินอกไก่ 175 กรัม', { calories: 225, protein: 20 }))
  test('"เวย์โปรตีน 1 สกู๊ป" is a serving, not 1 g of protein', () =>
    expectParsed('ดื่มเวย์โปรตีน 1 สกู๊ป', { food_name: 'Whey Protein Shake', protein: 24 }))
  test('misspelled food (กระเพราไก่ / ก๊วยเตี๋ยว)', () => {
    expectParsed('กินกระเพราไก่', { food_name: 'Basil Chicken with Rice' })
    expectParsed('กินก๊วยเตี๋ยว', { food_name: 'Noodle Soup' })
  })
  test('unknown food keeps the spoken name and only spoken macros', () =>
    expectParsed('กินขนมบ้านยาย 300 แคล', {
      food_name: 'ขนมบ้านยาย', calories: 300, protein: null, match_type: 'none', macros_estimated: false,
    }))
})

describe('output shape and rejection', () => {
  test('every field is always present', () => {
    const result = parseCommand('สควอท 60 กิโล 5 ครั้ง')
    assert.deepEqual(Object.keys(result).sort(), [
      'calories', 'carbs', 'confidence', 'exercise_name', 'fat', 'food_name', 'macros_estimated',
      'match_type', 'protein', 'reps', 'sets', 'spoken_name', 'type', 'weight_kg',
    ])
    assert.equal(result.food_name, null)
  })
  test('returns null for text it cannot understand', () => {
    for (const text of ['', '   ', 'สวัสดีครับ', 'วันนี้อากาศดี', 'สควอท', '60 กิโล 5 ครั้ง']) {
      assert.equal(parseCommand(text), null, `"${text}"`)
    }
  })
})

describe('helpers', () => {
  test('parseNumber handles Thai number words', () => {
    assert.equal(parseNumber('ยี่สิบห้า'), 25)
    assert.equal(parseNumber('สิบเอ็ด'), 11)
    assert.equal(parseNumber('สองร้อยห้าสิบ'), 250)
    assert.equal(parseNumber('ครึ่ง'), 0.5)
  })
  test('phoneticKey merges confusable spellings', () => {
    assert.equal(phoneticKey('เดดลิฟต์'), phoneticKey('เดทลิฟ'))
    assert.equal(phoneticKey('สะควอต'), phoneticKey('สควอท'))
    assert.equal(phoneticKey('Dead Lift'), phoneticKey('deadlift'))
  })
  test('dictionary loads the full exercise database', () => assert.ok(EXERCISES.length > 900))
})
