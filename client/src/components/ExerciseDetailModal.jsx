import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check, Footprints, Pause, Play, TriangleAlert, Wind, X } from 'lucide-react'
import { getAnatomy } from '../utils/exerciseAnatomy'
import { GUIDE_KEYS, MEDIA_SOURCE, getExerciseMedia, getGuidePattern } from '../utils/exerciseMedia'
import ExerciseBadges from './ExerciseBadges'
import { prefersReducedMotion } from '../utils/motion'
import ExerciseVideo from './ExerciseVideo'
import { MuscleIcon } from './MuscleTargetCard'

const TIP_STYLES = {
  stance: { Icon: Footprints, tone: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300' },
  breathing: { Icon: Wind, tone: 'border-sky-400/20 bg-sky-400/[0.06] text-sky-300' },
  caution: { Icon: TriangleAlert, tone: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300' },
}

function MuscleChips({ muscles, tone }) {
  const { t } = useTranslation()
  const styles =
    tone === 'primary' ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-red-300/15 bg-red-300/[0.05] text-red-100/75'
  return muscles.map((muscle) => (
    <li key={muscle} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'primary' ? 'bg-red-500' : 'bg-red-300/50'}`} aria-hidden />
      {t(`anatomy.muscles.${muscle}`)}
    </li>
  ))
}

// ป๊อปอัปรายละเอียดท่า: วิดีโอ Anatomy ขนาดใหญ่ (เล่นทันทีเมื่อเปิด หยุดเมื่อปิด) + รูป Anatomy ที่กล้ามเนื้อเป้าหมายเต้นเป็นสีแดง
// + คำแนะนำมือใหม่ 3 ข้อ (การวางเท้า / การหายใจ / ข้อควรระวัง) ; onSelect(exercise) = เลือกท่านี้ไปกรอกเซต/ครั้ง
export default function ExerciseDetailModal({ exercise, categoryLabel, onSelect, onClose }) {
  const { t } = useTranslation()
  const anatomy = getAnatomy(exercise.name)
  const media = getExerciseMedia(exercise.name)
  const pattern = getGuidePattern(exercise.name)
  const [autoPlay] = useState(() => !prefersReducedMotion())
  const [playing, setPlaying] = useState(false) // สถานะจริงจาก event play/pause ของวิดีโอ
  const videoRef = useRef(null)
  const closeRef = useRef(null)

  // ปิด Modal = หยุดวิดีโอทันที (ไม่รอให้อนิเมชันปิดจบ)
  const close = useCallback(() => {
    videoRef.current?.pause()
    onClose()
  }, [onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [close])

  // เปิด Modal = เริ่มเล่นทันที (สำรอง autoPlay ที่บางเบราว์เซอร์ข้าม) ; unmount = หยุดและคืนทรัพยากร
  useEffect(() => {
    const video = videoRef.current
    if (video && autoPlay) video.play().catch(() => {})
    return () => video?.pause()
  }, [autoPlay])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  const anatomyFigure = anatomy && (
    <figure className="flex items-end justify-center gap-2" aria-label={t('exerciseLibrary.targetFigure')}>
      {['front', 'back'].map((view) => (
        <div key={view} className="flex flex-col items-center gap-1">
          <MuscleIcon
            primary={anatomy.primary}
            secondary={anatomy.secondary}
            view={view}
            tone="anatomy"
            pulse={playing || !media}
            className="h-32 w-16 sm:h-40 sm:w-20"
          />
          <figcaption className="text-[9px] uppercase tracking-wider text-slate-500">{t(`anatomy.views.${view}`)}</figcaption>
        </div>
      ))}
    </figure>
  )

  // portal ไปที่ body: การ์ดแม่มี transform/overflow-hidden ซึ่งทำให้ position: fixed ไม่เต็มจอ
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-detail-title"
        className="glass-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none bg-obsidian-raised/95 sm:rounded-b-2xl"
      >
        {/* หัว */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h3 id="exercise-detail-title" className="truncate text-lg font-bold tracking-tight text-white">
              {exercise.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">{categoryLabel}</span>
              <ExerciseBadges anatomy={anatomy} />
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t('exerciseLibrary.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-4">
          {/* ภาพสาธิตเคลื่อนไหว + Anatomy */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.07] bg-[radial-gradient(circle_at_50%_45%,rgba(239,68,68,0.14),rgba(255,255,255,0.02)_65%)] sm:aspect-[5/4]">
              {media ? (
                <>
                  <ExerciseVideo
                    ref={videoRef}
                    media={media}
                    autoPlay={autoPlay}
                    label={t('exerciseLibrary.demoAlt', { name: exercise.name })}
                    onPlayingChange={setPlaying}
                    className="absolute inset-0 h-full w-full object-contain p-1 pb-9"
                  />
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={t(playing ? 'exerciseLibrary.pause' : 'exerciseLibrary.play')}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                  >
                    {playing ? <Pause className="h-3 w-3 fill-current" aria-hidden /> : <Play className="h-3 w-3 fill-current" aria-hidden />}
                    {t(playing ? 'exerciseLibrary.pauseShort' : 'exerciseLibrary.playShort')}
                  </button>
                  {/* Anatomy ซ้อนมุมขวาบนบนมือถือ (จอใหญ่แสดงคอลัมน์ข้าง ๆ) */}
                  {anatomy && (
                    <span className="absolute right-2 top-2 flex rounded-lg bg-black/45 p-1 backdrop-blur-[2px] sm:hidden">
                      <MuscleIcon primary={anatomy.primary} secondary={anatomy.secondary} tone="anatomy" pulse={playing} className="h-20 w-10" />
                    </span>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {anatomyFigure}
                  <p className="px-4 text-center text-[11px] text-slate-500">{t('exerciseLibrary.noDemo')}</p>
                </div>
              )}
            </div>
            {media && anatomy && (
              <div className="hidden flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-[radial-gradient(circle_at_50%_45%,rgba(239,68,68,0.12),rgba(255,255,255,0.02)_70%)] px-4 py-3 sm:flex">
                {anatomyFigure}
              </div>
            )}
          </div>

          {/* กล้ามเนื้อเป้าหมาย */}
          {anatomy && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-red-300">{t('exerciseLibrary.target')}</span>
              <ul className="flex flex-wrap gap-1.5">
                <MuscleChips muscles={anatomy.primary} tone="primary" />
              </ul>
              {anatomy.secondary.length > 0 && (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-red-200/60">{t('exerciseLibrary.secondary')}</span>
                  <ul className="flex flex-wrap gap-1.5">
                    <MuscleChips muscles={anatomy.secondary} tone="secondary" />
                  </ul>
                </>
              )}
            </div>
          )}

          {/* คำแนะนำมือใหม่ 3 ข้อ */}
          <h4 className="mb-2 mt-5 text-sm font-semibold text-white">{t('exerciseLibrary.beginnerTips')}</h4>
          <ol className="grid gap-2 sm:grid-cols-3">
            {GUIDE_KEYS.map((key, index) => {
              const { Icon, tone } = TIP_STYLES[key]
              return (
                <motion.li
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.07 }}
                  className={`rounded-xl border p-3 ${tone}`}
                >
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {t(`exerciseLibrary.tipLabels.${key}`)}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{t(`exerciseLibrary.tips.${pattern}.${key}`)}</p>
                </motion.li>
              )
            })}
          </ol>

          {media && (
            <p className="mt-3 text-[10px] text-slate-600">
              {t('exerciseLibrary.credit')}{' '}
              <a href={MEDIA_SOURCE.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-400">
                {MEDIA_SOURCE.name}
              </a>{' '}({MEDIA_SOURCE.license})
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={close} className="btn-ghost flex-1">
              {t('exerciseLibrary.close')}
            </button>
            <button
              type="button"
              onClick={() => {
                videoRef.current?.pause()
                onSelect(exercise)
              }}
              className="btn-accent flex flex-[2] items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" aria-hidden />
              {t('exerciseLibrary.select')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
