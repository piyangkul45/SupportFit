import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Dumbbell, UtensilsCrossed, X } from 'lucide-react'
import { ButtonLabel } from './Spinner'

// field ที่แก้ได้ของแต่ละประเภท [ชื่อ field, translation key, step ของ input]
const FIELDS = {
  workout: {
    name: ['exercise_name', 'editLog.exercise'],
    numbers: [
      ['weight_kg', 'editLog.weight', '0.5'],
      ['reps', 'editLog.reps', '1'],
      ['sets', 'editLog.sets', '1'],
    ],
  },
  food: {
    name: ['food_name', 'editLog.food'],
    numbers: [
      ['calories', 'editLog.calories', '1'],
      ['protein', 'editLog.protein', '1'],
      ['carbs', 'editLog.carbs', '1'],
      ['fat', 'editLog.fat', '1'],
    ],
  },
}

function toFormValues(kind, log) {
  const { name, numbers } = FIELDS[kind]
  const values = { [name[0]]: log[name[0]] ?? '' }
  for (const [field] of numbers) values[field] = log[field] ?? ''
  return values
}

// ฟอร์มแก้ไขรายการที่บันทึกแล้ว (kind = 'workout' | 'food')
// onSave(values) คืน Promise; ถ้า throw จะแสดง error ค้างไว้ในฟอร์ม
export default function EditLogModal({ kind, log, onSave, onClose }) {
  const { t } = useTranslation()
  const [values, setValues] = useState(() => toFormValues(kind, log))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef(null)
  const { name, numbers } = FIELDS[kind]

  useEffect(() => {
    nameInputRef.current?.focus()
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setField = (field) => (event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedName = String(values[name[0]]).trim()
    if (!trimmedName) return setError(t('editLog.nameRequired'))

    const payload = { [name[0]]: trimmedName }
    for (const [field] of numbers) {
      const raw = String(values[field]).trim()
      const number = raw === '' ? null : Number(raw)
      if (number != null && !(Number.isFinite(number) && number >= 0)) return setError(t('editLog.invalidNumber'))
      payload[field] = number
    }

    setError('')
    setSaving(true)
    try {
      await onSave(payload)
    } catch (err) {
      setError(err.message || t('editLog.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
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
        aria-labelledby="edit-log-title"
        className="glass-card w-full max-w-sm space-y-4 bg-obsidian-raised/90 p-5"
      >
        <div className="flex items-center justify-between">
          <h3 id="edit-log-title" className="card-title">
            <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              {kind === 'workout' ? <Dumbbell className="h-4 w-4" aria-hidden /> : <UtensilsCrossed className="h-4 w-4" aria-hidden />}
            </span>
            {t(kind === 'workout' ? 'editLog.titleWorkout' : 'editLog.titleFood')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('editLog.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div>
          <label htmlFor="edit-log-name" className="mb-1.5 block text-sm font-medium text-slate-300">
            {t(name[1])}
          </label>
          <input
            id="edit-log-name"
            ref={nameInputRef}
            type="text"
            maxLength={100}
            value={values[name[0]]}
            onChange={setField(name[0])}
            className="input-field"
          />
        </div>

        <div className={`grid gap-3 ${numbers.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {numbers.map(([field, labelKey, step]) => (
            <div key={field}>
              <label htmlFor={`edit-log-${field}`} className="mb-1.5 block text-xs font-medium text-slate-400">
                {t(labelKey)}
              </label>
              <input
                id={`edit-log-${field}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={step}
                value={values[field]}
                onChange={setField(field)}
                className="input-field"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="animate-shake rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">
            {t('editLog.cancel')}
          </button>
          <button type="submit" disabled={saving} className="btn-accent flex-1 text-sm">
            <ButtonLabel loading={saving} loadingText={t('editLog.saving')}>
              {t('editLog.save')}
            </ButtonLabel>
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
