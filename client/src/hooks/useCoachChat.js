import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { coachChat } from '../utils/api'

// ตรงกับขีดจำกัดใน server/coach/chat.js
const MAX_HISTORY_MESSAGES = 12
const MAX_HISTORY_TEXT_LENGTH = 2000

// แยกตามผู้ใช้ เพื่อไม่ให้บัญชีอื่นที่ล็อกอินในแท็บเดียวกันเห็นบทสนทนา
const storageKey = (userId) => `supportfit_coach_${userId}`

function readConversation(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(userId)))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function writeConversation(userId, messages) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(messages))
  } catch {
    // storage เต็ม/ถูกปิด: บทสนทนายังอยู่ใน state จนกว่าจะรีเฟรช
  }
}

// บทสนทนากับ AI Coach ของ session นี้ อยู่ใน Dashboard ไม่ใช่ในหน้าแชต
// -> สลับแท็บระหว่างรอคำตอบแล้วคำตอบไม่หาย ; sessionStorage -> รีเฟรชหน้าแล้วยังย้อนดูได้ ปิดแท็บแล้วหายไป
// messages: [{ role: 'user' | 'model', text }]
export default function useCoachChat(userId) {
  const [messages, setMessages] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState(null)
  const messagesRef = useRef(messages)
  const requestRef = useRef(0) // ล้างการสนทนาระหว่างรอ = ไม่สนใจคำตอบของรอบเก่า
  const busyRef = useRef(false)

  const commit = useCallback(
    (next) => {
      messagesRef.current = next
      setMessages(next)
      if (userId) writeConversation(userId, next)
    },
    [userId]
  )

  useEffect(() => {
    if (!userId) return
    const saved = readConversation(userId)
    messagesRef.current = saved
    setMessages(saved)
  }, [userId])

  // conversation ลงท้ายด้วยข้อความ user ที่ยังไม่ได้คำตอบ
  const ask = useCallback(
    async (conversation) => {
      const id = ++requestRef.current
      busyRef.current = true
      setIsThinking(true)
      setError(null)
      try {
        const history = conversation
          .slice(0, -1)
          .slice(-MAX_HISTORY_MESSAGES)
          .map(({ role, text }) => ({ role, text: text.slice(0, MAX_HISTORY_TEXT_LENGTH) }))
        const { reply } = await coachChat(conversation.at(-1).text, history)
        if (id === requestRef.current) commit([...conversation, { role: 'model', text: reply }])
      } catch (err) {
        console.error(err)
        if (id === requestRef.current) setError(err.message || true)
      } finally {
        if (id === requestRef.current) {
          busyRef.current = false
          setIsThinking(false)
        }
      }
    },
    [commit]
  )

  const send = useCallback(
    (text) => {
      if (busyRef.current) return
      const conversation = [...messagesRef.current, { role: 'user', text }]
      commit(conversation)
      ask(conversation)
    },
    [ask, commit]
  )

  const retry = useCallback(() => {
    if (!busyRef.current && messagesRef.current.at(-1)?.role === 'user') ask(messagesRef.current)
  }, [ask])

  const clear = useCallback(() => {
    requestRef.current += 1
    busyRef.current = false
    setIsThinking(false)
    setError(null)
    commit([])
  }, [commit])

  return useMemo(() => ({ messages, isThinking, error, send, retry, clear }), [messages, isThinking, error, send, retry, clear])
}
