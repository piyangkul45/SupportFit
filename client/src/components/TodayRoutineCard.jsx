import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BedDouble, CalendarCheck, Check, ChevronRight, Mic } from 'lucide-react'
import { dayName, programTitle } from '../utils/programs'

const MAX_SET_BOXES = 8

// เซตที่ทำแล้ว / เป้าหมาย เป็นช่องติ๊ก (เกิน MAX_SET_BOXES เซตแสดงเป็นตัวเลขอย่างเดียว)
function SetBoxes({ done, total }) {
  if (total > MAX_SET_BOXES) return null
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors duration-300 ${
            i < done ? 'border-emerald-400/60 bg-emerald-400/80 text-obsidian' : 'border-white/15 bg-white/[0.03]'
          }`}
        >
          {i < done && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      ))}
    </span>
  )
}

function RoutineSkeleton() {
  return (
    <div className="glass-card space-y-3 p-5" aria-hidden>
      <div className="skeleton h-5 w-48" />
      <div className="skeleton h-12" />
      <div className="skeleton h-12" />
    </div>
  )
}

// ตารางฝึกวันนี้จากโปรแกรมที่ใช้อยู่ (GET /api/users/me/active-program/today)
// แตะท่าเพื่อเลือก แล้วพูดแค่ตัวเลข ("100 kg 8 reps") ระบบจะบันทึกเข้าท่านั้น
function TodayRoutineCard({ routine, loading, setsDone, selectedExercise, onSelectExercise, onChooseProgram }) {
  const { t } = useTranslation()
  if (loading) return <RoutineSkeleton />

  if (!routine?.program) {
    return (
      <section className="glass-card flex items-center justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{t('dashboard.routine.title')}</h3>
            <p className="text-xs text-slate-400">{t('dashboard.routine.none')}</p>
          </div>
        </div>
        <button type="button" onClick={onChooseProgram} className="btn-ghost flex shrink-0 items-center gap-1 px-3 py-2 text-xs">
          {t('dashboard.routine.choose')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </section>
    )
  }

  const { program, today } = routine
  const exercises = today.day.exercises
  const doneOf = (exercise) => Math.min(setsDone.get(exercise.exercise_name.toLowerCase()) || 0, exercise.sets)
  const completedSets = exercises.reduce((sum, exercise) => sum + doneOf(exercise), 0)
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const allDone = totalSets > 0 && completedSets >= totalSets

  return (
    <section className="glass-card border-emerald-400/20 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
              {t('dashboard.routine.title')}
            </p>
            <h3 className="truncate text-sm font-semibold text-white">
              {programTitle(program, t)} · {dayName(today.day, today.day_index, t)}
            </h3>
            <p className="text-[11px] text-slate-500">
              {today.week == null
                ? t('dashboard.routine.dayOfCycle', { day: today.day_number, total: today.cycle_length })
                : t('dashboard.routine.dayOf', { day: today.day_number, total: today.cycle_length, week: today.week })}
            </p>
          </div>
        </div>
        <button type="button" onClick={onChooseProgram} className="btn-icon shrink-0 p-1.5" aria-label={t('dashboard.routine.manage')} data-tooltip={t('dashboard.routine.manage')}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {today.is_rest_day ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <BedDouble className="h-6 w-6 shrink-0 text-cyan-300" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('dashboard.routine.restDay')}</p>
            <p className="text-xs text-slate-400">{t('dashboard.routine.restHint')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                initial={{ width: 0 }}
                animate={{ width: `${totalSets ? (completedSets / totalSets) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-300">
              {t('dashboard.routine.setsDone', { done: completedSets, total: totalSets })}
            </span>
          </div>

          <ul className="space-y-1.5">
            {exercises.map((exercise, index) => {
              const done = doneOf(exercise)
              const complete = done >= exercise.sets
              const selected = selectedExercise === exercise.exercise_name
              return (
                <li key={`${exercise.exercise_name}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelectExercise(selected ? null : exercise.exercise_name)}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ${
                      selected
                        ? 'border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_18px_-8px_rgba(16,185,129,0.9)]'
                        : complete
                          ? 'border-transparent bg-emerald-400/[0.05]'
                          : 'border-white/[0.06] bg-black/20 hover:border-white/15'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1.5 truncate text-sm font-medium ${complete ? 'text-emerald-300' : 'text-slate-100'}`}>
                        {selected && <Mic className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />}
                        <span className="truncate">{exercise.exercise_name}</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {t('programs.target', { sets: exercise.sets, reps: exercise.reps })}
                        {exercise.weight_kg != null && ` · ${t('programs.targetWeight', { weight: exercise.weight_kg })}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <SetBoxes done={done} total={exercise.sets} />
                      <span className={`text-[11px] tabular-nums ${complete ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {t('dashboard.routine.exerciseSets', { done, total: exercise.sets })}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <p className="mt-3 text-[11px] text-slate-500">
            {allDone ? t('dashboard.routine.allDone') : t('dashboard.routine.tapHint')}
          </p>
        </>
      )}
    </section>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(TodayRoutineCard)
