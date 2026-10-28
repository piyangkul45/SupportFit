import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BedDouble, CalendarDays, Check, Copy, Pencil, Sparkles, X } from 'lucide-react'
import { generateProgram } from '../utils/api'
import { dayName, isRestDay, programDescription, programTitle, trainingDayCount } from '../utils/programs'
import { ButtonLabel } from './Spinner'

// กรอบ popup แบบเดียวกับ ProgramBuilderModal: มือถือเลื่อนขึ้นจากล่าง, จอใหญ่อยู่กลางจอ, Esc/คลิกพื้นหลัง = ปิด
function ModalFrame({ Icon, title, titleId, onClose, children, footer, as = 'div', onSubmit }) {
  const { t } = useTranslation()
  const Panel = as === 'form' ? motion.form : motion.div

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <Panel
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-card flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col bg-obsidian-raised/85"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-5">
          <h3 id={titleId} className="card-title min-w-0 text-base">
            <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="truncate">{title}</span>
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
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap gap-2 border-t border-white/[0.07] p-4">{footer}</div>}
      </Panel>
    </motion.div>
  )
}

// ตารางฝึกรายวัน Day 1 - Day N พร้อมท่า เซต × ครั้ง (และน้ำหนักเป้าหมายถ้ามี)
// onSelect: ตั้งเป็นโปรแกรมที่ใช้อยู่ ; onEdit: แก้ไข (โปรแกรมของฉัน) หรือคัดลอกไปแก้ (preset)
export function ProgramScheduleModal({ program, isActive, busy, onSelect, onEdit, onClose }) {
  const { t } = useTranslation()
  const description = programDescription(program, t)

  return (
    <ModalFrame
      Icon={CalendarDays}
      title={programTitle(program, t)}
      titleId="program-schedule-title"
      onClose={onClose}
      footer={
        <>
          {isActive ? (
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200">
              <Check className="h-4 w-4" aria-hidden />
              {t('programs.schedule.inUse')}
            </span>
          ) : (
            <button type="button" disabled={busy} onClick={onSelect} className="btn-accent flex-1 text-sm">
              <ButtonLabel loading={busy} loadingText={t('programs.selecting')}>
                {t('programs.schedule.select')}
              </ButtonLabel>
            </button>
          )}
          <button type="button" onClick={onEdit} className="btn-ghost flex items-center justify-center gap-1.5 text-sm">
            {program.is_preset ? <Copy className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
            {t(program.is_preset ? 'programs.customize' : 'programs.edit')}
          </button>
        </>
      }
    >
      {description && <p className="mb-2 text-sm text-slate-300">{description}</p>}
      <p className="mb-4 text-xs text-slate-500">
        {t('programs.trainingDays', { count: trainingDayCount(program) })} · {t('programs.cycleDays', { count: program.days.length })}
      </p>

      <ol className="space-y-3">
        {program.days.map((day, index) => {
          const rest = isRestDay(day)
          return (
            <li
              key={index}
              className={`rounded-xl border p-3.5 ${rest ? 'border-white/[0.05] bg-white/[0.02]' : 'border-emerald-400/15 bg-emerald-400/[0.03]'}`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    rest ? 'bg-white/5 text-slate-500' : 'bg-gradient-to-br from-emerald-400 to-green-600 text-white'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('programs.dayFallback', { number: index + 1 })}</p>
                  <p className={`truncate text-sm font-semibold ${rest ? 'text-slate-500' : 'text-slate-100'}`}>{dayName(day, index, t)}</p>
                </div>
                {rest && <BedDouble className="ml-auto h-4 w-4 text-slate-600" aria-hidden />}
              </div>

              {!rest && (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-1.5 font-medium">{t('programs.schedule.exercise')}</th>
                      <th className="w-16 pb-1.5 text-right font-medium">{t('programs.schedule.sets')}</th>
                      <th className="w-16 pb-1.5 text-right font-medium">{t('programs.schedule.reps')}</th>
                      <th className="w-20 pb-1.5 text-right font-medium">{t('programs.schedule.weight')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((exercise, exerciseIndex) => (
                      <tr key={`${exercise.exercise_name}-${exerciseIndex}`} className="border-t border-white/[0.05]">
                        <td className="py-1.5 pr-2 text-slate-200">{exercise.exercise_name}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-300">{exercise.sets}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-300">{exercise.reps}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-400">
                          {exercise.weight_kg ? `${exercise.weight_kg} ${t('common.units.kg')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          )
        })}
      </ol>
    </ModalFrame>
  )
}

const DAY_OPTIONS = [2, 3, 4, 5, 6]
const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'machine', 'kettlebell']
const GOAL_OPTIONS = ['gain_muscle', 'lose_weight', 'strength', 'endurance', 'general']
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced']

function OptionChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-300">{label}</legend>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </fieldset>
  )
}

// รับจำนวนวัน/อุปกรณ์/เป้าหมาย/ระดับ -> server ให้ Gemini ออกแบบแล้วบันทึกเป็นโปรแกรมของฉัน -> onCreated(program)
// ใช้เวลาหลายวินาที ปิด popup ไม่ได้ระหว่างรอ (กันผู้ใช้กดซ้ำแล้วได้โปรแกรมซ้ำ)
export function AiProgramModal({ onCreated, onClose }) {
  const { t } = useTranslation()
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [equipment, setEquipment] = useState(['barbell', 'dumbbell', 'machine'])
  const [goal, setGoal] = useState('gain_muscle')
  const [level, setLevel] = useState('beginner')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const toggleEquipment = (item) =>
    setEquipment((prev) => (prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item]))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (generating) return
    setError('')
    setGenerating(true)
    try {
      const program = await generateProgram({ days_per_week: daysPerWeek, equipment, goal, level })
      onCreated(program)
    } catch (err) {
      setError(err.message || t('programs.ai.failed'))
      setGenerating(false)
    }
  }

  const close = () => !generating && onClose()

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      Icon={Sparkles}
      title={t('programs.ai.title')}
      titleId="ai-program-title"
      onClose={close}
      footer={
        <button type="submit" disabled={generating} className="btn-accent flex w-full items-center justify-center gap-2 text-sm">
          <ButtonLabel loading={generating} loadingText={t('programs.ai.generating')}>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t('programs.ai.submit')}
            </span>
          </ButtonLabel>
        </button>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-400">{t('programs.ai.intro')}</p>

        <Field label={t('programs.ai.daysLabel')}>
          <div className="grid grid-cols-5 gap-2">
            {DAY_OPTIONS.map((value) => (
              <OptionChip key={value} active={daysPerWeek === value} onClick={() => setDaysPerWeek(value)}>
                {t('programs.ai.daysOption', { count: value })}
              </OptionChip>
            ))}
          </div>
        </Field>

        <Field label={t('programs.ai.equipmentLabel')} hint={t('programs.ai.equipmentHint')}>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map((item) => (
              <OptionChip key={item} active={equipment.includes(item)} onClick={() => toggleEquipment(item)}>
                {t(`programs.ai.equipment.${item}`)}
              </OptionChip>
            ))}
          </div>
        </Field>

        <Field label={t('programs.ai.goalLabel')}>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((value) => (
              <OptionChip key={value} active={goal === value} onClick={() => setGoal(value)}>
                {t(`programs.ai.goals.${value}`)}
              </OptionChip>
            ))}
          </div>
        </Field>

        <Field label={t('programs.ai.levelLabel')}>
          <div className="grid grid-cols-3 gap-2">
            {LEVEL_OPTIONS.map((value) => (
              <OptionChip key={value} active={level === value} onClick={() => setLevel(value)}>
                {t(`programs.ai.levels.${value}`)}
              </OptionChip>
            ))}
          </div>
        </Field>

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </ModalFrame>
  )
}
