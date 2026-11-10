import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { BODY_PART_KEYS } from '../utils/exerciseAnatomy'

// ปุ่มเลือกส่วนร่างกาย: ภาพหุ่นกล้ามเนื้อ 3D สีเงินชุดเดียวกับ MuscleCategorySelector (public/muscles/<key>.webp)
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
            className={`flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-1 pb-1.5 pt-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              active
                ? 'border-orange-400/50 bg-orange-400/15 text-orange-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            <img
              src={`/muscles/${key || 'all'}.webp`}
              alt=""
              width={720}
              height={540}
              loading="lazy"
              draggable={false}
              className={`aspect-[4/3] w-full select-none rounded-md object-contain ${active ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.55)]' : ''}`}
            />
            <span className="whitespace-nowrap">{t(`anatomy.bodyParts.${key || 'all'}`)}</span>
          </button>
        )
      })}
    </div>
  )
})
