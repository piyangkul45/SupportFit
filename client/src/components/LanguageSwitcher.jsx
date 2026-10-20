import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../i18n'

// ปุ่มสลับภาษา 🌐 EN | TH — เปลี่ยนข้อความทั้งแอปทันทีโดยไม่ต้อง reload และจำไว้ใน localStorage
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage
  // pill แยกต่อ instance (หน้า Auth กับ Header ไม่แย่ง layoutId กัน)
  const pillId = useId()

  return (
    <div
      role="group"
      aria-label={t('common.switchLanguage')}
      className={`flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5 text-xs font-semibold ${className}`}
    >
      <Globe aria-hidden className="ml-1.5 mr-1 h-3.5 w-3.5 text-slate-400" />
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng
        return (
          <button
            key={lng}
            type="button"
            onClick={() => !active && i18n.changeLanguage(lng)}
            aria-pressed={active}
            className={`relative rounded-lg px-2 py-1.5 uppercase tracking-wide transition-colors duration-200 ${
              active ? 'text-emerald-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                className="absolute inset-0 rounded-lg bg-emerald-400/15 ring-1 ring-emerald-400/30"
              />
            )}
            <span className="relative">{lng}</span>
          </button>
        )
      })}
    </div>
  )
}
