import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BODY_PART_KEYS, MUSCLES } from './exerciseAnatomy.js'

const DIR = fileURLToPath(new URL('../../public/muscles', import.meta.url))
const KEYS = ['all', ...BODY_PART_KEYS]
// ภาพกล้ามเนื้อเดี่ยวสำหรับชิปใน MuscleTargetCard
const CHIPS = Object.keys(MUSCLES)
  .filter((k) => k !== 'fullbody')
  .map((k) => `m-${k}`)

test('every muscle category and muscle chip has a transparent 3D render, nothing else in public/muscles', () => {
  for (const key of [...KEYS, ...CHIPS]) {
    const file = `${DIR}/${key}.webp`
    assert.ok(existsSync(file), `missing muscles/${key}.webp (run scripts/build-muscle-icons.mjs)`)
    assert.ok(statSync(file).size > 2000, `muscles/${key}.webp looks empty`)
    // WebP แบบมีช่อง alpha (พื้นโปร่งใส) = chunk VP8X ที่บิต alpha ถูกตั้ง
    const head = readFileSync(file).subarray(0, 21)
    assert.equal(head.toString('ascii', 12, 16), 'VP8X', `${key}.webp has no alpha channel`)
    assert.ok(head[20] & 0x10, `${key}.webp is not transparent`)
  }
  const allowed = new Set([...KEYS, ...CHIPS].map((k) => `${k}.webp`).concat('LICENSE.md'))
  for (const file of readdirSync(DIR)) assert.ok(allowed.has(file), `unexpected file muscles/${file}`)
})

test('anatomy displays use the realistic 3D renders; the vector figure is gone', () => {
  assert.ok(!existsSync(fileURLToPath(new URL('../components/AnatomyFigure.jsx', import.meta.url))), 'vector AnatomyFigure should be removed')
  for (const name of ['MuscleCategorySelector', 'BodyPartFilter', 'MuscleTargetCard']) {
    const src = readFileSync(fileURLToPath(new URL(`../components/${name}.jsx`, import.meta.url)), 'utf8')
    assert.match(src, /\/(muscles|mannequin)\//, `${name} does not use the 3D renders`)
    assert.doesNotMatch(src, /AnatomyFigure|MuscleIcon/, `${name} still uses the vector anatomy figure`)
  }
})
