import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Camera, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { analyzeMeal, analyzeMealImage } from '../utils/api'
import { isToday } from '../utils/date'
import { prepareMealImage } from '../utils/image'
import Spinner, { ButtonLabel } from './Spinner'
import { MicButton, Waveform } from './VoiceInput'

// ปุ่มกล้องวงกลมขนาดเท่าปุ่มไมค์ (กรอบ h-32 w-32 เหมือน MicButton จะได้วางเรียงกันพอดี)
// input ไม่ใส่ capture: มือถือให้เลือกได้ทั้งถ่ายรูปใหม่และเลือกจากคลังภาพ
function CameraButton({ busy, disabled, onFile }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <span
        aria-hidden
        className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28),transparent_65%)]"
      />
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label={t('meal.photo.button')}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-2xl shadow-orange-500/30 disabled:opacity-60"
      >
        {busy ? <Spinner className="h-8 w-8" /> : <Camera className="h-9 w-9" aria-hidden />}
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = '' // เลือกรูปเดิมซ้ำได้
          if (file) onFile(file)
        }}
      />
    </div>
  )
}

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

// AI Meal Logger: พิมพ์/พูดว่ากินอะไรไป หรือถ่าย/อัปโหลดรูปอาหาร -> Gemini ประเมินสารอาหาร -> ตรวจแล้วกดบันทึก
// รูป: ย่อเป็น JPEG ในเครื่องก่อนส่ง ข้อความในช่องพิมพ์ (ถ้ามี) ส่งไปเป็นรายละเอียดเสริมของรูป
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
  const [photo, setPhoto] = useState(null) // { url } รูปที่วิเคราะห์ล่าสุด (แสดงคู่กับผลลัพธ์)
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false)
  const recognitionRef = useRef(null)
  const language = i18n.resolvedLanguage

  // คืนหน่วยความจำของรูปตัวอย่างเมื่อเปลี่ยนรูป/ปิดการ์ด
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])

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
    setPhoto(null) // ผลลัพธ์รอบนี้มาจากข้อความ ไม่ใช่รูปเดิม
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

  const handlePhoto = async (file) => {
    if (isAnalyzingPhoto) return
    recognitionRef.current?.stop()
    setError('')
    setItems([])
    setPhoto({ url: URL.createObjectURL(file) })
    setIsAnalyzingPhoto(true)
    try {
      const { data, mimeType } = await prepareMealImage(file)
      const { items: analyzed } = await analyzeMealImage({ image: data, mimeType, note: text.trim() })
      setItems(analyzed)
    } catch (err) {
      const key = { unsupported: 'meal.photo.unsupported', too_large: 'meal.photo.tooLarge' }[err.message]
      setError(key ? t(key) : err.message || t('meal.analyzeFailed'))
    } finally {
      setIsAnalyzingPhoto(false)
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    setItems([])
  }

  const handleSave = async () => {
    if (!items.length || isSaving) return
    setIsSaving(true)
    try {
      const results = await onSave(items)
      const failed = items.filter((_, index) => !results[index])
      setItems(failed)
      if (!failed.length) {
        setText('')
        setPhoto(null)
      }
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

      <div className="relative flex flex-col items-center gap-2 py-2">
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {SpeechRecognition && <MicButton isListening={isListening} onClick={toggleListening} />}
          <CameraButton busy={isAnalyzingPhoto} disabled={isAnalyzingPhoto || isListening} onFile={handlePhoto} />
        </div>
        {SpeechRecognition && <Waveform isListening={isListening} />}
        <p className="text-center text-xs font-medium text-slate-400">
          {isListening
            ? t('voice.listening')
            : isAnalyzingPhoto
              ? t('meal.photo.analyzing')
              : SpeechRecognition
                ? t('meal.photo.hintWithVoice')
                : t('meal.photo.hint')}
        </p>
      </div>

      {photo && (
        <div className="relative mt-2 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <img src={photo.url} alt={t('meal.photo.previewAlt')} className="h-full w-full object-cover" />
            {isAnalyzingPhoto && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-amber-200">
                <Spinner className="h-5 w-5" />
              </span>
            )}
          </div>
          <p className="min-w-0 flex-1 text-xs text-slate-400">
            {isAnalyzingPhoto ? t('meal.photo.analyzing') : items.length ? t('meal.photo.done', { count: items.length }) : t('meal.photo.noteHint')}
          </p>
          {!isAnalyzingPhoto && (
            <button
              type="button"
              onClick={clearPhoto}
              aria-label={t('meal.photo.remove')}
              className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleAnalyze} className="relative mt-3 space-y-3">
        <div>
          <label htmlFor="meal-text" className="mb-1.5 block text-xs font-medium text-slate-400">
            {t('meal.transcriptLabel')}
          </label>
          {/* ระหว่างฟังแสดงคำที่กำลังถอดความต่อท้าย (ล็อกการพิมพ์ไว้) หยุดฟังแล้วแก้ข้อความได้ก่อนวิเคราะห์ */}
          <textarea
            id="meal-text"
            value={isListening && interim ? `${text}${text ? ' ' : ''}${interim}` : text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            readOnly={isListening}
            rows={3}
            maxLength={MAX_TEXT_LENGTH}
            placeholder={t('meal.placeholder')}
            className="input-field resize-none"
          />
        </div>

        <button type="submit" disabled={!text.trim() || isAnalyzing || isAnalyzingPhoto} className="btn-accent w-full">
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
