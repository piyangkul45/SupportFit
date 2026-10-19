import { useTranslation } from 'react-i18next'
import { isToday } from '../utils/date'

export default function LogsList({ workoutLogs, foodLogs }) {
  const { t } = useTranslation()
  const todayWorkouts = workoutLogs.filter((log) => isToday(log.created_at))
  const todayFoods = foodLogs.filter((log) => isToday(log.created_at))

  const totalCalories = todayFoods.reduce((sum, f) => sum + (f.calories || 0), 0)
  const totalProtein = todayFoods.reduce((sum, f) => sum + (f.protein || 0), 0)

  return (
    <div className="mx-auto mt-6 w-full max-w-md space-y-4">
      <div className="glass-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-400/10 text-base">
            💪
          </span>
          {t('dashboard.logs.workoutsToday', { count: todayWorkouts.length })}
        </h3>
        {todayWorkouts.length === 0 ? (
          <p className="text-sm text-slate-500">{t('dashboard.logs.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {todayWorkouts.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-200">{log.exercise_name}</span>
                <span className="shrink-0 text-slate-400">
                  {t('dashboard.logs.workoutLine', {
                    weight: log.weight_kg ?? '-',
                    reps: log.reps ?? '-',
                    sets: log.sets ?? '-',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-base">
            🍽️
          </span>
          {t('dashboard.logs.mealsToday', { count: todayFoods.length })}
        </h3>
        {todayFoods.length === 0 ? (
          <p className="text-sm text-slate-500">{t('dashboard.logs.empty')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {todayFoods.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-200">{log.food_name}</span>
                  <span className="shrink-0 text-slate-400">
                    {t('dashboard.logs.foodLine', {
                      calories: log.calories ?? '-',
                      protein: log.protein ?? '-',
                    })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-white/10 pt-2 text-sm font-medium text-slate-300">
              {t('dashboard.logs.totalToday', { calories: totalCalories, protein: totalProtein })}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
