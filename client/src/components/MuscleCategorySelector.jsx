import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BODY_PART_ICON, BODY_PART_KEYS, exercisesForBodyPart } from '../utils/exerciseAnatomy'
import { EXERCISES } from '../utils/exerciseCatalog'
import { MuscleIcon } from './MuscleTargetCard'

export const TARGET_RED = '#ef4444'

// ซูมรูปร่างกาย (viewBox 60×120) เข้าไปที่ส่วนนั้นให้พอดีวงกลม + ด้านที่มองเห็นกล้ามเนื้อชัด
const CROPS = {
  all: { view: 'front', viewBox: '-30 0 120 120' },
  chest: { view: 'front', viewBox: '11 11 38 38' },
  back: { view: 'back', viewBox: '8 12 44 44' },
  arms: { view: 'front', viewBox: '0 20 34 34' },
  core: { view: 'front', viewBox: '13 25 34 34' },
  legs: { view: 'front', viewBox: '6 54 48 48' },
  shoulders: { view: 'front', viewBox: '6 8 48 48' },
}

// ปุ่มหมวดกล้ามเนื้อเป็นวงกลมรูป Anatomy (ทั้งหมด, อก, หลัง, แขน, ท้อง, ขา, ไหล่) ด้านบนสุดของ Exercise Library
// value: key ใน BODY_PARTS หรือ null (= ทั้งหมด) ; onChange(key) เรียกทันทีเมื่อกด -> รายการท่ากรองทันที
export default memo(function MuscleCategorySelector({ value, onChange, className = '' }) {
  const { t } = useTranslation()
  const counts = useMemo(
    () => Object.fromEntries([['all', EXERCISES.length], ...BODY_PART_KEYS.map((key) => [key, exercisesForBodyPart(key).length])]),
    []
  )
  const options = ['all', 'chest', 'back', 'arms', 'core', 'legs', 'shoulders']

  return (
    <div role="radiogroup" aria-label={t('anatomy.filterLabel')} // contain: inline-size = แถววงกลมไม่ดันคอลัมน์ให้กว้างเกินจอมือถือ (เลื่อนแนวนอนแทน)
      className={`-mx-1 flex snap-x gap-1 overflow-x-auto px-1 pb-1 [contain:inline-size] sm:justify-between ${className}`}>
      {options.map((key) => {
        const active = (value || 'all') === key
        const crop = CROPS[key]
        const primary = key === 'all' ? ['fullbody'] : BODY_PART_ICON[key]
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key === 'all' ? null : key)}
            className="group flex w-[4.25rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          >
            <span className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
              {active && (
                <motion.span
                  layoutId="muscle-category-ring"
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 via-rose-500 to-orange-400 shadow-[0_0_18px_-4px_rgba(239,68,68,0.9)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className={`relative flex h-[calc(100%-5px)] w-[calc(100%-5px)] items-center justify-center overflow-hidden rounded-full border transition-[transform,border-color,background-color] duration-200 group-hover:scale-105 group-active:scale-95 ${
                  active
                    ? 'border-transparent bg-[radial-gradient(circle_at_50%_35%,#3b1218,#120a0c)]'
                    : 'border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] group-hover:border-white/25'
                }`}
              >
                <MuscleIcon
                  primary={primary}
                  view={crop.view}
                  viewBox={crop.viewBox}
                  primaryFill={active ? TARGET_RED : 'rgba(248,113,113,0.55)'}
                  pulse={active && key !== 'all'}
                  className="h-full w-full"
                />
              </span>
              <span
                className={`absolute -right-0.5 -top-0.5 min-w-[1.25rem] rounded-full border px-1 text-center text-[10px] font-bold tabular-nums leading-[1.1rem] ${
                  active ? 'border-red-300/40 bg-red-500 text-white' : 'border-white/10 bg-obsidian-raised text-slate-400'
                }`}
              >
                {counts[key]}
              </span>
            </span>
            <span className={`whitespace-nowrap text-[11px] font-semibold transition-colors ${active ? 'text-red-200' : 'text-slate-400 group-hover:text-slate-200'}`}>
              {t(`anatomy.bodyParts.${key}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
})
