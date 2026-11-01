// API ของ SupportFit AI Coach (ดู coach/chat.js)

const express = require('express')
const { createCoachChat } = require('../coach/chat')

// GeminiError.reason -> [HTTP status, message key ใน i18n.js]
const AI_FAILURES = {
  timeout: [504, 'coach.timeout'],
  busy: [503, 'coach.busy'],
  model_unavailable: [502, 'coach.failed'],
  failed: [502, 'coach.failed'],
}

// chat: ใช้แทน Gemini ตอนทดสอบ (null = ไม่ได้ตั้ง GEMINI_API_KEY ปิดฟีเจอร์ AI)
module.exports = function createCoachRouter({ supabase, requireAuth, handleSupabaseError, chat = createCoachChat() }) {
  const router = express.Router()

  // body: { message, history?: [{ role: 'user' | 'model', text }] } -> { reply } (Markdown)
  router.post('/coach/chat', requireAuth, async (req, res) => {
    const message = String(req.body?.message || '').trim()
    if (!message) return res.status(400).json({ error: req.t('coach.messageRequired') })
    if (!chat) return res.status(503).json({ error: req.t('coach.unavailable'), reason: 'ai_unavailable' })

    const { data: profile, error } = await supabase.from('users').select('*').eq('id', req.authUser.uid).maybeSingle()
    if (error) return handleSupabaseError(res, error, req.t('data.profileLoadFailed'))

    try {
      res.json({ reply: await chat({ message, history: req.body?.history, profile }) })
    } catch (failure) {
      console.error('coach chat failed:', failure.message)
      const [status, messageKey] = AI_FAILURES[failure.reason] || AI_FAILURES.failed
      res.status(status).json({ error: req.t(messageKey), reason: `ai_${failure.reason || 'failed'}` })
    }
  })

  return router
}
