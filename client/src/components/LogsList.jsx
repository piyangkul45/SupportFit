import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Dumbbell, Pencil, Trash2, UtensilsCrossed } from 'lucide-react'
import { isToday } from '../utils/date'
import AnimatedNumber from './AnimatedNumber'
import Badge from './Badge'

// กดลบครั้งแรกเปลี่ยนเป็นปุ่มยืนยัน ถ้าไม่กดยืนยันภายในเวลานี้จะกลับเป็นปุ่มปกติ (กันลบพลาด)
const CONFIRM_DELETE_MS = 3000

function LogBadges({ kind, log }) {
  const { t } = useTranslation()
  const units = (key) => t(`common.units.${key}`)
  if (kind === 'workout') {
    return (
      <>
        <Badge value={log.weight_kg} unit={units('kg')} tone="emerald" label={t('editLog.weight')} />
        <Badge value={log.reps} unit={units('reps')} tone="cyan" label={t('editLog.reps')} />
        <Badge value={log.sets} unit={units('sets')} tone="violet" label={t('editLog.sets')} />
      </>
    )
  }
  return (
    <>
      <Badge value={log.calories} unit={units('kcal')} tone="emerald" label={t('editLog.calories')} />
      <Badge value={log.protein} prefix={t('dashboard.logs.short.protein')} unit={units('g')} tone="cyan" label={t('editLog.protein')} />
      <Badge value={log.carbs} prefix={t('dashboard.logs.short.carbs')} unit={units('g')} tone="amber" label={t('editLog.carbs')} />
      <Badge value={log.fat} prefix={t('dashboard.logs.short.fat')} unit={units('g')} tone="rose" label={t('editLog.fat')} />
    </>
  )
}

// props เป็นค่าที่คงที่ทั้งหมด (kind, log object เดิม, handler จาก useCallback) -> memo ข้ามการ render
// ของรายการที่ไม่เปลี่ยน เช่น ลบ/แก้ 1 รายการ รายการอื่นไม่ render ใหม่
const LogItem = memo(function LogItem({ kind, log, onEdit, onDelete }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const name = kind === 'workout' ? log.exercise_name : log.food_name

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), CONFIRM_DELETE_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  const iconButton = 'rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.08]'

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-3.5 pr-1.5 transition-colors hover:border-white/10 hover:bg-white/[0.05]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <LogBadges kind={kind} log={log} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEdit(kind, log)}
        aria-label={t('dashboard.logs.edit', { name })}
        data-tooltip={t('dashboard.logs.editShort')}
        className={`${iconButton} hover:text-emerald-300`}
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.button
            key="confirm"
            type="button"
            onClick={() => onDelete(kind, log)}
            autoFocus
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileTap={{ scale: 0.92 }}
            className="rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"
          >
            {t('dashboard.logs.confirmDelete')}
          </motion.button>
        ) : (
          <motion.button
            key="delete"
            type="button"
            onClick={() => setConfirming(true)}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            aria-label={t('dashboard.logs.delete', { name })}
            data-tooltip={t('dashboard.logs.deleteShort')}
            className={`${iconButton} hover:text-red-300`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
  )
})

function LogsSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-xl border border-white/[0.06] p-3">
          <div className="skeleton mb-2 h-4 w-2/5" />
          <div className="flex gap-1.5">
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-4 w-12" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function LogSection({ title, Icon, tone, count, loading, footer, children }) {
  const { t } = useTranslation()
  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="card-title">
          <span className={`icon-tile ${tone}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h3>
        {!loading && <span className="badge border-white/10 bg-white/5 text-slate-300">{count}</span>}
      </div>
      {loading ? (
        <LogsSkeleton />
      ) : count === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-500">
          {t('dashboard.logs.empty')}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>{children}</AnimatePresence>
          </ul>
          {footer}
        </>
      )}
    </section>
  )
}

// onEdit(kind, log) / onDelete(kind, log) โดย kind = 'workout' | 'food'
function LogsList({ workoutLogs, foodLogs, onEdit, onDelete, loading }) {
  const { t } = useTranslation()
  const todayWorkouts = useMemo(() => workoutLogs.filter((log) => isToday(log.created_at)), [workoutLogs])
  const todayFoods = useMemo(() => foodLogs.filter((log) => isToday(log.created_at)), [foodLogs])
  const units = (key) => t(`common.units.${key}`)

  // ปัดทศนิยม 1 ตำแหน่ง กันผลบวกทศนิยมแบบ 52.599999
  const totalCalories = useMemo(() => Math.round(todayFoods.reduce((sum, f) => sum + (f.calories || 0), 0)), [todayFoods])
  const totalProtein = useMemo(
    () => Math.round(todayFoods.reduce((sum, f) => sum + (f.protein || 0), 0) * 10) / 10,
    [todayFoods]
  )

  return (
    <div className="space-y-4">
      <LogSection
        title={t('dashboard.logs.workoutsTitle')}
        Icon={Dumbbell}
        tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
        count={todayWorkouts.length}
        loading={loading}
      >
        {todayWorkouts.map((log) => (
          <LogItem
            key={log.id}
            kind="workout"
            log={log}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </LogSection>

      <LogSection
        title={t('dashboard.logs.mealsTitle')}
        Icon={UtensilsCrossed}
        tone="border-amber-400/20 bg-amber-400/10 text-amber-300"
        count={todayFoods.length}
        loading={loading}
        footer={
          <p className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs text-slate-400">
            <span>{t('dashboard.logs.totalLabel')}</span>
            <span className="font-semibold text-slate-200">
              <AnimatedNumber value={totalCalories} /> {units('kcal')} · {t('dashboard.logs.short.protein')}{' '}
              <AnimatedNumber value={totalProtein} decimals={1} /> {units('g')}
            </span>
          </p>
        }
      >
        {todayFoods.map((log) => (
          <LogItem
            key={log.id}
            kind="food"
            log={log}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </LogSection>
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(LogsList)
