import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { login, resendOtp, signup, verifyOtp } from '../utils/api'
import { ErrorMessage, ResendRow } from './AuthUi'
import BrandMark from './BrandMark'
import ForgotPasswordForm from './ForgotPasswordForm'
import LanguageSwitcher from './LanguageSwitcher'
import OtpInput from './OtpInput'
import PasswordStrengthMeter, { MIN_PASSWORD_LENGTH } from './PasswordStrengthMeter'
import { ButtonLabel } from './Spinner'
import Toast from './Toast'

const RESEND_COOLDOWN_SECONDS = 60
const OTP_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// เวลาแสดง toast "รหัสถูกต้อง" ก่อนเข้า Dashboard
const SIGN_IN_DELAY_MS = 1200

function FieldError({ children }) {
  return <p className="mt-1 text-xs text-red-300">{children}</p>
}

export default function AuthPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'verify' | 'forgot'
  const [previousMode, setPreviousMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({})
  const [otp, setOtp] = useState('')
  // error = { key, params } (แปลตอน render จึงเปลี่ยนภาษาทันที) หรือ { text } (ข้อความจาก server)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [toast, setToast] = useState(null)
  // id ใหม่ทุกครั้ง ให้ toast ข้อความเดิมที่เด้งซ้ำเล่นอนิเมชันและนับเวลาใหม่
  const notify = useCallback((next) => setToast({ ...next, id: Date.now() + Math.random() }), [])

  const isSignup = mode === 'signup'
  const isVerify = mode === 'verify'
  const isForgot = mode === 'forgot'

  const isCoolingDown = resendCooldown > 0
  useEffect(() => {
    if (!isCoolingDown) return undefined
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [isCoolingDown])

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

  const goToVerify = (cooldown) => {
    setOtp('')
    setPreviousMode(mode)
    setMode('verify')
    setResendCooldown(cooldown)
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
      if (isSignup) {
        const { message } = await signup({ name: name.trim(), email, password })
        goToVerify(RESEND_COOLDOWN_SECONDS)
        notify({ type: 'success', message })
      } else {
        const session = await login(email, password)
        notify({ type: 'success', message: t('auth.toast.loginSuccess') })
        setVerified(true)
        setTimeout(() => signIn(session), SIGN_IN_DELAY_MS)
      }
    } catch (err) {
      // บัญชียังไม่ยืนยันอีเมล (login) หรือขอรหัสถี่เกินไป แต่รหัสเดิมยังใช้ได้ (signup)
      // -> พาไปหน้ากรอกรหัสพร้อมนับเวลาที่เหลือ
      if (err.reason === 'unverified' || (err.status === 429 && err.retryAfter)) {
        goToVerify(err.retryAfter ?? RESEND_COOLDOWN_SECONDS)
        notify({ type: err.reason === 'unverified' ? 'success' : 'error', message: err.message })
      } else {
        const message = err.message || t('auth.toast.genericError')
        setError({ text: message })
        notify({ type: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (code = otp) => {
    if (loading || verified || code.length !== OTP_LENGTH) return
    setError(null)
    setLoading(true)
    try {
      const session = await verifyOtp(email, code)
      setVerified(true)
      notify({ type: 'success', message: t('auth.toast.verifySuccess') })
      setTimeout(() => signIn(session), SIGN_IN_DELAY_MS)
    } catch (err) {
      const nextError =
        err.reason === 'invalid'
          ? { key: 'auth.toast.invalidCode' }
          : { text: err.message || t('auth.toast.verifyFailed') }
      setError(nextError)
      notify({ type: 'error', message: nextError.key ? t(nextError.key) : nextError.text })
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return
    setError(null)
    setResending(true)
    try {
      await resendOtp(email)
      setOtp('')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      notify({ type: 'success', message: t('auth.toast.otpResent') })
    } catch (err) {
      if (err.retryAfter) setResendCooldown(err.retryAfter)
      notify({ type: 'error', message: err.message || t('auth.toast.resendFailed') })
    } finally {
      setResending(false)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
    setOtp('')
    setTouched({})
    setPassword('')
    setConfirmPassword('')
  }

  const errorText = error && (error.key ? t(error.key, error.params) : error.text)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* พื้นหลัง: ลูกแก้วแสง + ตาราง */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-float-orb absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-lime-500/20 blur-[120px]" />
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
            <BrandMark className="mb-4 h-14 w-14 shadow-[0_0_32px_-8px_rgba(163,230,53,0.6)]" />
            <div key={mode} className="animate-view-in">
              <h1 className="text-2xl font-bold tracking-tight text-white">{t(`auth.headings.${mode}.title`)}</h1>
              <p className="mt-1.5 text-sm text-slate-400">{t(`auth.headings.${mode}.subtitle`)}</p>
            </div>
          </div>

          {(mode === 'login' || isSignup) && (
            <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-lime-400/15 ring-1 ring-lime-400/30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
                    mode === tab ? 'text-lime-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div key={mode} className="animate-view-in">
            {isForgot ? (
              <ForgotPasswordForm
                initialEmail={email}
                notify={notify}
                onBack={() => switchMode('login')}
                onSuccess={(resetEmail) => {
                  setEmail(resetEmail)
                  switchMode('login')
                }}
              />
            ) : isVerify ? (
              <>
                <div className="mb-6 flex justify-center">
                  <span className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                    {email}
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleVerifyOtp()
                  }}
                  className="space-y-4"
                >
                  <OtpInput
                    value={otp}
                    onChange={(next) => {
                      setOtp(next)
                      if (error) setError(null)
                    }}
                    onComplete={handleVerifyOtp}
                    length={OTP_LENGTH}
                    disabled={loading || verified}
                    hasError={Boolean(error)}
                  />
                  <p className="text-center text-xs text-slate-500">{t('auth.codeExpiry')}</p>

                  {errorText && <ErrorMessage key={errorText}>{errorText}</ErrorMessage>}

                  <button
                    type="submit"
                    disabled={loading || verified || otp.length !== OTP_LENGTH}
                    className="btn-accent w-full"
                  >
                    <ButtonLabel
                      loading={loading || verified}
                      loadingText={verified ? t('auth.buttons.loggingIn') : t('auth.buttons.checking')}
                    >
                      {t('auth.buttons.verify')}
                    </ButtonLabel>
                  </button>
                </form>

                <ResendRow
                  cooldown={resendCooldown}
                  resending={resending}
                  disabled={verified}
                  onResend={handleResendOtp}
                />

                <button
                  type="button"
                  onClick={() => switchMode(previousMode)}
                  disabled={verified}
                  className="auth-link mt-4 block w-full text-center"
                >
                  {t('auth.buttons.backToEditEmail')}
                </button>
              </>
            ) : (
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
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-300">{t('auth.fields.password')}</label>
                    {!isSignup && (
                      <button type="button" onClick={() => switchMode('forgot')} className="auth-link text-xs">
                        {t('auth.forgotLink')}
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
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
                    <input
                      type="password"
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
                            ? 'border-lime-400/50'
                            : ''
                      }`}
                    />
                    {fieldErrors.confirmPassword ? (
                      <FieldError>{fieldErrors.confirmPassword}</FieldError>
                    ) : (
                      passwordsMatch && <p className="mt-1 text-xs text-lime-300">{t('auth.validation.passwordsMatch')}</p>
                    )}
                  </div>
                )}

                {errorText && <ErrorMessage key={errorText}>{errorText}</ErrorMessage>}

                <button
                  type="submit"
                  disabled={loading || verified || (isSignup && !canSubmitSignup)}
                  className="btn-accent w-full"
                >
                  <ButtonLabel
                    loading={loading || verified}
                    loadingText={
                      verified
                        ? t('auth.buttons.loggingIn')
                        : isSignup
                          ? t('auth.buttons.creatingAccount')
                          : t('auth.buttons.checking')
                    }
                  >
                    {isSignup ? t('auth.buttons.signup') : t('auth.buttons.login')}
                  </ButtonLabel>
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {t('auth.securityFooter')}
        </p>
      </div>
    </div>
  )
}
