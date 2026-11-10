import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BODY_PART_KEYS } from './exerciseAnatomy.js'

const DIR = fileURLToPath(new URL('../../public/muscles', import.meta.url))
const KEYS = ['all', ...BODY_PART_KEYS]

test('every muscle category has one 3D render and nothing else is left in public/muscles', () => {
  for (const key of KEYS) {
    const file = `${DIR}/${key}.webp`
    assert.ok(existsSync(file), `missing muscles/${key}.webp (run scripts/build-muscle-icons.mjs)`)
    assert.ok(statSync(file).size > 5000, `muscles/${key}.webp looks empty`)
    // WebP แบบมีช่อง alpha (พื้นโปร่งใส) = chunk VP8X ที่บิต alpha ถูกตั้ง
    const head = readFileSync(file).subarray(0, 21)
    assert.equal(head.toString('ascii', 12, 16), 'VP8X', `${key}.webp has no alpha channel`)
    assert.ok(head[20] & 0x10, `${key}.webp is not transparent`)
  }
  const allowed = new Set([...KEYS.map((k) => `${k}.webp`), 'LICENSE.md'])
  for (const file of readdirSync(DIR)) assert.ok(allowed.has(file), `unexpected file muscles/${file}`)
})

test('muscle pickers use the 3D renders, not the vector figure', () => {
  for (const name of ['MuscleCategorySelector', 'BodyPartFilter']) {
    const src = readFileSync(fileURLToPath(new URL(`../components/${name}.jsx`, import.meta.url)), 'utf8')
    assert.match(src, /\/muscles\//, `${name} does not use /muscles renders`)
    assert.doesNotMatch(src, /AnatomyFigure|MuscleIcon/, `${name} still uses the vector anatomy figure`)
  }
})
