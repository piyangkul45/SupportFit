import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Activity, Beef, Calculator, Droplet, Flame, Scale, TrendingDown, TrendingUp, UserRound, Wheat, X } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import { ButtonLabel } from './Spinner'
import { ACTIVITY_LEVELS, GENDERS, PROFILE_LIMITS, calculateTargets } from '../utils/macroCalculator'

const GOALS = [
  { id: 'lose_weight', Icon: TrendingDown },
  { id: 'maintain', Icon: Scale },
  { id: 'gain_muscle', Icon: TrendingUp },
]

// [field, translation key, step]
const BODY_FIELDS = [
  ['age', 'profile.age', '1'],
  ['height_cm', 'profile.height', '0.5'],
  ['weight_kg', 'profile.weight', '0.5'],
]

const MACROS = [
  ['protein', 'dashboard.targets.protein', Beef, 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'],
  ['carbs', 'dashboard.targets.carbs', Wheat, 'border-amber-400/20 bg-amber-400/10 text-amber-300'],
  ['fat', 'dashboard.targets.fat', Droplet, 'border-rose-400/20 bg-rose-400/10 text-rose-300'],
]

function toFormValues(user) {
  return {
    age: user?.age ?? '',
    gender: user?.gender ?? '',
    height_cm: user?.height_cm ?? '',
    weight_kg: user?.weight_kg ?? '',
    activity_level: user?.activity_level ?? 'moderate',
    fitness_goal: user?.fitness_goal ?? 'maintain',
  }
}

// ปุ่มตัวเลือกแบบ radio (เพศ, ระดับกิจกรรม, เป้าหมาย)
function OptionButton({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors duration-200 ${
        selected
          ? 'border-emerald-400/50 bg-emerald-400/10 text-white shadow-[0_0_18px_-8px_rgba(16,185,129,0.9)]'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }) {
  return <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">{children}</p>
}

// ผลคำนวณสด: BMR / TDEE / แคลอรี่เป้าหมาย / สารอาหาร
function TargetsPreview({ targets }) {
  const { t } = useTranslation()
  const g = t('common.units.g')
  const kcal = t('common.units.kcal')

  return (
    <div className="glass-panel space-y-4 p-4">
      <p className="card-title">
        <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Calculator className="h-4 w-4" aria-hidden />
        </span>
        {t('profile.preview.title')}
      </p>

      {targets ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              ['bmr', 'profile.preview.bmr'],
              ['tdee', 'profile.preview.tdee'],
            ].map(([key, labelKey]) => (
              <div key={key} className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2">
                <p className="text-[11px] text-slate-500">{t(labelKey)}</p>
                <p className="text-sm font-semibold text-slate-200">
                  <AnimatedNumber value={targets[key]} /> <span className="text-xs font-normal text-slate-500">{kcal}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/15 to-green-500/5 p-3 text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-200/80">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              {t('profile.preview.calories')}
            </p>
            <p className="mt-0.5 text-3xl font-bold text-white">
              <AnimatedNumber value={targets.calories} /> <span className="text-sm font-medium text-slate-400">{kcal}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MACROS.map(([key, labelKey, Icon, tone]) => (
              <div key={key} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/20 py-2.5">
                <span className={`icon-tile h-7 w-7 ${tone}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <p className="text-[11px] text-slate-500">{t(labelKey)}</p>
                <p className="text-sm font-semibold text-slate-100">
                  <AnimatedNumber value={targets[key]} /> <span className="text-xs font-normal text-slate-500">{g}</span>
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">{t('profile.preview.empty')}</p>
      )}
    </div>
  )
}

// Onboarding (mode 'onboarding': ปิดไม่ได้จนกว่าจะบันทึก) และ Profile Settings (mode 'edit')
// onSave(payload) คืน Promise; ถ้า throw จะแสดง error ค้างไว้ในฟอร์ม
export default function ProfileModal({ user, mode = 'edit', onSave, onClose }) {
  const { t } = useTranslation()
  const [values, setValues] = useState(() => toFormValues(user))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const firstInputRef = useRef(null)
  const dismissible = mode === 'edit'
  const targets = useMemo(() => calculateTargets(values), [values])

  useEffect(() => {
    firstInputRef.current?.focus()
    if (!dismissible) return undefined
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissible, onClose])

  const setField = (field, value) => setValues((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!targets) return setError(t('profile.incomplete'))

    setError('')
    setSaving(true)
    try {
      await onSave({
        ...values,
        age: Number(values.age),
        height_cm: Number(values.height_cm),
        weight_kg: Number(values.weight_kg),
        target_calories: targets.calories,
        target_protein: targets.protein,
        target_carbs: targets.carbs,
        target_fat: targets.fat,
      })
    } catch (err) {
      setError(err.message || t('profile.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => dismissible && event.target === event.currentTarget && onClose()}
    >
      <motion.form
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="glass-card max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto bg-obsidian-raised/85 p-5 sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 id="profile-modal-title" className="card-title text-base">
              <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <UserRound className="h-4 w-4" aria-hidden />
              </span>
              {t(mode === 'onboarding' ? 'profile.onboardingTitle' : 'profile.settingsTitle')}
            </h3>
            <p className="mt-1.5 text-sm text-slate-400">
              {t(mode === 'onboarding' ? 'profile.onboardingSubtitle' : 'profile.settingsSubtitle')}
            </p>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('profile.close')}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_17rem]">
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('profile.gender')}</SectionLabel>
              <div role="radiogroup" aria-label={t('profile.gender')} className="grid grid-cols-2 gap-2">
                {GENDERS.map((gender) => (
                  <OptionButton
                    key={gender}
                    selected={values.gender === gender}
                    onClick={() => setField('gender', gender)}
                    className="text-center font-medium"
                  >
                    {t(`profile.genders.${gender}`)}
                  </OptionButton>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {BODY_FIELDS.map(([field, labelKey, step], index) => (
                <div key={field}>
                  <label htmlFor={`profile-${field}`} className="mb-1.5 block text-xs font-medium text-slate-400">
                    {t(labelKey)}
                  </label>
                  <input
                    id={`profile-${field}`}
                    ref={index === 0 ? firstInputRef : undefined}
                    type="number"
                    inputMode="decimal"
                    min={PROFILE_LIMITS[field][0]}
                    max={PROFILE_LIMITS[field][1]}
                    step={step}
                    value={values[field]}
                    onChange={(event) => setField(field, event.target.value)}
                    className="input-field"
                  />
                </div>
              ))}
            </div>

            <div>
              <SectionLabel>
                <Activity className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                {t('profile.activity')}
              </SectionLabel>
              <div role="radiogroup" aria-label={t('profile.activity')} className="grid gap-1.5">
                {ACTIVITY_LEVELS.map((level) => (
                  <OptionButton
                    key={level}
                    selected={values.activity_level === level}
                    onClick={() => setField('activity_level', level)}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="font-medium">{t(`profile.activityLevels.${level}.label`)}</span>
                    <span className="text-right text-xs text-slate-500">{t(`profile.activityLevels.${level}.hint`)}</span>
                  </OptionButton>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('profile.goal')}</SectionLabel>
              <div role="radiogroup" aria-label={t('profile.goal')} className="grid grid-cols-3 gap-2">
                {GOALS.map(({ id, Icon }) => (
                  <OptionButton
                    key={id}
                    selected={values.fitness_goal === id}
                    onClick={() => setField('fitness_goal', id)}
                    className="flex flex-col items-center gap-1.5 py-3 text-center"
                  >
                    <Icon className="h-5 w-5 text-emerald-300" aria-hidden />
                    <span className="text-xs font-medium leading-tight sm:text-sm">{t(`profile.goals.${id}`)}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 md:sticky md:top-0 md:self-start">
            <TargetsPreview targets={targets} />

            {error && (
              <p className="animate-shake rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              {dismissible && (
                <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">
                  {t('profile.cancel')}
                </button>
              )}
              <button type="submit" disabled={saving || !targets} className="btn-accent flex-1 text-sm">
                <ButtonLabel loading={saving} loadingText={t('profile.saving')}>
                  {t(mode === 'onboarding' ? 'profile.start' : 'profile.save')}
                </ButtonLabel>
              </button>
            </div>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
