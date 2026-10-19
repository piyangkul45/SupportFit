import { useTranslation } from 'react-i18next'

export const MIN_PASSWORD_LENGTH = 6

// ชื่อระดับอยู่ในไฟล์แปลภาษา password.levels[0-4]
const STRENGTH_LEVELS = [
  { bar: 'bg-red-500', text: 'text-red-300' },
  { bar: 'bg-orange-500', text: 'text-orange-300' },
  { bar: 'bg-yellow-400', text: 'text-yellow-300' },
  { bar: 'bg-lime-400', text: 'text-lime-300' },
  { bar: 'bg-emerald-400', text: 'text-emerald-300' },
]

// Returns 0-4 plus hints for what is still missing
function getPasswordStrength(password) {
  const checks = [
    { ok: password.length >= 8, hint: 'length' },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), hint: 'case' },
    { ok: /\d/.test(password), hint: 'digit' },
    { ok: /[^A-Za-z0-9]/.test(password), hint: 'symbol' },
  ]
  let score = checks.filter((c) => c.ok).length
  if (password.length < MIN_PASSWORD_LENGTH) score = 0
  else if (password.length >= 12 && score === 3) score = 4
  return { score, missing: checks.filter((c) => !c.ok).map((c) => c.hint) }
}

export default function PasswordStrengthMeter({ password }) {
  const { t } = useTranslation()
  if (!password) return null
  const { score, missing } = getPasswordStrength(password)
  const level = STRENGTH_LEVELS[score]

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < Math.max(score, 1) ? level.bar : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="mt-1 flex items-start justify-between gap-2 text-xs">
        <span className={level.text}>{t('password.strength', { level: t('password.levels')[score] })}</span>
        {missing.length > 0 && score < 4 && (
          <span className="text-right text-slate-500">
            {t('password.add', { hints: missing.map((hint) => t(`password.hints.${hint}`)).join(', ') })}
          </span>
        )}
      </div>
    </div>
  )
}
