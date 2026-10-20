import { memo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Beef, Droplet, Flame, Target, Wheat } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'

const RADIUS = 52
const STROKE = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// วงแหวนความคืบหน้า (SVG) ไล่สีตาม from/to พร้อมตัวเลขนับขึ้นตรงกลาง
function ProgressRing({ label, Icon, current, target, unit, from, to, glow }) {
  const { t } = useTranslation()
  const gradientId = useId()
  const safeTarget = target || 1
  const percent = Math.round((current / safeTarget) * 100)
  const filled = Math.min(current / safeTarget, 1)
  const difference = Math.round(Math.abs(target - current)).toLocaleString()

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-36 w-36 sm:h-40 sm:w-40">
        {/* แสงเรืองคงที่ (ไม่ใช้ filter: drop-shadow ที่ต้องคำนวณใหม่ทุกเฟรมระหว่างวงแหวนขยับ) */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, transparent 52%, ${glow} 60%, transparent 72%)`, opacity: 0.35 }}
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
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="mb-0.5 h-4 w-4 text-slate-400" aria-hidden />
          <AnimatedNumber value={current} className="text-2xl font-bold text-white sm:text-3xl" />
          <span className="text-[11px] text-slate-500">
            / {target.toLocaleString()} {unit}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-200">
        {label}{' '}
        <span className={percent > 100 ? 'text-amber-300' : 'text-emerald-300'}>{percent}%</span>
      </p>
      <p className="text-xs text-slate-500">
        {current > target
          ? t('dashboard.targets.over', { value: difference, unit })
          : t('dashboard.targets.remaining', { value: difference, unit })}
      </p>
    </div>
  )
}

// target ไม่มี (ยังไม่ได้ทำ onboarding) = แสดงแค่ค่าที่กินไป ไม่มีแถบความคืบหน้า
function MacroChip({ Icon, label, value, target, unit, tone, bar }) {
  const hasTarget = target > 0
  const filled = hasTarget ? Math.min(value / target, 1) : 0

  return (
    <div className="glass-panel px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className={`icon-tile h-7 w-7 ${tone}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-slate-100">
            <AnimatedNumber value={value} />
            {hasTarget && <span className="font-normal text-slate-500"> / {target.toLocaleString()}</span>}{' '}
            <span className="text-xs font-normal text-slate-500">{unit}</span>
          </p>
        </div>
      </div>
      {hasTarget && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className={`h-full origin-left rounded-full ${value > target ? 'bg-amber-300' : bar}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: filled }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
    </div>
  )
}

function MacroDashboardSkeleton() {
  return (
    <div className="glass-card p-5" aria-hidden>
      <div className="skeleton mb-5 h-5 w-32" />
      <div className="flex justify-around">
        <div className="skeleton h-36 w-36 rounded-full" />
        <div className="skeleton h-36 w-36 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="skeleton h-12" />
        <div className="skeleton h-12" />
      </div>
    </div>
  )
}

function MacroDashboard({ totals, targetCalories, targetProtein, targetCarbs, targetFat, loading }) {
  const { t } = useTranslation()
  if (loading) return <MacroDashboardSkeleton />

  return (
    <section className="glass-card p-5">
      <h3 className="card-title mb-5">
        <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Target className="h-4 w-4" aria-hidden />
        </span>
        {t('dashboard.targets.title')}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <ProgressRing
          label={t('dashboard.targets.calories')}
          Icon={Flame}
          current={totals.calories}
          target={targetCalories}
          unit={t('common.units.kcal')}
          from="#34d399"
          to="#22c55e"
          glow="rgba(16,185,129,0.55)"
        />
        <ProgressRing
          label={t('dashboard.targets.protein')}
          Icon={Beef}
          current={totals.protein}
          target={targetProtein}
          unit={t('common.units.g')}
          from="#22d3ee"
          to="#a855f7"
          glow="rgba(34,211,238,0.45)"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MacroChip
          Icon={Wheat}
          label={t('dashboard.targets.carbs')}
          value={totals.carbs}
          target={targetCarbs}
          unit={t('common.units.g')}
          tone="border-amber-400/20 bg-amber-400/10 text-amber-300"
          bar="bg-gradient-to-r from-amber-400 to-yellow-300"
        />
        <MacroChip
          Icon={Droplet}
          label={t('dashboard.targets.fat')}
          value={totals.fat}
          target={targetFat}
          unit={t('common.units.g')}
          tone="border-rose-400/20 bg-rose-400/10 text-rose-300"
          bar="bg-gradient-to-r from-rose-400 to-pink-400"
        />
      </div>
    </section>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(MacroDashboard)
