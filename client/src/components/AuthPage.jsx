import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { demoLogin, login, signup } from '../utils/api'
import { ErrorMessage, PasswordInput } from './AuthUi'
import BrandMark from './BrandMark'
import LanguageSwitcher from './LanguageSwitcher'
import PasswordStrengthMeter, { MIN_PASSWORD_LENGTH } from './PasswordStrengthMeter'
import { ButtonLabel } from './Spinner'
import Toast from './Toast'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FieldError({ children }) {
  return <p className="mt-1 text-xs text-red-300">{children}</p>
}

// ทางเข้าหลัก: ปุ่ม Demo Account กดครั้งเดียวเข้า Dashboard ; อีเมล + รหัสผ่านเป็นทางเลือกรอง
export default function AuthPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({})
  // error = { key, params } (แปลตอน render จึงเปลี่ยนภาษาทันที) หรือ { text } (ข้อความจาก server)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [toast, setToast] = useState(null)
  // id ใหม่ทุกครั้ง ให้ toast ข้อความเดิมที่เด้งซ้ำเล่นอนิเมชันและนับเวลาใหม่
  const notify = useCallback((next) => setToast({ ...next, id: Date.now() + Math.random() }), [])

  const isSignup = mode === 'signup'
  const busy = loading || demoLoading

  const fieldErrors = useMemo(() => {
    const errors = {}
    if (email && !EMAIL_PATTERN.test(email)) errors.email = t('auth.validation.invalidEmail')
    if (isSignup) {
      if (password && password.length < MIN_PASSWORD_LENGTH) {
        errors.password = t('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
      }
      if (confirmPassword && password !== confirmPassword) {
        errors.confirmPassword = t('auth.validation.passwordMismatch')
      }
    }
    return errors
  }, [email, password, confirmPassword, isSignup, t])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const canSubmitSignup =
    EMAIL_PATTERN.test(email) && password.length >= MIN_PASSWORD_LENGTH && passwordsMatch

  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }))
  const showError = (field) => (touched[field] || field === 'confirmPassword') && fieldErrors[field]

  const showFailure = (err) => {
    const message = err.message || t('auth.toast.genericError')
    setError({ text: message })
    notify({ type: 'error', message })
  }

  const handleDemoLogin = async () => {
    if (busy) return
    setError(null)
    setDemoLoading(true)
    try {
      signIn(await demoLogin())
    } catch (err) {
      showFailure(err)
      setDemoLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setTouched({ email: true, password: true, confirmPassword: true })

    if (isSignup && !canSubmitSignup) {
      setError({
        key:
          password !== confirmPassword
            ? 'auth.validation.passwordAndConfirmMismatch'
            : 'auth.validation.fillAllFields',
      })
      return
    }
    if (!isSignup && (!EMAIL_PATTERN.test(email) || !password)) {
      setError({ key: 'auth.validation.emailAndPasswordRequired' })
      return
    }

    setLoading(true)
    try {
      signIn(isSignup ? await signup({ name: name.trim(), email, password }) : await login(email, password))
    } catch (err) {
      showFailure(err)
      setLoading(false)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
    setTouched({})
    setPassword('')
    setConfirmPassword('')
  }

  const errorText = error && (error.key ? t(error.key, error.params) : error.text)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian px-4 py-10">
      {/* พื้นหลัง: ลูกแก้วแสง + ตาราง */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-float-orb absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div
          className="animate-float-orb absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-emerald-500/15 blur-[110px]"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="animate-float-orb absolute top-1/3 -left-24 h-64 w-64 rounded-full bg-sky-500/10 blur-[100px]"
          style={{ animationDelay: '-9s' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="animate-card-in relative w-full max-w-md">
        <div className="glass-auth px-6 py-8 sm:px-8">
          <LanguageSwitcher className="absolute right-4 top-4 z-10" />
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandMark className="mb-4 h-14 w-14 shadow-[0_0_32px_-8px_rgba(16,185,129,0.6)]" />
            <div key={mode} className="animate-view-in">
              <h1 className="text-2xl font-bold tracking-tight text-white">{t(`auth.headings.${mode}.title`)}</h1>
              <p className="mt-1.5 text-sm text-slate-400">{t(`auth.headings.${mode}.subtitle`)}</p>
            </div>
          </div>

          <button type="button" onClick={handleDemoLogin} disabled={busy} className="btn-accent w-full py-3.5 text-base">
            <ButtonLabel loading={demoLoading} loadingText={t('auth.buttons.demoLoading')}>
              {t('auth.buttons.demo')}
            </ButtonLabel>
          </button>

          <div className="my-6 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">{t('auth.orWithEmail')}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
            <span
              aria-hidden
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-emerald-400/15 ring-1 ring-emerald-400/30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSignup ? 'translate-x-full' : ''
              }`}
            />
            {[
              ['login', t('auth.tabs.login')],
              ['signup', t('auth.tabs.signup')],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => mode !== tab && switchMode(tab)}
                className={`relative z-10 rounded-lg py-2 text-sm font-medium transition-colors duration-200 ${
                  mode === tab ? 'text-emerald-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div key={mode} className="animate-view-in">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {isSignup && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.fields.name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('auth.fields.namePlaceholder')}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.fields.email')}</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  onBlur={() => markTouched('email')}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(showError('email'))}
                  className={`input-field ${showError('email') ? 'border-red-400/60' : ''}`}
                />
                {showError('email') && <FieldError>{fieldErrors.email}</FieldError>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.fields.password')}</label>
                <PasswordInput
                  required
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  placeholder={
                    isSignup
                      ? t('auth.fields.newPasswordPlaceholder', { min: MIN_PASSWORD_LENGTH })
                      : t('auth.fields.passwordPlaceholder')
                  }
                  aria-invalid={Boolean(showError('password'))}
                  className={`input-field ${showError('password') ? 'border-red-400/60' : ''}`}
                />
                {isSignup && <PasswordStrengthMeter password={password} />}
                {showError('password') && <FieldError>{fieldErrors.password}</FieldError>}
              </div>

              {isSignup && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.fields.confirmPassword')}</label>
                  <PasswordInput
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.fields.confirmPasswordPlaceholder')}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className={`input-field ${
                      fieldErrors.confirmPassword
                        ? 'border-red-400/60'
                        : passwordsMatch
                          ? 'border-emerald-400/50'
                          : ''
                    }`}
                  />
                  {fieldErrors.confirmPassword ? (
                    <FieldError>{fieldErrors.confirmPassword}</FieldError>
                  ) : (
                    passwordsMatch && <p className="mt-1 text-xs text-emerald-300">{t('auth.validation.passwordsMatch')}</p>
                  )}
                </div>
              )}

              {errorText && <ErrorMessage key={errorText}>{errorText}</ErrorMessage>}

              <button type="submit" disabled={busy || (isSignup && !canSubmitSignup)} className="btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-60">
                <ButtonLabel
                  loading={loading}
                  loadingText={isSignup ? t('auth.buttons.creatingAccount') : t('auth.buttons.checking')}
                >
                  {isSignup ? t('auth.buttons.signup') : t('auth.buttons.login')}
                </ButtonLabel>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
