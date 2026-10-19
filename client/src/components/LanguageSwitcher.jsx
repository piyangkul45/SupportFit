import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'

// ปุ่มสลับภาษา 🌐 EN | TH — เปลี่ยนข้อความทั้งแอปทันทีโดยไม่ต้อง reload และจำไว้ใน localStorage
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage

  return (
    <div
      role="group"
      aria-label={t('common.switchLanguage')}
      className={`relative flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5 text-xs font-semibold backdrop-blur ${className}`}
    >
      <span aria-hidden className="pl-1.5 pr-1 text-sm">
        🌐
      </span>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng
        return (
          <button
            key={lng}
            type="button"
            onClick={() => !active && i18n.changeLanguage(lng)}
            aria-pressed={active}
            className={`rounded-lg px-2 py-1.5 uppercase tracking-wide transition-all duration-200 ${
              active
                ? 'bg-lime-400/15 text-lime-200 ring-1 ring-lime-400/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {lng}
          </button>
        )
      })}
    </div>
  )
}
