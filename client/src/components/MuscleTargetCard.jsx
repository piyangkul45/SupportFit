import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { mediaSlug } from '../utils/exerciseMedia'

// ภาพร่างนักกีฬา 3D (โมเดลของแอปเอง) สร้างด้วย scripts/build-muscle-icons.mjs:
// - public/mannequin/<slug>-target.webp = ร่างด้านหน้า + หลังของท่านั้น (หลักส้ม-แดง / รองส้มอ่อน) พื้นโปร่งใส 1:1
// - public/muscles/m-<muscle>.webp = ร่างเต็มตัวที่ไฮไลต์กล้ามเนื้อมัดเดียว (ชิปรายชื่อกล้ามเนื้อ) 1:2

// รูปกล้ามเนื้อเป้าหมายของท่า (ใช้ในการ์ดนี้และคำตอบของ AI Coach) ; exercise = ชื่อท่าในรายการ
export const TargetFigure = memo(function TargetFigure({ exercise, className = 'h-24 w-24', title }) {
  return (
    <img
      src={`/mannequin/${mediaSlug(exercise)}-target.webp`}
      alt={title || ''}
      width={400}
      height={400}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  )
})

const TONES = {
  primary: {
    label: 'border-orange-400/30 bg-orange-400/15 text-orange-200',
    chip: 'border-orange-400/20 bg-orange-400/[0.07] text-orange-100',
    dot: 'bg-orange-400',
  },
  secondary: {
    label: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
    chip: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-50',
    dot: 'bg-amber-300',
  },
}

function MuscleGroup({ tone, muscles }) {
  const { t } = useTranslation()
  if (!muscles.length) return null
  const styles = TONES[tone]
  return (
    <div>
      <p className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles.label}`}>
        <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden />
        {t(`anatomy.${tone}`)}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {muscles.map((muscle) => (
          <li key={muscle} className={`flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2 text-xs font-medium ${styles.chip}`}>
            <span className="flex h-8 w-6 items-center justify-center overflow-hidden rounded-md bg-[#0e1a24]">
              {muscle !== 'fullbody' && (
                <img src={`/muscles/m-${muscle}.webp`} alt="" width={160} height={320} loading="lazy" draggable={false} className="h-8 w-4 object-contain" />
              )}
            </span>
            {t(`anatomy.muscles.${muscle}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

// การ์ดกล้ามเนื้อเป้าหมายของท่า: ภาพกายวิภาค 3D ด้านหน้า/หลัง + ป้ายกล้ามเนื้อหลัก (ส้ม) และกล้ามเนื้อรอง (ส้มอ่อน)
// anatomy: ผลของ getAnatomy() ; exercise: ชื่อท่าในรายการ ; ไม่มีอย่างใดอย่างหนึ่ง = ไม่แสดง
export default memo(function MuscleTargetCard({ anatomy, exercise, className = '' }) {
  const { t } = useTranslation()
  if (!anatomy || !exercise) return null
  const { primary, secondary } = anatomy
  const describe = (muscles) => muscles.map((muscle) => t(`anatomy.muscles.${muscle}`)).join(', ')

  return (
    <div className={`flex gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 ${className}`}>
      <figure
        className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg bg-[#0e1a24] px-1 py-1"
        aria-label={t('anatomy.figureLabel', { primary: describe(primary), secondary: describe(secondary) || '-' })}
      >
        <TargetFigure exercise={exercise} className="h-28 w-28" />
        <figcaption className="flex w-full justify-around text-[9px] uppercase tracking-wider text-slate-500">
          <span>{t('anatomy.views.front')}</span>
          <span>{t('anatomy.views.back')}</span>
        </figcaption>
      </figure>
      <div className="min-w-0 flex-1 space-y-2.5">
        <MuscleGroup tone="primary" muscles={primary} />
        <MuscleGroup tone="secondary" muscles={secondary} />
      </div>
    </div>
  )
})
