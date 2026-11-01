import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Flame, MessageCircle, SendHorizontal, Users } from 'lucide-react'
import { ButtonLabel } from '../components/Spinner'
import {
  createCommunityComment,
  createCommunityPost,
  getCommunityComments,
  getCommunityPosts,
  toggleCommunityLike,
} from '../utils/api'
import { timeAgo } from '../utils/date'

// ตรงกับ server/routes/community.js
const CATEGORIES = ['weight_training', 'nutrition', 'program_share', 'qa']
const FILTERS = ['all', 'popular', ...CATEGORIES]
const MAX_POST_LENGTH = 1000
const MAX_COMMENT_LENGTH = 500

const initialOf = (name) => (name || '?')[0].toUpperCase()

function Avatar({ name, small }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 font-bold text-emerald-200 ${
        small ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
      }`}
    >
      {initialOf(name)}
    </span>
  )
}

function ErrorText({ children }) {
  return (
    <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {children}
    </p>
  )
}

function CreatePost({ userName, onCreated }) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const text = content.trim()
    if (!text || saving) return
    setSaving(true)
    setError('')
    try {
      onCreated(await createCommunityPost({ content: text, category }))
      setContent('')
    } catch (err) {
      setError(err.message || t('community.errors.post'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card space-y-3 p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar name={userName} />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={MAX_POST_LENGTH}
          rows={3}
          aria-label={t('community.create.label')}
          placeholder={t('community.create.placeholder')}
          className="input-field min-h-[5.25rem] resize-none [field-sizing:content]"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label={t('community.create.category')} className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={category === key}
              onClick={() => setCategory(key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                category === key
                  ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {t(`community.categories.${key}`)}
            </button>
          ))}
        </div>
        <button type="submit" disabled={!content.trim() || saving} className="btn-accent shrink-0 text-sm">
          <ButtonLabel loading={saving} loadingText={t('community.create.posting')}>
            {t('community.create.submit')}
          </ButtonLabel>
        </button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  )
}

// คอมเมนต์โหลดเมื่อเปิดโพสต์ครั้งแรก onAdded: ให้การ์ดเพิ่มจำนวนคอมเมนต์
function Comments({ postId, onAdded }) {
  const { t, i18n } = useTranslation()
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCommunityComments(postId)
      .then((rows) => !cancelled && setComments(rows))
      .catch((err) => {
        if (cancelled) return
        setComments([])
        setError(err.message || t('community.errors.load'))
      })
    return () => {
      cancelled = true
    }
  }, [postId, t])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    setError('')
    try {
      const comment = await createCommunityComment(postId, content)
      setComments((prev) => [...(prev ?? []), comment])
      setText('')
      onAdded()
    } catch (err) {
      setError(err.message || t('community.errors.comment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-white/[0.07] px-4 py-3 sm:px-5">
      {comments === null ? (
        <div className="skeleton h-10" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">{t('community.comments.empty')}</p>
      ) : (
        <ul aria-label={t('community.comments.title')} className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <Avatar name={comment.author_name} small />
              <div className="glass-panel min-w-0 flex-1 px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold text-slate-100">{comment.author_name || t('community.anonymous')}</span>
                  <time dateTime={comment.created_at} className="text-slate-500">{timeAgo(comment.created_at, i18n.resolvedLanguage)}</time>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-200">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          aria-label={t('community.comments.label')}
          placeholder={t('community.comments.placeholder')}
          className="input-field"
        />
        <button
          type="submit"
          disabled={!text.trim() || saving}
          aria-label={t('community.comments.send')}
          className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center !px-0 !py-0"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}

function PostCard({ post, onChange }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [likeError, setLikeError] = useState('')
  const likingRef = useRef(false)

  // แสดงผลทันที ถ้า server ไม่สำเร็จค่อยคืนค่าเดิม
  const handleLike = async () => {
    if (likingRef.current) return
    likingRef.current = true
    setLikeError('')
    const { liked, likes_count } = post
    onChange(post.id, { liked: !liked, likes_count: Math.max(0, likes_count + (liked ? -1 : 1)) })
    try {
      onChange(post.id, await toggleCommunityLike(post.id))
    } catch (err) {
      onChange(post.id, { liked, likes_count })
      setLikeError(err.message || t('community.errors.like'))
    } finally {
      likingRef.current = false
    }
  }

  const addComment = useCallback(
    () => onChange(post.id, (current) => ({ comments_count: current.comments_count + 1 })),
    [onChange, post.id]
  )

  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="block w-full px-4 pt-4 text-left sm:px-5"
      >
        <span className="flex items-center gap-3">
          <Avatar name={post.author_name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-100">{post.author_name || t('community.anonymous')}</span>
            <time dateTime={post.created_at} className="block text-xs text-slate-500">{timeAgo(post.created_at, i18n.resolvedLanguage)}</time>
          </span>
          <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-xs font-medium text-emerald-200">
            {t(`community.categories.${post.category}`)}
          </span>
        </span>
        <span className={`mt-3 block whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200 ${open ? '' : 'line-clamp-4'}`}>
          {post.content}
        </span>
      </button>

      <div className="flex items-center gap-1 px-2.5 py-2 sm:px-3.5">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={post.liked}
          aria-label={t('community.like', { count: post.likes_count })}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-orange-500/10 ${
            post.liked ? 'text-orange-400' : 'text-slate-400 hover:text-orange-300'
          }`}
        >
          <Flame className={`h-4.5 w-4.5 ${post.liked ? 'fill-current' : ''}`} aria-hidden />
          {post.likes_count}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={t('community.commentsCount', { count: post.comments_count })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
        >
          <MessageCircle className="h-4.5 w-4.5" aria-hidden />
          {post.comments_count}
        </button>
        {likeError && <p role="alert" className="min-w-0 flex-1 truncate text-xs text-red-300">{likeError}</p>}
      </div>

      {open && <Comments postId={post.id} onAdded={addComment} />}
    </motion.li>
  )
}

