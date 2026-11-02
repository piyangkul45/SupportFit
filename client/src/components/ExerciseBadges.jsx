import { useTranslation } from 'react-i18next'

const LEVEL_STYLES = {
  beginner: { emoji: '🟢', tone: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' },
  intermediate: { emoji: '🟡', tone: 'border-amber-400/25 bg-amber-400/10 text-amber-200' },
  advanced: { emoji: '🔴', tone: 'border-rose-400/25 bg-rose-400/10 text-rose-200' },
}
const EQUIPMENT_TONE = 'border-white/10 bg-white/[0.05] text-slate-300'

// ป้ายระดับความยาก + อุปกรณ์ที่ใช้ของท่า (anatomy จาก getAnatomy) ไม่มีข้อมูล = ไม่แสดง
export default function ExerciseBadges({ anatomy, className = '' }) {
  const { t } = useTranslation()
  if (!anatomy) return null
  const level = LEVEL_STYLES[anatomy.level]
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      <span className={`badge font-medium ${level.tone}`}>
        <span aria-hidden>{level.emoji}</span>
        {t(`anatomy.levels.${anatomy.level}`)}
      </span>
      <span className={`badge font-medium ${EQUIPMENT_TONE}`}>
        <span aria-hidden>{anatomy.equipment ? '🏋️' : '🏠'}</span>
        {t(anatomy.equipment ? 'anatomy.equipment.required' : 'anatomy.equipment.none')}
      </span>
    </span>
  )
}
