import { useTranslation } from 'react-i18next'
import { memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, ChartColumn, Flame, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDailyMacroSeries, getExerciseNames, getExerciseSeries } from '../utils/analytics'
import AnimatedNumber from './AnimatedNumber'
import AnalyticsSkeleton from './AnalyticsSkeleton'

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(16, 20, 29, 0.92)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.75rem',
  color: '#e2e8f0',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 12px 32px -12px rgba(0,0,0,0.7)',
}
const AXIS_TICK = { fontSize: 11, fill: '#64748b' }
const LEGEND_STYLE = { fontSize: 12, color: '#cbd5e1', paddingTop: 8 }
const AXIS_LABEL = { fontSize: 11, fill: '#64748b' }

// เส้นกราฟไล่สี + พื้นที่ใต้เส้นจางลงด้านล่าง
function GradientDefs({ id, from, to }) {
  return (
    <defs>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={from} stopOpacity={0.35} />
        <stop offset="100%" stopColor={to} stopOpacity={0} />
      </linearGradient>
    </defs>
  )
}

function StatTile({ Icon, label, value, unit, decimals = 0, tone, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 28 }}
      className="glass-card flex items-center gap-3 p-4"
    >
      <span className={`icon-tile h-10 w-10 ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-white">
          <AnimatedNumber value={value} decimals={decimals} />
          <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span>
        </p>
      </div>
    </motion.div>
  )
}

function ChartCard({ title, Icon, tone, action, empty, emptyText, children, delay }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 28 }}
      className="glass-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title">
          <span className={`icon-tile ${tone}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h3>
        {action}
      </div>
      {empty ? (
        <p className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </motion.section>
  )
}

function AnalyticsPage({ workoutLogs, foodLogs, loading }) {
  const { t } = useTranslation()
  const exerciseNames = useMemo(() => getExerciseNames(workoutLogs), [workoutLogs])
  const [chosenExercise, setChosenExercise] = useState('')
  // ท่าที่เลือกไว้ไม่มีแล้ว (ยังไม่เคยเลือก/ถูกลบ) -> ใช้ท่าแรก (คำนวณตอน render ไม่ต้อง setState ใน effect)
  const selectedExercise = exerciseNames.includes(chosenExercise) ? chosenExercise : (exerciseNames[0] ?? '')

  const exerciseSeries = useMemo(
    () => getExerciseSeries(workoutLogs, selectedExercise),
    [workoutLogs, selectedExercise]
  )
  const macroSeries = useMemo(() => getDailyMacroSeries(foodLogs), [foodLogs])

  const best1rm = exerciseSeries.reduce((max, point) => Math.max(max, point.estimated_1rm || 0), 0)
  const averageCalories = macroSeries.length
    ? macroSeries.reduce((sum, point) => sum + (point.calories || 0), 0) / macroSeries.length
    : 0

  if (loading) return <AnalyticsSkeleton />

  return (
    <div className="space-y-5">
      <div className="mb-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t('nav.analytics')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('analytics.subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          Icon={Activity}
          label={t('analytics.totalSessions')}
          value={workoutLogs.length}
          unit=""
          tone="border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
          delay={0}
        />
        <StatTile
          Icon={TrendingUp}
          label={selectedExercise ? t('analytics.best1rm', { name: selectedExercise }) : t('analytics.best1rmShort')}
          value={best1rm}
          decimals={1}
          unit={t('common.units.kg')}
          tone="border-violet-400/20 bg-violet-400/10 text-violet-300"
          delay={0.05}
        />
        <StatTile
          Icon={Flame}
          label={t('analytics.avgCalories')}
          value={Math.round(averageCalories)}
          unit={t('common.units.kcal')}
          tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          delay={0.1}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title={t('analytics.progressiveOverload')}
          Icon={TrendingUp}
          tone="border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-cyan-300"
          empty={exerciseSeries.length === 0}
          emptyText={t('analytics.noWorkoutData')}
          delay={0.12}
          action={
            exerciseNames.length > 0 && (
              <select
                value={selectedExercise}
                onChange={(e) => setChosenExercise(e.target.value)}
                aria-label={t('analytics.progressiveOverload')}
                className="max-w-[12rem] rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-100 outline-none focus:border-cyan-400/60"
              >
                {exerciseNames.map((name) => (
                  <option key={name} value={name} className="bg-obsidian-raised">
                    {name}
                  </option>
                ))}
              </select>
            )
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={exerciseSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <GradientDefs id="orm" from="#22d3ee" to="#38bdf8" />
              <GradientDefs id="vol" from="#a855f7" to="#d946ef" />
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                label={{ value: t('analytics.oneRmAxis'), angle: -90, position: 'insideLeft', ...AXIS_LABEL }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                label={{ value: t('analytics.volumeAxis'), angle: 90, position: 'insideRight', ...AXIS_LABEL }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="estimated_1rm"
                name={t('analytics.estimated1rm')}
                stroke="url(#orm-stroke)"
                fill="url(#orm-fill)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="volume_load"
                name={t('analytics.volumeLoad')}
                stroke="url(#vol-stroke)"
                fill="url(#vol-fill)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#a855f7', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('analytics.macroHistory')}
          Icon={ChartColumn}
          tone="border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-violet-300"
          empty={macroSeries.length === 0}
          emptyText={t('analytics.noFoodData')}
          delay={0.18}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={macroSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <GradientDefs id="cal" from="#34d399" to="#22d3ee" />
              <GradientDefs id="pro" from="#8b5cf6" to="#ec4899" />
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                label={{ value: t('analytics.caloriesAxis'), angle: -90, position: 'insideLeft', ...AXIS_LABEL }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                label={{ value: t('analytics.proteinAxis'), angle: 90, position: 'insideRight', ...AXIS_LABEL }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="calories"
                name={t('analytics.calories')}
                stroke="url(#cal-stroke)"
                fill="url(#cal-fill)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#34d399', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="protein"
                name={t('analytics.protein')}
                stroke="url(#pro-stroke)"
                fill="url(#pro-fill)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(AnalyticsPage)
