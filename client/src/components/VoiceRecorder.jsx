import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

const WAVE_BAR_DELAYS = [0, 0.12, 0.24, 0.36, 0.48, 0.36, 0.24, 0.12]

const FEEDBACK_TONES = {
  error: { icon: '❌', className: 'border-red-500/20 bg-red-500/10 text-red-300' },
  warning: { icon: '⚠️', className: 'border-amber-400/20 bg-amber-400/10 text-amber-300' },
  success: { icon: '✅', className: 'border-lime-400/20 bg-lime-400/10 text-lime-300' },
}

// feedback = { tone, parts: [{ key, params?, icon? }] } เก็บเป็น key แปลตอน render
// เพื่อให้ข้อความเปลี่ยนภาษาทันทีเมื่อผู้ใช้สลับภาษา
function renderFeedback(feedback, t) {
  const tone = FEEDBACK_TONES[feedback.tone] ?? FEEDBACK_TONES.success
  const text = feedback.parts
    .map((part) => `${part.icon ? `${part.icon} ` : ''}${t(part.key, part.params)}`)
    .join(' ')
  return { className: tone.className, text: `${tone.icon} ${text}` }
}

export default function VoiceRecorder({ onFinalResult, feedback }) {
  const { t } = useTranslation()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const onFinalResultRef = useRef(onFinalResult)

  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  }, [onFinalResult])

  useEffect(() => {
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'th-TH'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText) {
        setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText))
        onFinalResultRef.current?.(finalText.trim())
      }
      setInterimTranscript(interimText)
    }

    recognition.onerror = (event) => {
      setError(event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setError('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const clearTranscript = () => {
    setTranscript('')
    setInterimTranscript('')
  }

  if (!SpeechRecognition) {
    return (
      <div className="glass-card border-red-500/20 bg-red-500/10 p-4 text-red-300">
        {t('voice.unsupported')}
      </div>
    )
  }

  const feedbackView = feedback ? renderFeedback(feedback, t) : null

  return (
    <div className="glass-card mx-auto w-full max-w-md p-6">
      <h2 className="mb-5 text-center text-lg font-semibold text-white">
        {t('voice.title')}
      </h2>

      <div className="mb-5 flex flex-col items-center gap-4">
        <button
          onClick={toggleListening}
          aria-pressed={isListening}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full text-3xl transition-all duration-300 ${
            isListening
              ? 'animate-pulse-glow bg-red-500 shadow-[0_0_24px_-4px_rgba(239,68,68,0.9)] hover:bg-red-400'
              : 'bg-lime-400 text-slate-950 shadow-[0_0_24px_-4px_rgba(163,230,53,0.8)] hover:bg-lime-300'
          }`}
        >
          {isListening ? '⏹' : '🎤'}
        </button>

        <div className="flex h-8 items-end gap-1" aria-hidden>
          {WAVE_BAR_DELAYS.map((delay, i) => (
            <span
              key={i}
              className={`w-1.5 origin-bottom rounded-full bg-lime-400 ${isListening ? 'animate-wave-bar' : 'h-1.5 opacity-30'}`}
              style={
                isListening
                  ? { height: '100%', animationDelay: `${delay}s` }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="text-sm font-medium text-slate-400">
          {isListening ? t('voice.listening') : t('voice.tapToStart')}
        </p>
      </div>

      <div className="min-h-[80px] rounded-xl border border-white/10 bg-black/20 p-3 text-left text-slate-100">
        {transcript}
        {interimTranscript && <span className="text-slate-500"> {interimTranscript}</span>}
        {!transcript && !interimTranscript && (
          <span className="text-slate-500">
            {t('voice.examplesLabel')} {t('voice.examples')}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {t('voice.error', { error })}
        </p>
      )}

      {feedbackView && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${feedbackView.className}`}>
          {feedbackView.text}
        </p>
      )}

      <button
        onClick={clearTranscript}
        className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-300"
      >
        {t('voice.clear')}
      </button>
    </div>
  )
}
