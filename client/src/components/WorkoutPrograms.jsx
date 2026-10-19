import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatReps, WORKOUT_PROGRAMS } from '../utils/workoutPrograms'

const DIFFICULTY_STYLE = {
  beginner: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  intermediate: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  advanced: 'border-red-400/30 bg-red-400/10 text-red-300',
}

function getPrimaryMuscles(program) {
  const all = program.days.flatMap((day) => day.exercises.flatMap((ex) => ex.muscles))
  return [...new Set(all)].slice(0, 4)
}

export default function WorkoutPrograms({ onStart }) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState(WORKOUT_PROGRAMS[0]?.id ?? null)
  const muscleLabel = (key) => t(`programs.muscles.${key}`)

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-slate-400">{t('programs.intro')}</p>

      {WORKOUT_PROGRAMS.map((program) => {
        const isExpanded = expandedId === program.id
        const primaryMuscles = getPrimaryMuscles(program)

        return (
          <div key={program.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : program.id)}
              className={`relative flex w-full items-start justify-between gap-3 bg-gradient-to-br p-5 text-left ${program.accent}`}
            >
              <div
                aria-hidden
                className="absolute -right-4 -top-4 text-7xl opacity-20 blur-[1px]"
              >
                {program.emoji}
              </div>

              <div className="relative min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white drop-shadow">{program.name}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur ${DIFFICULTY_STYLE[program.difficulty] ?? 'border-white/30 bg-white/10 text-white'}`}
                  >
                    {t(`programs.difficulty.${program.difficulty}`)}
                  </span>
                </div>
                <p className="text-sm text-white/80">{t('programs.by', { name: program.celebrity })}</p>
                <p className="mt-2 max-w-md text-sm text-white/90">{t(`programs.taglines.${program.id}`)}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {primaryMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur"
                    >
                      {muscleLabel(muscle)}
                    </span>
                  ))}
                </div>
              </div>

              <span className="relative shrink-0 text-xl text-white/80">
                {isExpanded ? '▲' : '▼'}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-4 p-5">
                {program.days.map((day) => (
                  <div key={day.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-100">{day.name}</h4>
                      <button
                        onClick={() => onStart(program, day)}
                        className="btn-accent px-3 py-1.5 text-sm hover:scale-[1.03]"
                      >
                        {t('programs.start')}
                      </button>
                    </div>

                    <ul className="space-y-1.5">
                      {day.exercises.map((ex) => (
                        <li
                          key={ex.name}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-100">{ex.name}</span>
                          <span className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="rounded-full bg-lime-400/10 px-2 py-0.5 font-medium text-lime-300">
                              {ex.sets} x {formatReps(ex.reps, t)}
                            </span>
                            <span>{ex.muscles.map(muscleLabel).join(' / ')}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
