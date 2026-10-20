import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { BedDouble, CalendarPlus, Dumbbell, Plus, Search, Trash2, X } from 'lucide-react'
import { ButtonLabel } from './Spinner'
import { searchExercises } from '../utils/api'
import { isRestDay } from '../utils/programs'

const SEARCH_DELAY_MS = 200
const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 20
const NEW_EXERCISE = { sets: 3, reps: 10, weight_kg: '' }

// ช่องค้นหาท่ามาตรฐาน (ค้นได้ทั้งชื่ออังกฤษและไทย) เลือกแล้วเพิ่มเข้าวันนั้น
function ExerciseSearch({ onAdd, disabled }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      searchExercises(query)
        .then((names) => !cancelled && setResults(names))
        .catch(() => !cancelled && setResults([]))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => !boxRef.current?.contains(event.target) && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const add = (name) => {
    onAdd(name)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter') {
            event.preventDefault()
            if (results[0]) add(results[0])
          }
        }}
        placeholder={t(disabled ? 'programs.builder.dayFull' : 'programs.builder.searchPlaceholder')}
        aria-label={t('programs.builder.searchPlaceholder')}
        className="input-field pl-9"
      />
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-obsidian-raised/95 p-1 shadow-xl glass-blur"
          >
            {results.length ? (
              results.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => add(name)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                  >
                    <Plus className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                    {name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-2 text-sm text-slate-500">{t('programs.builder.noResults')}</li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function NumberCell({ label, value, onChange, step = '1', min = '0' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field px-2.5 py-2 text-center"
      />
    </label>
  )
}

function DayEditor({ day, index, canRemove, onChange, onRemove }) {
  const { t } = useTranslation()
  const rest = isRestDay(day)

  const updateExercise = (exerciseIndex, field, value) =>
    onChange({
      ...day,
      exercises: day.exercises.map((exercise, i) => (i === exerciseIndex ? { ...exercise, [field]: value } : exercise)),
    })

  return (
    <motion.div layout="position" className="glass-panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="badge shrink-0 border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
          {t('programs.dayFallback', { number: index + 1 })}
        </span>
        <input
          type="text"
          maxLength={60}
          value={day.name}
          onChange={(event) => onChange({ ...day, name: event.target.value })}
          placeholder={t(rest ? 'programs.restDay' : 'programs.builder.dayNamePlaceholder')}
          aria-label={t('programs.builder.dayName', { number: index + 1 })}
          className="input-field min-w-0 flex-1 py-2"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('programs.builder.removeDay', { number: index + 1 })}
            data-tooltip={t('programs.builder.removeDay', { number: index + 1 })}
            className="btn-icon shrink-0 p-2 text-slate-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {rest && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <BedDouble className="h-3.5 w-3.5" aria-hidden />
          {t('programs.builder.restDayHint')}
        </p>
      )}

      <ul className="space-y-2">
        {day.exercises.map((exercise, exerciseIndex) => (
          <li
            key={`${exercise.exercise_name}-${exerciseIndex}`}
            className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-100">
                <Dumbbell className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
                <span className="truncate">{exercise.exercise_name}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...day, exercises: day.exercises.filter((_, i) => i !== exerciseIndex) })}
                aria-label={t('programs.builder.removeExercise', { name: exercise.exercise_name })}
                className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-red-300"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberCell label={t('programs.builder.sets')} min="1" value={exercise.sets} onChange={(value) => updateExercise(exerciseIndex, 'sets', value)} />
              <NumberCell label={t('programs.builder.reps')} min="1" value={exercise.reps} onChange={(value) => updateExercise(exerciseIndex, 'reps', value)} />
              <NumberCell
                label={t('programs.builder.weight')}
                step="0.5"
                value={exercise.weight_kg}
                onChange={(value) => updateExercise(exerciseIndex, 'weight_kg', value)}
              />
            </div>
          </li>
        ))}
      </ul>

      <ExerciseSearch
        disabled={day.exercises.length >= MAX_EXERCISES_PER_DAY}
        onAdd={(name) => onChange({ ...day, exercises: [...day.exercises, { exercise_name: name, ...NEW_EXERCISE }] })}
      />
    </motion.div>
  )
}

// สร้าง/แก้ไขโปรแกรม: ชื่อ + คำอธิบาย + วัน (วันที่ไม่มีท่า = วันพัก) + ท่า/เซต/ครั้ง/น้ำหนักเป้าหมาย
// draft = ค่าเริ่มต้น (ดู toBuilderDraft) ; onSave(payload) คืน Promise ถ้า throw จะแสดง error ค้างไว้
export default function ProgramBuilderModal({ draft, isEditing, onSave, onClose }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description)
  const [days, setDays] = useState(draft.days)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // วันพัก = วันที่ไม่มีท่า ต่างจากวันฝึกใหม่แค่ตั้งชื่อ "วันพัก" ไว้ให้
  const addDay = (rest) => setDays((prev) => [...prev, { name: rest ? t('programs.restDay') : '', exercises: [] }])
  const updateDay = (index, day) => setDays((prev) => prev.map((current, i) => (i === index ? day : current)))
  const removeDay = (index) => setDays((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!title.trim()) return setError(t('programs.builder.titleRequired'))
    if (!days.some((day) => !isRestDay(day))) return setError(t('programs.builder.noTrainingDays'))

    setError('')
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        days: days.map((day) => ({
          name: day.name.trim(),
          exercises: day.exercises.map((exercise) => ({
            exercise_name: exercise.exercise_name,
            sets: Number(exercise.sets),
            reps: Number(exercise.reps),
            weight_kg: exercise.weight_kg === '' ? null : Number(exercise.weight_kg),
          })),
        })),
      })
    } catch (err) {
      setError(err.message || t('programs.feedback.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.form
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-builder-title"
        className="glass-card flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col bg-obsidian-raised/85"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-5">
          <h3 id="program-builder-title" className="card-title text-base">
            <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <CalendarPlus className="h-4 w-4" aria-hidden />
            </span>
            {t(isEditing ? 'programs.builder.editTitle' : 'programs.builder.createTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('programs.builder.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">{t('programs.builder.titleLabel')}</span>
              <input
                ref={titleRef}
                type="text"
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('programs.builder.titlePlaceholder')}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">{t('programs.builder.descriptionLabel')}</span>
              <input
                type="text"
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('programs.builder.descriptionPlaceholder')}
                className="input-field"
              />
            </label>
          </div>

          <div className="space-y-3">
            {days.map((day, index) => (
              <DayEditor
                key={index}
                day={day}
                index={index}
                canRemove={days.length > 1}
                onChange={(next) => updateDay(index, next)}
                onRemove={() => removeDay(index)}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={days.length >= MAX_DAYS} onClick={() => addDay(false)} className="btn-ghost flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
              <Plus className="h-4 w-4" aria-hidden />
              {t('programs.builder.addDay')}
            </button>
            <button type="button" disabled={days.length >= MAX_DAYS} onClick={() => addDay(true)} className="btn-ghost flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
              <BedDouble className="h-4 w-4" aria-hidden />
              {t('programs.builder.addRestDay')}
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/[0.07] p-5">
          {error && (
            <p className="animate-shake rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">
              {t('programs.builder.cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-accent flex-1 text-sm">
              <ButtonLabel loading={saving} loadingText={t('programs.builder.saving')}>
                {t('programs.builder.save')}
              </ButtonLabel>
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
