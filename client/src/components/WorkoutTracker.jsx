import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Check, Dumbbell, Flame, PersonStanding, Plus, Search, X } from 'lucide-react'
import { calculateCaloriesBurned } from '../utils/calories'
import { CATEGORIES, DEFAULT_MET, searchExercises } from '../utils/exerciseCatalog'
import { ButtonLabel } from './Spinner'

const CATEGORY_ICONS = { strength: Dumbbell, cardio: Activity, street: PersonStanding }
const EMPTY_DETAILS = { sets: '', reps: '', weight: '', duration: '', distance: '' }

// '' = ไม่ได้กรอก (null), ค่าที่ไม่ใช่ตัวเลขไม่ติดลบ = NaN (ฟอร์มแจ้ง error)
const parseField = (value) => {
  const text = String(value).trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN
}

function NumberField({ id, label, unit, value, onChange, step = '1', required }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-400">
        {label}
        {required && <span className="text-emerald-300"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field pr-12 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  )
}

// Workout Tracker: เลือกหมวด -> ค้นหา/เลือกท่า -> กรอกเซต/ครั้ง/น้ำหนัก หรือเวลา/ระยะทาง -> บันทึก
// แคลอรีที่เผาผลาญคำนวณจาก MET ของท่า + น้ำหนักตัว (utils/calories.js) แสดงก่อนบันทึก
// onSave(entry) คืน Promise<boolean> ว่าบันทึกสำเร็จหรือไม่
export default memo(function WorkoutTracker({ bodyWeightKg, onSave }) {
  const { t } = useTranslation()
  const [category, setCategory] = useState('strength')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null) // { name, category, met, kcalPerKgKm? }
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const results = useMemo(() => searchExercises(query, category), [query, category])
  const trimmedQuery = query.trim()
  const hasExactMatch = results.some((exercise) => exercise.name.toLowerCase() === trimmedQuery.toLowerCase())

  const selectExercise = (exercise) => {
    setSelected(exercise)
    setCategory(exercise.category)
    setError('')
  }
  const selectCustom = () =>
    selectExercise({ name: trimmedQuery.slice(0, 100), category, met: DEFAULT_MET[category], custom: true })

  const changeCategory = (next) => {
    setCategory(next)
    if (selected && selected.category !== next) setSelected(null)
    setError('')
  }

  const setField = (field) => (value) => setDetails((prev) => ({ ...prev, [field]: value }))

  const isCardio = selected?.category === 'cardio'
  const values = {
    sets: parseField(details.sets),
    reps: parseField(details.reps),
    weight: parseField(details.weight),
    duration: parseField(details.duration),
    distance: parseField(details.distance),
  }
  const caloriesPreview = selected
    ? calculateCaloriesBurned(
        {
          category: selected.category,
          met: selected.met,
          kcalPerKgKm: selected.kcalPerKgKm,
          sets: values.sets,
          durationMin: values.duration,
          distanceKm: values.distance,
        },
        bodyWeightKg
      )
    : 0

  // คืน key ของ error หรือ null ถ้าครบ
  const validate = () => {
    if (Object.values(values).some(Number.isNaN)) return 'workout.errors.invalidNumber'
    if (isCardio) {
      const distanceOnly = selected.kcalPerKgKm && values.distance > 0
      return values.duration > 0 || distanceOnly ? null : selected.kcalPerKgKm ? 'workout.errors.durationOrDistance' : 'workout.errors.duration'
    }
    if (!(values.sets >= 1) || !(values.reps >= 1)) return 'workout.errors.setsReps'
    if (selected.category === 'strength' && values.weight == null) return 'workout.errors.weight'
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selected || saving) return
    const errorKey = validate()
    if (errorKey) return setError(t(errorKey))

    setError('')
    setSaving(true)
    const entry = isCardio
      ? {
          exercise_name: selected.name,
          activity_type: 'cardio',
          duration_min: values.duration,
          distance_km: values.distance,
          calories_burned: caloriesPreview,
        }
      : {
          exercise_name: selected.name,
          activity_type: selected.category,
          sets: Math.round(values.sets),
          reps: Math.round(values.reps),
          weight_kg: values.weight,
          calories_burned: caloriesPreview,
        }
    try {
      if (await onSave(entry)) setDetails(EMPTY_DETAILS)
    } finally {
      setSaving(false)
    }
  }

  const categoryLabel = (key) => t(`workout.categories.${key}`)

  return (
    <section className="glass-card relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_65%)]"
      />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <h2 className="card-title">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Dumbbell className="h-4 w-4" aria-hidden />
          </span>
          {t('workout.title')}
        </h2>
      </div>

      {/* หมวดกิจกรรม */}
      <div role="tablist" aria-label={t('workout.categoryLabel')} className="relative grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICONS[key]
          const active = key === category
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeCategory(key)}
              className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="workout-category"
                  className="absolute inset-0 rounded-lg border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-green-600/20"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative h-4 w-4" aria-hidden />
              <span className="relative">{categoryLabel(key)}</span>
            </button>
          )
        })}
      </div>

      {/* ค้นหาท่า */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('workout.searchPlaceholder')}
          aria-label={t('workout.searchPlaceholder')}
          className="input-field pl-9"
        />
      </div>

      <div className="relative mt-3 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {results.map((exercise) => {
          const active = selected?.name === exercise.name && !selected.custom
          return (
            <button
              key={exercise.name}
              type="button"
              onClick={() => selectExercise(exercise)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]'
              }`}
            >
              {active && <Check className="h-3.5 w-3.5" aria-hidden />}
              {exercise.name}
              {exercise.category !== category && (
                <span className="text-[10px] text-slate-500">· {categoryLabel(exercise.category)}</span>
              )}
            </button>
          )
        })}
        {trimmedQuery && !hasExactMatch && (
          <button
            type="button"
            onClick={selectCustom}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-400/30 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('workout.useCustom', { name: trimmedQuery, category: categoryLabel(category) })}
          </button>
        )}
        {!results.length && !trimmedQuery && <p className="text-sm text-slate-500">{t('workout.noResults')}</p>}
      </div>

      {/* รายละเอียดการเล่น */}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.form
            key="details"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-white">
                  {selected.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">{categoryLabel(selected.category)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t('workout.clearSelection')}
                  className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {isCardio ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    id="workout-duration"
                    label={t('workout.fields.duration')}
                    unit={t('workout.units.min')}
                    value={details.duration}
                    onChange={setField('duration')}
                    required={!selected.kcalPerKgKm}
                  />
                  <NumberField
                    id="workout-distance"
                    label={t('workout.fields.distance')}
                    unit={t('workout.units.km')}
                    value={details.distance}
                    onChange={setField('distance')}
                    step="0.1"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <NumberField id="workout-sets" label={t('workout.fields.sets')} unit={t('common.units.sets')} value={details.sets} onChange={setField('sets')} required />
                  <NumberField id="workout-reps" label={t('workout.fields.reps')} unit={t('common.units.reps')} value={details.reps} onChange={setField('reps')} required />
                  <NumberField
                    id="workout-weight"
                    label={selected.category === 'street' ? t('workout.fields.addedWeight') : t('workout.fields.weight')}
                    unit={t('common.units.kg')}
                    value={details.weight}
                    onChange={setField('weight')}
                    step="0.5"
                    required={selected.category === 'strength'}
                  />
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Flame className="h-4 w-4 text-orange-400" aria-hidden />
                  {t('workout.caloriesEstimate')}
                </span>
                <span className="text-lg font-bold tabular-nums text-emerald-300">
                  {caloriesPreview.toLocaleString()} <span className="text-xs font-normal text-slate-500">{t('common.units.kcal')}</span>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                {t('workout.caloriesNote', { met: selected.met, weight: Number(bodyWeightKg) > 0 ? bodyWeightKg : 70 })}
              </p>

              {error && (
                <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button type="submit" disabled={saving} className="btn-accent mt-3 w-full">
                <ButtonLabel loading={saving} loadingText={t('workout.saving')}>
                  {t('workout.save')}
                </ButtonLabel>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  )
})
