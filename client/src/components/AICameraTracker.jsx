import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Flame, Lightbulb, Play, RotateCcw, Save, Square, X } from 'lucide-react'
import { calculateCaloriesBurned } from '../utils/calories'
import { findExercise } from '../utils/exerciseCatalog'
import { loadPose } from '../utils/poseLoader'
import { speak } from '../utils/speech'
import { createSquatTracker } from '../utils/squatTracker'
import Spinner, { ButtonLabel } from './Spinner'

const EXERCISE = findExercise('Bodyweight Squat')
const SKELETON_COLORS = { ok: '#34d399', warn: '#fbbf24', bad: '#ef4444' }
// คู่ landmark ของลำตัว แขน และขา (ไม่วาดใบหน้า)
const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
]
const JOINTS = [...new Set(BONES.flat())]
const MIN_DRAW_VISIBILITY = 0.4
const EMPTY_VIEW = { reps: 0, correct: 0, incorrect: 0, issue: null, tracking: false, phase: 'waiting', lastRep: null }

const severityOf = (issue) => (issue === 'almost' ? 'warn' : issue ? 'bad' : 'ok')

function drawSkeleton(context, landmarks, color) {
  const { width, height } = context.canvas
  const visible = (index) => (landmarks[index]?.visibility ?? 0) >= MIN_DRAW_VISIBILITY
  context.lineCap = 'round'
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = Math.max(3, width / 160)
  for (const [from, to] of BONES) {
    if (!visible(from) || !visible(to)) continue
    context.beginPath()
    context.moveTo(landmarks[from].x * width, landmarks[from].y * height)
    context.lineTo(landmarks[to].x * width, landmarks[to].y * height)
    context.stroke()
  }
  for (const index of JOINTS) {
    if (!visible(index)) continue
    context.beginPath()
    context.arc(landmarks[index].x * width, landmarks[index].y * height, Math.max(4, width / 120), 0, Math.PI * 2)
    context.fill()
  }
}

const ERROR_KEYS = {
  NotAllowedError: 'camera.errors.denied',
  NotFoundError: 'camera.errors.noCamera',
  NotReadableError: 'camera.errors.busy',
  InsecureContext: 'camera.errors.insecure',
}

const LAST_FAULT_KEYS = { almost: 'camera.feedback.lastAlmost', depth: 'camera.feedback.lastDepth', back: 'camera.feedback.lastBack' }

// ข้อความแนะนำสด (เรียงตามความสำคัญ) -> { text, tone: 'good' | 'warn' | 'bad' | 'info' } หรือ null
function liveFeedback(view, t) {
  if (!view.tracking) return null
  if (view.issue === 'back') return { text: t('camera.feedback.back'), tone: 'bad' }
  if (view.issue) return { text: t(`camera.feedback.${view.issue}`), tone: 'warn' }
  if (view.phase === 'down') return { text: t('camera.feedback.deep'), tone: 'good' }
  // ผลของรอบล่าสุดค้างไว้จนเริ่มย่อรอบใหม่
  if (view.lastRep && view.phase === 'up') {
    if (view.lastRep.correct) return { text: t('camera.feedback.great'), tone: 'good' }
    const fault = view.lastRep.faults[0]
    return { text: t(LAST_FAULT_KEYS[fault], { n: view.lastRep.number, angle: view.lastRep.lowest }), tone: 'bad' }
  }
  return null
}

const FEEDBACK_TONES = {
  good: 'bg-emerald-600/90',
  warn: 'bg-amber-600/90',
  bad: 'bg-red-600/90',
}

// กล่องตัวนับบนวิดีโอ: 🟢 ทำถูกต้อง / 🔴 ฟอร์มตก/ทำผิด
function Counter({ tone, label, count, unit }) {
  const styles =
    tone === 'good' ? 'border-emerald-400/50 bg-emerald-950/75 text-emerald-200' : 'border-red-400/50 bg-red-950/75 text-red-200'
  return (
    <div className={`rounded-xl border px-3 py-1.5 backdrop-blur-sm ${styles}`}>
      <p className="text-[11px] font-semibold sm:text-xs">{label}</p>
      <p className="text-xl font-black tabular-nums text-white sm:text-2xl">
        <span key={count} className="inline-block animate-toast-in">
          {count}
        </span>{' '}
        <span className="text-xs font-semibold text-white/70">{unit}</span>
      </p>
    </div>
  )
}

