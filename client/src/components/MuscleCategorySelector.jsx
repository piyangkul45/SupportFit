import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BODY_PART_ICON, exercisesForBodyPart } from '../utils/exerciseAnatomy'
import { EXERCISES } from '../utils/exerciseCatalog'
import AnatomyFigure from './AnatomyFigure'

// การ์ดภาพ Anatomy ซูมเฉพาะส่วน (แนวนอน 4:3)
// img = ภาพเรนเดอร์ 3D (BodyParts3D, CC BY-SA 2.1 JP — public/muscles/LICENSE.md) พื้นหลังโปร่งใส 720×540
// ไม่มี img (อก ท้อง: ไม่มีภาพเรนเดอร์ 3D แบบเปิดเสรี) = เวกเตอร์ AnatomyFigure ; viewBox อยู่ในพิกัด 200×430
// "ทั้งหมด" = ร่างเต็มตัวด้านหน้า + หลังคู่กัน
// มือถือ 3 คอลัมน์: "ทั้งหมด" กว้าง 2 ช่อง (สูงเท่าการ์ดอื่นในแถว) ให้ 8 การ์ดเต็ม 3 แถวพอดี
const CARDS = [
  { key: 'all' },
  { key: 'chest', view: 'front', viewBox: '40 50 120 90' },
  { key: 'back', img: '/muscles/back.webp' },
  { key: 'shoulders', img: '/muscles/shoulders.webp' },
  { key: 'arms', img: '/muscles/arms.webp' },
  { key: 'core', view: 'front', viewBox: '40 112 120 90' },
  { key: 'glutes', img: '/muscles/glutes.webp' },
  { key: 'legs', img: '/muscles/legs.webp' },
]

// ขอบภาพจางหายแบบนุ่มนวลเข้ากับพื้นการ์ดเดิม (ไม่มีขอบตัดแข็ง)
const SEAMLESS_MASK = {
  WebkitMaskImage: 'radial-gradient(ellipse 72% 70% at 50% 45%, #000 62%, transparent 100%)',
  maskImage: 'radial-gradient(ellipse 72% 70% at 50% 45%, #000 62%, transparent 100%)',
}

const CARD_BG = 'bg-[radial-gradient(circle_at_50%_30%,#2c313d,#12141b_78%)]'

// Muscle Picker แบบการ์ดรูปภาพ Anatomy (ขอบมน พื้นเข้ม) อยู่บนสุดของ Exercise Library
// กล้ามเนื้อของหมวดเป็นสีส้ม-แดงสด กล้ามเนื้ออื่นเทา-ขาว ; hover/แตะ = ขอบสว่าง + ซูมภาพ 1.03
// value: key ใน BODY_PARTS หรือ null (= ทั้งหมด) ; onChange(key) เรียกทันทีเมื่อกด -> รายการท่ากรองทันที
export default memo(function MuscleCategorySelector({ value, onChange, className = '' }) {
  const { t } = useTranslation()
  const counts = useMemo(
    () => Object.fromEntries(CARDS.map(({ key }) => [key, key === 'all' ? EXERCISES.length : exercisesForBodyPart(key).length])),
    []
  )

  return (
    <div role="radiogroup" aria-label={t('anatomy.filterLabel')} className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${className}`}>
      {CARDS.map(({ key, view, viewBox, img }) => {
        const active = (value || 'all') === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key === 'all' ? null : key)}
            className={`group relative overflow-hidden rounded-xl border ${key === 'all' ? 'col-span-2 min-h-full sm:col-span-1 sm:aspect-[4/3]' : 'aspect-[4/3]'} text-left outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-orange-300/70 ${CARD_BG} ${
              active
                ? 'border-orange-400/90 shadow-[0_0_0_1px_rgba(251,146,60,0.55),0_0_22px_-6px_rgba(244,81,30,0.85)]'
                : 'border-white/10 hover:border-orange-200/70 hover:shadow-[0_0_16px_-8px_rgba(255,255,255,0.6)] active:border-orange-200/70'
            }`}
          >
            {/* ภาพซูมเบา ๆ 1.03 เมื่อชี้/แตะ */}
            <span className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.03] group-active:scale-[1.03]">
              {key === 'all' ? (
                <span className="flex h-full items-center justify-center gap-1 px-2 pb-4 pt-1">
                  {['front', 'back'].map((side) => (
                    <AnatomyFigure key={side} view={side} primary={active ? ['fullbody'] : []} tone="anatomy" className="h-full w-auto" />
                  ))}
                </span>
              ) : img ? (
                <img
                  src={img}
                  alt=""
                  width={720}
                  height={540}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={SEAMLESS_MASK}
                  className={`h-full w-full select-none object-cover transition-[filter] duration-300 ${
                    active ? 'brightness-110 saturate-[1.15] drop-shadow-[0_0_10px_rgba(239,68,68,0.45)]' : 'brightness-95'
                  }`}
                />
              ) : (
                <AnatomyFigure
                  view={view}
                  viewBox={viewBox}
                  fit="slice"
                  primary={BODY_PART_ICON[key]}
                  tone="anatomy"
                  pulse={active}
                  className="h-full w-full"
                />
              )}
            </span>

            {/* เงาไล่ด้านล่างให้อ่านชื่อหมวดชัด */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            {active && (
              <motion.span
                layoutId="muscle-card-active"
                className="pointer-events-none absolute inset-0 rounded-xl bg-orange-500/[0.08]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="absolute inset-x-2 bottom-1.5 flex items-end justify-between gap-1">
              <span className={`truncate text-xs font-bold tracking-tight sm:text-sm ${active ? 'text-orange-100' : 'text-white'}`}>
                {t(`anatomy.bodyParts.${key}`)}
              </span>
              <span
                className={`shrink-0 rounded-md px-1.5 text-[10px] font-bold tabular-nums leading-4 ${
                  active ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-300'
                }`}
              >
                {counts[key]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
})
