import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const DURATION_MS = 4000

const VARIANTS = {
  success: {
    titleKey: 'toast.success',
    ring: 'border-lime-400/30',
    icon: 'bg-lime-400/15 text-lime-300',
    bar: 'bg-lime-400',
    path: 'M5 12.5l4.5 4.5L19 7.5',
  },
  error: {
    titleKey: 'toast.error',
    ring: 'border-red-400/30',
    icon: 'bg-red-500/15 text-red-300',
    bar: 'bg-red-400',
    path: 'M7 7l10 10M17 7L7 17',
  },
  info: {
    titleKey: 'toast.info',
    ring: 'border-sky-400/30',
    icon: 'bg-sky-400/15 text-sky-300',
    bar: 'bg-sky-400',
    path: 'M12 11v6M12 7.5v.01',
  },
}

// toast = { type: 'success' | 'error' | 'info', message, title?, id? }
// ส่ง id ใหม่ทุกครั้ง (AuthPage ทำให้แล้ว) เพื่อให้ข้อความเดิมที่แสดงซ้ำเล่นอนิเมชันและนับเวลาใหม่
export default function Toast({ toast, onClose }) {
  const { t } = useTranslation()
  // เก็บ onClose ล่าสุดใน ref เพื่อไม่ให้ตัวจับเวลารีเซ็ตทุกครั้งที่ parent render ใหม่
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => onCloseRef.current(), DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null
  const variant = VARIANTS[toast.type] ?? VARIANTS.success

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        key={toast.id}
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        className={`animate-toast-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl ${variant.ring}`}
      >
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${variant.icon}`}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={variant.path} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100">{toast.title ?? t(variant.titleKey)}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="-mr-1 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label={t('toast.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
        <div
          className={`animate-toast-progress absolute inset-x-0 bottom-0 h-0.5 opacity-70 ${variant.bar}`}
          style={{ animationDuration: `${DURATION_MS}ms` }}
        />
      </div>
    </div>
  )
}
