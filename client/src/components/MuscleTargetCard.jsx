import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { MUSCLES } from '../utils/exerciseAnatomy'

// สีเดียวกันทั้งแอป: กล้ามเนื้อหลัก = ส้ม, กล้ามเนื้อรอง = ฟ้า
const PRIMARY_FILL = '#fb923c'
const SECONDARY_FILL = '#38bdf8'
const BASE_FILL = 'rgba(148, 163, 184, 0.16)'
const BODY_FILL = 'rgba(148, 163, 184, 0.09)'

// รูปร่างกายแบบเรียบ (viewBox 60×120) แต่ละชิ้นผูกกับกล้ามเนื้อ ; muscle: null = ส่วนที่ไม่ใช่กล้ามเนื้อ (หัว มือ เท้า)
const ellipse = (cx, cy, rx, ry, muscle) => ({ kind: 'ellipse', cx, cy, rx, ry, muscle })
const path = (d, muscle) => ({ kind: 'path', d, muscle })
const pair = (make, cx, mirror = 60) => [make(cx), make(mirror - cx)]

const SHARED = [
  ellipse(30, 9, 6, 6.5, null),
  path('M27 14.5h6v4h-6z', null),
  ...pair((cx) => ellipse(cx, 23, 5, 4.2, 'shoulders'), 17.5),
  ...pair((cx) => ellipse(cx, 50, 2.8, 7.5, 'forearms'), 11),
  ...pair((cx) => ellipse(cx, 60.5, 2.4, 2.6, null), 10),
  ...pair((cx) => ellipse(cx, 109.5, 3.8, 2, null), 23.5),
]

const FIGURES = {
  front: [
    ...SHARED,
    path('M20 20.5h9.4v11.2q-5.2 2.2-9.4-1.2z', 'chest'),
    path('M30.6 20.5H40v10q-4.2 3.4-9.4 1.2z', 'chest'),
    ...pair((cx) => ellipse(cx, 34, 3.4, 7, 'biceps'), 13.5),
    path('M22.5 33.5h15q.8 0 .8.8v15.4q0 1.8-1.8 1.8h-13q-1.8 0-1.8-1.8V34.3q0-.8.8-.8z', 'abs'),
    path('M22 52.5h16l1.2 6.5H20.8z', null),
    ...pair((cx) => ellipse(cx, 71.5, 5.2, 12, 'quads'), 24.5),
    ...pair((cx) => ellipse(cx, 96, 3.5, 9.5, null), 24),
  ],
  back: [
    ...SHARED,
    path('M20 20h20l-1.2 27.5q-8.8 3.6-17.6 0z', 'back'),
    ...pair((cx) => ellipse(cx, 34, 3.4, 7, 'triceps'), 13.5),
    ...pair((cx) => ellipse(cx, 56, 5.6, 5.2, 'glutes'), 25),
    ...pair((cx) => ellipse(cx, 74, 5, 10.5, 'hamstrings'), 24.5),
    ...pair((cx) => ellipse(cx, 95.5, 3.8, 9, 'calves'), 24),
  ],
}

// front ถ้ากล้ามเนื้อหลักตัวแรกมองเห็นจากด้านหน้า ไม่งั้น back
const pickView = (muscles) => MUSCLES[muscles[0]]?.view || 'front'

// ไอคอนรูปร่างกายที่ไฮไลต์กล้ามเนื้อ (ส้ม = หลัก, ฟ้า = รอง) ใช้ได้ทั้งการ์ดท่า ปุ่ม filter และคำตอบของ AI Coach
// primaryFill: เปลี่ยนสีกล้ามเนื้อหลัก (เช่น แดงใน Exercise Library) ; pulse: กล้ามเนื้อหลักเต้นเป็นจังหวะ ; viewBox: ซูมเฉพาะส่วน
export const MuscleIcon = memo(function MuscleIcon({
  primary = [],
  secondary = [],
  view,
  className = 'h-10 w-5',
  title,
  primaryFill = PRIMARY_FILL,
  pulse = false,
  viewBox = '0 0 60 120',
}) {
  const side = view || pickView(primary.length ? primary : secondary)
  const fullbody = primary.includes('fullbody')
  const isPrimary = (muscle) => Boolean(muscle) && (fullbody || primary.includes(muscle))
  const fillOf = (muscle) => {
    if (!muscle) return BODY_FILL
    if (isPrimary(muscle)) return primaryFill
    if (secondary.includes(muscle) || secondary.includes('fullbody')) return SECONDARY_FILL
    return BASE_FILL
  }
  return (
    <svg viewBox={viewBox} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {FIGURES[side].map(({ kind, muscle, ...shape }, index) => {
        const props = { ...shape, fill: fillOf(muscle), className: pulse && isPrimary(muscle) ? 'animate-muscle-pulse' : undefined }
        return kind === 'ellipse' ? <ellipse key={index} {...props} /> : <path key={index} {...props} />
      })}
    </svg>
  )
})

const TONES = {
  primary: {
    label: 'border-orange-400/30 bg-orange-400/15 text-orange-200',
    chip: 'border-orange-400/20 bg-orange-400/[0.07] text-orange-100',
    dot: 'bg-orange-400',
  },
  secondary: {
    label: 'border-sky-400/30 bg-sky-400/15 text-sky-200',
    chip: 'border-sky-400/20 bg-sky-400/[0.07] text-sky-100',
    dot: 'bg-sky-400',
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
            <span className="flex h-8 w-6 items-center justify-center rounded-md bg-black/25">
              <MuscleIcon
                primary={tone === 'primary' ? [muscle] : []}
                secondary={tone === 'secondary' ? [muscle] : []}
                className="h-7 w-3.5"
              />
            </span>
            {t(`anatomy.muscles.${muscle}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

// การ์ดกล้ามเนื้อเป้าหมายของท่า: รูปร่างกายด้านหน้า/หลัง + ป้ายกล้ามเนื้อหลัก (ส้ม) และกล้ามเนื้อรอง (ฟ้า) พร้อมไอคอน
// anatomy: ผลของ getAnatomy() ไม่มี = ไม่แสดง
export default memo(function MuscleTargetCard({ anatomy, className = '' }) {
  const { t } = useTranslation()
  if (!anatomy) return null
  const { primary, secondary } = anatomy
  const describe = (muscles) => muscles.map((muscle) => t(`anatomy.muscles.${muscle}`)).join(', ')

  return (
    <div className={`flex gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 ${className}`}>
      <figure
        className="flex shrink-0 items-end gap-1 rounded-lg bg-white/[0.03] px-2 py-1.5"
        aria-label={t('anatomy.figureLabel', { primary: describe(primary), secondary: describe(secondary) || '-' })}
      >
        {['front', 'back'].map((view) => (
          <div key={view} className="flex flex-col items-center gap-0.5">
            <MuscleIcon primary={primary} secondary={secondary} view={view} className="h-24 w-12" />
            <figcaption className="text-[9px] uppercase tracking-wider text-slate-500">{t(`anatomy.views.${view}`)}</figcaption>
          </div>
        ))}
      </figure>
      <div className="min-w-0 flex-1 space-y-2.5">
        <MuscleGroup tone="primary" muscles={primary} />
        <MuscleGroup tone="secondary" muscles={secondary} />
      </div>
    </div>
  )
})
