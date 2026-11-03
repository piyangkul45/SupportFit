import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
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

test('no real-person photo sources remain', () => {
  for (const name of Object.keys(EVERKINETIC_IDS)) {
    const media = getExerciseMedia(name)
    for (const src of [...media.sources.map((source) => source.src), media.poster, media.still]) {
      assert.doesNotMatch(src, /\.jpe?g$|free-exercise-db/i)
    }
  }
})

test('slugs and lookups', () => {
  assert.equal(mediaSlug('Bench Press'), 'bench-press')
  assert.equal(mediaSlug('Push Up'), 'push-up')
  assert.equal(getExerciseMedia('  squat ').id, '0122')
  assert.equal(getExerciseMedia('My Custom Move'), null)
  assert.equal(getExerciseMedia('Swimming'), null)
  assert.equal(getGuidePattern('My Custom Move'), 'general')
})
