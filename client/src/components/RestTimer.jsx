import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'

export default function RestTimer({ duration = 90, active, onFinish }) {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState(duration)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

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
  const progress = ((duration - secondsLeft) / duration) * 100

  return (
    <div className="glass-card mx-auto w-full max-w-md p-6 text-center">
      <p className="mb-2 text-sm font-medium uppercase tracking-wide text-lime-300">{t('dashboard.rest.title')}</p>
      <p className="mb-3 text-5xl font-black tabular-nums text-white">
        {minutes}:{String(seconds).padStart(2, '0')}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300 shadow-[0_0_10px_-1px_rgba(163,230,53,0.9)] transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        onClick={() => {
          clearInterval(intervalRef.current)
          onFinish?.()
        }}
        className="mt-3 text-sm text-slate-400 hover:text-lime-300"
      >
        {t('dashboard.rest.skip')}
      </button>
    </div>
  )
}
