import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'

// 6-digit OTP input: one box per digit, auto-advance, backspace-to-previous,
// arrow-key navigation and pasting a full code into any box.
export default function OtpInput({ value, onChange, onComplete, length = 6, disabled = false, hasError = false }) {
  const { t } = useTranslation()
  const inputsRef = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const focusBox = (index) => {
    const target = inputsRef.current[Math.max(0, Math.min(length - 1, index))]
    target?.focus()
    target?.select()
  }

  const commit = (nextDigits) => {
    const next = nextDigits.join('').slice(0, length)
    onChange(next)
    if (next.length === length && !nextDigits.includes('')) onComplete?.(next)
  }

  const fillFrom = (index, raw) => {
    const incoming = raw.replace(/\D/g, '')
    if (!incoming) return
    const nextDigits = [...digits]
    let cursor = index
    for (const ch of incoming) {
      if (cursor >= length) break
      nextDigits[cursor] = ch
      cursor += 1
    }
    commit(nextDigits)
    focusBox(cursor)
  }

  const handleChange = (index, e) => {
    const raw = e.target.value
    if (raw === '') {
      const nextDigits = [...digits]
      nextDigits[index] = ''
      commit(nextDigits)
      return
    }
    // Keep only the newly typed digit when the box already had one
    const typed = raw.length > 1 && digits[index] ? raw.replace(digits[index], '') : raw
    fillFrom(index, typed)
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault()
      const nextDigits = [...digits]
      nextDigits[index - 1] = ''
      commit(nextDigits)
      focusBox(index - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusBox(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusBox(index + 1)
    }
  }

  const handlePaste = (index, e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    // A full code always fills from the first box, wherever it was pasted
    fillFrom(pasted.replace(/\D/g, '').length >= length ? 0 : index, pasted)
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={t('otp.groupLabel')}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={t('otp.digitLabel', { n: i + 1 })}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-13 w-11 rounded-xl border bg-white/5 text-center text-xl font-semibold text-slate-100 outline-none transition-all duration-200 focus:-translate-y-0.5 focus:bg-white/10 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-50 sm:w-12 ${
            hasError
              ? 'border-red-400/60 focus:border-red-400'
              : digit
                ? 'border-emerald-400/40 focus:border-emerald-400/80'
                : 'border-white/10 focus:border-emerald-400/60'
          }`}
        />
      ))}
    </div>
  )
}
