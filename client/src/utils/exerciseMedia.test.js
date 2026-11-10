import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EXERCISES } from './exerciseCatalog.js'
import { EVERKINETIC_IDS, FREE_EXERCISE_DB_IDS, GUIDE_PATTERNS, getExerciseMedia, getGuidePattern, mediaSlug } from './exerciseMedia.js'

const CATALOG_NAMES = new Set(EXERCISES.map((exercise) => exercise.name))
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))

test('media and guide keys are all catalog exercise names', () => {
  for (const name of [...Object.keys(EVERKINETIC_IDS), ...Object.keys(FREE_EXERCISE_DB_IDS), ...Object.keys(GUIDE_PATTERNS)]) {
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
  for (const name of [...Object.keys(EVERKINETIC_IDS), ...Object.keys(FREE_EXERCISE_DB_IDS)]) {
    const media = getExerciseMedia(name)
    for (const url of [...media.sources.map((source) => source.src), media.poster]) {
      const file = `${PUBLIC_DIR}${url}`
      assert.ok(existsSync(file), `missing ${url} (run scripts/build-exercise-videos.mjs or build-photo-videos.mjs)`)
      assert.ok(statSync(file).size > 1000, `${url} looks empty`)
    }
  }
})

test('Everkinetic exercises keep line art (photos only where no line art exists)', () => {
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
  assert.equal(getExerciseMedia('Plank').kind, 'photo')
  assert.equal(getExerciseMedia('Squat').kind, 'lineart')
  assert.equal(getGuidePattern('My Custom Move'), 'general')
})

test('photo demos: no overlap with line art, pinned CDN still, public-domain credit', () => {
  for (const [name, id] of Object.entries(FREE_EXERCISE_DB_IDS)) {
    assert.ok(!(name in EVERKINETIC_IDS), `${name} already has line art`)
    const media = getExerciseMedia(name)
    assert.equal(media.kind, 'photo')
    assert.equal(media.source.name, 'Free Exercise DB')
    assert.match(media.still, new RegExp(`^https://cdn\\.jsdelivr\\.net/gh/yuhonas/free-exercise-db@[0-9a-f]{40}/exercises/${id}/[01]\\.jpg$`))
  }
})

test('requested exercises now have a demo clip', () => {
  for (const name of ['Boxing', 'Yoga', 'Mountain Climber', 'Plank', 'Hanging Leg Raise']) assert.ok(getExerciseMedia(name), name)
})
