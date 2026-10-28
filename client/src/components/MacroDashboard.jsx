import { memo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Beef, Droplet, Dumbbell, Equal, Target, Utensils, Wheat } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'

const RADIUS = 52
const STROKE = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const EASE = [0.22, 1, 0.36, 1]

// วงแหวน Remaining Calories = Goal - Calories In + Calories Out
// วงเต็มตาม Net / Goal (Net = In - Out) เกินเป้า = วงสีเหลืองอำพันและตัวเลขเป็น "เกินมา"
function RemainingRing({ remaining, net, goal }) {
  const { t } = useTranslation()
  const gradientId = useId()
  const isOver = remaining < 0
  const filled = goal > 0 ? Math.min(Math.max(net, 0) / goal, 1) : 0
  const [from, to] = isOver ? ['#fbbf24', '#f97316'] : ['#34d399', '#22c55e']

  return (
    <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, transparent 52%, ${isOver ? 'rgba(251,191,36,0.5)' : 'rgba(16,185,129,0.55)'} 60%, transparent 72%)`,
          opacity: 0.35,
        }}
      />
      <svg viewBox="0 0 128 128" className="relative h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />
        <motion.circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - filled) }}
          transition={{ duration: 1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {isOver ? t('dashboard.targets.overLabel') : t('dashboard.targets.remainingLabel')}
        </span>
        <AnimatedNumber
          value={Math.abs(remaining)}
          className={`text-3xl font-bold tabular-nums sm:text-4xl ${isOver ? 'text-amber-300' : 'text-white'}`}
        />
        <span className="text-[11px] text-slate-500">
          {t('dashboard.targets.ofGoal', { goal: goal.toLocaleString() })}
        </span>
      </div>
    </div>
  )
}

// แถว Calories In / Out / Net ข้างวงแหวน
function CalorieStat({ Icon, label, value, note, tone, sign = '' }) {
  const { t } = useTranslation()
  return (
    <div className="glass-panel flex items-center gap-3 px-3 py-2">
      <span className={`icon-tile h-7 w-7 ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[11px] text-slate-500">{label}</p>
        {note && <p className="truncate text-[10px] text-slate-600">{note}</p>}
      </div>
      <p className="text-sm font-semibold tabular-nums text-slate-100">
        {sign}
        <AnimatedNumber value={value} />{' '}
        <span className="text-xs font-normal text-slate-500">{t('common.units.kcal')}</span>
      </p>
    </div>
  )
}

// แถบความคืบหน้าของสารอาหาร target ไม่มี (ยังไม่ได้ทำ onboarding) = แสดงแค่ค่าที่กินไป ไม่มีแถบ
function MacroBar({ Icon, label, value, target, tone, bar }) {
  const { t } = useTranslation()
  const hasTarget = target > 0
  const isOver = hasTarget && value > target
  const percent = hasTarget ? Math.round((value / target) * 100) : null
  const unit = t('common.units.g')

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`icon-tile h-6 w-6 rounded-md ${tone}`}>
          <Icon className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="ml-auto text-sm tabular-nums text-slate-100">
          <AnimatedNumber value={value} decimals={1} />
          {hasTarget && <span className="text-slate-500"> / {target.toLocaleString()}</span>}{' '}
          <span className="text-xs text-slate-500">{unit}</span>
        </span>
        {hasTarget && (
          <span className={`w-10 text-right text-xs font-semibold tabular-nums ${isOver ? 'text-amber-300' : 'text-emerald-300'}`}>
            {percent}%
          </span>
        )}
      </div>
      {hasTarget ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-white/[0.07]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.round(value)}
        >
          <motion.div
            className={`h-full origin-left rounded-full ${isOver ? 'bg-amber-300' : bar}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(value / target, 1) }}
            transition={{ duration: 1, ease: EASE }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-slate-600">{t('dashboard.targets.noTarget')}</p>
      )}
    </div>
  )
}

function MacroDashboardSkeleton() {
  return (
    <div className="glass-card p-5" aria-hidden>
      <div className="skeleton mb-5 h-5 w-32" />
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="skeleton h-40 w-40 rounded-full" />
        <div className="w-full flex-1 space-y-2">
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
      </div>
    </div>
  )
}

// totals = สารอาหารวันนี้จาก food_logs, caloriesOut = แคลอรีที่เผาผลาญวันนี้ (ประมาณจาก workout_logs)
// ตัวเลขทั้งหมดคำนวณจาก logs ใน state ของ Dashboard เพิ่ม/แก้/ลบรายการ = อัปเดตทันที
function MacroDashboard({ totals, caloriesOut, targetCalories, targetProtein, targetCarbs, targetFat, loading }) {
  const { t } = useTranslation()
  if (loading) return <MacroDashboardSkeleton />

  const caloriesIn = totals.calories
  const net = caloriesIn - caloriesOut
  const remaining = targetCalories - caloriesIn + caloriesOut
  const netDiff = Math.abs(net - targetCalories).toLocaleString()

  return (
    <section className="glass-card p-5">
      <h3 className="card-title mb-5">
        <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Target className="h-4 w-4" aria-hidden />
        </span>
        {t('dashboard.targets.title')}
      </h3>

      <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
        <RemainingRing remaining={remaining} net={net} goal={targetCalories} />
        <div className="w-full flex-1 space-y-2">
          <CalorieStat
            Icon={Utensils}
            label={t('dashboard.targets.caloriesIn')}
            value={caloriesIn}
            tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          />
          <CalorieStat
            Icon={Dumbbell}
            label={t('dashboard.targets.caloriesOut')}
            note={t('dashboard.targets.caloriesOutNote')}
            value={caloriesOut}
            tone="border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
          />
          <CalorieStat
            Icon={Equal}
            label={t('dashboard.targets.net')}
            note={
              net > targetCalories
                ? t('dashboard.targets.netOver', { value: netDiff })
                : t('dashboard.targets.netUnder', { value: netDiff })
            }
            value={Math.abs(net)}
            sign={net < 0 ? '−' : ''}
            tone="border-violet-400/20 bg-violet-400/10 text-violet-300"
          />
        </div>
      </div>

      <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
        <MacroBar
          Icon={Beef}
          label={t('dashboard.targets.protein')}
          value={totals.protein}
          target={targetProtein}
          tone="border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
          bar="bg-gradient-to-r from-cyan-400 to-violet-500"
        />
        <MacroBar
          Icon={Wheat}
          label={t('dashboard.targets.carbs')}
          value={totals.carbs}
          target={targetCarbs}
          tone="border-amber-400/20 bg-amber-400/10 text-amber-300"
          bar="bg-gradient-to-r from-amber-400 to-yellow-300"
        />
        <MacroBar
          Icon={Droplet}
          label={t('dashboard.targets.fat')}
          value={totals.fat}
          target={targetFat}
          tone="border-rose-400/20 bg-rose-400/10 text-rose-300"
          bar="bg-gradient-to-r from-rose-400 to-pink-400"
        />
      </div>
    </section>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(MacroDashboard)
