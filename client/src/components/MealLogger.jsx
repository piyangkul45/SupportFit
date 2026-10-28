import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Sparkles, Square, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { analyzeMeal } from '../utils/api'
import { isToday } from '../utils/date'
import { ButtonLabel } from './Spinner'

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const SPEECH_LANG = { en: 'en-US', th: 'th-TH' }
const MAX_TEXT_LENGTH = 500

const formatNumber = (value) => Math.round(Number(value) || 0).toLocaleString()

function Macros({ protein, carbs, fat }) {
  const { t } = useTranslation()
  return (
    <span className="text-xs text-slate-500 tabular-nums">
      {t('meal.macros', { protein: formatNumber(protein), carbs: formatNumber(carbs), fat: formatNumber(fat) })}
    </span>
  )
}

// AI Meal Logger: พิมพ์หรือพูดว่ากินอะไรไป -> Gemini ประเมินสารอาหาร -> ตรวจแล้วกดบันทึก
// แสดงรายการอาหารวันนี้ (จาก foodLogs) พร้อมแคลอรีรวม
// onSave(items) คืน boolean[] ว่ารายการไหนบันทึกสำเร็จ
export default memo(function MealLogger({ foodLogs, loading, onSave, onDelete }) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const language = i18n.resolvedLanguage

  // สร้าง recognizer ใหม่เมื่อเปลี่ยนภาษาของแอป ข้อความที่พูดจบแต่ละช่วงต่อท้ายช่องพิมพ์
  useEffect(() => {
    if (!SpeechRecognition) return undefined
    const recognition = new SpeechRecognition()
    recognition.lang = SPEECH_LANG[language] ?? SPEECH_LANG.th
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText.trim()) {
        setText((prev) => `${prev.trim() ? `${prev.trim()} ` : ''}${finalText.trim()}`.slice(0, MAX_TEXT_LENGTH))
      }
      setInterim(interimText)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') setError(t('meal.micError'))
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [language, t])

  const toggleListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      return
    }
    setError('')
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // start() ซ้ำระหว่างที่ยังไม่ปิดรอบก่อนจะ throw InvalidStateError
    }
  }

  const handleAnalyze = async (event) => {
    event.preventDefault()
    const input = text.trim()
    if (!input || isAnalyzing) return
    recognitionRef.current?.stop()
    setError('')
    setIsAnalyzing(true)
    try {
      const { items: analyzed } = await analyzeMeal(input)
      setItems(analyzed)
    } catch (err) {
      setItems([])
      setError(err.message || t('meal.analyzeFailed'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!items.length || isSaving) return
    setIsSaving(true)
    try {
      const results = await onSave(items)
      const failed = items.filter((_, index) => !results[index])
      setItems(failed)
      if (!failed.length) setText('')
    } finally {
      setIsSaving(false)
    }
  }

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index))

  const todayMeals = useMemo(() => foodLogs.filter((log) => isToday(log.created_at)), [foodLogs])
  const totalCalories = useMemo(() => todayMeals.reduce((sum, log) => sum + (Number(log.calories) || 0), 0), [todayMeals])
  const previewCalories = items.reduce((sum, item) => sum + item.calories, 0)

  return (
    <section className="glass-card relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_65%)]"
      />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <h2 className="card-title">
          <span className="icon-tile border-amber-400/20 bg-amber-400/10 text-amber-300">
            <UtensilsCrossed className="h-4 w-4" aria-hidden />
          </span>
          {t('meal.title')}
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          {t('meal.poweredBy')}
        </span>
      </div>

      <form onSubmit={handleAnalyze} className="relative space-y-3">
        <div className="relative">
          <textarea
            value={isListening && interim ? `${text}${text ? ' ' : ''}${interim}` : text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            readOnly={isListening}
            rows={3}
            maxLength={MAX_TEXT_LENGTH}
            placeholder={t('meal.placeholder')}
            aria-label={t('meal.placeholder')}
            className="input-field resize-none pr-14"
          />
          {SpeechRecognition && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? t('meal.stopRecording') : t('meal.startRecording')}
              aria-pressed={isListening}
              className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                isListening
                  ? 'animate-pulse border-red-400/40 bg-red-500/20 text-red-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isListening ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
        {isListening && <p className="text-xs text-red-300">{t('meal.listening')}</p>}

        <button type="submit" disabled={!text.trim() || isAnalyzing} className="btn-accent w-full">
          <ButtonLabel loading={isAnalyzing} loadingText={t('meal.analyzing')}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {t('meal.analyze')}
          </ButtonLabel>
        </button>
      </form>

      {error && (
        <p role="alert" className="relative mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="relative mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('meal.preview')}</p>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="glass-panel flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{item.name}</p>
                  <Macros protein={item.protein_g} carbs={item.carbs_g} fat={item.fat_g} />
                </div>
                <span className="text-sm font-semibold tabular-nums text-amber-300">
                  {t('meal.kcal', { value: formatNumber(item.calories) })}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={t('meal.removeItem', { name: item.name })}
                  className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleSave} disabled={isSaving} className="btn-accent w-full">
            <ButtonLabel loading={isSaving} loadingText={t('meal.saving')}>
              {t('meal.save', { n: items.length, kcal: formatNumber(previewCalories) })}
            </ButtonLabel>
          </button>
        </div>
      )}

      <div className="relative mt-5 border-t border-white/10 pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">{t('meal.todayTitle')}</h3>
          <p className="text-sm text-slate-400">
            {t('meal.total')}{' '}
            <span className="text-lg font-bold tabular-nums text-amber-300">{formatNumber(totalCalories)}</span>{' '}
            {t('meal.kcalUnit')}
          </p>
        </div>

        {loading ? (
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
        ) : todayMeals.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-500">{t('meal.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {todayMeals.map((log) => (
              <li key={log.id} className="glass-panel flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{log.food_name}</p>
                  <Macros protein={log.protein} carbs={log.carbs} fat={log.fat} />
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-200">
                  {t('meal.kcal', { value: formatNumber(log.calories) })}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete('food', log)}
                  aria-label={t('meal.deleteItem', { name: log.food_name })}
                  className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
})
