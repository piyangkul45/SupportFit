// API ของ SupportFit Community: ฟีดโพสต์, ไฟ 🔥 และคอมเมนต์
//
// ตาราง: community_posts -> community_comments, community_post_likes (ดู sql/schema.sql)
// ส่งกลับเฉพาะชื่อผู้โพสต์ ไม่ส่ง user_id/อีเมล

const express = require('express')

const CATEGORIES = ['weight_training', 'nutrition', 'program_share', 'qa']
const MAX_POST_LENGTH = 1000
const MAX_COMMENT_LENGTH = 500
const PAGE_SIZE = 20
const MAX_COMMENTS = 200

// ระบุชื่อ foreign key: community_post_likes เชื่อมโพสต์กับ users ได้อีกทาง PostgREST จึงเลือกเองไม่ได้
const POST_COLUMNS = 'id, content, category, likes_count, created_at, users!community_posts_user_id_fkey(name), community_comments(count)'
const COMMENT_COLUMNS = 'id, post_id, content, created_at, users!community_comments_user_id_fkey(name)'

// ยังไม่ได้สร้างตาราง community_* (ยังไม่ได้รัน schema.sql)
const isSchemaMissing = (error) => ['PGRST200', 'PGRST204', 'PGRST205', '42P01', '42703'].includes(error?.code)
const UNIQUE_VIOLATION = '23505'
const isPostId = (value) => /^\d{1,18}$/.test(String(value))

const toPost = (row, likedIds = new Set()) => ({
  id: row.id,
  author_name: row.users?.name ?? null,
  content: row.content,
  category: row.category,
  likes_count: row.likes_count,
  comments_count: row.community_comments?.[0]?.count ?? 0,
  liked: likedIds.has(String(row.id)),
  created_at: row.created_at,
})

const toComment = (row) => ({
  id: row.id,
  post_id: row.post_id,
  author_name: row.users?.name ?? null,
  content: row.content,
  created_at: row.created_at,
})

