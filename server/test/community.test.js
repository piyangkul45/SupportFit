// ทดสอบ API ของ Community ด้วยฐานข้อมูลจำลอง
// รัน: npm test
const { test, describe, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const express = require('express')
const { SCHEMA_PATH } = require('../migrate')
const createCommunityRouter = require('../routes/community')
const { createFakeCommunityDb } = require('./helpers/fakeCommunityDb')

const { CATEGORIES, PAGE_SIZE } = createCommunityRouter
const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'

describe('community API', () => {
  let server
  let baseUrl
  let db

  before(async () => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.t = (key) => key
      next()
    })
    const requireAuth = (req, res, next) => {
      const uid = { alice: ALICE, bob: BOB }[req.headers.authorization]
      if (!uid) return res.status(401).json({ error: 'auth' })
      req.authUser = { uid }
      next()
    }
    // ส่งผ่าน proxy เพื่อให้แต่ละเทสต์เปลี่ยน db ใหม่ได้
    const supabase = { from: (table) => db.from(table) }
    app.use('/api', createCommunityRouter({ supabase, requireAuth, handleSupabaseError: (res, error) => res.status(500).json({ error: error.message }) }))
    await new Promise((resolve) => {
      server = app.listen(0, resolve)
    })
    baseUrl = `http://127.0.0.1:${server.address().port}/api/community`
  })

  after(() => server.close())
  beforeEach(() => {
    db = createFakeCommunityDb({ [ALICE]: 'Alice', [BOB]: 'Bob' })
  })

  async function api(method, path, body, user = 'alice') {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, body: await res.json() }
  }
  const newPost = async (content = 'hello', category = 'qa', user = 'alice') =>
    (await api('POST', '/posts', { content, category }, user)).body

  test('every endpoint requires login', async () => {
    assert.equal((await api('GET', '/posts', null, null)).status, 401)
    assert.equal((await api('POST', '/posts', { content: 'x', category: 'qa' }, null)).status, 401)
    assert.equal((await api('POST', '/posts/1/like', {}, null)).status, 401)
    assert.equal((await api('POST', '/posts/1/comments', { content: 'x' }, null)).status, 401)
    assert.equal((await api('GET', '/posts/1/comments', null, null)).status, 401)
  })

  test('creates a post as the logged-in user, ignoring any user_id or likes in the body', async () => {
    const { status, body } = await api('POST', '/posts', { content: '  สควอท  ', category: 'weight_training', user_id: BOB, likes_count: 999 })
    assert.equal(status, 201)
    assert.equal(body.content, 'สควอท')
    assert.equal(body.author_name, 'Alice')
    assert.equal(body.likes_count, 0)
    assert.equal(db.tables.community_posts[0].user_id, ALICE)
  })

  test('does not expose user ids', async () => {
    await newPost()
    const { body } = await api('GET', '/posts')
    assert.ok(!JSON.stringify(body).includes(ALICE))
    assert.ok(!('user_id' in body.posts[0]))
  })

  test('validates content and category', async () => {
    assert.equal((await api('POST', '/posts', { content: '   ', category: 'qa' })).body.error, 'community.contentRequired')
    assert.equal((await api('POST', '/posts', { content: 'x', category: 'spam' })).body.error, 'community.invalidCategory')
    assert.equal((await api('POST', '/posts', { content: 'x'.repeat(1001), category: 'qa' })).status, 400)
  })

  test('filters by category and rejects unknown filters', async () => {
    await newPost('a', 'qa')
    await newPost('b', 'nutrition')
    const { body } = await api('GET', '/posts?filter=nutrition')
    assert.deepEqual(body.posts.map((post) => post.content), ['b'])
    assert.equal((await api('GET', '/posts?filter=hack')).status, 400)
  })

  test('sorts newest first, popular by fire then newest', async () => {
    const older = await newPost('older')
    await newPost('newer')
    await api('POST', `/posts/${older.id}/like`, {})
    assert.deepEqual((await api('GET', '/posts')).body.posts.map((post) => post.content), ['newer', 'older'])
    assert.deepEqual((await api('GET', '/posts?filter=popular')).body.posts.map((post) => post.content), ['older', 'newer'])
  })

  test('pages through posts', async () => {
    for (let i = 0; i < PAGE_SIZE + 2; i++) await newPost(`p${i}`)
    const first = (await api('GET', '/posts')).body
    assert.equal(first.posts.length, PAGE_SIZE)
    assert.equal(first.has_more, true)
    const second = (await api('GET', `/posts?offset=${PAGE_SIZE}`)).body
    assert.equal(second.posts.length, 2)
    assert.equal(second.has_more, false)
  })

  test('fire toggles once per user and counts real likes', async () => {
    const post = await newPost()
    assert.deepEqual((await api('POST', `/posts/${post.id}/like`, {})).body, { liked: true, likes_count: 1 })
    assert.deepEqual((await api('POST', `/posts/${post.id}/like`, {}, 'bob')).body, { liked: true, likes_count: 2 })
    assert.equal((await api('GET', '/posts')).body.posts[0].liked, true)
    assert.deepEqual((await api('POST', `/posts/${post.id}/like`, {})).body, { liked: false, likes_count: 1 })
    const feed = (await api('GET', '/posts')).body.posts[0]
    assert.equal(feed.liked, false)
    assert.equal(feed.likes_count, 1)
  })

  test('comments are listed oldest first and update the count', async () => {
    const post = await newPost()
    const first = await api('POST', `/posts/${post.id}/comments`, { content: ' first ' }, 'bob')
    assert.equal(first.status, 201)
    assert.equal(first.body.author_name, 'Bob')
    assert.equal(first.body.content, 'first')
    await api('POST', `/posts/${post.id}/comments`, { content: 'second' })
    assert.deepEqual((await api('GET', `/posts/${post.id}/comments`)).body.map((comment) => comment.content), ['first', 'second'])
    assert.equal((await api('GET', '/posts')).body.posts[0].comments_count, 2)
  })

  test('validates comments', async () => {
    const post = await newPost()
    assert.equal((await api('POST', `/posts/${post.id}/comments`, { content: ' ' })).status, 400)
    assert.equal((await api('POST', `/posts/${post.id}/comments`, { content: 'x'.repeat(501) })).status, 400)
  })

  test('unknown or malformed posts are 404', async () => {
    assert.equal((await api('POST', '/posts/999/like', {})).status, 404)
    assert.equal((await api('POST', '/posts/999/comments', { content: 'x' })).status, 404)
    assert.equal((await api('POST', '/posts/abc/like', {})).status, 404)
    assert.equal((await api('GET', '/posts/abc/comments')).status, 404)
  })
})

test('schema allows exactly the categories the API accepts', () => {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
  const allowed = /category in \(([^)]*)\)/.exec(schema)[1].match(/'[^']+'/g).map((value) => value.slice(1, -1))
  assert.deepEqual(allowed, CATEGORIES)
})
