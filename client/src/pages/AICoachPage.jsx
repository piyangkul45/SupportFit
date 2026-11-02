import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Bot, Mic, RotateCcw, SendHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react'
import useSpeechInput from '../hooks/useSpeechInput'
import BodyPartFilter from '../components/BodyPartFilter'
import ExerciseBadges from '../components/ExerciseBadges'
import { MuscleIcon } from '../components/MuscleTargetCard'
import { exercisesForBodyPart, findExerciseInText, getAnatomy } from '../utils/exerciseAnatomy'

const MAX_TEXT_LENGTH = 1000
const QUICK_PROMPTS = ['dinner', 'recovery', 'cardio']
const WAVE_DELAYS = [0, 0.15, 0.3, 0.45]
// ชื่อท่ามือใหม่ที่ใส่เป็นตัวอย่างในคำขอ: ให้ AI ใช้ชื่อที่แอปรู้จัก จะได้แสดงรูปกล้ามเนื้อประกอบได้
const PLAN_EXAMPLE_COUNT = 5

// ---- แสดงคำตอบ ----
// รองรับเฉพาะที่ prompt ของ coach อนุญาต (bullet, ลำดับ, **ตัวหนา**) และ render เป็น element ของ React
// ไม่ใช้ dangerouslySetInnerHTML ข้อความจากโมเดลจึงกลายเป็น HTML ไม่ได้
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={index} className="font-semibold text-emerald-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  )
}

// บรรทัด -> [{ type: 'p' | 'heading', text } | { type: 'ul' | 'ol', items, start }]
// บรรทัดว่างไม่ตัด list: โมเดลมักเว้นบรรทัดระหว่างข้อ ถ้าตัดเลขลำดับจะเริ่มใหม่ทุกข้อ
function toBlocks(text) {
  const blocks = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line)
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const type = bullet ? 'ul' : numbered ? 'ol' : null
    if (type) {
      const item = bullet ? bullet[1] : numbered[2]
      if (blocks.at(-1)?.type === type) blocks.at(-1).items.push(item)
      else blocks.push({ type, items: [item], start: numbered ? Number(numbered[1]) : undefined })
    } else {
      blocks.push(heading ? { type: 'heading', text: heading[1].replaceAll('**', '') } : { type: 'p', text: line })
    }
  }
  return blocks
}

