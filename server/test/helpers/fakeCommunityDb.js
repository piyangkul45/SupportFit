// Supabase จำลองในหน่วยความจำ เฉพาะ query ที่ routes/community.js ใช้ (ทดสอบ API โดยไม่แตะฐานข้อมูลจริง)
// ใส่ users ของโพสต์/คอมเมนต์และจำนวนคอมเมนต์ให้เหมือนผลของ embed ใน PostgREST

function createFakeCommunityDb(users = {}) {
  const tables = { community_posts: [], community_comments: [], community_post_likes: [] }
  let nextId = 1

  const withEmbeds = (table, row) => {
    if (table === 'community_posts') {
      const comments = tables.community_comments.filter((comment) => String(comment.post_id) === String(row.id)).length
      return { ...row, users: { name: users[row.user_id] }, community_comments: [{ count: comments }] }
    }
    if (table === 'community_comments') return { ...row, users: { name: users[row.user_id] } }
    return { ...row }
  }

  function query(table) {
    const state = { filters: [], orders: [], range: null, limit: null, action: 'select', head: false, count: false, values: null }
    const matches = (row) => state.filters.every((test) => test(row))

    function run() {
      const rows = tables[table]
      if (state.action === 'insert') {
        const row = { ...state.values }
        if (table === 'community_post_likes') {
          if (rows.some((like) => String(like.post_id) === String(row.post_id) && like.user_id === row.user_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
        } else {
          row.id = nextId++
          row.created_at = new Date(Date.now() + row.id).toISOString()
          if (table === 'community_posts') row.likes_count = 0
          if (table === 'community_comments') row.post_id = Number(row.post_id)
        }
        rows.push(row)
        return { data: [withEmbeds(table, row)], error: null }
      }
      if (state.action === 'update') {
        rows.filter(matches).forEach((row) => Object.assign(row, state.values))
        return { data: null, error: null }
      }
      if (state.action === 'delete') {
        tables[table] = rows.filter((row) => !matches(row))
        return { data: null, error: null }
      }

      let result = rows.filter(matches)
      for (const [column, ascending] of [...state.orders].reverse()) {
        result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1))
      }
      const count = result.length
      if (state.range) result = result.slice(state.range[0], state.range[1] + 1)
      if (state.limit) result = result.slice(0, state.limit)
      return { data: state.head ? null : result.map((row) => withEmbeds(table, row)), count: state.count ? count : null, error: null }
    }

    const builder = {
      select(_columns, options = {}) {
        state.head = Boolean(options.head)
        state.count = options.count === 'exact'
        return builder
      },
      insert(values) {
        state.action = 'insert'
        state.values = values
        return builder
      },
      update(values) {
        state.action = 'update'
        state.values = values
        return builder
      },
      delete() {
        state.action = 'delete'
        return builder
      },
      eq(column, value) {
        state.filters.push((row) => String(row[column]) === String(value))
        return builder
      },
      match(values) {
        for (const [column, value] of Object.entries(values)) builder.eq(column, value)
        return builder
      },
      in(column, values) {
        const allowed = new Set(values.map(String))
        state.filters.push((row) => allowed.has(String(row[column])))
        return builder
      },
      order(column, { ascending = true } = {}) {
        state.orders.push([column, ascending])
        return builder
      },
      range(from, to) {
        state.range = [from, to]
        return builder
      },
      limit(value) {
        state.limit = value
        return builder
      },
      async maybeSingle() {
        const { data, error } = run()
        return { data: data?.[0] ?? null, error }
      },
      async single() {
        const { data, error } = run()
        return { data: data?.[0] ?? null, error }
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    return builder
  }

  return { from: query, tables }
}

module.exports = { createFakeCommunityDb }
