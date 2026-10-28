import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, CalendarCheck, Check, Crosshair, Dumbbell, Eraser, Search, Sparkles, TriangleAlert, Undo2, UtensilsCrossed, X } from 'lucide-react'
import { parseCommand } from '../utils/api'
import { MicButton, Waveform } from './VoiceInput'
import Badge from './Badge'
import { ButtonLabel } from './Spinner'

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

// หยุดพิมพ์นานเท่านี้ถือว่าแก้เสร็จ แล้วแปลงข้อความใหม่ (ออกจากช่องพิมพ์ = แปลงทันที)
const REPARSE_DELAY_MS = 350

// 1 บรรทัด = 1 คำสั่ง (เสียงแต่ละช่วงที่ STT ตัดจบจะขึ้นบรรทัดใหม่)
const splitLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const StatusBadge = memo(function StatusBadge({ isListening, isParsing, readyCount }) {
  const { t } = useTranslation()
  let tone = 'border-white/10 bg-white/5 text-slate-400'
  let dot = 'bg-slate-500'
  let label = t('voice.status.idle')
  if (isListening) {
    tone = 'border-red-400/30 bg-red-500/10 text-red-300'
    dot = 'bg-red-400 animate-pulse'
    label = t('voice.status.listening')
  } else if (isParsing) {
    tone = 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
    dot = 'bg-cyan-400 animate-pulse'
    label = t('voice.status.parsing')
  } else if (readyCount > 0) {
    tone = 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    dot = 'bg-emerald-400'
    label = t('voice.status.ready', { count: readyCount })
  }

  return (
    <motion.span
      key={label}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </motion.span>
  )
})

// memo: บรรทัดที่ไม่ได้แก้ไม่ต้อง render ใหม่ (preview object ของบรรทัดเดิมไม่เปลี่ยน)
const PreviewCard = memo(function PreviewCard({ line, preview }) {
  const { t } = useTranslation()
  const units = (key) => t(`common.units.${key}`)

  if (!preview || preview.status === 'loading') {
    return (
      <li className="rounded-xl border border-white/[0.06] p-3" aria-label={t('voice.preview.parsing')}>
        <div className="skeleton mb-2 h-4 w-1/2" />
        <div className="flex gap-1.5">
          <div className="skeleton h-4 w-12" />
          <div className="skeleton h-4 w-12" />
        </div>
      </li>
    )
  }

  if (preview.status !== 'ok') {
    return (
      <li className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-sm text-amber-200">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {preview.status === 'unknown' ? t('voice.preview.notUnderstood', { text: line }) : t('voice.preview.failed')}
      </li>
    )
  }

  const { parsed } = preview
  const isWorkout = parsed.type === 'workout'
  const Icon = isWorkout ? Dumbbell : UtensilsCrossed
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2.5"
    >
      <span className="icon-tile mt-0.5 h-7 w-7 border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">
          {isWorkout ? parsed.exercise_name : parsed.food_name}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {isWorkout ? (
            <>
              <Badge value={parsed.weight_kg} unit={units('kg')} tone="emerald" />
              <Badge value={parsed.reps} unit={units('reps')} tone="cyan" />
              <Badge value={parsed.sets} unit={units('sets')} tone="violet" />
            </>
          ) : (
            <>
              <Badge value={parsed.calories} unit={units('kcal')} tone="emerald" />
              <Badge value={parsed.protein} prefix={t('dashboard.logs.short.protein')} unit={units('g')} tone="cyan" />
              <Badge value={parsed.carbs} prefix={t('dashboard.logs.short.carbs')} unit={units('g')} tone="amber" />
              <Badge value={parsed.fat} prefix={t('dashboard.logs.short.fat')} unit={units('g')} tone="rose" />
            </>
          )}
          {parsed.macros_estimated && (
            <span className="text-[11px] text-slate-500">· {t('voice.preview.estimated')}</span>
          )}
        </div>
        {parsed.match_type === 'hint' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/90">
            <CalendarCheck className="h-3 w-3" aria-hidden />
            {t('voice.preview.fromRoutine')}
          </p>
        )}
        {parsed.match_type === 'fuzzy' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300/90">
            <Search className="h-3 w-3" aria-hidden />
            {t('voice.preview.heard', { spoken: parsed.spoken_name })}
          </p>
        )}
        {parsed.source === 'gemini' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-violet-300/90">
            <Sparkles className="h-3 w-3" aria-hidden />
            {parsed.spoken_name
              ? t('voice.preview.aiHeard', { spoken: parsed.spoken_name })
              : t('voice.preview.ai')}
          </p>
        )}
      </div>
    </motion.li>
  )
})

