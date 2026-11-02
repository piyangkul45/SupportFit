// ทดสอบข้อมูลกล้ามเนื้อของท่า, Quick Filter ตามส่วนร่างกาย และการหาท่าจากคำตอบของ AI Coach
// รัน: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISES } from './exerciseCatalog.js'
import { BODY_PART_KEYS, LEVELS, MUSCLES, exercisesForBodyPart, findExerciseInText, getAnatomy, matchesBodyPart } from './exerciseAnatomy.js'

test('ทุกท่าในรายการมีข้อมูลกล้ามเนื้อที่ถูกต้อง', () => {
  for (const exercise of EXERCISES) {
    const anatomy = getAnatomy(exercise.name)
    assert.ok(anatomy, exercise.name)
    assert.ok(anatomy.primary.length > 0, exercise.name)
    for (const muscle of [...anatomy.primary, ...anatomy.secondary]) assert.ok(muscle in MUSCLES, `${exercise.name}: ${muscle}`)
    assert.ok(LEVELS.includes(anatomy.level), exercise.name)
    assert.equal(typeof anatomy.equipment, 'boolean')
  }
})

test('ท่าที่พิมพ์เองไม่มีข้อมูลกล้ามเนื้อ', () => {
  assert.equal(getAnatomy('My Custom Move'), null)
})

test('Quick Filter ดูจากกล้ามเนื้อหลักเท่านั้น', () => {
  assert.ok(matchesBodyPart('Push Up', 'chest'))
  assert.ok(!matchesBodyPart('Push Up', 'arms')) // triceps เป็นกล้ามเนื้อรอง
  assert.ok(matchesBodyPart('Bicep Curl', 'arms'))
  assert.ok(matchesBodyPart('Squat', 'legs'))
  assert.ok(matchesBodyPart('Plank', 'core'))
  assert.ok(matchesBodyPart('Plank', null))
})

test('ทุกส่วนร่างกายมีท่าสำหรับมือใหม่ และเรียงมือใหม่ก่อน', () => {
  for (const part of BODY_PART_KEYS) {
    const beginner = exercisesForBodyPart(part, { level: 'beginner' })
    assert.ok(beginner.length > 0, part)
    assert.ok(beginner.every((exercise) => getAnatomy(exercise.name).level === 'beginner'))
    const all = exercisesForBodyPart(part).map((exercise) => LEVELS.indexOf(getAnatomy(exercise.name).level))
    assert.deepEqual(all, [...all].sort((a, b) => a - b), part)
  }
})

test('หาท่าจากข้อความคำตอบของ AI Coach', () => {
  assert.equal(findExerciseInText('**Push Up** - 3 เซต × 10 ครั้ง')?.name, 'Push Up')
  assert.equal(findExerciseInText('**Bodyweight Squat** 3x15 แล้วต่อด้วย Plank')?.name, 'Bodyweight Squat')
  assert.equal(findExerciseInText('**Push-ups** 3 sets')?.name, 'Push Up')
  assert.equal(findExerciseInText('**วิดพื้น** 3 เซต')?.name, 'Push Up')
  assert.equal(findExerciseInText('ทำ Plank ค้างไว้ 30 วินาที')?.name, 'Plank')
  assert.equal(findExerciseInText('ดื่มน้ำให้พอ และนอนหลับ 7-8 ชั่วโมง'), null)
  assert.equal(findExerciseInText('Have a light brunch'), null)
})
