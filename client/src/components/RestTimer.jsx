import { useTranslation } from 'react-i18next'
import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, RotateCcw, SkipForward, Timer } from 'lucide-react'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const EXTEND_SECONDS = 15

// ขีดบอกเวลารอบวง: element คงที่สร้างครั้งเดียว ตัวจับเวลา render ทุกวินาทีจะข้ามส่วนนี้
const TICKS = Array.from({ length: 60 }, (_, i) => (
  <line
    key={i}
    x1="64"
    y1="4"
    x2="64"
    y2={i % 5 === 0 ? 9 : 7}
    stroke="rgba(255,255,255,0.12)"
    strokeWidth="1"
    transform={`rotate(${i * 6} 64 64)`}
  />
))

function ControlButton({ onClick, Icon, label, primary = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -1 }}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
        primary
          ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </motion.button>
  )
}

function RestTimer({ duration = 90, active, onFinish }) {
  const { t } = useTranslation()
  const [total, setTotal] = useState(duration)
  const [secondsLeft, setSecondsLeft] = useState(duration)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    setTotal(duration)
    setSecondsLeft(duration)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [active, duration])

  // เรียก onFinish จาก effect แยก แทนการเรียกใน setState updater ของ interval ด้านบน
  // (การ setState ข้าม component ระหว่างขั้นตอน render/update ของ component อื่นเป็น anti-pattern ใน React)
  useEffect(() => {
    if (active && secondsLeft === 0) {
      clearInterval(intervalRef.current)
      onFinish?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, secondsLeft])

  if (!active) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const remaining = secondsLeft / total
  const isEnding = secondsLeft <= 10

  const extend = () => {
    setTotal((value) => value + EXTEND_SECONDS)
    setSecondsLeft((value) => value + EXTEND_SECONDS)
  }
  const reset = () => {
    setTotal(duration)
    setSecondsLeft(duration)
  }
  const skip = () => {
    clearInterval(intervalRef.current)
    onFinish?.()
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="glass-card flex flex-col items-center gap-4 p-5 sm:flex-row sm:gap-6"
      aria-live="polite"
    >
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="rest-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={isEnding ? '#fbbf24' : '#34d399'} />
              <stop offset="100%" stopColor={isEnding ? '#f97316' : '#22c55e'} />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          {TICKS}
          <motion.circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            stroke="url(#rest-ring)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - remaining) }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums tracking-tight text-white">
            {minutes}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
        <p className="card-title">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Timer className="h-4 w-4" aria-hidden />
          </span>
          {t('dashboard.rest.title')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <ControlButton onClick={extend} Icon={Plus} label={t('dashboard.rest.addTime', { seconds: EXTEND_SECONDS })} />
          <ControlButton onClick={reset} Icon={RotateCcw} label={t('dashboard.rest.reset')} />
          <ControlButton onClick={skip} Icon={SkipForward} label={t('dashboard.rest.skip')} primary />
        </div>
      </div>
    </motion.section>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(RestTimer)