module.exports = function createCommunityRouter({ supabase, requireAuth, handleSupabaseError }) {
  const router = express.Router()

  function sendDbError(req, res, error, failKey) {
    if (isSchemaMissing(error)) {
      console.error(error)
      return res.status(500).json({ error: req.t('community.dbNotReady') })
    }
    return handleSupabaseError(res, error, req.t(failKey))
  }

  const postExists = async (id) => {
    const { data, error } = await supabase.from('community_posts').select('id').eq('id', id).maybeSingle()
    return { exists: Boolean(data), error }
  }

  // ?filter=all | popular | <category> &offset=0 -> { posts, has_more }
  router.get('/community/posts', requireAuth, async (req, res) => {
    const filter = String(req.query.filter || 'all')
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0)
    if (filter !== 'all' && filter !== 'popular' && !CATEGORIES.includes(filter)) {
      return res.status(400).json({ error: req.t('community.invalidCategory') })
    }

    let query = supabase.from('community_posts').select(POST_COLUMNS)
    if (CATEGORIES.includes(filter)) query = query.eq('category', filter)
    if (filter === 'popular') query = query.order('likes_count', { ascending: false })
    // ดึงเกิน 1 แถวเพื่อรู้ว่ายังมีหน้าถัดไปไหม
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE)
    if (error) return sendDbError(req, res, error, 'community.loadFailed')

    const rows = data.slice(0, PAGE_SIZE)
    const { data: likes, error: likesError } = rows.length
      ? await supabase
          .from('community_post_likes')
          .select('post_id')
          .eq('user_id', req.authUser.uid)
          .in('post_id', rows.map((row) => row.id))
      : { data: [] }
    if (likesError) return sendDbError(req, res, likesError, 'community.loadFailed')

    const likedIds = new Set(likes.map((like) => String(like.post_id)))
    res.json({ posts: rows.map((row) => toPost(row, likedIds)), has_more: data.length > PAGE_SIZE })
  })

  // body: { content, category }
  router.post('/community/posts', requireAuth, async (req, res) => {
    const content = String(req.body?.content || '').trim()
    const category = req.body?.category
    if (!content) return res.status(400).json({ error: req.t('community.contentRequired') })
    if (content.length > MAX_POST_LENGTH) {
      return res.status(400).json({ error: req.t('community.tooLong', { max: MAX_POST_LENGTH }) })
    }
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: req.t('community.invalidCategory') })

    const { data, error } = await supabase
      .from('community_posts')
      .insert({ user_id: req.authUser.uid, content, category })
      .select(POST_COLUMNS)
      .single()
    if (error) return sendDbError(req, res, error, 'community.saveFailed')
    res.status(201).json(toPost(data))
  })

  // กดไฟ/เอาไฟออก -> { liked, likes_count } ; likes_count นับใหม่จากแถวจริง กดพร้อมกันหลายคนแล้วตัวเลขไม่เพี้ยนค้าง
  router.post('/community/posts/:id/like', requireAuth, async (req, res) => {
    const { id } = req.params
    if (!isPostId(id)) return res.status(404).json({ error: req.t('community.notFound') })
    const { exists, error: postError } = await postExists(id)
    if (postError) return sendDbError(req, res, postError, 'community.likeFailed')
    if (!exists) return res.status(404).json({ error: req.t('community.notFound') })

    const likes = () => supabase.from('community_post_likes')
    const match = { post_id: id, user_id: req.authUser.uid }
    const { data: existing, error: findError } = await likes().select('post_id').match(match).maybeSingle()
    if (findError) return sendDbError(req, res, findError, 'community.likeFailed')

    // กดรัวสองครั้งพร้อมกัน: ครั้งที่สองชน primary key ถือว่ากดแล้ว ไม่ใช่ error
    const { error: toggleError } = existing ? await likes().delete().match(match) : await likes().insert(match)
    if (toggleError && toggleError.code !== UNIQUE_VIOLATION) return sendDbError(req, res, toggleError, 'community.likeFailed')

    const { count, error: countError } = await likes().select('post_id', { count: 'exact', head: true }).eq('post_id', id)
    if (countError) return sendDbError(req, res, countError, 'community.likeFailed')
    const { error: updateError } = await supabase.from('community_posts').update({ likes_count: count }).eq('id', id)
    if (updateError) return sendDbError(req, res, updateError, 'community.likeFailed')

    res.json({ liked: !existing, likes_count: count })
  })

  router.get('/community/posts/:id/comments', requireAuth, async (req, res) => {
    const { id } = req.params
    if (!isPostId(id)) return res.status(404).json({ error: req.t('community.notFound') })

    const { data, error } = await supabase
      .from('community_comments')
      .select(COMMENT_COLUMNS)
      .eq('post_id', id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(MAX_COMMENTS)
    if (error) return sendDbError(req, res, error, 'community.loadFailed')
    res.json(data.map(toComment))
  })

  // body: { content }
  router.post('/community/posts/:id/comments', requireAuth, async (req, res) => {
    const { id } = req.params
    const content = String(req.body?.content || '').trim()
    if (!isPostId(id)) return res.status(404).json({ error: req.t('community.notFound') })
    if (!content) return res.status(400).json({ error: req.t('community.contentRequired') })
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: req.t('community.tooLong', { max: MAX_COMMENT_LENGTH }) })
    }

    const { exists, error: postError } = await postExists(id)
    if (postError) return sendDbError(req, res, postError, 'community.commentFailed')
    if (!exists) return res.status(404).json({ error: req.t('community.notFound') })

    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: id, user_id: req.authUser.uid, content })
      .select(COMMENT_COLUMNS)
      .single()
    if (error) return sendDbError(req, res, error, 'community.commentFailed')
    res.status(201).json(toComment(data))
  })

  return router
}

module.exports.CATEGORIES = CATEGORIES
module.exports.PAGE_SIZE = PAGE_SIZE
