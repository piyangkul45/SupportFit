import { useTranslation } from 'react-i18next'
import { formatReps } from '../utils/workoutPrograms'

export default function TodayProgramCard({ program, day, completedNames, onClear }) {
  const { t } = useTranslation()

  return (
    <div className="glass-card mx-auto mb-4 w-full max-w-md border-lime-400/20 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-lime-300">
            {t('dashboard.programCard.nowPlaying')}
          </p>
          <h3 className="font-semibold text-white">
            {program.name} · {day.name}
          </h3>
        </div>
        <button onClick={onClear} className="shrink-0 text-sm text-slate-500 hover:text-slate-300">
          {t('dashboard.programCard.clear')}
        </button>
      </div>

      <ul className="space-y-1 text-sm">
        {day.exercises.map((ex) => {
          const done = completedNames.has(ex.name.toLowerCase())
          return (
            <li
              key={ex.name}
              className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                done ? 'bg-lime-400/10 text-lime-300 line-through' : 'text-slate-300'
              }`}
            >
              <span>
                {done ? '✅' : '⬜️'} {ex.name}
              </span>
              <span className="text-xs text-slate-500">
                {ex.sets} x {formatReps(ex.reps, t)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
