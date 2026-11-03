import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Beef, Droplet, Flame, Salad, Wheat } from 'lucide-react'
import AnimatedNumber from '../components/AnimatedNumber'
import { MacroBar } from '../components/MacroDashboard'
import MealLogger from '../components/MealLogger'

const EASE = [0.22, 1, 0.36, 1]
const STAGGER = { animate: { transition: { staggerChildren: 0.06 } } }
const RISE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
}

function SummarySkeleton() {
  return (
    <div className="glass-card grid gap-5 p-5 lg:grid-cols-[1fr_1.4fr]" aria-hidden>
      <div className="space-y-3">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-3" />
      </div>
      <div className="space-y-4">
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
        <div className="skeleton h-8" />
      </div>
    </div>
  )
}

// สรุปแคลอรีและสารอาหารที่กินวันนี้ เทียบกับเป้าหมายในโปรไฟล์ (ด้านบนสุดของหน้าโภชนาการ)
// แคลอรีที่เผาผลาญจากการออกกำลังกายดูได้ที่ Dashboard (การ์ดเป้าหมายวันนี้)
const NutritionSummary = memo(function NutritionSummary({ totals, targetCalories, targetProtein, targetCarbs, targetFat, loading }) {
  const { t } = useTranslation()
  if (loading) return <SummarySkeleton />

  const eaten = totals.calories
  const remaining = targetCalories - eaten
  const ratio = targetCalories > 0 ? eaten / targetCalories : 0
  const isOver = remaining < 0
  const units = (key) => t(`common.units.${key}`)

  return (
    <section className="glass-card relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.14),transparent_65%)]"
      />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:gap-8">
        {/* แคลอรี */}
        <div>
          <h2 className="card-title mb-4">
            <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Flame className="h-4 w-4" aria-hidden />
            </span>
            {t('nutrition.summaryTitle')}
          </h2>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{t('nutrition.eaten')}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-white">
              <AnimatedNumber value={eaten} />
            </span>
            <span className="text-sm text-slate-500">
              / {targetCalories.toLocaleString()} {units('kcal')}
            </span>
          </p>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.07]"
            role="progressbar"
            aria-label={t('nutrition.eaten')}
            aria-valuemin={0}
            aria-valuemax={targetCalories}
            aria-valuenow={Math.round(eaten)}
          >
            <motion.div
              className={`h-full origin-left rounded-full ${isOver ? 'bg-amber-300' : 'bg-gradient-to-r from-emerald-400 to-green-300'}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(ratio, 1) }}
              transition={{ duration: 1, ease: EASE }}
            />
          </div>
          <p className={`mt-2 text-sm font-medium ${isOver ? 'text-amber-300' : 'text-emerald-300'}`}>
            {isOver
              ? t('nutrition.over', { value: Math.abs(remaining).toLocaleString() })
              : t('nutrition.remaining', { value: remaining.toLocaleString() })}
          </p>
        </div>

        {/* สารอาหารหลัก */}
        <div className="space-y-4 border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
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
      </div>
    </section>
  )
})

// หน้าโภชนาการ (/nutrition): สรุปแคลอรี/สารอาหารวันนี้ด้านบน + บันทึกอาหารด้วย AI (ไมค์ กล้อง พิมพ์ วิเคราะห์)
// พร้อมรายการอาหารวันนี้ (แก้ไข/ลบได้) ; state ของ logs อยู่ใน App (Dashboard) ร่วมกับหน้าอื่น
export default memo(function NutritionPage({ user, totals, foodLogs, loading, onSaveMeal, onEdit, onDelete }) {
  const { t } = useTranslation()
  return (
    <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-5">
      <motion.div variants={RISE}>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-300/80">
          <Salad className="h-3.5 w-3.5" aria-hidden />
          {t('nutrition.eyebrow')}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('nutrition.title')}</h1>
      </motion.div>

      <motion.div variants={RISE}>
        <NutritionSummary
          totals={totals}
          targetCalories={user?.target_calories ?? 2000}
          targetProtein={user?.target_protein ?? 150}
          targetCarbs={user?.target_carbs}
          targetFat={user?.target_fat}
          loading={loading}
        />
      </motion.div>

      <motion.div variants={RISE} className="mx-auto max-w-3xl">
        <MealLogger foodLogs={foodLogs} loading={loading} onSave={onSaveMeal} onEdit={onEdit} onDelete={onDelete} />
      </motion.div>
    </motion.div>
  )
})
