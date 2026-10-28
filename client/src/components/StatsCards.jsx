import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CalendarDays, ChartColumn, Dumbbell, History, Scale, TrendingDown, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getWeightLogs, saveWeightLog } from '../utils/api'
import { caloriesForLog } from '../utils/calories'
import { localDateString } from '../utils/date'
import { dailyCalorieSeries, historyByDate, lastNDates, longDate, shortDate } from '../utils/stats'
import { ButtonLabel } from './Spinner'

// สีของกราฟ (ตรวจด้วย dataviz validator บนพื้นการ์ด #10141d แล้ว: lightness/chroma/CVD/contrast ผ่านทั้งหมด)
// Calories In = aqua, Calories Out = orange (ใช้ตรงกันทุกกราฟ) ; น้ำหนักตัวเป็นเส้นเดียวใช้ aqua
const SERIES = { in: '#199e70', out: '#d95926', weight: '#199e70' }
const SURFACE = '#10141d'
const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' }
const GRID = 'rgba(255,255,255,0.06)'
const BASELINE = '#94a3b8'
const WEIGHT_RANGES = [7, 30]
const HISTORY_PAGE = 14

function Card({ Icon, title, action, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 28 }}
      className="glass-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title">
          <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </motion.section>
  )
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === option.value ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// กล่อง tooltip ร่วม: ข้อความใช้สีตัวอักษร ส่วนสีของ series อยู่ที่จุดหน้าแถว
function TooltipBox({ title, rows, footer }) {
  return (
    <div className="min-w-40 rounded-xl border border-white/10 bg-obsidian-raised/95 px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-slate-100">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center justify-between gap-4 text-slate-300">
          <span className="flex items-center gap-1.5">
            {row.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />}
            {row.label}
          </span>
          <span className="font-semibold tabular-nums text-slate-100">{row.value}</span>
        </p>
      ))}
      {footer && <p className="mt-1.5 border-t border-white/10 pt-1.5 text-slate-400">{footer}</p>}
    </div>
  )
}

const EmptyChart = ({ children }) => (
  <p className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-slate-500">
    {children}
  </p>
)

