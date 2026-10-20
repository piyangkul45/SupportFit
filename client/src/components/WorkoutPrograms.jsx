import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Play } from 'lucide-react'
import { formatReps, WORKOUT_PROGRAMS } from '../utils/workoutPrograms'

const DIFFICULTY_STYLE = {
  beginner: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  intermediate: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  advanced: 'border-red-400/30 bg-red-400/10 text-red-300',
}

function getPrimaryMuscles(program) {
  const all = program.days.flatMap((day) => day.exercises.flatMap((ex) => ex.muscles))
  return [...new Set(all)].slice(0, 4)
}

// routine ของคนดัง: เริ่มเฉพาะวันนี้ (แสดงบน Dashboard จนกว่าจะล้าง) อยู่ในหน้า Programs (pages/Programs.jsx)
function WorkoutPrograms({ onStart }) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState(WORKOUT_PROGRAMS[0]?.id ?? null)
  const muscleLabel = (key) => t(`programs.muscles.${key}`)

  return (
    <div className="space-y-4">
      {WORKOUT_PROGRAMS.map((program, index) => {
        const isExpanded = expandedId === program.id
        const primaryMuscles = getPrimaryMuscles(program)

        return (
          <motion.div
            key={program.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 28 }}
            className="glass-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : program.id)}
              aria-expanded={isExpanded}
              className="relative flex w-full items-start justify-between gap-3 p-5 text-left"
            >
              {/* สีประจำโปรแกรมแบบจาง ๆ ให้เข้ากับธีมมืด */}
              <div aria-hidden className={`absolute inset-0 bg-gradient-to-br opacity-20 ${program.accent}`} />
              <div aria-hidden className="absolute -right-3 -top-5 text-7xl opacity-15">
                {program.emoji}
              </div>

              <div className="relative min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{program.name}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${DIFFICULTY_STYLE[program.difficulty] ?? 'border-white/30 bg-white/10 text-white'}`}
                  >
                    {t(`programs.difficulty.${program.difficulty}`)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{t('programs.by', { name: program.celebrity })}</p>
                <p className="mt-2 max-w-md text-sm text-slate-200">{t(`programs.taglines.${program.id}`)}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {primaryMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                    >
                      {muscleLabel(muscle)}
                    </span>
                  ))}
                </div>
              </div>

              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                className="relative shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="space-y-3 border-t border-white/[0.07] p-5">
                    {program.days.map((day) => (
                      <div key={day.name} className="glass-panel p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-100">{day.name}</h4>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onStart(program, day)}
                            className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                            {t('programs.start')}
                          </motion.button>
                        </div>

                        <ul className="space-y-1.5">
                          {day.exercises.map((ex) => (
                            <li
                              key={ex.name}
                              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 text-sm"
                            >
                              <span className="font-medium text-slate-100">{ex.name}</span>
                              <span className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="badge border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                                  {ex.sets} × {formatReps(ex.reps, t)}
                                </span>
                                <span>{ex.muscles.map(muscleLabel).join(' / ')}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(WorkoutPrograms)
