import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CalendarDays, Check } from 'lucide-react'
import { programDescription, programTitle, trainingDayCount } from '../utils/programs'
import { ButtonLabel } from './Spinner'

// สี/อีโมจิประจำโปรแกรม (ข้อมูลโปรแกรมจริงมาจาก server/programs/presets.js ส่วน CELEBRITY_PROGRAMS)
const STYLE = {
  arnold_golden_six: { emoji: '🏛️', accent: 'from-amber-500 to-orange-600' },
  cbum_classic: { emoji: '🏆', accent: 'from-fuchsia-500 to-purple-700' },
  rock_hercules: { emoji: '🔥', accent: 'from-red-600 to-rose-800' },
  thor_superhero: { emoji: '⚡', accent: 'from-sky-500 to-blue-700' },
  mentzer_hit: { emoji: '💥', accent: 'from-slate-500 to-zinc-700' },
  nippard_4day: { emoji: '🔬', accent: 'from-emerald-500 to-teal-700' },
}
const FALLBACK_STYLE = { emoji: '💪', accent: 'from-emerald-500 to-green-700' }

const DIFFICULTY_STYLE = {
  beginner: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  intermediate: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  advanced: 'border-red-400/30 bg-red-400/10 text-red-300',
}

// Routine ของคนดัง (preset category 'celebrity'): ดูตารางฝึก (popup) หรือเลือกเป็นโปรแกรมที่ใช้อยู่ (ซิงก์เข้า Dashboard)
// onView(program) / onSelect(program) ใช้ตัวเดียวกับ preset ทั่วไปใน pages/Programs.jsx
function WorkoutPrograms({ programs, activeId, busyId, onView, onSelect }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {programs.map((program, index) => {
        const style = STYLE[program.key] || FALLBACK_STYLE
        const isActive = program.id === activeId
        return (
          <motion.article
            key={program.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 28 }}
            onClick={(event) => !event.target.closest('button') && onView(program)}
            className={`glass-card relative flex cursor-pointer flex-col overflow-hidden transition-colors hover:border-emerald-400/30 ${
              isActive ? 'border-emerald-400/40' : ''
            }`}
          >
            <div aria-hidden className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-20 ${style.accent}`} />
            <div aria-hidden className="absolute -right-3 -top-5 text-7xl opacity-15">
              {style.emoji}
            </div>

            <div className="relative flex flex-1 flex-col p-5">
              <div className="mb-1 flex flex-wrap items-center gap-2 pr-10">
                <h3 className="text-base font-bold text-white">{programTitle(program, t)}</h3>
                {isActive && (
                  <span className="badge border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                    <Check className="mr-1 h-3 w-3" aria-hidden />
                    {t('programs.activeBadge')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{t('programs.by', { name: program.celebrity })}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2 py-0.5 font-semibold ${DIFFICULTY_STYLE[program.difficulty] ?? 'border-white/30 bg-white/10 text-white'}`}>
                  {t(`programs.difficulty.${program.difficulty}`)}
                </span>
                <span className="text-slate-400">
                  {t('programs.trainingDays', { count: trainingDayCount(program) })} · {t('programs.cycleDays', { count: program.days.length })}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-300">{programDescription(program, t)}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(program.muscles || []).map((muscle) => (
                  <span key={muscle} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                    {t(`programs.muscles.${muscle}`)}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button type="button" onClick={() => onView(program)} className="btn-ghost flex items-center justify-center gap-1.5 px-3 py-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {t('programs.viewDays')}
                </button>
                {isActive ? (
                  <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t('programs.schedule.inUse')}
                  </span>
                ) : (
                  <button type="button" disabled={busyId === program.id} onClick={() => onSelect(program)} className="btn-accent flex-1 px-3 py-2 text-xs">
                    <ButtonLabel loading={busyId === program.id} loadingText={t('programs.selecting')}>
                      {t('programs.select')}
                    </ButtonLabel>
                  </button>
                )}
              </div>
            </div>
          </motion.article>
        )
      })}
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(WorkoutPrograms)