// ---- 1. กราฟแนวโน้มน้ำหนักตัว + ฟอร์มบันทึกน้ำหนักรายวัน ----
// โหลด 30 วันครั้งเดียว (ครอบคลุมทั้งมุมมอง 7 และ 30 วัน) บันทึกแล้วแทนค่าวันนั้นใน state ทันที
// onProfileWeight(kg): น้ำหนักวันล่าสุดถูกบันทึกเป็นน้ำหนักในโปรไฟล์แล้ว (ให้ Dashboard ใช้คำนวณแคลอรี)
export const WeightTrendCard = memo(function WeightTrendCard({ onProfileWeight, delay }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  const today = localDateString()
  const [range, setRange] = useState(7)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    let cancelled = false
    getWeightLogs(WEIGHT_RANGES[WEIGHT_RANGES.length - 1], localDateString())
      .then((rows) => !cancelled && setLogs(rows))
      .catch((err) => !cancelled && setLoadError(err.message || t('stats.weight.loadFailed')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [t])

  // ทุกวันในช่วง (วันที่ไม่ได้ชั่ง = null เส้นต่อข้ามให้)
  const series = useMemo(() => {
    const byDate = new Map(logs.map((log) => [log.logged_on, log.weight_kg]))
    return lastNDates(range).map((day) => ({ date: day, weight: byDate.get(day) ?? null }))
  }, [logs, range])
  const points = series.filter((point) => point.weight != null)
  const latest = points.at(-1)?.weight ?? null
  const change = points.length >= 2 ? Math.round((points.at(-1).weight - points[0].weight) * 10) / 10 : null

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = Number(weight)
    if (!weight || !Number.isFinite(value) || value < 20 || value > 400) return setFormError(t('stats.weight.invalid'))
    setFormError('')
    setSavedNote('')
    setSaving(true)
    try {
      const { log, profile_weight_kg } = await saveWeightLog(value, date)
      setLogs((prev) => [...prev.filter((row) => row.logged_on !== log.logged_on), log].sort((a, b) => (a.logged_on > b.logged_on ? 1 : -1)))
      if (profile_weight_kg != null) onProfileWeight?.(profile_weight_kg)
      setWeight('')
      setSavedNote(t('stats.weight.saved', { weight: log.weight_kg, date: shortDate(log.logged_on, language) }))
    } catch (err) {
      setFormError(err.message || t('stats.weight.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const unit = t('common.units.kg')
  const ChangeIcon = change != null && change > 0 ? TrendingUp : TrendingDown

  return (
    <Card
      Icon={Scale}
      title={t('stats.weight.title')}
      delay={delay}
      action={
        <Segmented
          label={t('stats.weight.rangeLabel')}
          value={range}
          onChange={setRange}
          options={WEIGHT_RANGES.map((days) => ({ value: days, label: t('stats.rangeDays', { count: days }) }))}
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-slate-500">{t('stats.weight.latest')}</p>
          <p className="text-2xl font-bold tabular-nums text-white">
            {latest != null ? latest : '—'} <span className="text-sm font-medium text-slate-500">{unit}</span>
          </p>
        </div>
        {change != null && (
          <p className="flex items-center gap-1 pb-1 text-sm text-slate-300">
            <ChangeIcon className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="font-semibold tabular-nums text-slate-100">
              {change > 0 ? '+' : ''}
              {change} {unit}
            </span>
            <span className="text-slate-500">{t('stats.weight.changeIn', { count: range })}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="skeleton h-[240px]" aria-hidden />
      ) : loadError ? (
        <EmptyChart>{loadError}</EmptyChart>
      ) : points.length === 0 ? (
        <EmptyChart>{t('stats.weight.empty')}</EmptyChart>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => shortDate(value, language)}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={[(min) => Math.floor(min - 1), (max) => Math.ceil(max + 1)]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
              unit=""
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
              content={({ active, payload, label }) =>
                active && payload?.[0]?.value != null ? (
                  <TooltipBox title={longDate(label, language)} rows={[{ label: t('stats.weight.series'), value: `${payload[0].value} ${unit}`, color: SERIES.weight }]} />
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="weight"
              name={t('stats.weight.series')}
              stroke={SERIES.weight}
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: SERIES.weight, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: SERIES.weight, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="mb-2 text-xs font-medium text-slate-400">{t('stats.weight.formTitle')}</p>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="400"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={t('stats.weight.placeholder')}
              aria-label={t('stats.weight.placeholder')}
              className="input-field pr-10 tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{unit}</span>
          </div>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            aria-label={t('stats.weight.date')}
            className="input-field order-last col-span-2 [color-scheme:dark] sm:order-none sm:col-span-1"
          />
          <button type="submit" disabled={saving} className="btn-accent px-4 text-sm">
            <ButtonLabel loading={saving} loadingText={t('stats.weight.saving')}>
              {t('stats.weight.save')}
            </ButtonLabel>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{t('stats.weight.hint')}</p>
        {formError && <p role="alert" className="mt-2 text-sm text-red-300">{formError}</p>}
        {savedNote && <p role="status" className="mt-2 text-sm text-emerald-300">{savedNote}</p>}
      </form>
    </Card>
  )
})

// ---- 2. กราฟแท่ง Calories In vs Calories Out 7 วัน + เส้นประเป้าหมายรายวัน ----
export const WeeklyCaloriesCard = memo(function WeeklyCaloriesCard({ foodLogs, workoutLogs, bodyWeightKg, targetCalories, delay }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  const kcal = t('common.units.kcal')
  const target = Number(targetCalories) || 0

  const series = useMemo(
    () => dailyCalorieSeries(foodLogs, workoutLogs, lastNDates(7), bodyWeightKg),
    [foodLogs, workoutLogs, bodyWeightKg]
  )
  const hasData = series.some((day) => day.caloriesIn || day.caloriesOut)
  const loggedDays = series.filter((day) => day.caloriesIn > 0)
  const avgIn = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.caloriesIn, 0) / loggedDays.length) : 0
  const totalOut = series.reduce((sum, day) => sum + day.caloriesOut, 0)
  const overDays = target ? loggedDays.filter((day) => day.caloriesIn > target).length : 0
  const format = (value) => Math.round(value).toLocaleString()

  return (
    <Card Icon={ChartColumn} title={t('stats.calories.title')} delay={delay}>
      {!hasData ? (
        <EmptyChart>{t('stats.calories.empty')}</EmptyChart>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={series} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => shortDate(value, language)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, (max) => Math.ceil((Math.max(max, target) * 1.1) / 100) * 100]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const day = payload[0].payload
                const net = day.caloriesIn - day.caloriesOut
                const diff = net - target
                return (
                  <TooltipBox
                    title={longDate(label, language)}
                    rows={[
                      { label: t('stats.calories.in'), value: `${format(day.caloriesIn)} ${kcal}`, color: SERIES.in },
                      { label: t('stats.calories.out'), value: `${format(day.caloriesOut)} ${kcal}`, color: SERIES.out },
                      { label: t('stats.calories.net'), value: `${format(net)} ${kcal}` },
                    ]}
                    footer={
                      target
                        ? diff > 0
                          ? t('stats.calories.overTarget', { value: format(diff) })
                          : t('stats.calories.underTarget', { value: format(-diff) })
                        : null
                    }
                  />
                )
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#cbd5e1', paddingTop: 8 }} />
            {target > 0 && (
              <ReferenceLine
                y={target}
                stroke={BASELINE}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{ value: t('stats.calories.targetLabel', { value: format(target) }), position: 'insideTopRight', fill: '#cbd5e1', fontSize: 11 }}
              />
            )}
            <Bar dataKey="caloriesIn" name={t('stats.calories.in')} fill={SERIES.in} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="caloriesOut" name={t('stats.calories.out')} fill={SERIES.out} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          [t('stats.calories.avgIn'), `${format(avgIn)}`, kcal],
          [t('stats.calories.totalOut'), `${format(totalOut)}`, kcal],
          [t('stats.calories.overDays'), target ? `${overDays}/${loggedDays.length}` : '—', t('stats.calories.days')],
        ].map(([label, value, unitLabel]) => (
          <div key={label} className="glass-panel px-2 py-2">
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-100">
              {value} <span className="text-[11px] font-normal text-slate-500">{unitLabel}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
})

// รายละเอียดการออกกำลังกาย 1 แถว: "4 × 8 · 60 กก." หรือ "30 นาที · 5 กม."
function workoutDetail(log, t) {
  const parts = []
  if (log.sets || log.reps) parts.push(`${log.sets ?? 1} × ${log.reps ?? '—'}`)
  if (log.weight_kg) parts.push(`${log.weight_kg} ${t('common.units.kg')}`)
  if (log.duration_min) parts.push(`${log.duration_min} ${t('workout.units.min')}`)
  if (log.distance_km) parts.push(`${log.distance_km} ${t('workout.units.km')}`)
  return parts.join(' · ') || '—'
}

// ---- 3. ประวัติย้อนหลังแยกตามวัน: เลือกวัน -> รายการอาหาร (Macros) + ท่าฝึก (แคลอรีที่เผาผลาญ) ----
export const HistoryLog = memo(function HistoryLog({ foodLogs, workoutLogs, bodyWeightKg, delay }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  const days = useMemo(() => historyByDate(foodLogs, workoutLogs, bodyWeightKg), [foodLogs, workoutLogs, bodyWeightKg])
  const [chosenDate, setChosenDate] = useState(null)
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE)
  // วันที่เลือกไว้ไม่มีแล้ว (ลบรายการหมด) หรือยังไม่เลือก -> วันล่าสุด
  const selected = days.find((day) => day.date === chosenDate) || days[0] || null
  const kcal = t('common.units.kcal')
  const g = t('common.units.g')
  const format = (value) => Math.round(Number(value) || 0).toLocaleString()

  return (
    <Card Icon={History} title={t('stats.history.title')} delay={delay}>
      {!days.length ? (
        <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">{t('stats.history.empty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
          {/* รายการวัน: มือถือเลื่อนแนวนอน จอใหญ่เป็นคอลัมน์ซ้าย */}
          <div>
            <ul className="flex gap-2 overflow-x-auto pb-1 md:max-h-[28rem] md:flex-col md:overflow-y-auto md:overflow-x-visible md:pb-0 md:pr-1">
              {days.slice(0, visibleCount).map((day) => {
                const active = day.date === selected?.date
                return (
                  <li key={day.date} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setChosenDate(day.date)}
                      aria-pressed={active}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                        active ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${active ? 'text-emerald-100' : 'text-slate-200'}`}>{shortDate(day.date, language)}</p>
                      <p className="text-[11px] tabular-nums text-slate-500">
                        {t('stats.history.dayChip', { in: format(day.totals.calories), out: format(day.totals.caloriesOut) })}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
            {days.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + HISTORY_PAGE)}
                className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10"
              >
                {t('stats.history.showMore')}
              </button>
            )}
          </div>

          {selected && (
            <div className="min-w-0 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-300" aria-hidden />
                <h4 className="text-sm font-semibold text-white">{longDate(selected.date, language)}</h4>
              </div>

              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  [t('stats.calories.in'), format(selected.totals.calories), kcal],
                  [t('stats.calories.out'), format(selected.totals.caloriesOut), kcal],
                  [t('dashboard.targets.protein'), format(selected.totals.protein), g],
                  [t('dashboard.targets.carbs'), format(selected.totals.carbs), g],
                  [t('dashboard.targets.fat'), format(selected.totals.fat), g],
                ].map(([label, value, unitLabel]) => (
                  <div key={label} className="glass-panel px-2.5 py-2">
                    <dt className="text-[11px] text-slate-500">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-100">
                      {value} <span className="text-[11px] font-normal text-slate-500">{unitLabel}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
                  {t('stats.history.foods', { count: selected.foods.length })}
                </p>
                {selected.foods.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[26rem] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="pb-1.5 font-medium">{t('stats.history.food')}</th>
                          <th className="w-20 pb-1.5 text-right font-medium">{kcal}</th>
                          <th className="w-14 pb-1.5 text-right font-medium">P</th>
                          <th className="w-14 pb-1.5 text-right font-medium">C</th>
                          <th className="w-14 pb-1.5 text-right font-medium">F</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.foods.map((log) => (
                          <tr key={log.id} className="border-t border-white/[0.05]">
                            <td className="py-1.5 pr-2 text-slate-200">{log.food_name}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-100">{format(log.calories)}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-400">{format(log.protein)}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-400">{format(log.carbs)}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-400">{format(log.fat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t('stats.history.noFoods')}</p>
                )}
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                  {t('stats.history.workouts', { count: selected.workouts.length })}
                </p>
                {selected.workouts.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[26rem] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="pb-1.5 font-medium">{t('stats.history.exercise')}</th>
                          <th className="pb-1.5 font-medium">{t('stats.history.detail')}</th>
                          <th className="w-20 pb-1.5 text-right font-medium">{kcal}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.workouts.map((log) => (
                          <tr key={log.id} className="border-t border-white/[0.05]">
                            <td className="py-1.5 pr-2 text-slate-200">{log.exercise_name}</td>
                            <td className="py-1.5 pr-2 tabular-nums text-slate-400">{workoutDetail(log, t)}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-100">{format(caloriesForLog(log, bodyWeightKg))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t('stats.history.noWorkouts')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
})
