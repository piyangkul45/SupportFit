import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Play } from 'lucide-react'
import useFrameAnimation from '../hooks/useFrameAnimation'
import ExerciseBadges from './ExerciseBadges'
import { MuscleIcon } from './MuscleTargetCard'
import { TARGET_RED } from './MuscleCategorySelector'

const TOUCH_PLAY_MS = 2500

// การ์ดท่าฝึกใน Exercise Library: ภาพพรีวิวท่า (เฟรมแรก) ; ชี้เมาส์ / แตะบนมือถือ / โฟกัสด้วยคีย์บอร์ด = เล่นภาพเคลื่อนไหว
// ไม่มีภาพสาธิต (media = null หรือโหลดภาพไม่ได้) -> แสดงรูป Anatomy ด้านหน้า/หลังที่กล้ามเนื้อเป้าหมายเป็นสีแดงแทน
// กดการ์ด = onOpen(exercise) เปิดป๊อปอัปรายละเอียด
export default memo(function ExerciseCard({ exercise, anatomy, media, active, categoryNote, onOpen }) {
  const { t } = useTranslation()
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const [warm, setWarm] = useState(false) // เฟรมที่ 2 โหลดเมื่อเริ่มเล่นครั้งแรก (ประหยัดเน็ตตอนเลื่อนดูรายการ)
  const touchTimer = useRef(null)
  const frames = media && !broken ? media.frames : null
  const frame = useFrameAnimation(frames?.length || 0, playing)

  useEffect(() => () => clearTimeout(touchTimer.current), [])

  const start = () => {
    setWarm(true)
    setPlaying(true)
  }
  const stop = () => setPlaying(false)
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse') return
    clearTimeout(touchTimer.current)
    start()
    touchTimer.current = setTimeout(stop, TOUCH_PLAY_MS)
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(exercise)}
      onPointerEnter={(event) => event.pointerType === 'mouse' && start()}
      onPointerLeave={(event) => event.pointerType === 'mouse' && stop()}
      onPointerDown={onPointerDown}
      onFocus={start}
      onBlur={stop}
      aria-pressed={active}
      aria-haspopup="dialog"
      className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_20px_-8px_rgba(16,185,129,0.9)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.9)]'
      }`}
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-white">
        {frames ? (
          frames.slice(0, warm ? frames.length : 1).map((src, index) => (
            <img
              key={src}
              src={src}
              alt={index === 0 ? t('exerciseLibrary.previewAlt', { name: exercise.name }) : ''}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setBroken(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.04] ${
                frame === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))
        ) : (
          <span className="absolute inset-0 flex items-center justify-center gap-1 bg-[radial-gradient(circle_at_50%_40%,#2a1216,#0d0a0b)]">
            {anatomy &&
              ['front', 'back'].map((view) => (
                <MuscleIcon
                  key={view}
                  primary={anatomy.primary}
                  secondary={anatomy.secondary}
                  view={view}
                  primaryFill={TARGET_RED}
                  pulse={playing}
                  className="h-[82%] w-auto"
                />
              ))}
          </span>
        )}

        {/* มุมซ้ายบน: ไอคอนกล้ามเนื้อเป้าหมาย ; มุมขวาล่าง: ปุ่มเล่น (ซ่อนขณะเล่น) */}
        {frames && anatomy && (
          <span className="absolute left-1.5 top-1.5 flex h-10 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm">
            <MuscleIcon primary={anatomy.primary} secondary={anatomy.secondary} primaryFill={TARGET_RED} pulse={playing} className="h-9 w-[18px]" />
          </span>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        {frames && (
          <span
            className={`absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm transition-opacity duration-200 ${
              playing ? 'opacity-0' : 'opacity-100'
            }`}
            aria-hidden
          >
            <Play className="h-2.5 w-2.5 fill-current" />
            {t('exerciseLibrary.gif')}
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <span className={`truncate text-xs font-semibold ${active ? 'text-emerald-200' : 'text-slate-100'}`}>{exercise.name}</span>
        {categoryNote && <span className="-mt-1 truncate text-[10px] text-slate-500">{categoryNote}</span>}
        <ExerciseBadges anatomy={anatomy} />
      </span>
    </button>
  )
})