// การ์ดสรุปหลังกดหยุด: จำนวนทั้งหมด อัตราความถูกต้อง ผลแต่ละครั้ง และข้อแนะนำปรับปรุงฟอร์ม
function SummaryCard({ summary, calories, saving, onSave, onResume, onRestart }) {
  const { t } = useTranslation()
  const { total, correct, incorrect, accuracy, faultCounts, history } = summary
  const tips = []
  if (!total) tips.push(t('camera.result.tips.none'))
  else {
    // ปัญหาที่เกิดบ่อยก่อน
    const faults = Object.entries(faultCounts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])
    for (const [group, count] of faults) tips.push(t(`camera.result.tips.${group}`, { count }))
    if (!faults.length) tips.push(t('camera.result.tips.great'))
  }
  const accuracyTone = accuracy >= 80 ? 'text-emerald-300' : accuracy >= 50 ? 'text-amber-300' : 'text-red-300'
  const ringColor = accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-obsidian/95 p-4 backdrop-blur-sm sm:p-6">
      <div role="region" aria-labelledby="camera-summary-title" className="mx-auto max-w-lg animate-toast-in">
        <h3 id="camera-summary-title" className="text-lg font-bold text-white">
          {t('camera.result.title')}
        </h3>
        <p className="text-xs text-slate-400">{t('camera.result.subtitle')}</p>

        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4">
          {/* วงแหวนอัตราความถูกต้อง */}
          <div
            className="relative grid h-28 w-28 place-items-center rounded-full"
            style={{ background: `conic-gradient(${ringColor} ${accuracy * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
            role="img"
            aria-label={`${t('camera.result.accuracy')} ${accuracy}%`}
          >
            <div className="grid h-[5.6rem] w-[5.6rem] place-items-center rounded-full bg-obsidian-raised text-center">
              <div>
                <p className={`text-2xl font-black tabular-nums ${accuracyTone}`}>{accuracy}%</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t('camera.result.accuracy')}</p>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="glass-panel px-2 py-2.5">
              <dt className="text-[11px] text-slate-400">{t('camera.result.total')}</dt>
              <dd className="text-2xl font-bold tabular-nums text-white">{total}</dd>
            </div>
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-2.5">
              <dt className="text-[11px] text-emerald-300">🟢 {t('camera.result.correct')}</dt>
              <dd className="text-2xl font-bold tabular-nums text-emerald-200">{correct}</dd>
            </div>
            <div className="rounded-xl border border-red-400/25 bg-red-500/[0.07] px-2 py-2.5">
              <dt className="text-[11px] text-red-300">🔴 {t('camera.result.incorrect')}</dt>
              <dd className="text-2xl font-bold tabular-nums text-red-200">{incorrect}</dd>
            </div>
          </dl>
        </div>

        {history.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-slate-300">{t('camera.result.timeline')}</p>
            <ol className="flex flex-wrap gap-1">
              {history.map((rep) => (
                <li
                  key={rep.number}
                  title={t('camera.result.repLabel', {
                    n: rep.number,
                    result: t(rep.correct ? 'camera.result.resultCorrect' : 'camera.result.resultIncorrect'),
                  })}
                  className={`grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold tabular-nums ${
                    rep.correct ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'
                  }`}
                >
                  <span className="sr-only">
                    {t('camera.result.repLabel', {
                      n: rep.number,
                      result: t(rep.correct ? 'camera.result.resultCorrect' : 'camera.result.resultIncorrect'),
                    })}
                  </span>
                  <span aria-hidden>{rep.number}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Lightbulb className="h-4 w-4" aria-hidden />
            {t('camera.result.tipsTitle')}
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-slate-200">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-2">
          <button type="button" onClick={onSave} disabled={!total || saving} className="btn-accent flex w-full items-center justify-center gap-2">
            <ButtonLabel loading={saving} loadingText={t('workout.saving')}>
              <Save className="h-4 w-4" aria-hidden />
              {t('camera.result.save', { reps: total, count: total })}
              {total > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium opacity-80">
                  · <Flame className="h-3.5 w-3.5" aria-hidden /> {calories} kcal
                </span>
              )}
            </ButtonLabel>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onResume} className="btn-ghost flex items-center justify-center gap-1.5 text-sm">
              <Play className="h-4 w-4" aria-hidden />
              {t('camera.result.resume')}
            </button>
            <button type="button" onClick={onRestart} className="btn-ghost flex items-center justify-center gap-1.5 text-sm">
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t('camera.result.restart')}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">{t('camera.result.saveNote')}</p>
        </div>
      </div>
    </div>
  )
}

// กล้อง AI นับ Squat + ตรวจฟอร์มแบบ real-time: แยกนับ "ทำถูกต้อง" กับ "ทำผิดท่า" ทุกครั้งที่ยืนขึ้นครบรอบ
// วิดีโอประมวลผลในเครื่องทั้งหมด ไม่มีการอัปโหลด
// onSave(entry) คืน Promise<boolean> เหมือน WorkoutTracker (บันทึกลง workout_logs และอัปเดต Dashboard)
export default function AICameraTracker({ bodyWeightKg, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const angleRef = useRef(null)
  const trackerRef = useRef(createSquatTracker())
  const pausedRef = useRef(false) // เปิดการ์ดสรุปอยู่ = ไม่นับเพิ่ม (กล้องยังเปิดไว้ เล่นต่อได้ทันที)
  const [status, setStatus] = useState('loading') // 'loading' | 'running' | 'error'
  const [errorKey, setErrorKey] = useState(null)
  const [view, setView] = useState(EMPTY_VIEW)
  const [summary, setSummary] = useState(null)
  const [saving, setSaving] = useState(false)

  const language = i18n.resolvedLanguage
  const voiceRef = useRef({ t, language })
  useEffect(() => {
    voiceRef.current = { t, language }
  }, [t, language])

  const handleResults = useCallback((results) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = results.poseLandmarks
    if (pausedRef.current) {
      if (landmarks) drawSkeleton(context, landmarks, SKELETON_COLORS.ok)
      return
    }
    const next = trackerRef.current.update(landmarks, video.videoWidth / video.videoHeight)
    if (landmarks) drawSkeleton(context, landmarks, SKELETON_COLORS[severityOf(next.issue)])
    // มุมเปลี่ยนทุกเฟรม เขียนลง DOM ตรง ๆ ไม่ให้ React render ใหม่ 30 ครั้งต่อวินาที
    if (angleRef.current) angleRef.current.textContent = next.tracking && next.angle != null ? `${Math.round(next.angle)}°` : '--'

    setView((prev) => {
      if (
        prev.reps === next.reps &&
        prev.issue === next.issue &&
        prev.tracking === next.tracking &&
        prev.phase === next.phase &&
        prev.lastRep === next.lastRep
      ) {
        return prev
      }
      const { reps, correct, incorrect, issue, tracking, phase, lastRep } = next
      return { reps, correct, incorrect, issue, tracking, phase, lastRep }
    })
  }, [])

  // เสียง: ทำถูก = ขานเลข ; ทำผิด = "ครั้งที่ N ฟอร์มยังไม่ถูก" (สาเหตุเตือนไปแล้วตอนย่อ) ; ปัญหาใหม่ระหว่างย่อ = เตือน
  const spokenRef = useRef({ reps: 0, issue: null })
  useEffect(() => {
    const { t: translate, language: voice } = voiceRef.current
    if (view.reps > spokenRef.current.reps && view.lastRep) {
      speak(view.lastRep.correct ? String(view.lastRep.number) : translate('camera.voice.badRep', { n: view.lastRep.number }), voice)
    } else if (view.issue && view.issue !== spokenRef.current.issue) {
      speak(translate(`camera.warnings.${view.issue}`), voice)
    }
    spokenRef.current = { reps: view.reps, issue: view.issue }
  }, [view.reps, view.issue, view.lastRep])

  useEffect(() => {
    let stopped = false
    let stream = null
    let frame = null
    let activePose = null

    const fail = (error) => {
      if (stopped) return
      console.error('AI camera failed', error)
      setErrorKey(ERROR_KEYS[error?.name] ?? 'camera.errors.failed')
      setStatus('error')
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (stopped) return
        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        activePose = await loadPose()
        if (stopped) return
        activePose.onResults(handleResults)
        setStatus('running')

        // ส่งเฟรมถัดไปเมื่อเฟรมก่อนประมวลผลเสร็จ เครื่องช้าจะข้ามเฟรมแทนการสะสมคิว
        const tick = async () => {
          if (stopped) return
          try {
            if (video.readyState >= 2) await activePose.send({ image: video })
          } catch (error) {
            fail(error)
            return
          }
          if (!stopped) frame = requestAnimationFrame(tick)
        }
        tick()
      } catch (error) {
        fail(error)
      }
    }
    start()

    return () => {
      stopped = true
      if (frame) cancelAnimationFrame(frame)
      activePose?.onResults(() => {})
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [handleResults])

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const calories = calculateCaloriesBurned({ category: EXERCISE.category, met: EXERCISE.met, sets: 1 }, bodyWeightKg)

  const restart = () => {
    trackerRef.current = createSquatTracker()
    pausedRef.current = false
    spokenRef.current = { reps: 0, issue: null }
    setView(EMPTY_VIEW)
    setSummary(null)
  }

  const stop = () => {
    pausedRef.current = true
    setSummary(trackerRef.current.summary())
  }

  const resume = () => {
    pausedRef.current = false
    setSummary(null)
  }

  const handleSave = async () => {
    if (!summary?.total || saving) return
    setSaving(true)
    try {
      const saved = await onSave({
        exercise_name: EXERCISE.name,
        activity_type: EXERCISE.category,
        sets: 1,
        reps: summary.total,
        weight_kg: null,
        calories_burned: calories,
      })
      if (saved) onClose()
    } finally {
      setSaving(false)
    }
  }

  const feedback = liveFeedback(view, t)
  const hint = !view.tracking ? 'camera.hints.noBody' : view.phase === 'waiting' ? 'camera.hints.standUp' : 'camera.hints.ready'
  const lastTone = view.lastRep ? (view.lastRep.correct ? 'text-emerald-300' : 'text-red-400') : 'text-white/90'
  const unit = (count) => t('camera.counters.unit', { count })

  // portal: การ์ดแม่มี overflow และ animation transform ซึ่งจะครอบ position: fixed ของ modal
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('camera.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 sm:p-6">
      <div className="glass-card flex h-full w-full max-w-3xl flex-col overflow-hidden bg-obsidian-raised sm:h-auto sm:max-h-full">
        <header className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white">{t('camera.title')}</h2>
            <p className="truncate text-xs text-slate-400">{t('camera.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('camera.close')} className="btn-icon">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-black sm:aspect-[4/3] sm:flex-none">
          {/* กล้องหน้าแสดงแบบกระจก: พลิกทั้งวิดีโอและ canvas ส่วนตัวเลข/ข้อความอยู่นอกชั้นที่พลิก */}
          <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />

          {status === 'running' && !summary && (
            <>
              {/* จำนวนครั้งทั้งหมด: สีตามผลของครั้งล่าสุด */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  key={view.reps}
                  aria-label={t('camera.repsLabel', { count: view.reps })}
                  className={`animate-toast-in text-8xl font-black tabular-nums [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-9xl ${lastTone}`}
                >
                  {view.reps}
                </span>
              </div>

              {/* ตัวนับแยก 2 ช่อง */}
              <div className="absolute left-3 top-3 flex flex-col gap-1.5 sm:flex-row" aria-live="polite">
                <Counter tone="good" label={`🟢 ${t('camera.counters.correct')}`} count={view.correct} unit={unit(view.correct)} />
                <Counter tone="bad" label={`🔴 ${t('camera.counters.incorrect')}`} count={view.incorrect} unit={unit(view.incorrect)} />
              </div>

              <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-sm font-semibold tabular-nums text-emerald-300">
                {t('camera.knee')} <span ref={angleRef}>--</span>
              </span>

              {/* ข้อความแนะนำฟอร์มสด */}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                {feedback ? (
                  <p
                    key={feedback.text}
                    role="status"
                    className={`animate-toast-in rounded-xl px-4 py-2 text-center text-base font-bold text-white shadow-lg sm:text-lg ${FEEDBACK_TONES[feedback.tone]}`}
                  >
                    {feedback.text}
                  </p>
                ) : (
                  <p className="rounded-xl bg-black/60 px-3 py-1.5 text-center text-sm text-slate-200">{t(hint)}</p>
                )}
              </div>
            </>
          )}

          {summary && (
            <SummaryCard
              summary={summary}
              calories={calories}
              saving={saving}
              onSave={handleSave}
              onResume={resume}
              onRestart={restart}
            />
          )}

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-slate-300">
              <Spinner className="h-8 w-8" />
              {t('camera.loading')}
            </div>
          )}

          {status === 'error' && (
            <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-300">
              {t(errorKey)}
            </p>
          )}
        </div>

        {!summary && (
          <footer className="space-y-2.5 p-4">
            <div className="flex items-center gap-2">
              <span className="flex flex-1 items-center gap-1.5 text-sm text-slate-300">
                <Flame className="h-4 w-4 text-orange-400" aria-hidden />
                {t('camera.summary', { reps: view.reps, kcal: view.reps ? calories : 0 })}
              </span>
              <button type="button" onClick={restart} disabled={!view.reps} className="btn-icon">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t('camera.reset')}
              </button>
            </div>
            <button
              type="button"
              onClick={stop}
              disabled={status !== 'running'}
              className="btn-accent flex w-full items-center justify-center gap-2"
            >
              <Square className="h-4 w-4 fill-current" aria-hidden />
              {t('camera.stop')}
            </button>
            <p className="text-center text-[11px] text-slate-500">{t('camera.privacy')}</p>
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}
