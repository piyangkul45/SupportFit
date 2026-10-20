import { useTranslation } from 'react-i18next'
import Spinner from './Spinner'

function formatCountdown(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// กล่อง error ในฟอร์ม ใส่ key={ข้อความ} ตอนเรียกใช้ เพื่อให้สั่นใหม่ทุกครั้งที่ error เปลี่ยน
export function ErrorMessage({ children }) {
  return (
    <div
      role="alert"
      className="animate-shake flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5M12 16v.01" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

// แถว "ขอรหัสใหม่ได้ในอีก 0:59" พร้อมวงนับถอยหลัง -> กลายเป็นปุ่มส่งรหัสใหม่เมื่อครบเวลา
export function ResendRow({ cooldown, total = 60, resending, disabled, onResend }) {
  const { t } = useTranslation()
  const radius = 9
  const circumference = 2 * Math.PI * radius

  return (
    <div className="mt-5 flex min-h-8 items-center justify-center text-sm">
      {cooldown > 0 ? (
        <p className="flex items-center gap-2 text-slate-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90" aria-hidden="true">
            <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="#a3e635"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.min(cooldown, total) / total)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          {t('otp.resendIn')}
          <span className="font-mono tabular-nums text-slate-300">{formatCountdown(cooldown)}</span>
        </p>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={resending || disabled}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-emerald-300 transition-colors hover:bg-emerald-400/10 hover:text-emerald-200 disabled:opacity-50"
        >
          {resending && <Spinner className="h-3.5 w-3.5" />}
          {resending ? t('otp.resending') : t('otp.resend')}
        </button>
      )}
    </div>
  )
}
