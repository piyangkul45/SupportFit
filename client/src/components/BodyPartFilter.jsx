import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid } from 'lucide-react'
import { BODY_PART_ICON, BODY_PART_KEYS } from '../utils/exerciseAnatomy'
import { MuscleIcon } from './MuscleTargetCard'

// ปุ่มเลือกส่วนร่างกายเป็นไอคอนรูปร่างกาย (อก, ขา, ท้อง, แขน, หลัง, ไหล่)
// value: key ใน BODY_PARTS หรือ null (= ทั้งหมด) ; showAll=false ไม่มีปุ่ม "ทั้งหมด" (ใช้เป็นตัวเลือกใน AI Coach)
export default memo(function BodyPartFilter({ value, onChange, showAll = true, disabled, label, className = '' }) {
  const { t } = useTranslation()
  const options = showAll ? [null, ...BODY_PART_KEYS] : BODY_PART_KEYS
  return (
    <div role="group" aria-label={label || t('anatomy.filterLabel')} className={`flex gap-1.5 overflow-x-auto pb-1 ${className}`}>
      {options.map((key) => {
        const active = value === key
        return (
          <button
            key={key || 'all'}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active && key ? null : key)}
            className={`flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl border px-1 pb-1.5 pt-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              active
                ? 'border-orange-400/50 bg-orange-400/15 text-orange-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {key ? (
              <MuscleIcon primary={BODY_PART_ICON[key]} className="h-9 w-[18px]" />
            ) : (
              <span className="flex h-9 items-center">
                <LayoutGrid className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="whitespace-nowrap">{t(`anatomy.bodyParts.${key || 'all'}`)}</span>
          </button>
        )
      })}
    </div>
  )
})
