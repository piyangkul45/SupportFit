import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

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

// ช่องรหัสผ่านพร้อมปุ่มรูปตาทางขวา สลับ type ระหว่าง password/text props อื่นส่งต่อให้ <input>
export function PasswordInput({ className = '', ...props }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:text-slate-200 focus-visible:text-emerald-300 focus-visible:outline-none"
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </button>
    </div>
  )
}
