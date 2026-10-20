import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CircleCheck, Circle, Trophy, X } from 'lucide-react'
import { formatReps } from '../utils/workoutPrograms'

function TodayProgramCard({ program, day, completedNames, onClear }) {
  const { t } = useTranslation()
  const doneCount = day.exercises.filter((ex) => completedNames.has(ex.name.toLowerCase())).length
  const progress = doneCount / day.exercises.length

  return (
    <section className="glass-card border-emerald-400/20 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Trophy className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
              {t('dashboard.programCard.nowPlaying')}
            </p>
            <h3 className="truncate text-sm font-semibold text-white">
              {program.name} · {day.name}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label={t('dashboard.programCard.clear')}
          data-tooltip={t('dashboard.programCard.clear')}
          className="btn-icon shrink-0 p-1.5"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-300">
          {t('dashboard.programCard.progress', { done: doneCount, total: day.exercises.length })}
        </span>
      </div>

      <ul className="space-y-1 text-sm">
        {day.exercises.map((ex) => {
          const done = completedNames.has(ex.name.toLowerCase())
          return (
            <li
              key={ex.name}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                done ? 'bg-emerald-400/[0.08] text-emerald-300' : 'text-slate-300'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {done ? (
                  <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                )}
                <span className={`truncate ${done ? 'line-through decoration-emerald-400/50' : ''}`}>{ex.name}</span>
              </span>
              <span className="badge shrink-0 border-white/10 bg-white/5 text-slate-400">
                {ex.sets} × {formatReps(ex.reps, t)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(TodayProgramCard)
