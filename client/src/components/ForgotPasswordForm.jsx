import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { forgotPassword, resetPassword } from '../utils/api'
import { ErrorMessage, ResendRow } from './AuthUi'
import OtpInput from './OtpInput'
import PasswordStrengthMeter, { MIN_PASSWORD_LENGTH } from './PasswordStrengthMeter'
import { ButtonLabel } from './Spinner'

const RESEND_COOLDOWN_SECONDS = 60
const OTP_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ลืมรหัสผ่าน 2 ขั้น: (1) กรอกอีเมล -> ส่ง OTP  (2) กรอก OTP + รหัสผ่านใหม่ -> ตั้งรหัสผ่านใหม่
// server ตอบเหมือนกันไม่ว่าอีเมลจะมีบัญชีหรือไม่ (กัน email enumeration) จึงไปขั้นที่ 2 เสมอ
// notify รับ { type, message } เพื่อแสดง toast ของ AuthPage, onSuccess(email) กลับไปหน้าเข้าสู่ระบบ
export default function ForgotPasswordForm({ initialEmail = '', notify, onBack, onSuccess }) {
  const { t } = useTranslation()
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // error = { key, params } (แปลตอน render จึงเปลี่ยนภาษาทันที) หรือ { text } (ข้อความจาก server)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const isCoolingDown = resendCooldown > 0
  useEffect(() => {
    if (!isCoolingDown) return undefined
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [isCoolingDown])

  const describe = (e) => (e.key ? t(e.key, e.params) : e.text)
  const fail = (nextError) => {
    setError(nextError)
    notify({ type: 'error', message: describe(nextError) })
  }

  const requestOtp = async () => {
    const { message, retryAfter } = await forgotPassword(email)
    setResendCooldown(retryAfter ?? RESEND_COOLDOWN_SECONDS)
    notify({ type: 'info', title: t('forgot.checkEmailTitle'), message })
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError(null)
    if (!EMAIL_PATTERN.test(email)) return fail({ key: 'forgot.errors.invalidEmail' })

    setLoading(true)
    try {
      await requestOtp()
      setStep('reset')
    } catch (err) {
      fail(err.message ? { text: err.message } : { key: 'forgot.errors.sendFailed' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return
    setError(null)
    setResending(true)
    try {
      await requestOtp()
      setOtp('')
    } catch (err) {
      notify({ type: 'error', message: err.message || t('auth.toast.resendFailed') })
    } finally {
      setResending(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError(null)
    if (otp.length !== OTP_LENGTH) return fail({ key: 'forgot.errors.incompleteCode' })
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return fail({ key: 'forgot.errors.passwordTooShort', params: { min: MIN_PASSWORD_LENGTH } })
    }
    if (newPassword !== confirmPassword) return fail({ key: 'forgot.errors.mismatch' })

    setLoading(true)
    try {
      const { message } = await resetPassword({ email, otp, newPassword })
      notify({ type: 'success', title: t('forgot.successTitle'), message })
      onSuccess(email)
    } catch (err) {
      fail(
        err.reason === 'invalid'
          ? { key: 'forgot.errors.invalidCode' }
          : err.message
            ? { text: err.message }
            : { key: 'forgot.errors.resetFailed' }
      )
      if (err.reason) setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const errorText = error && describe(error)
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  if (step === 'email') {
    return (
      <div key="email" className="animate-view-in">
        <p className="mb-5 text-center text-sm text-slate-400">{t('forgot.intro')}</p>

        <form onSubmit={handleRequestOtp} noValidate className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.fields.email')}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder={t('auth.fields.emailPlaceholder')}
              className="input-field"
            />
          </div>

          {errorText && <ErrorMessage key={errorText}>{errorText}</ErrorMessage>}

          <button type="submit" disabled={loading} className="btn-accent w-full">
            <ButtonLabel loading={loading} loadingText={t('forgot.sending')}>
              {t('forgot.sendCode')}
            </ButtonLabel>
          </button>
        </form>

        <button type="button" onClick={onBack} className="auth-link mt-5 block w-full text-center">
          {t('forgot.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <div key="reset" className="animate-view-in">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <span className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
          {email}
        </span>
        <p className="text-xs text-slate-500">{t('forgot.codeHint')}</p>
      </div>

      <form onSubmit={handleReset} noValidate className="space-y-4">
        <OtpInput
          value={otp}
          onChange={(next) => {
            setOtp(next)
            if (error) setError(null)
          }}
          length={OTP_LENGTH}
          disabled={loading}
          hasError={Boolean(error) && otp.length === 0}
        />

        <div className="pt-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('forgot.newPassword')}</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('auth.fields.newPasswordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
            className="input-field"
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('forgot.confirmNewPassword')}</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('forgot.confirmNewPasswordPlaceholder')}
            aria-invalid={mismatch}
            className={`input-field ${mismatch ? 'border-red-400/60' : passwordsMatch ? 'border-lime-400/50' : ''}`}
          />
          {mismatch && <p className="mt-1 text-xs text-red-300">{t('auth.validation.passwordMismatch')}</p>}
          {passwordsMatch && <p className="mt-1 text-xs text-lime-300">{t('auth.validation.passwordsMatch')}</p>}
        </div>

        {errorText && <ErrorMessage key={errorText}>{errorText}</ErrorMessage>}

        <button
          type="submit"
          disabled={loading || otp.length !== OTP_LENGTH || !newPassword || !confirmPassword}
          className="btn-accent w-full"
        >
          <ButtonLabel loading={loading} loadingText={t('forgot.saving')}>
            {t('forgot.submit')}
          </ButtonLabel>
        </button>
      </form>

      <ResendRow cooldown={resendCooldown} resending={resending} onResend={handleResendOtp} />

      <button
        type="button"
        onClick={() => {
          setStep('email')
          setError(null)
          setOtp('')
        }}
        className="auth-link mt-3 block w-full text-center"
      >
        {t('forgot.changeEmail')}
      </button>
    </div>
  )
}
