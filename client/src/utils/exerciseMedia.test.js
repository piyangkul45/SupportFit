import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EXERCISES } from './exerciseCatalog.js'
import { GUIDE_PATTERNS, MANNEQUIN_MOTIONS, PATTERN_MOTIONS, getExerciseMedia, getGuidePattern, mediaSlug, motionFor } from './exerciseMedia.js'
import { MOTIONS } from '../../scripts/mannequin/motions.js'

const CATALOG_NAMES = new Set(EXERCISES.map((exercise) => exercise.name))
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))

test('media and guide keys are all catalog exercise names', () => {
  for (const name of [...Object.keys(MANNEQUIN_MOTIONS), ...Object.keys(GUIDE_PATTERNS)]) {
    assert.ok(CATALOG_NAMES.has(name), `${name} is not in exerciseCatalog`)
  }
})

test('every catalog exercise has a beginner guide pattern', () => {
  for (const exercise of EXERCISES) assert.notEqual(getGuidePattern(exercise.name), 'general', exercise.name)
})

test('global media standard: all 53 catalog exercises have a 3D mannequin animation', () => {
  assert.equal(EXERCISES.length, 53)
  for (const exercise of EXERCISES) {
    const media = getExerciseMedia(exercise.name)
    assert.ok(media, `${exercise.name} has no 3D animation`)
    assert.ok(MOTIONS[media.motion], `${exercise.name}: unknown motion ${media.motion}`)
    assert.deepEqual(
      media.sources.map((source) => source.type),
      ['video/mp4', 'video/webm']
    )
    const slug = mediaSlug(exercise.name)
    assert.deepEqual(
      [...media.sources.map((source) => source.src), media.poster],
      [`/mannequin/${slug}.mp4`, `/mannequin/${slug}.webm`, `/mannequin/${slug}-poster.webp`]
    )
  }
})

test('no real-person photos or static anatomy stand-ins are referenced', () => {
  for (const exercise of EXERCISES) {
    const media = getExerciseMedia(exercise.name)
    for (const src of [...media.sources.map((source) => source.src), media.poster, media.still].filter(Boolean)) {
      assert.doesNotMatch(src, /\.jpe?g$|\.png$|\.svg$|free-exercise-db|everkinetic|wger|exercisedb|unsplash|pexels|^https?:/i, `${exercise.name}: ${src}`)
    }
  }
})

test('generated video, webm, poster and 3D target figure exist for every exercise', () => {
  for (const exercise of EXERCISES) {
    const media = getExerciseMedia(exercise.name)
    for (const url of [...media.sources.map((source) => source.src), media.poster, `/mannequin/${mediaSlug(exercise.name)}-target.webp`]) {
      const file = `${PUBLIC_DIR}${url}`
      assert.ok(existsSync(file), `missing ${url} (run scripts/build-mannequin-videos.mjs)`)
      assert.ok(statSync(file).size > 1000, `${url} looks empty`)
    }
  }
})

test('public/mannequin holds only clips for catalog exercises; old line-art folder is gone', () => {
  const allowed = new Set(['LICENSE.md'])
  for (const exercise of EXERCISES) {
    const slug = mediaSlug(exercise.name)
    for (const file of [`${slug}.mp4`, `${slug}.webm`, `${slug}-poster.webp`, `${slug}-target.webp`]) allowed.add(file)
  }
  for (const file of readdirSync(`${PUBLIC_DIR}/mannequin`)) assert.ok(allowed.has(file), `unexpected media file mannequin/${file}`)
  assert.ok(!existsSync(`${PUBLIC_DIR}/anatomy`), 'public/anatomy (old line-art media) should be removed')
})

test('smart 3D movement fallback: every guide pattern maps to a real motion', () => {
  for (const pattern of new Set(Object.values(GUIDE_PATTERNS))) {
    assert.ok(MOTIONS[PATTERN_MOTIONS[pattern]], `pattern ${pattern} has no fallback motion`)
  }
  // ท่าเฉพาะทางใช้แอนิเมชันของรูปแบบการเคลื่อนไหวหลัก
  assert.equal(motionFor('HIIT'), 'jumping-jack')
  assert.equal(motionFor('Pistol Squat'), 'pistol-squat')
})

test('slugs and lookups', () => {
  assert.equal(mediaSlug('Bench Press'), 'bench-press')
  assert.equal(mediaSlug('Push Up'), 'push-up')
  assert.equal(getExerciseMedia('  squat ').motion, 'barbell-squat')
  assert.equal(getExerciseMedia('Plank').motion, 'plank')
  assert.equal(getExerciseMedia('Swimming').motion, 'swim')
  assert.equal(getExerciseMedia('My Custom Move'), null)
  assert.equal(getGuidePattern('My Custom Move'), 'general')
})