// onSave(parsedItems) -> Promise<boolean[]> (บันทึกสำเร็จรายการไหนบ้าง ตามลำดับ)
// รายการที่บันทึกสำเร็จจะถูกลบออกจากช่องข้อความ ที่ไม่สำเร็จคงไว้ให้ลองใหม่
// exerciseHint: ท่าที่เลือกไว้ใน "ตารางฝึกวันนี้" พูดแค่ตัวเลข ("100 kg 8 reps") จะบันทึกเข้าท่านี้
// onClearHint(null): เลิกเลือกท่า
// embedded: แสดงเป็นส่วนหนึ่งของการ์ดอื่น (Workout Tracker) ไม่มีกรอบการ์ดและหัวข้อใหญ่ของตัวเอง
function VoiceRecorder({ onSave, exerciseHint = null, onClearHint, embedded = false }) {
  const { t } = useTranslation()
  const [isListening, setIsListening] = useState(false)
  // textarea เป็น uncontrolled: ข้อความที่กำลังพิมพ์อยู่ใน DOM เท่านั้น ไม่ setState ทุกตัวอักษร
  // React รู้ค่าใหม่เมื่อหยุดพิมพ์ครบ REPARSE_DELAY_MS (committedText) / ออกจากช่อง / มีเสียงเข้ามา
  const textareaRef = useRef(null)
  const debounceRef = useRef(0)
  const [committedText, setCommittedText] = useState('') // ข้อความที่แปลงไปแล้ว (preview อิงจากนี้)
  const [isDirty, setIsDirty] = useState(false) // พิมพ์แล้วแต่ยังไม่ครบ debounce
  const [hasText, setHasText] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [previews, setPreviews] = useState({}) // บรรทัด -> { status: 'loading' | 'ok' | 'unknown' | 'error', parsed }
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  // บรรทัดปัจจุบัน ใช้ทิ้งผล parse ที่กลับมาช้าของบรรทัดที่ถูกแก้/ลบไปแล้ว
  const currentLinesRef = useRef(new Set())
  const currentHintRef = useRef(exerciseHint)

  const readDraft = () => textareaRef.current?.value ?? ''

  // ให้ preview แปลงข้อความนี้ทันที
  const commit = useCallback((value) => {
    clearTimeout(debounceRef.current)
    setCommittedText(value)
    setIsDirty(false)
    setHasText(value.trim() !== '')
  }, [])

  // เปลี่ยนข้อความจากโค้ด (เสียง / ลบบรรทัด / ล้าง / หลังบันทึก)
  const setDraft = useCallback(
    (value) => {
      if (textareaRef.current) textareaRef.current.value = value
      commit(value)
    },
    [commit]
  )

  // พิมพ์: setState เฉพาะตอนค่า isDirty/hasText เปลี่ยน (ค่าเดิม React ข้ามการ render) แล้วรอ debounce
  const handleInput = (event) => {
    const value = event.target.value
    setIsDirty(true)
    setHasText(value.trim() !== '')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commit(value), REPARSE_DELAY_MS)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // ข้อความจากเสียง: ต่อเป็นบรรทัดใหม่ แล้วแปลงทันทีไม่ต้องรอ debounce
  const appendSegment = useCallback(
    (segment) => {
      const prev = textareaRef.current?.value ?? ''
      setDraft(prev.trim() ? `${prev.replace(/\s+$/, '')}\n${segment}` : segment)
    },
    [setDraft]
  )

  useEffect(() => {
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'th-TH'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText.trim()) appendSegment(finalText.trim())
      setInterimTranscript(interimText)
    }

    recognition.onerror = (event) => {
      setError(event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [appendSegment])

  // แปลงเฉพาะบรรทัดที่ยังไม่เคยแปลง (บรรทัดเดิมใช้ผลเดิม) ส่วนที่ error ไว้จะลองใหม่
  // เปลี่ยนท่าที่เลือกไว้ (exerciseHint) = แปลงใหม่ทุกบรรทัด เพราะบรรทัดที่พูดแค่ตัวเลขผูกกับท่านั้น
  // เก็บเฉพาะผลของบรรทัดที่ยังอยู่ (ไม่สะสม preview ของข้อความที่ถูกแก้ไปแล้วจนหน่วยความจำโต)
  useEffect(() => {
    const current = new Set(splitLines(committedText))
    currentLinesRef.current = current
    currentHintRef.current = exerciseHint
    const pending = [...current].filter(
      (line) => !previews[line] || previews[line].status === 'error' || previews[line].hint !== exerciseHint
    )

    setPreviews((prev) => {
      const next = {}
      for (const line of current) if (prev[line]) next[line] = prev[line]
      for (const line of pending) next[line] = { status: 'loading', hint: exerciseHint }
      return next
    })

    for (const line of pending) {
      parseCommand(line, exerciseHint)
        .then((parsed) => ({ status: 'ok', parsed, hint: exerciseHint }))
        .catch((err) => ({ status: err.status === 422 ? 'unknown' : 'error', hint: exerciseHint }))
        .then((preview) => {
          if (!currentLinesRef.current.has(line) || currentHintRef.current !== exerciseHint) return
          setPreviews((prev) => ({ ...prev, [line]: preview }))
        })
    }
    // previews ไม่อยู่ใน deps: ไม่ต้องแปลงใหม่เมื่อผลของบรรทัดอื่นกลับมา
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedText, exerciseHint])

  // คงที่ระหว่าง render -> MicButton (memo) ไม่ render ใหม่ตอนพิมพ์
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setError('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const undoLastLine = () => {
    const lines = readDraft().split('\n')
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.pop()
    setDraft(lines.join('\n'))
  }

  const clearAll = () => {
    setDraft('')
    setInterimTranscript('')
  }

  const lines = splitLines(committedText)
  const readyItems = lines.filter((line) => previews[line]?.status === 'ok')
  const isParsing = isDirty || lines.some((line) => previews[line]?.status === 'loading')
  const canSave = readyItems.length > 0 && !isParsing && !isSaving

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const results = await onSave(readyItems.map((line) => previews[line].parsed))
      const saved = new Set(readyItems.filter((_, i) => results[i]))
      // ลบเฉพาะบรรทัดที่บันทึกแล้ว
      setDraft(
        readDraft()
          .split('\n')
          .filter((line) => !saved.has(line.trim()))
          .join('\n')
          .trim()
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (event) => {
    // Ctrl/Cmd + Enter = บันทึก
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      // ยังพิมพ์ค้างอยู่: แปลงก่อน (กดอีกครั้งเพื่อบันทึกเมื่อ preview พร้อม)
      if (isDirty) commit(readDraft())
      else handleSave()
    }
  }

  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? 'relative' : 'glass-card relative overflow-hidden p-5 sm:p-6'}>
      {/* แสงพื้นหลังการ์ด เปลี่ยนสีตามสถานะ */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_65%)] transition-opacity duration-700 ${
          isListening ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.16),transparent_65%)] transition-opacity duration-700 ${
          isListening ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="relative mb-2 flex items-center justify-between gap-3">
        {embedded ? (
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <AudioLines className="h-4 w-4 text-emerald-300" aria-hidden />
            {t('voice.title')}
          </h3>
        ) : (
          <h2 className="card-title">
            <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <AudioLines className="h-4 w-4" aria-hidden />
            </span>
            {t('voice.title')}
          </h2>
        )}
        <StatusBadge isListening={isListening} isParsing={isParsing && lines.length > 0} readyCount={readyItems.length} />
      </div>

      {SpeechRecognition ? (
        <div className="relative flex flex-col items-center gap-2 py-2">
          <MicButton isListening={isListening} onClick={toggleListening} />
          <Waveform isListening={isListening} />
          <p className="text-xs font-medium text-slate-400">
            {isListening ? t('voice.listening') : t('voice.tapToStart')}
          </p>
        </div>
      ) : (
        <p className="relative mb-4 mt-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('voice.unsupported')}
        </p>
      )}

      <div className="relative mt-3">
        <AnimatePresence initial={false}>
          {exerciseHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2">
                <p className="min-w-0 text-sm text-emerald-100">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Crosshair className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <span className="truncate">{t('voice.hint.label', { name: exerciseHint })}</span>
                  </span>
                  <span className="text-[11px] text-emerald-200/70">{t('voice.hint.example')}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onClearHint?.(null)}
                  aria-label={t('voice.hint.clear')}
                  data-tooltip={t('voice.hint.clear')}
                  className="btn-icon shrink-0 p-1.5"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <label htmlFor="voice-transcript" className="text-xs font-medium text-slate-400">
            {t('voice.transcriptLabel')}
          </label>
          <span className="hidden shrink-0 text-[11px] text-slate-600 sm:inline">{t('voice.keyboardHint')}</span>
        </div>
        {/* field-sizing: ขยายความสูงตามข้อความเอง (ไม่ต้องคำนวณ rows ใน React ทุกตัวอักษร) */}
        <textarea
          id="voice-transcript"
          ref={textareaRef}
          defaultValue=""
          onInput={handleInput}
          onBlur={() => isDirty && commit(readDraft())}
          onKeyDown={handleKeyDown}
          placeholder={t('voice.placeholder')}
          rows={3}
          spellCheck={false}
          className="input-field max-h-60 min-h-[5.75rem] resize-none bg-black/20 font-medium leading-relaxed [field-sizing:content]"
        />
        <AnimatePresence>
          {interimTranscript && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1.5 truncate px-1 text-sm italic text-slate-500"
            >
              … {interimTranscript}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-2 flex justify-end gap-1">
          <button type="button" onClick={undoLastLine} disabled={!hasText} className="btn-icon">
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t('voice.undoLast')}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasText && !interimTranscript}
            className="btn-icon hover:!bg-red-500/10 hover:!text-red-300"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            {t('voice.clear')}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {lines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('voice.preview.title')}
            </p>
            <ul className="space-y-2">
              {lines.map((line, i) => (
                <PreviewCard key={`${i}-${line}`} line={line} preview={previews[line]} />
              ))}
            </ul>
            <motion.button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              whileTap={canSave ? { scale: 0.97 } : undefined}
              className="btn-accent mt-3 flex w-full items-center justify-center gap-2 text-sm"
            >
              <ButtonLabel loading={isSaving} loadingText={t('voice.saving')}>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" aria-hidden />
                  {t('voice.save', { count: readyItems.length })}
                </span>
              </ButtonLabel>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="relative mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('voice.error', { error })}
        </p>
      )}
    </Wrapper>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(VoiceRecorder)
