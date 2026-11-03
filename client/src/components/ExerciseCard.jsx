import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Play } from 'lucide-react'
import ExerciseBadges from './ExerciseBadges'
import { prefersReducedMotion } from '../utils/motion'
import ExerciseVideo from './ExerciseVideo'
import { MuscleIcon } from './MuscleTargetCard'

const TOUCH_PLAY_MS = 2500

// การ์ดท่าฝึกใน Exercise Library: วิดีโอ Anatomy ของท่า (แสดง poster นิ่งไว้ก่อน ไม่เล่นอัตโนมัติ)
// ชี้เมาส์ / แตะบนมือถือ / โฟกัสด้วยคีย์บอร์ด = video.play() ; เลื่อนออก / ครบเวลาหลังแตะ = video.pause() (ประหยัด GPU มือถือ)
// ไม่มีวิดีโอ (media = null) -> Silhouette Anatomy โปร่ง ขาว-เทา ที่กล้ามเนื้อเป้าหมายเป็นสีแดงแทน
// กดการ์ด = onOpen(exercise) เปิดป๊อปอัปรายละเอียด
export default memo(function ExerciseCard({ exercise, anatomy, media, active, categoryNote, onOpen }) {
  const { t } = useTranslation()
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false) // การ์ดที่ไม่มีวิดีโอ: ให้กล้ามเนื้อสีแดงเต้นแทน
  const videoRef = useRef(null)
  const touchTimer = useRef(null)

  useEffect(() => () => clearTimeout(touchTimer.current), [])

  const start = () => {
    setHovered(true)
    const video = videoRef.current
    if (!video || prefersReducedMotion()) return
    // play() คืน Promise ที่ reject ได้ (เช่น ถูก pause ก่อนโหลดเสร็จ) ไม่ใช่ error จริง
    video.play().catch(() => {})
  }
  const stop = () => {
    setHovered(false)
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0 // กลับท่าเริ่ม ให้ตรงกับ poster
  }
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
      {/* ภาพแนวตั้ง 3:4 กลืนกับพื้นเข้มของเว็บ มีแสงแดงจาง ๆ ด้านหลังร่าง
          พื้นทึบ #1d1f26 (= สีการ์ดที่เห็นจริง) จำเป็น: ตอน hover การ์ดมี transform ทำให้ mix-blend-mode: screen
          ผสมได้แค่กับสิ่งที่อยู่ในการ์ด ถ้าพื้นโปร่งจะเห็นกรอบดำของวิดีโอ */}
      <span className="relative block aspect-[3/4] w-full overflow-hidden bg-[#1d1f26] bg-[radial-gradient(circle_at_50%_42%,rgba(239,68,68,0.13),transparent_62%)]">
        {media ? (
          <ExerciseVideo
            ref={videoRef}
            media={media}
            label={t('exerciseLibrary.previewAlt', { name: exercise.name })}
            onPlayingChange={setPlaying}
            className="absolute inset-x-1 bottom-6 h-[calc(100%-1.75rem)] w-[calc(100%-0.5rem)] object-contain object-bottom"
          />
        ) : (
          // ไม่มีภาพวาดท่า: Silhouette Anatomy แบบโปร่ง ด้านหน้า + หลัง
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 px-2">
            {anatomy &&
              ['front', 'back'].map((view) => (
                <MuscleIcon
                  key={view}
                  primary={anatomy.primary}
                  secondary={anatomy.secondary}
                  view={view}
                  tone="anatomy"
                  pulse={hovered}
                  className="h-[80%] w-auto drop-shadow-[0_0_10px_rgba(239,68,68,0.25)]"
                />
              ))}
          </span>
        )}

        {/* มุมซ้ายบน (พื้นที่ว่างเหนือภาพวาด): รูปร่างกาย ขาว-เทา ไฮไลต์กล้ามเนื้อเป้าหมายสีแดง ; มุมขวาล่าง: ปุ่มเล่น (ซ่อนขณะเล่น) */}
        {media && anatomy && (
          <span className="absolute left-1.5 top-1.5 flex h-[30%] items-center justify-center rounded-lg bg-black/40 px-1 py-1 backdrop-blur-[2px]">
            <MuscleIcon primary={anatomy.primary} secondary={anatomy.secondary} tone="anatomy" pulse={playing} className="h-full w-auto" />
          </span>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        {media && (
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
