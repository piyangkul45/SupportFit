import { memo, useId } from 'react'

// รูปกายวิภาคแบบเวกเตอร์ลงเงา (pseudo-3D) แทนหุ่นเหลี่ยม: แต่ละมัดกล้ามเนื้อไล่เฉดของตัวเอง + ไฮไลต์สะท้อนแสง
// + เส้นร่องเข้มคั่นระหว่างมัด ; กล้ามเนื้อเป้าหมายมีแสงเรือง ; viewBox 200×430 (ด้านหน้า/ด้านหลัง)
// ชิ้นด้านซ้ายวาดครั้งเดียวแล้วสะท้อนเป็นด้านขวา ; muscle: null = ส่วนที่ไม่ใช่กล้ามเนื้อ (หัว มือ ข้อต่อ เท้า)

const FIGURE_SIZE = { width: 200, height: 430 }

const s = (d, muscle) => ({ d, muscle })

// สี่เหลี่ยมมุมมน (ใช้กับซิกแพ็ก)
const rounded = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`

const HEAD = s('M100 10C110 10 116 20 116 30C116 42 110 50 100 50C90 50 84 42 84 30C84 20 90 10 100 10Z', null)
const NECK = s('M92 46L108 46L110 62C104 66 96 66 90 62Z', null)
const DELTOID = 'M58 74C46 76 38 88 38 102C39 112 43 118 48 122C52 110 58 98 66 90C72 84 78 80 84 77C76 79 66 78 58 74Z'
const UPPER_ARM = 'M48 122C41 134 39 152 42 168C45 174 52 174 55 168C59 152 60 136 58 118C55 118 51 119 48 122Z'
const FOREARM = 'M42 172C36 190 34 212 36 236C40 240 46 240 49 236C54 214 57 192 56 172C52 176 46 176 42 172Z'
const HAND = s('M36 240C32 250 33 262 38 268C44 270 49 264 50 252C50 244 48 240 44 239Z', null)
const KNEE = s('M76 330C76 340 92 342 94 330C90 326 80 326 76 330Z', null)
const FOOT = s('M72 410C68 418 70 424 78 424L90 424C92 418 88 412 84 410Z', null)

const FIGURES = {
  front: {
    center: [
      HEAD,
      NECK,
      s('M74 206C86 218 94 224 100 226C106 224 114 218 126 206L128 218C116 230 106 236 100 236C94 236 84 230 72 218Z', null),
    ],
    side: [
      s('M90 56C82 62 70 68 58 74C66 78 76 79 84 76C88 70 90 64 90 56Z', 'back'), // trapezius บน
      s(DELTOID, 'shoulders'),
      s('M98 78L86 77C74 81 64 90 60 102C60 112 64 120 74 124C84 127 94 125 98 120Z', 'chest'),
      s('M64 120C62 130 64 140 68 148L74 146L72 126Z', 'abs'), // serratus
      s(UPPER_ARM, 'biceps'),
      s(FOREARM, 'forearms'),
      HAND,
      s('M74 126C70 140 70 160 72 178C74 194 80 206 86 214L86 130C82 128 78 126 74 126Z', 'abs'), // oblique
      s(rounded(87, 128, 12, 18, 4), 'abs'),
      s(rounded(87, 148, 12, 18, 4), 'abs'),
      s(rounded(87, 168, 12, 18, 4), 'abs'),
      s('M88 188L99 188L99 214C95 216 91 214 88 208Z', 'abs'),
      s('M72 214C62 240 60 274 66 304C68 316 72 324 78 328L80 300C78 270 80 244 86 226Z', 'quads'), // vastus lateralis
      s('M86 226C80 252 80 286 82 312C84 320 88 326 92 328C96 312 98 284 96 256C95 242 92 232 88 224Z', 'quads'), // rectus femoris
      s('M92 226C99 236 100 256 98 286C97 270 95 250 92 234Z', 'quads'), // adductor
      KNEE,
      s('M74 344C68 364 68 388 74 408L84 408C88 388 90 366 88 346C84 342 78 342 74 344Z', 'calves'),
      FOOT,
    ],
  },
  back: {
    center: [HEAD, NECK],
    side: [
      s('M92 54C84 62 72 68 58 74C68 80 80 84 92 92L100 104L100 56Z', 'back'), // trapezius บน
      s('M100 104L92 92C90 108 94 128 100 146Z', 'back'), // trapezius ล่าง
      s(DELTOID, 'shoulders'),
      s('M66 88C62 96 62 104 66 112C76 114 86 110 92 102L90 92C82 88 74 86 66 88Z', 'back'), // infraspinatus / teres
      s('M64 112C60 130 64 150 72 166C80 178 90 186 98 190L98 150C92 128 88 116 90 104C82 112 74 114 64 112Z', 'back'), // lats
      s('M92 150L100 150L100 196L90 196C88 184 90 166 92 150Z', 'back'), // erector spinae
      s(UPPER_ARM, 'triceps'),
      s(FOREARM, 'forearms'),
      HAND,
      s('M74 196C66 208 66 228 74 240C82 250 94 250 99 242L99 202C92 196 82 194 74 196Z', 'glutes'),
      s('M70 244C64 270 64 298 70 322L80 326C82 300 84 272 86 250Z', 'hamstrings'),
      s('M86 250C90 274 92 300 88 326L96 324C98 300 98 274 96 252Z', 'hamstrings'),
      KNEE,
      s('M72 340C64 356 64 376 70 392C74 398 80 398 84 394C90 378 92 358 88 342C84 338 76 338 72 340Z', 'calves'),
      s('M72 394C72 400 74 406 76 408L84 408C86 404 86 398 84 394Z', null),
      FOOT,
    ],
  },
}

// โทนสี: กล้ามเนื้ออื่น ๆ เทา-ขาว ; target ส้ม (ค่าเริ่มต้นของแอป) หรือ ส้ม-แดงสด (Exercise Library)
const STOPS = {
  base: ['#f8fafc', '#cbd5e1', '#7c8798'],
  body: ['#8b95a5', '#5b6576', '#323a47'],
  orange: ['#ffc08f', '#fb923c', '#c2410c'],
  fire: ['#ffb07a', '#f4511e', '#a3161a'],
  sky: ['#c7ecff', '#38bdf8', '#0369a1'],
  blush: ['#fde2e2', '#f8a3a3', '#c2575b'],
}
const TONES = {
  default: { primary: 'orange', secondary: 'sky', glow: '#fb923c' },
  anatomy: { primary: 'fire', secondary: 'blush', glow: '#ef4444' },
}

function Gradient({ id, stops }) {
  return (
    <linearGradient id={id} x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stopColor={stops[0]} />
      <stop offset="0.5" stopColor={stops[1]} />
      <stop offset="1" stopColor={stops[2]} />
    </linearGradient>
  )
}

// primary / secondary: รายชื่อกล้ามเนื้อ (MUSCLES ใน utils/exerciseAnatomy) ; 'fullbody' = ทุกมัด
// view: 'front' | 'back' ; viewBox: ซูมเฉพาะส่วน (พิกัดของ FIGURE_SIZE) ; fit: 'meet' (เห็นทั้งหมด) | 'slice' (เต็มกรอบ)
// tone: 'default' | 'anatomy' ; pulse: กล้ามเนื้อเป้าหมายเต้นเป็นจังหวะ
export default memo(function AnatomyFigure({
  primary = [],
  secondary = [],
  view = 'front',
  viewBox = `0 0 ${FIGURE_SIZE.width} ${FIGURE_SIZE.height}`,
  fit = 'meet',
  tone = 'default',
  pulse = false,
  className = '',
  title,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const palette = TONES[tone] || TONES.default
  const ids = {
    base: `${uid}b`,
    body: `${uid}n`,
    primary: `${uid}p`,
    secondary: `${uid}s`,
    shine: `${uid}h`,
    glow: `${uid}g`,
  }
  const fullbody = primary.includes('fullbody')
  const kindOf = (muscle) => {
    if (!muscle) return 'body'
    if (fullbody || primary.includes(muscle)) return 'primary'
    if (secondary.includes(muscle) || secondary.includes('fullbody')) return 'secondary'
    return 'base'
  }
  const figure = FIGURES[view] || FIGURES.front

  const renderShape = ({ d, muscle }, key) => {
    const kind = kindOf(muscle)
    const isTarget = kind === 'primary'
    return (
      <g key={key} className={pulse && isTarget ? 'animate-muscle-pulse' : undefined} filter={isTarget ? `url(#${ids.glow})` : undefined}>
        <path d={d} fill={`url(#${ids[kind]})`} stroke="rgba(8, 10, 16, 0.9)" strokeWidth="1.1" strokeLinejoin="round" />
        {muscle && <path d={d} fill={`url(#${ids.shine})`} />}
      </g>
    )
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={`xMidYMid ${fit}`}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <Gradient id={ids.base} stops={STOPS.base} />
        <Gradient id={ids.body} stops={STOPS.body} />
        <Gradient id={ids.primary} stops={STOPS[palette.primary]} />
        <Gradient id={ids.secondary} stops={STOPS[palette.secondary]} />
        {/* ไฮไลต์สะท้อนแสงด้านบนซ้ายของแต่ละมัด ให้ดูนูน */}
        <radialGradient id={ids.shine} cx="0.35" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feFlood floodColor={palette.glow} floodOpacity="0.75" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {figure.center.map((shape, index) => renderShape(shape, `c${index}`))}
      {figure.side.map((shape, index) => renderShape(shape, `l${index}`))}
      <g transform={`translate(${FIGURE_SIZE.width} 0) scale(-1 1)`}>{figure.side.map((shape, index) => renderShape(shape, `r${index}`))}</g>
    </svg>
  )
})
