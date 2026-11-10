import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { exercisesForBodyPart } from '../utils/exerciseAnatomy'
import { EXERCISES } from '../utils/exerciseCatalog'

// การ์ดภาพเรนเดอร์กายวิภาค 3D สมจริง (BodyParts3D + Z-Anatomy: public/muscles/<key>.webp สร้างด้วย scripts/build-muscle-icons.mjs)
// ร่างสีเทาเงินเมทัลลิก เห็นลายเส้นใยกล้ามเนื้อ มัดเป้าหมายเรืองแสงส้ม-แดง ; ภาพพื้นโปร่งใส 720×540 (4:3) ซูมเฉพาะส่วน
// "ทั้งหมด" = ร่างเต็มตัวด้านหน้า + หลังคู่กัน
// มือถือ 3 คอลัมน์: "ทั้งหมด" กว้าง 2 ช่อง (สูงเท่าการ์ดอื่นในแถว) ให้ 8 การ์ดเต็ม 3 แถวพอดี ; ภาพ object-contain ทุกใบ = สัดส่วนเท่ากัน
const CARDS = ['all', 'chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs'].map((key) => ({ key, img: `/muscles/${key}.webp` }))

// พื้นการ์ดสีเรียบ #0e1a24 (slate blue dark) ผืนเดียวกับพื้นภาพ ไม่มีแสงหรือวงแสงประกอบ
const CARD_BG = 'bg-[#0e1a24]'

// Muscle Picker แบบการ์ดรูปภาพ Anatomy (ขอบมน พื้นเข้ม) อยู่บนสุดของ Exercise Library
// การ์ดที่เลือก = ขอบเรืองแสงสีส้ม 2px (#f97316) ; ป้ายจำนวนท่าโทนเข้มมุมขวาล่าง ; ชื่อหมวดตัวหนาสีขาว ; hover/แตะ = ซูมภาพ 1.03
// value: key ใน BODY_PARTS หรือ null (= ทั้งหมด) ; onChange(key) เรียกทันทีเมื่อกด -> รายการท่ากรองทันที
export default memo(function MuscleCategorySelector({ value, onChange, className = '' }) {
  const { t } = useTranslation()
  const counts = useMemo(
    () => Object.fromEntries(CARDS.map(({ key }) => [key, key === 'all' ? EXERCISES.length : exercisesForBodyPart(key).length])),
    []
  )

  return (
    <div role="radiogroup" aria-label={t('anatomy.filterLabel')} className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${className}`}>
      {CARDS.map(({ key, img }) => {
        const active = (value || 'all') === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key === 'all' ? null : key)}
            className={`group relative overflow-hidden rounded-2xl border-2 ${key === 'all' ? 'col-span-2 min-h-full sm:col-span-1 sm:aspect-[4/3]' : 'aspect-[4/3]'} text-left outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-orange-300/70 ${CARD_BG} ${
              active
                ? 'border-orange-500 shadow-[0_0_18px_-2px_rgba(249,115,22,0.75)]'
                : 'border-white/10 hover:border-orange-500/50 active:border-orange-500/60'
            }`}
          >
            {/* ภาพซูมเบา ๆ 1.03 เมื่อชี้/แตะ */}
            <span className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.03] group-active:scale-[1.03]">
              <img
                src={img}
                alt=""
                width={720}
                height={540}
                loading="lazy"
                decoding="async"
                draggable={false}
                className={`h-full w-full select-none object-contain transition-[filter] duration-300 ${
                  active ? 'brightness-110 saturate-[1.12]' : 'brightness-95'
                }`}
              />
            </span>

            {/* เงาไล่ด้านล่างให้อ่านชื่อหมวดชัด */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0e1a24] via-[#0e1a24]/55 to-transparent" />
            {active && (
              <motion.span
                layoutId="muscle-card-active"
                className="pointer-events-none absolute inset-0 rounded-[14px] bg-orange-500/[0.06]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="absolute inset-x-2 bottom-1.5 flex items-end justify-between gap-1">
              <span className="truncate text-xs font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-sm">
                {t(`anatomy.bodyParts.${key}`)}
              </span>
              <span
                className={`shrink-0 rounded-md bg-black/60 px-1.5 text-[10px] font-bold tabular-nums leading-4 ring-1 ${
                  active ? 'text-orange-300 ring-orange-500/60' : 'text-slate-200 ring-white/10'
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
