import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Play } from 'lucide-react'
import ExerciseBadges from './ExerciseBadges'
import { prefersReducedMotion } from '../utils/motion'
import ExerciseVideo from './ExerciseVideo'
import { MuscleIcon } from './MuscleTargetCard'

// การ์ดท่าฝึกใน Exercise Library: วิดีโอสาธิตท่า (autoPlay loop muted playsInline) + รูป Anatomy กล้ามเนื้อเป้าหมาย
// เล่นอัตโนมัติเฉพาะตอนการ์ดอยู่ในจอ (IntersectionObserver) เลื่อนพ้นจอ = pause (ประหยัดแบต/GPU มือถือ) ; ผู้ใช้ตั้ง Reduce Motion = ไม่เล่นเอง
// ระหว่างโหลด = poster ; โหลดวิดีโอไม่ได้ = poster/ภาพนิ่ง ; ไม่มีสื่อเลย (media = null หรือโหลดไม่ได้ทุกแบบ) = Silhouette Anatomy
// ทุกการ์ดมีป้าย "► ดูท่า" ; กดการ์ด = onOpen(exercise) เปิดป๊อปอัปคลิปขยายใหญ่
export default memo(function ExerciseCard({ exercise, anatomy, media, active, categoryNote, onOpen }) {
  const { t } = useTranslation()
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false) // การ์ดที่ไม่มีวิดีโอ: ให้กล้ามเนื้อสีแดงเต้นแทน
  const [unavailable, setUnavailable] = useState(false)
  const cardRef = useRef(null)
  const videoRef = useRef(null)
  const showMedia = media && !unavailable

  useEffect(() => {
    const card = cardRef.current
    if (!showMedia || !card || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current
        if (!video) return
        // play() คืน Promise ที่ reject ได้ (เช่น ถูก pause ก่อนโหลดเสร็จ) ไม่ใช่ error จริง
        if (entry.isIntersecting) video.play?.().catch(() => {})
        else video.pause?.()
      },
      { threshold: 0.6 }
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [showMedia])

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onOpen(exercise)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
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
        {showMedia ? (
          <ExerciseVideo
            ref={videoRef}
            media={media}
            label={t('exerciseLibrary.previewAlt', { name: exercise.name })}
            onPlayingChange={setPlaying}
            onUnavailable={() => setUnavailable(true)}
            className={
              media.kind === 'photo'
                ? // ภาพถ่าย 3:2 อยู่กลางการ์ด (เหนือป้าย "ดูท่า") ; รูป Anatomy อยู่ในที่ว่างด้านบน
                  'absolute inset-x-1 bottom-7 h-[calc(100%-45%)] w-[calc(100%-0.5rem)] object-cover'
                : 'absolute inset-x-1 bottom-6 h-[calc(100%-1.75rem)] w-[calc(100%-0.5rem)] object-contain object-bottom'
            }
          />
        ) : (
          // ไม่มีภาพสาธิต: Silhouette Anatomy แบบโปร่ง ด้านหน้า + หลัง
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 px-2 pb-5">
            {anatomy &&
              ['front', 'back'].map((view) => (
                <MuscleIcon
                  key={view}
                  primary={anatomy.primary}
                  secondary={anatomy.secondary}
                  view={view}
                  tone="anatomy"
                  pulse={hovered}
                  className="h-[78%] w-auto drop-shadow-[0_0_10px_rgba(239,68,68,0.25)]"
                />
              ))}
          </span>
        )}

        {/* มุมซ้ายบน: รูปร่างกาย ขาว-เทา ไฮไลต์กล้ามเนื้อเป้าหมายสีแดง (คู่กับวิดีโอ) */}
        {showMedia && anatomy && (
          <span className="absolute left-1.5 top-1.5 flex h-[30%] items-center justify-center rounded-lg bg-black/40 px-1 py-1 backdrop-blur-[2px]">
            <MuscleIcon primary={anatomy.primary} secondary={anatomy.secondary} tone="anatomy" pulse={playing} className="h-full w-auto" />
          </span>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        {/* ป้าย "► ดูท่า" แสดงเหมือนกันทุกการ์ด (กดที่ใดบนการ์ดก็เปิดคลิปขยาย) */}
        <span
          className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors duration-200 group-hover:bg-orange-500/90"
          aria-hidden
        >
          <Play className="h-2.5 w-2.5 fill-current" />
          {t('exerciseLibrary.gif')}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <span className={`truncate text-xs font-semibold ${active ? 'text-emerald-200' : 'text-slate-100'}`}>{exercise.name}</span>
        {categoryNote && <span className="-mt-1 truncate text-[10px] text-slate-500">{categoryNote}</span>}
        <ExerciseBadges anatomy={anatomy} />
      </span>
    </button>
  )
})
