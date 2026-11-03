import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAB_PATHS, pathForTab, tabFromPath } from './routes.js'

test('nutrition route maps both ways', () => {
  assert.equal(TAB_PATHS.nutrition, '/nutrition')
  assert.equal(tabFromPath('/nutrition'), 'nutrition')
  assert.equal(pathForTab('nutrition'), '/nutrition')
})

test('paths are normalised (trailing slash, case)', () => {
  assert.equal(tabFromPath('/nutrition/'), 'nutrition')
  assert.equal(tabFromPath('/Nutrition'), 'nutrition')
  assert.equal(tabFromPath('/'), 'home')
  assert.equal(tabFromPath(''), 'home')
})

test('unknown paths and tabs fall back to the dashboard', () => {
  assert.equal(tabFromPath('/does-not-exist'), 'home')
  assert.equal(pathForTab('nope'), '/')
})

test('every tab round-trips', () => {
  for (const [tab, path] of Object.entries(TAB_PATHS)) assert.equal(tabFromPath(path), tab)
})
