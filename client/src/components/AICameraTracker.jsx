import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Flame, RotateCcw, Save, X } from 'lucide-react'
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

// กล้อง AI นับ Squat: วิดีโอประมวลผลในเครื่องทั้งหมด ไม่มีการอัปโหลด
// onSave(entry) คืน Promise<boolean> เหมือน WorkoutTracker (บันทึกลง workout_logs และอัปเดต Dashboard)
export default function AICameraTracker({ bodyWeightKg, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const angleRef = useRef(null)
  const trackerRef = useRef(createSquatTracker())
  const repOffsetRef = useRef(0) // "เริ่มนับใหม่" = หักจำนวนที่นับไปแล้ว
  const [status, setStatus] = useState('loading') // 'loading' | 'running' | 'error'
  const [errorKey, setErrorKey] = useState(null)
  const [view, setView] = useState({ reps: 0, issue: null, tracking: false, phase: 'waiting' })
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
    const next = trackerRef.current.update(landmarks, video.videoWidth / video.videoHeight)
    if (landmarks) drawSkeleton(context, landmarks, SKELETON_COLORS[severityOf(next.issue)])
    // มุมเปลี่ยนทุกเฟรม เขียนลง DOM ตรง ๆ ไม่ให้ React render ใหม่ 30 ครั้งต่อวินาที
    if (angleRef.current) angleRef.current.textContent = next.tracking && next.angle != null ? `${Math.round(next.angle)}°` : '--'

    const reps = next.reps - repOffsetRef.current
    setView((prev) => {
      if (prev.reps === reps && prev.issue === next.issue && prev.tracking === next.tracking && prev.phase === next.phase) return prev
      return { reps, issue: next.issue, tracking: next.tracking, phase: next.phase }
    })
  }, [])

  // ขานเลขเมื่อนับเพิ่ม เตือนด้วยเสียงเมื่อเกิดปัญหาใหม่ (speak ตัดเสียงก่อนหน้าเอง เลขจึงไม่ค้างคิว)
  const spokenRef = useRef({ reps: 0, issue: null })
  useEffect(() => {
    const { t: translate, language: voice } = voiceRef.current
    if (view.reps > spokenRef.current.reps) speak(String(view.reps), voice)
    else if (view.issue && view.issue !== spokenRef.current.issue) speak(translate(`camera.warnings.${view.issue}`), voice)
    spokenRef.current = { reps: view.reps, issue: view.issue }
  }, [view.reps, view.issue])

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

  const resetCount = () => {
    repOffsetRef.current += view.reps
    spokenRef.current = { reps: 0, issue: null }
    setView((prev) => ({ ...prev, reps: 0 }))
  }

  const handleSave = async () => {
    if (!view.reps || saving) return
    setSaving(true)
    try {
      const saved = await onSave({
        exercise_name: EXERCISE.name,
        activity_type: EXERCISE.category,
        sets: 1,
        reps: view.reps,
        weight_kg: null,
        calories_burned: calories,
      })
      if (saved) onClose()
    } finally {
      setSaving(false)
    }
  }

  const severity = severityOf(view.issue)
  const hint = !view.tracking ? 'camera.hints.noBody' : view.phase === 'waiting' ? 'camera.hints.standUp' : 'camera.hints.ready'

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

          {status === 'running' && (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  key={view.reps}
                  aria-live="polite"
                  aria-label={t('camera.repsLabel', { count: view.reps })}
                  className="animate-toast-in text-8xl font-black tabular-nums text-white/90 [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-9xl"
                >
                  {view.reps}
                </span>
              </div>

              <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-sm font-semibold tabular-nums text-emerald-300">
                {t('camera.knee')} <span ref={angleRef}>--</span>
              </span>

              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                {view.issue ? (
                  <p
                    role="alert"
                    className={`rounded-xl px-4 py-2 text-lg font-bold text-white ${severity === 'warn' ? 'bg-amber-600/90' : 'bg-red-600/90'}`}
                  >
                    {t(`camera.warnings.${view.issue}`)}
                  </p>
                ) : (
                  <p className="rounded-xl bg-black/60 px-3 py-1.5 text-center text-sm text-slate-200">{t(hint)}</p>
                )}
              </div>
            </>
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

        <footer className="space-y-2.5 p-4">
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center gap-1.5 text-sm text-slate-300">
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
              {t('camera.summary', { reps: view.reps, kcal: view.reps ? calories : 0 })}
            </span>
            <button type="button" onClick={resetCount} disabled={!view.reps} className="btn-icon">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('camera.reset')}
            </button>
          </div>
          <button type="button" onClick={handleSave} disabled={!view.reps || saving} className="btn-accent flex w-full items-center justify-center gap-2">
            <ButtonLabel loading={saving} loadingText={t('workout.saving')}>
              <Save className="h-4 w-4" aria-hidden />
              {t('camera.save')}
            </ButtonLabel>
          </button>
          <p className="text-center text-[11px] text-slate-500">{t('camera.privacy')}</p>
        </footer>
      </div>
    </div>,
    document.body
  )
}
