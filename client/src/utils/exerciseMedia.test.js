import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EXERCISES } from './exerciseCatalog.js'
import { EVERKINETIC_IDS, GUIDE_PATTERNS, getExerciseMedia, getGuidePattern, mediaSlug } from './exerciseMedia.js'

const CATALOG_NAMES = new Set(EXERCISES.map((exercise) => exercise.name))
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))

test('media and guide keys are all catalog exercise names', () => {
  for (const name of [...Object.keys(EVERKINETIC_IDS), ...Object.keys(GUIDE_PATTERNS)]) {
    assert.ok(CATALOG_NAMES.has(name), `${name} is not in exerciseCatalog`)
  }
})

test('every catalog exercise has a beginner guide pattern', () => {
  for (const exercise of EXERCISES) assert.notEqual(getGuidePattern(exercise.name), 'general', exercise.name)
})

test('headline exercises have MP4 + WebM video, poster and a CDN still', () => {
  for (const name of ['Squat', 'Bench Press', 'Leg Extension', 'Lunge', 'Deadlift', 'Push Up']) {
    const media = getExerciseMedia(name)
    assert.deepEqual(
      media.sources.map((source) => source.type),
      ['video/mp4', 'video/webm']
    )
    assert.match(media.poster, /^\/anatomy\/[a-z0-9-]+-poster\.webp$/)
    assert.match(media.still, /^https:\/\/cdn\.jsdelivr\.net\/gh\/everkinetic\/data@[0-9a-f]{40}\/dist\/svg\/\d{4}-relaxation\.svg$/)
  }
})

test('generated video, webm and poster files exist for every mapped exercise', () => {
  for (const name of Object.keys(EVERKINETIC_IDS)) {
    const media = getExerciseMedia(name)
    for (const url of [...media.sources.map((source) => source.src), media.poster]) {
      const file = `${PUBLIC_DIR}${url}`
      assert.ok(existsSync(file), `missing ${url} (run scripts/build-exercise-videos.mjs)`)
      assert.ok(statSync(file).size > 1000, `${url} looks empty`)
    }
  }
})

test('global media standard: every catalog exercise is line art or the anatomy fallback, never a photo', () => {
  for (const exercise of EXERCISES) {
    const media = getExerciseMedia(exercise.name)
    if (!media) continue // ไม่มีคลิปลายเส้น -> UI ใช้ Silhouette Anatomy (เวกเตอร์)
    assert.equal(media.source.name, 'Everkinetic', exercise.name)
    for (const src of [...media.sources.map((source) => source.src), media.poster, media.still]) {
      assert.doesNotMatch(src, /\.jpe?g$|\.png$|free-exercise-db|wger|exercisedb|unsplash|pexels/i, `${exercise.name}: ${src}`)
    }
    assert.match(media.still, /^https:\/\/cdn\.jsdelivr\.net\/gh\/everkinetic\/data@[0-9a-f]{40}\/dist\/svg\/\d{4}-relaxation\.svg$/)
  }
})

test('public/anatomy holds only line-art clips for mapped exercises (no leftover photo demos)', () => {
  const allowed = new Set(['LICENSE.md'])
  for (const name of Object.keys(EVERKINETIC_IDS)) {
    const slug = mediaSlug(name)
    for (const file of [`${slug}.mp4`, `${slug}.webm`, `${slug}-poster.webp`]) allowed.add(file)
  }
  for (const file of readdirSync(`${PUBLIC_DIR}/anatomy`)) assert.ok(allowed.has(file), `unexpected media file anatomy/${file}`)
})

test('slugs and lookups', () => {
  assert.equal(mediaSlug('Bench Press'), 'bench-press')
  assert.equal(mediaSlug('Push Up'), 'push-up')
  assert.equal(getExerciseMedia('  squat ').id, '0122')
  assert.equal(getExerciseMedia('My Custom Move'), null)
  assert.equal(getExerciseMedia('Swimming'), null)
  assert.equal(getExerciseMedia('Plank'), null) // ไม่มีคลิปลายเส้น -> Silhouette Anatomy
  assert.equal(getGuidePattern('My Custom Move'), 'general')
})
