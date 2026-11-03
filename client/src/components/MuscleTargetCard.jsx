import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { MUSCLES } from '../utils/exerciseAnatomy'
import AnatomyFigure from './AnatomyFigure'

// front ถ้ากล้ามเนื้อหลักตัวแรกมองเห็นจากด้านหน้า ไม่งั้น back
const pickView = (muscles) => MUSCLES[muscles[0]]?.view || 'front'

// ไอคอนรูปร่างกายที่ไฮไลต์กล้ามเนื้อ ใช้ได้ทั้งการ์ดท่า ปุ่ม filter และคำตอบของ AI Coach
// วาดด้วย AnatomyFigure (เวกเตอร์ลงเงาแบบ 3D): กล้ามเนื้ออื่นเทา-ขาว ; tone ค่าเริ่มต้น = หลักส้ม / รองฟ้า
// tone='anatomy' = หลักส้ม-แดงสด / รองแดงอ่อน (Exercise Library) ; pulse: กล้ามเนื้อหลักเต้นเป็นจังหวะ
export const MuscleIcon = memo(function MuscleIcon({ primary = [], secondary = [], view, className = 'h-10 w-5', title, tone, pulse = false }) {
  return (
    <AnatomyFigure
      primary={primary}
      secondary={secondary}
      view={view || pickView(primary.length ? primary : secondary)}
      tone={tone === 'anatomy' ? 'anatomy' : 'default'}
      pulse={pulse}
      className={className}
      title={title}
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