// หน้า Community: สร้างโพสต์, ตัวกรอง, ฟีด (โหลดเพิ่มทีละหน้า) และคอมเมนต์
export default memo(function CommunityPage({ userName }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [posts, setPosts] = useState(null) // null = กำลังโหลดหน้าแรก
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0) // เปลี่ยนตัวกรองเร็ว ๆ = ไม่ใช้ผลของคำขอเก่า

  const load = useCallback(
    async (nextFilter, offset) => {
      const id = ++requestRef.current
      setError('')
      try {
        const { posts: rows, has_more } = await getCommunityPosts(nextFilter, offset)
        if (id !== requestRef.current) return
        setPosts((prev) => (offset ? [...(prev ?? []), ...rows.filter((row) => !prev?.some((post) => post.id === row.id))] : rows))
        setHasMore(has_more)
      } catch (err) {
        if (id !== requestRef.current) return
        setPosts((prev) => prev ?? [])
        setError(err.message || t('community.errors.load'))
      }
    },
    [t]
  )

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      setPosts(null)
      load(filter, 0)
    })
    return () => {
      active = false
    }
  }, [filter, load])

  const loadMore = async () => {
    setLoadingMore(true)
    await load(filter, posts.length)
    setLoadingMore(false)
  }

  // โพสต์ใหม่อยู่บนสุดของ "ทั้งหมด" เสมอ อยู่ตัวกรองอื่นจึงพากลับมาให้เห็นโพสต์ของตัวเอง
  const handleCreated = useCallback(
    (post) => {
      if (filter === 'all') setPosts((prev) => [post, ...(prev ?? [])])
      else setFilter('all')
    },
    [filter]
  )

  // changes: ค่าใหม่ หรือฟังก์ชันที่รับโพสต์ปัจจุบัน (เช่น บวกจำนวนคอมเมนต์)
  const updatePost = useCallback((id, changes) => {
    setPosts((prev) =>
      prev?.map((post) => (post.id === id ? { ...post, ...(typeof changes === 'function' ? changes(post) : changes) } : post))
    )
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
        <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Users className="h-4 w-4" aria-hidden />
        </span>
        {t('community.title')}
      </h1>

      <CreatePost userName={userName} onCreated={handleCreated} />

      <div role="tablist" aria-label={t('community.filterLabel')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((key) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-emerald-400/30 bg-gradient-to-b from-emerald-400/20 to-emerald-500/5 text-white'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100'
              }`}
            >
              {t(CATEGORIES.includes(key) ? `community.categories.${key}` : `community.filters.${key}`)}
            </button>
          )
        })}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      {posts === null ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      ) : posts.length === 0 ? (
        !error && <p className="glass-card p-8 text-center text-sm text-slate-400">{t('community.empty')}</p>
      ) : (
        <ul aria-label={t('community.feedLabel')} className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onChange={updatePost} />
          ))}
        </ul>
      )}

      {hasMore && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full text-sm">
          <ButtonLabel loading={loadingMore} loadingText={t('community.loadingMore')}>
            {t('community.loadMore')}
          </ButtonLabel>
        </button>
      )}
    </div>
  )
})