// ข้อในรายการที่เป็นท่าฝึกที่แอปรู้จัก = แสดงรูปกล้ามเนื้อ (ส้ม = หลัก, ฟ้า = รอง) + ป้ายระดับ/อุปกรณ์ประกอบ
function ListItem({ text }) {
  const exercise = findExerciseInText(text)
  const anatomy = exercise && getAnatomy(exercise.name)
  if (!anatomy) return <li><Inline text={text} /></li>
  return (
    <li>
      <div className="mt-1 flex gap-2.5 rounded-xl border border-white/[0.07] bg-black/20 p-2">
        <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
          <MuscleIcon primary={anatomy.primary} secondary={anatomy.secondary} className="h-12 w-6" title={exercise.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p><Inline text={text} /></p>
          <ExerciseBadges anatomy={anatomy} className="mt-1.5" />
        </div>
      </div>
    </li>
  )
}

function CoachReply({ text }) {
  return (
    <div className="space-y-2">
      {toBlocks(text).map((block, index) => {
        if (block.type === 'heading') return <p key={index} className="font-semibold text-white">{block.text}</p>
        if (block.type === 'p') return <p key={index}><Inline text={block.text} /></p>
        const List = block.type
        return (
          <List
            key={index}
            start={block.start}
            className={`space-y-1 pl-5 marker:text-emerald-400 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}
          >
            {block.items.map((item, itemIndex) => (
              <ListItem key={itemIndex} text={item} />
            ))}
          </List>
        )
      })}
    </div>
  )
}

// ---- สถานะ AI ----
function Wave() {
  return (
    <span aria-hidden className="flex h-4 items-center gap-0.5">
      {WAVE_DELAYS.map((delay) => (
        <span
          key={delay}
          className="animate-wave-bar h-full w-0.5 rounded-full bg-emerald-300"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

function CoachAvatar({ thinking }) {
  return (
    <span className="relative shrink-0">
      <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
        <Bot className="h-4 w-4" aria-hidden />
      </span>
      {thinking !== undefined && (
        <span
          aria-hidden
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-obsidian ${
            thinking ? 'animate-pulse bg-amber-400 motion-reduce:animate-none' : 'bg-emerald-400'
          }`}
        />
      )}
    </span>
  )
}

function Bubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && <CoachAvatar />}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words sm:max-w-[75%] ${
          isUser
            ? 'whitespace-pre-wrap rounded-br-md bg-gradient-to-br from-emerald-500 to-green-600 text-white'
            : 'glass-panel rounded-tl-md text-slate-200'
        }`}
      >
        {isUser ? message.text : <CoachReply text={message.text} />}
      </div>
    </motion.li>
  )
}

// หน้าแชต AI Coach: พิมพ์/พูดถาม หรือกดคำถามยอดฮิต บทสนทนาอยู่ใน useCoachChat (coach = ผลของ hook นั้น)
export default memo(function AICoachPage({ coach }) {
  const { t, i18n } = useTranslation()
  const { messages, isThinking, error, send, retry, clear } = coach
  const [text, setText] = useState('')
  const [micFailed, setMicFailed] = useState(false)
  const [isPickingPart, setIsPickingPart] = useState(false) // คำสั่งลัด "แนะนำท่าฝึก [ส่วนร่างกาย] สำหรับมือใหม่"
  const listRef = useRef(null)

  const speech = useSpeechInput({
    language: i18n.resolvedLanguage,
    onFinal: (spoken) => setText((prev) => `${prev.trim() ? `${prev.trim()} ` : ''}${spoken}`.slice(0, MAX_TEXT_LENGTH)),
    onError: () => setMicFailed(true),
  })

  // ระหว่างฟังแสดงคำที่กำลังถอดความต่อท้าย (ล็อกการพิมพ์ไว้) กดส่งระหว่างฟังก็ส่งข้อความที่เห็นนี้
  const draft = speech.isListening && speech.interim ? `${text}${text ? ' ' : ''}${speech.interim}` : text
  const canSend = Boolean(draft.trim()) && !isThinking

  // เลื่อนเฉพาะกล่องแชต (scrollIntoView จะเลื่อนทั้งหน้าด้วย)
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, isThinking, error])

  const submit = (value) => {
    const message = value.trim().slice(0, MAX_TEXT_LENGTH)
    if (!message || isThinking) return
    speech.cancel()
    setMicFailed(false)
    setText('')
    send(message)
  }

  const askBeginnerPlan = (bodyPart) => {
    if (!bodyPart) return
    setIsPickingPart(false)
    const examples = exercisesForBodyPart(bodyPart, { level: 'beginner' })
      .slice(0, PLAN_EXAMPLE_COUNT)
      .map((exercise) => exercise.name)
      .join(', ')
    submit(t('coach.beginnerPlan.message', { part: t(`anatomy.bodyParts.${bodyPart}`), examples }))
  }

  const toggleMic = () => {
    setMicFailed(false)
    speech.toggle()
  }

  const handleKeyDown = (event) => {
    // Enter ระหว่างเลือกคำจาก IME ไม่ใช่การส่ง ; Shift+Enter = ขึ้นบรรทัดใหม่
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit(draft)
  }

  const statusKey = isThinking ? 'thinking' : speech.isListening ? 'listening' : 'online'

  return (
    <section className="glass-card flex h-[calc(100dvh-13.5rem)] min-h-[26rem] flex-col overflow-hidden md:h-[calc(100dvh-9.5rem)]">
      <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <CoachAvatar thinking={isThinking} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight text-white">{t('coach.title')}</h1>
          <p role="status" className="flex h-4 items-center gap-1.5 text-xs text-slate-400">
            {isThinking && <Wave />}
            <span className="truncate">{t(`coach.status.${statusKey}`)}</span>
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} aria-label={t('coach.clear')} data-tooltip={t('coach.clear')} className="btn-icon">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && !isThinking ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="icon-tile mb-1 h-12 w-12 rounded-2xl border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-white">{t('coach.welcome.title')}</h2>
            <p className="max-w-sm text-sm text-slate-400">{t('coach.welcome.body')}</p>
          </div>
        ) : (
          <ol aria-label={t('coach.conversation')} className="space-y-4">
            {messages.map((message, index) => (
              <Bubble key={index} message={message} />
            ))}
            {isThinking && (
              <li className="flex gap-2.5">
                <CoachAvatar />
                <div className="glass-panel flex items-center gap-2 rounded-2xl rounded-tl-md px-3.5 py-3 text-sm text-slate-400">
                  <Wave />
                  {t('coach.status.thinking')}
                </div>
              </li>
            )}
          </ol>
        )}

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <p className="min-w-0 flex-1">{typeof error === 'string' ? error : t('coach.failed')}</p>
            <button type="button" onClick={retry} className="btn-icon shrink-0 text-red-200">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('coach.retry')}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5">
        {isPickingPart && (
          <div className="mb-2.5 rounded-xl border border-orange-400/20 bg-orange-400/[0.05] p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-orange-100">{t('coach.beginnerPlan.pick')}</p>
              <button type="button" onClick={() => setIsPickingPart(false)} aria-label={t('coach.beginnerPlan.cancel')} className="btn-icon p-1">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <BodyPartFilter value={null} onChange={askBeginnerPlan} showAll={false} disabled={isThinking} label={t('coach.beginnerPlan.pick')} />
          </div>
        )}
        <div role="group" aria-label={t('coach.prompts.label')} className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
          <button
            type="button"
            onClick={() => setIsPickingPart((open) => !open)}
            disabled={isThinking}
            aria-expanded={isPickingPart}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              isPickingPart
                ? 'border-orange-400/50 bg-orange-400/20 text-orange-100'
                : 'border-orange-400/25 bg-orange-400/[0.08] text-orange-200 hover:bg-orange-400/15'
            }`}
          >
            {t('coach.beginnerPlan.chip')}
          </button>
          {QUICK_PROMPTS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => submit(t(`coach.prompts.${key}`))}
              disabled={isThinking}
              className="shrink-0 whitespace-nowrap rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:opacity-50"
            >
              {t(`coach.prompts.${key}`)}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
          className="flex items-end gap-2"
        >
          {speech.isSupported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={t(speech.isListening ? 'coach.micStop' : 'coach.micStart')}
              aria-pressed={speech.isListening}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                speech.isListening
                  ? 'animate-pulse border-red-400/40 bg-red-500/20 text-red-300 motion-reduce:animate-none'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {speech.isListening ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            </button>
          )}
          <textarea
            value={draft}
            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
            onKeyDown={handleKeyDown}
            readOnly={speech.isListening}
            rows={1}
            maxLength={MAX_TEXT_LENGTH}
            aria-label={t('coach.inputLabel')}
            placeholder={t('coach.placeholder')}
            className="input-field max-h-32 min-h-11 flex-1 resize-none [field-sizing:content]"
          />
          <button type="submit" disabled={!canSend} aria-label={t('coach.send')} className="btn-accent flex h-11 w-11 shrink-0 items-center justify-center !px-0 !py-0">
            <SendHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </form>

        {micFailed ? (
          <p role="alert" className="mt-2 text-center text-[11px] text-red-300">{t('coach.micError')}</p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-slate-500">{t('coach.disclaimer')}</p>
        )}
      </div>
    </section>
  )
})
