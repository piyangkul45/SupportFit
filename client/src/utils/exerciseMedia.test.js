import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISES } from './exerciseCatalog.js'
import { GUIDE_PATTERNS, MEDIA_IDS, getExerciseMedia, getGuidePattern } from './exerciseMedia.js'

const CATALOG_NAMES = new Set(EXERCISES.map((exercise) => exercise.name))

test('media and guide keys are all catalog exercise names', () => {
  for (const name of [...Object.keys(MEDIA_IDS), ...Object.keys(GUIDE_PATTERNS)]) {
    assert.ok(CATALOG_NAMES.has(name), `${name} is not in exerciseCatalog`)
  }
})

test('every catalog exercise has a beginner guide pattern', () => {
  for (const exercise of EXERCISES) assert.notEqual(getGuidePattern(exercise.name), 'general', exercise.name)
})

test('headline exercises have a 2-frame vector illustration from the CDN', () => {
  for (const name of ['Squat', 'Bench Press', 'Leg Extension', 'Lunge', 'Deadlift', 'Push Up']) {
    const media = getExerciseMedia(name)
    assert.equal(media.frames.length, 2)
    assert.match(media.frames[0], /^https:\/\/cdn\.jsdelivr\.net\/gh\/everkinetic\/data@[0-9a-f]{40}\/dist\/svg\/\d{4}-relaxation\.svg$/)
    assert.match(media.frames[1], /-tension\.svg$/)
  }
})

test('no real-person photo sources remain', () => {
  for (const name of Object.keys(MEDIA_IDS)) {
    for (const src of getExerciseMedia(name).frames) assert.doesNotMatch(src, /\.jpe?g$|free-exercise-db/i)
  }
})

test('lookup is case-insensitive and unknown names return fallbacks', () => {
  assert.equal(getExerciseMedia('  squat ').id, '0122')
  assert.equal(getExerciseMedia('My Custom Move'), null)
  assert.equal(getExerciseMedia('Swimming'), null)
  assert.equal(getGuidePattern('My Custom Move'), 'general')
})
