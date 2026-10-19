import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDailyMacroSeries, getExerciseNames, getExerciseSeries } from '../utils/analytics'

export default function AnalyticsPage({ workoutLogs, foodLogs }) {
  const { t } = useTranslation()
  const exerciseNames = useMemo(() => getExerciseNames(workoutLogs), [workoutLogs])
  const [selectedExercise, setSelectedExercise] = useState('')

  useEffect(() => {
    if (exerciseNames.length > 0 && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0])
    }
  }, [exerciseNames, selectedExercise])

  const exerciseSeries = useMemo(
    () => getExerciseSeries(workoutLogs, selectedExercise),
    [workoutLogs, selectedExercise]
  )
  const macroSeries = useMemo(() => getDailyMacroSeries(foodLogs), [foodLogs])

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.75rem',
    color: '#e2e8f0',
  }
  const axisTick = { fontSize: 12, fill: '#94a3b8' }
  const legendStyle = { fontSize: 13, color: '#cbd5e1' }

  return (
    <div className="mx-auto mt-6 w-full max-w-2xl space-y-8">
      <div className="glass-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-white">{t('analytics.progressiveOverload')}</h3>
          {exerciseNames.length > 0 && (
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-slate-100 outline-none focus:border-lime-400/60"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name} className="bg-slate-900">
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {exerciseSeries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('analytics.noWorkoutData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={exerciseSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={axisTick} />
              <YAxis
                yAxisId="left"
                tick={axisTick}
                label={{ value: t('analytics.oneRmAxis'), angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                label={{ value: t('analytics.volumeAxis'), angle: 90, position: 'insideRight', fontSize: 12, fill: '#94a3b8' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="estimated_1rm"
                name={t('analytics.estimated1rm')}
                stroke="#a3e635"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="volume_load"
                name={t('analytics.volumeLoad')}
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-4 font-semibold text-white">{t('analytics.macroHistory')}</h3>
        {macroSeries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('analytics.noFoodData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={macroSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={axisTick} />
              <YAxis
                yAxisId="left"
                tick={axisTick}
                label={{ value: t('analytics.caloriesAxis'), angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                label={{ value: t('analytics.proteinAxis'), angle: 90, position: 'insideRight', fontSize: 12, fill: '#94a3b8' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="calories"
                name={t('analytics.calories')}
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="protein"
                name={t('analytics.protein')}
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
