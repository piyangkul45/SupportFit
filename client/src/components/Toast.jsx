import { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

const DURATION_MS = 4000

const VARIANTS = {
  success: {
    titleKey: 'toast.success',
    Icon: CircleCheck,
    ring: 'border-emerald-400/30',
    icon: 'bg-emerald-400/15 text-emerald-300',
    bar: 'from-emerald-400 to-green-400',
  },
  error: {
    titleKey: 'toast.error',
    Icon: CircleAlert,
    ring: 'border-red-400/30',
    icon: 'bg-red-500/15 text-red-300',
    bar: 'from-red-400 to-rose-400',
  },
  warning: {
    titleKey: 'toast.warning',
    Icon: TriangleAlert,
    ring: 'border-amber-400/30',
    icon: 'bg-amber-400/15 text-amber-300',
    bar: 'from-amber-400 to-orange-400',
  },
  info: {
    titleKey: 'toast.info',
    Icon: Info,
    ring: 'border-cyan-400/30',
    icon: 'bg-cyan-400/15 text-cyan-300',
    bar: 'from-cyan-400 to-violet-400',
  },
}

// toast = { type: 'success' | 'error' | 'warning' | 'info', message | parts, title?, id }
// parts = [{ key, params?, icon? }] แปลตอน render เพื่อให้เปลี่ยนภาษาตามผู้ใช้ได้ทันที
// ส่ง id ใหม่ทุกครั้งเพื่อให้ข้อความเดิมที่แสดงซ้ำเล่นอนิเมชันและนับเวลาใหม่
function Toast({ toast, onClose }) {
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

  const variant = toast ? (VARIANTS[toast.type] ?? VARIANTS.success) : null
  const message = toast?.parts
    ? toast.parts.map((part) => `${part.icon ? `${part.icon} ` : ''}${t(part.key, part.params)}`).join(' ')
    : toast?.message

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4 md:top-20 md:justify-end md:px-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border bg-obsidian-raised/75 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] glass-blur ${variant.ring}`}
          >
            <div className="flex items-start gap-3 px-4 py-3.5">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${variant.icon}`}>
                <variant.Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{toast.title ?? t(variant.titleKey)}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{message}</p>
              </div>
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                className="-mr-1 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
                aria-label={t('toast.close')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
              <div
                className={`animate-toast-progress h-full bg-gradient-to-r ${variant.bar}`}
                style={{ animationDuration: `${DURATION_MS}ms` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(Toast)
