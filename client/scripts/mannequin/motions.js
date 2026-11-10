// คลังท่าเคลื่อนไหวของหุ่นจำลอง 3D (ข้อมูลล้วน ไม่ import three) ใช้โดย scene.js ตอนเรนเดอร์วิดีโอ
//
// มุมทั้งหมดเป็นองศา แบบ "มุมโลกในระนาบด้านข้าง" (sagittal) ของแต่ละท่อน:
//   ลำตัว (pelvis/spine/chest/head): 0 = ตั้งตรง, + = เอนไปข้างหน้า, - = เอนไปข้างหลัง
//   แขน/ขา (uarm/farm/thigh/shin): 0 = ห้อยลงตรง, - = เหวี่ยงไปข้างหน้า (-90 = ชี้ตรงไปหน้า, -180 = ชูขึ้น), + = ไปข้างหลัง
//   foot: 0 = เท้าราบชี้หน้า, + = ปลายเท้าชี้ลง
// ค่าด้านซ้าย/ขวาต่างกันใส่เป็น [ซ้าย, ขวา] ; uarmA/thighA = กางออกด้านข้าง ; uarmT = เหวี่ยงแนวนอน (- = ไปหน้า)
// IK: handC = ตำแหน่งมือในพิกัดหน้าอก [y, z] ; handW / footW = ตำแหน่งโลก [y, z] ; handFix = มือยึดจุดคงที่ของท่า
// lift = ยกตัวลอยจากพื้น (กระโดด) ; anchor: 'feet' (เท้ายึดพื้น) | 'footL' | 'ground' | 'hands' | 'fixed'

const { sin, cos, PI, abs } = Math
const TAU = 2 * PI

const BAR = 'barbell'
const ARMS_DOWN = { uarm: 0, farm: 0, uarmA: 9 }

// ---------- ท่าแบบวงจรต่อเนื่อง (วิ่ง เดิน ปั่น ว่าย ฯลฯ) ----------
function gait(p, { stride = 38, knee = 70, arm = 45, elbow = 85, lean = 10, bounce = 0.04, kneeBase = 20 }) {
  const ph = TAU * p
  const leg = (o) => {
    const thigh = -12 - stride * sin(ph + o)
    const k = kneeBase + knee * (0.5 + 0.5 * cos(ph + o + 0.5)) ** 2
    return [thigh, thigh + k]
  }
  const [tL, sL] = leg(0)
  const [tR, sR] = leg(PI)
  const aL = arm * sin(ph + PI)
  const aR = arm * sin(ph)
  return {
    pelvis: lean * 0.7, spine: lean * 0.9, chest: lean, head: lean * 0.6,
    thigh: [tL, tR], shin: [sL, sR], foot: [8 * sin(ph), 8 * sin(ph + PI)],
    uarm: [aL, aR], farm: [aL - elbow, aR - elbow], uarmA: 10,
    lift: bounce * abs(sin(ph)), chestTwist: 6 * sin(ph),
  }
}

function pedal(p, { cy, cz, r, hand }) {
  const ph = TAU * p
  return {
    footWL: [cy + r * sin(ph), cz + r * cos(ph)],
    footWR: [cy + r * sin(ph + PI), cz + r * cos(ph + PI)],
    foot: [12 * sin(ph) - 5, 12 * sin(ph + PI) - 5],
    handW: hand,
  }
}

export const MOTIONS = {
  // ---------------- ขา / สะโพก ----------------
  'barbell-squat': {
    dur: 2.6, props: [BAR], armBend: -1,
    keys: [
      { handC: [0.26, -0.11], uarmA: 34 },
      { pelvis: 32, spine: 38, chest: 40, head: 22, thigh: -102, shin: 22, thighA: 14, handC: [0.26, -0.11], uarmA: 34 },
    ],
  },
  'bodyweight-squat': {
    dur: 2.4,
    keys: [
      { uarm: -20, farm: -30 },
      { pelvis: 30, spine: 34, chest: 36, head: 18, thigh: -100, shin: 22, thighA: 14, uarm: -88, farm: -90 },
    ],
  },
  'pistol-squat': {
    dur: 3, anchor: 'footL',
    keys: [
      { thigh: [0, -45], shin: [0, -35], uarm: -70, farm: -75 },
      { pelvis: 36, spine: 42, chest: 44, head: 25, thigh: [-112, -82], shin: [28, -82], foot: [0, -10], uarm: -88, farm: -90 },
    ],
  },
  'jump-squat': {
    dur: 2.2, times: [1, 0.6, 0.8],
    keys: [
      { ...ARMS_DOWN },
      { pelvis: 28, spine: 32, chest: 34, head: 16, thigh: -92, shin: 20, thighA: 12, uarm: 40, farm: 35 },
      { lift: 0.32, foot: 55, uarm: -165, farm: -170, uarmA: 18 },
    ],
  },
  lunge: {
    dur: 2.8, anchor: 'footL', props: [{ type: 'dumbbells', axis: 'z' }],
    keys: [
      { ...ARMS_DOWN },
      { ...ARMS_DOWN, spine: 4, thigh: [-88, 22], shin: [5, 96], foot: [0, 62] },
    ],
  },
  deadlift: {
    dur: 2.8, props: [BAR],
    keys: [
      { pelvis: 48, spine: 56, chest: 60, head: 38, thigh: -74, shin: 30, uarm: 0, farm: 0, uarmA: 10 },
      { ...ARMS_DOWN, uarmA: 10 },
    ],
  },
  rdl: {
    dur: 2.8, props: [BAR],
    keys: [
      { ...ARMS_DOWN, uarmA: 10, thigh: -6, shin: 4 },
      { pelvis: 72, spine: 76, chest: 78, head: 58, thigh: -10, shin: 8, uarm: 0, farm: 0, uarmA: 10 },
    ],
  },
  'hip-thrust': {
    dur: 2.6, cam: { az: 80, el: 14 },
    props: [{ type: 'box', size: [0.9, 0.4, 0.34], pos: [0, 0.2, -0.66], mat: 'pad' }],
    keys: [
      { pelvis: -62, spine: -66, chest: -70, head: -60, thigh: -128, shin: 8, thighA: 10, uarmA: 78, elbowR: -10 },
      { pelvis: -92, spine: -92, chest: -92, head: -70, thigh: -92, shin: 2, thighA: 10, uarmA: 78, elbowR: -10 },
    ],
  },
  'leg-press': {
    dur: 2.8, anchor: 'fixed', legBend: 1, cam: { az: 82, el: 16 },
    props: [
      { type: 'box', size: [0.46, 0.07, 0.36], pos: [0, 0.43, 0.04], mat: 'pad' },
      { type: 'box', size: [0.46, 0.07, 0.8], pos: [0, 0.6, -0.36], rot: [30, 0, 0], mat: 'pad' },
      { type: 'box', size: [0.5, 0.36, 0.8], pos: [0, 0.18, -0.1], mat: 'equip' },
      { type: 'plate', follow: 'feet', size: [0.62, 0.5, 0.04], rot: [-40, 0, 0], offset: [0, 0.05, 0.06] },
      { type: 'cyl', r: 0.022, from: [0.36, 0.5, 0.2], to: [0.36, 1.15, 0.98] },
      { type: 'cyl', r: 0.022, from: [-0.36, 0.5, 0.2], to: [-0.36, 1.15, 0.98] },
    ],
    keys: [
      { y: 0.55 - 0.975, pelvis: -60, spine: -62, chest: -64, head: -48, footW: [0.86, 0.38], foot: -128, uarm: 25, farm: -20, uarmA: 22 },
      { y: 0.55 - 0.975, pelvis: -60, spine: -62, chest: -64, head: -48, footW: [1.06, 0.62], foot: -128, uarm: 25, farm: -20, uarmA: 22 },
    ],
  },
  'leg-extension': {
    dur: 2.4, anchor: 'fixed',
    props: [
      { type: 'box', size: [0.46, 0.08, 0.46], pos: [0, 0.5, 0.08], mat: 'pad' },
      { type: 'box', size: [0.44, 0.6, 0.08], pos: [0, 0.92, -0.17], rot: [-10, 0, 0], mat: 'pad' },
      { type: 'box', size: [0.3, 0.46, 0.5], pos: [0, 0.23, 0.0], mat: 'equip' },
      { type: 'roller', follow: 'feet', offset: [0, 0.02, 0.07] },
    ],
    keys: [
      { y: 0.62 - 0.975, pelvis: -8, spine: -9, chest: -10, thigh: -88, shin: 12, foot: 8, uarm: 8, farm: -12, uarmA: 26 },
      { y: 0.62 - 0.975, pelvis: -8, spine: -9, chest: -10, thigh: -88, shin: -80, foot: -70, uarm: 8, farm: -12, uarmA: 26 },
    ],
  },
  'leg-curl': {
    dur: 2.4, anchor: 'fixed', cam: { az: 72, el: 20 },
    props: [
      { type: 'box', size: [0.44, 0.07, 1.25], pos: [0, 0.5, 0.1], mat: 'pad' },
      { type: 'box', size: [0.3, 0.47, 0.9], pos: [0, 0.235, 0.1], mat: 'equip' },
      { type: 'roller', follow: 'feet', offset: [0, 0.07, -0.02] },
    ],
    keys: [
      { y: 0.62 - 0.975, pelvis: 90, spine: 90, chest: 90, head: 72, thigh: 90, shin: 90, foot: 90, uarm: -45, farm: -75, uarmA: 22 },
      { y: 0.62 - 0.975, pelvis: 90, spine: 90, chest: 90, head: 72, thigh: 90, shin: 168, foot: 170, uarm: -45, farm: -75, uarmA: 22 },
    ],
  },

  // ---------------- อก / ไหล่ / แขน ----------------
  'bench-press': {
    dur: 2.6, anchor: 'fixed', armBend: -1, cam: { az: 58, el: 22 },
    props: [BAR, 'bench', 'rack'],
    keys: [
      { y: 0.6 - 0.975, pelvis: -90, spine: -90, chest: -90, head: -90, thigh: -70, shin: 0, handC: [0.22, 0.5], uarmA: 22 },
      { y: 0.6 - 0.975, pelvis: -90, spine: -90, chest: -90, head: -90, thigh: -70, shin: 0, handC: [0.1, 0.16], uarmA: 22 },
    ],
  },
  'dumbbell-bench': {
    dur: 2.6, anchor: 'fixed', armBend: -1, cam: { az: 58, el: 22 },
    props: [{ type: 'dumbbells', axis: 'x' }, 'bench'],
    keys: [
      { y: 0.6 - 0.975, pelvis: -90, spine: -90, chest: -90, head: -90, thigh: -70, shin: 0, handC: [0.2, 0.5], uarmA: 18 },
      { y: 0.6 - 0.975, pelvis: -90, spine: -90, chest: -90, head: -90, thigh: -70, shin: 0, handC: [0.1, 0.13], uarmA: 34 },
    ],
  },
  'incline-bench': {
    dur: 2.6, anchor: 'fixed', armBend: -1, cam: { az: 60, el: 16 },
    props: [
      BAR,
      { type: 'box', size: [0.34, 0.07, 0.82], pos: [0, 0.66, -0.34], rot: [35, 0, 0], mat: 'pad' },
      { type: 'box', size: [0.34, 0.07, 0.34], pos: [0, 0.46, 0.06], mat: 'pad' },
      { type: 'box', size: [0.12, 0.44, 0.7], pos: [0, 0.22, -0.15], mat: 'equip' },
    ],
    keys: [
      { y: 0.6 - 0.975, pelvis: -55, spine: -55, chest: -55, head: -45, thigh: -70, shin: 0, handC: [0.24, 0.5], uarmA: 22 },
      { y: 0.6 - 0.975, pelvis: -55, spine: -55, chest: -55, head: -45, thigh: -70, shin: 0, handC: [0.12, 0.16], uarmA: 22 },
    ],
  },
  'cable-fly': {
    dur: 2.6,
    props: [
      { type: 'cable', from: [1.0, 1.95, -0.12], to: 'handL' },
      { type: 'cable', from: [-1.0, 1.95, -0.12], to: 'handR' },
      { type: 'box', size: [0.18, 2.1, 0.24], pos: [1.1, 1.05, -0.12], mat: 'equip' },
      { type: 'box', size: [0.18, 2.1, 0.24], pos: [-1.1, 1.05, -0.12], mat: 'equip' },
    ],
    keys: [
      { pelvis: 8, spine: 12, chest: 14, thigh: [-10, 10], shin: [0, 14], uarmA: 84, uarmT: 18, elbowR: -22 },
      { pelvis: 8, spine: 12, chest: 14, thigh: [-10, 10], shin: [0, 14], uarmA: 84, uarmT: -78, elbowR: -22 },
    ],
  },
  'overhead-press': {
    dur: 2.6, props: [BAR], armBend: -1,
    keys: [
      { handC: [0.27, 0.17], uarmA: 22 },
      { handC: [0.84, 0.04], uarmA: 14 },
    ],
  },
  'lateral-raise': {
    dur: 2.4, props: [{ type: 'dumbbells', axis: 'z' }],
    keys: [
      { uarmA: 10, elbowR: -12 },
      { uarmA: 86, elbowR: -16 },
    ],
  },
  'bicep-curl': {
    dur: 2.2, props: [{ type: 'dumbbells', axis: 'x' }],
    keys: [
      { uarm: 4, farm: 0, uarmA: 8 },
      { uarm: -14, farm: -150, uarmA: 8 },
    ],
  },
  'tricep-pushdown': {
    dur: 2.2, cam: { az: 70, el: 10 },
    props: [
      { type: 'handle', width: 0.36 },
      { type: 'cable', from: [0, 2.2, 0.48], to: 'handsMid' },
      { type: 'box', size: [0.22, 2.3, 0.12], pos: [0, 1.15, 0.6], mat: 'equip' },
    ],
    keys: [
      { pelvis: 8, spine: 12, chest: 15, head: 8, uarm: 8, farm: -98, uarmA: 5 },
      { pelvis: 8, spine: 12, chest: 15, head: 8, uarm: 6, farm: -4, uarmA: 5 },
    ],
  },
  dips: {
    dur: 2.4, anchor: 'hands', handsAt: [0, 1.22, 0], props: ['dipbars'],
    keys: [
      { uarm: 0, farm: 0, uarmA: 12, thigh: -12, shin: 72, foot: 40 },
      { pelvis: 20, spine: 25, chest: 28, head: 14, uarm: 74, farm: -2, uarmA: 12, thigh: 8, shin: 85, foot: 45 },
    ],
  },
  'push-up': {
    dur: 2.2, anchor: 'feet', fix: 'floor', armBend: 1, cam: { az: 70, el: 18 },
    keys: [
      { pelvis: 68, spine: 68, chest: 68, head: 58, thigh: 68, shin: 68, foot: 68, handFix: 1, uarmA: 14 },
      { pelvis: 82, spine: 82, chest: 82, head: 72, thigh: 82, shin: 82, foot: 82, handFix: 1, uarmA: 22 },
    ],
  },
  'handstand-push-up': {
    dur: 2.6, anchor: 'fixed', fix: 'floor', armBend: -1, cam: { az: 60, el: 10 },
    keys: [
      { y: 1.24 - 0.975, pelvis: 180, spine: 180, chest: 180, head: 180, thigh: 180, shin: 180, foot: 150, handFix: 1, uarmA: 14 },
      { y: 0.98 - 0.975, pelvis: 180, spine: 180, chest: 180, head: 170, thigh: 180, shin: 180, foot: 150, handFix: 1, uarmA: 26 },
    ],
  },

  // ---------------- หลัง / ดึง ----------------
  'barbell-row': {
    dur: 2.4, props: [BAR], armBend: 1,
    keys: [
      { pelvis: 48, spine: 52, chest: 55, head: 32, thigh: -24, shin: 14, uarm: 0, farm: 0, uarmA: 10 },
      { pelvis: 48, spine: 52, chest: 55, head: 32, thigh: -24, shin: 14, handC: [0.02, 0.14], uarmA: 18 },
    ],
  },
  'lat-pulldown': {
    dur: 2.6, anchor: 'fixed',
    props: [
      { type: 'handle', width: 1.1 },
      { type: 'cable', from: [0, 2.45, 0.05], to: 'handsMid' },
      { type: 'box', size: [0.44, 0.08, 0.44], pos: [0, 0.52, 0.04], mat: 'pad' },
      { type: 'box', size: [0.3, 0.5, 0.4], pos: [0, 0.25, 0.04], mat: 'equip' },
      { type: 'box', size: [0.44, 0.09, 0.14], pos: [0, 0.75, 0.42], mat: 'pad' },
      { type: 'box', size: [0.16, 2.5, 0.16], pos: [0, 1.25, -0.45], mat: 'equip' },
    ],
    keys: [
      { y: 0.64 - 0.975, pelvis: -6, spine: -8, chest: -10, head: -14, thigh: -90, shin: 4, uarm: -168, uarmA: 30, farm: -172 },
      { y: 0.64 - 0.975, pelvis: -12, spine: -16, chest: -20, head: -8, thigh: -90, shin: 4, uarm: -10, uarmA: 80, uarmRoll: 88, elbowR: -118 },
    ],
  },
  'pull-up': {
    dur: 2.6, anchor: 'hands', handsAt: [0, 2.25, 0], props: ['pullbar'],
    keys: [
      { uarm: -172, uarmA: 26, farm: -174, thigh: -14, shin: 45, foot: 30 },
      { pelvis: -8, spine: -10, chest: -14, uarm: -12, uarmA: 70, uarmRoll: 80, elbowR: -128, thigh: -18, shin: 48, foot: 30 },
    ],
  },
  'chin-up': {
    dur: 2.6, anchor: 'hands', handsAt: [0, 2.25, 0], props: ['pullbar'],
    keys: [
      { uarm: -174, uarmA: 10, farm: -176, thigh: -14, shin: 45, foot: 30 },
      { pelvis: -6, spine: -8, chest: -12, uarm: -22, uarmA: 14, farm: -168, thigh: -18, shin: 48, foot: 30 },
    ],
  },
  'muscle-up': {
    dur: 3.4, anchor: 'hands', handsAt: [0, 2.25, 0], props: ['pullbar'], times: [1, 0.8, 0.9, 1],
    keys: [
      { uarm: -172, uarmA: 22, farm: -174, thigh: -10, shin: 20 },
      { pelvis: -10, spine: -12, chest: -16, uarm: -10, uarmA: 22, farm: -165, thigh: -20, shin: 25 },
      { pelvis: 28, spine: 32, chest: 36, head: 30, uarm: 45, uarmA: 18, farm: -100, thigh: -30, shin: 20 },
      { pelvis: 12, spine: 14, chest: 16, uarm: 6, uarmA: 18, farm: 0, thigh: -12, shin: 8 },
    ],
  },
  'inverted-row': {
    dur: 2.4, anchor: 'feet', fix: 'bar', armBend: 1, cam: { az: 70, el: 14 },
    props: ['lowbar'],
    keys: [
      { pelvis: -60, spine: -60, chest: -60, head: -62, thigh: -60, shin: -60, foot: -60, handFix: 1, uarmA: 16 },
      { pelvis: -48, spine: -48, chest: -48, head: -50, thigh: -48, shin: -48, foot: -48, handFix: 1, uarmA: 30 },
    ],
  },
  'hanging-leg-raise': {
    dur: 2.6, anchor: 'hands', handsAt: [0, 2.25, 0], props: ['pullbar'],
    keys: [
      { uarm: -174, uarmA: 18, farm: -176, foot: 20 },
      { pelvis: -18, spine: -10, chest: -6, uarm: -168, uarmA: 18, farm: -172, thigh: -112, shin: -110, foot: -80 },
    ],
  },

  // ---------------- แกนกลาง ----------------
  plank: {
    dur: 3, anchor: 'ground', pulse: 'cyclic', cam: { az: 68, el: 16 },
    fn: (p) => {
      const b = 1.4 * sin(TAU * p)
      return { pelvis: 79 + b, spine: 79, chest: 79 - b * 0.5, head: 66, thigh: 79 - b, shin: 79, foot: 79, uarm: 0, farm: -90, uarmA: 8 }
    },
  },
  crunch: {
    dur: 2.2, anchor: 'ground', armBend: -1, cam: { az: 62, el: 20 },
    keys: [
      { pelvis: -90, spine: -90, chest: -90, head: -82, thigh: -140, shin: -32, foot: 0, handC: [0.42, 0.06], uarmA: 40 },
      { pelvis: -94, spine: -72, chest: -46, head: -30, thigh: -140, shin: -32, foot: 0, handC: [0.42, 0.06], uarmA: 40 },
    ],
  },
  'mountain-climber': {
    dur: 1.4, anchor: 'ground', pulse: 'cyclic', cam: { az: 68, el: 16 },
    fn: (p) => {
      const c = cos(TAU * p)
      const tL = 16 + 56 * c
      const tR = 16 - 56 * c
      return {
        pelvis: 72, spine: 72, chest: 72, head: 60, uarm: 0, farm: 0, uarmA: 10,
        thigh: [tL, tR], shin: [72, 72], foot: [80 + 8 * c, 80 - 8 * c],
      }
    },
  },
  burpee: {
    dur: 3.6, anchor: 'ground', times: [0.8, 0.7, 0.9, 0.7, 0.9],
    keys: [
      { ...ARMS_DOWN },
      { pelvis: 40, spine: 62, chest: 72, head: 50, thigh: -112, shin: 32, uarm: 0, farm: 0, uarmA: 12 },
      { pelvis: 72, spine: 72, chest: 72, head: 60, thigh: 72, shin: 72, foot: 72, uarm: 0, farm: 0, uarmA: 12 },
      { pelvis: 40, spine: 62, chest: 72, head: 50, thigh: -112, shin: 32, uarm: 0, farm: 0, uarmA: 12 },
      { lift: 0.3, foot: 50, uarm: -168, farm: -172, uarmA: 16 },
    ],
  },

  // ---------------- พลังระเบิด / ฟังก์ชัน ----------------
  'clean-jerk': {
    dur: 4.2, props: [BAR], armBend: -1, times: [1, 0.8, 0.9, 1.1],
    keys: [
      { pelvis: 48, spine: 56, chest: 60, head: 38, thigh: -74, shin: 30, uarm: 0, farm: 0, uarmA: 10 },
      { pelvis: 18, spine: 18, chest: 16, head: 4, thigh: -96, shin: 24, thighA: 14, handC: [0.27, 0.17], uarmA: 26 },
      { handC: [0.27, 0.17], uarmA: 26 },
      { thigh: [-42, 26], shin: [12, 40], foot: [0, 40], handC: [0.84, 0.0], uarmA: 16 },
    ],
  },
  'kettlebell-swing': {
    dur: 2, props: ['kettlebell'],
    keys: [
      { pelvis: 55, spine: 58, chest: 60, head: 38, thigh: -30, shin: 16, thighA: 14, uarm: 28, farm: 28, uarmA: 6 },
      { thighA: 14, uarm: -90, farm: -92, uarmA: 6 },
    ],
  },
  'jumping-jack': {
    dur: 1.6, anchor: 'ground',
    fn: (p) => {
      const k = 0.5 - 0.5 * cos(TAU * p)
      return { uarmA: 14 + 150 * k, elbowR: -10, thighA: 3 + 18 * k, lift: 0.07 * abs(sin(TAU * p)), foot: 18 * abs(sin(TAU * p)) }
    },
  },
  'jump-rope': {
    dur: 1.2, anchor: 'ground', props: ['rope'], pulse: 'cyclic',
    fn: (p) => {
      const j = abs(sin(TAU * 2 * p))
      return { lift: 0.08 * j, foot: 30 * j, thigh: -6, shin: 10 - 6 * j, uarm: 12, farm: -55, uarmA: 24 }
    },
  },

  // ---------------- คาร์ดิโอ ----------------
  run: { dur: 0.9, anchor: 'ground', pulse: 'cyclic', cam: { az: 78, el: 10 }, fn: (p) => gait(p, {}) },
  'treadmill-run': { dur: 0.9, anchor: 'ground', pulse: 'cyclic', cam: { az: 70, el: 12 }, props: ['treadmill'], fn: (p) => gait(p, {}) },
  walk: {
    dur: 1.3, anchor: 'ground', pulse: 'cyclic', cam: { az: 78, el: 10 },
    fn: (p) => gait(p, { stride: 22, knee: 32, kneeBase: 4, arm: 20, elbow: 18, lean: 3, bounce: 0.015 }),
  },
  hike: {
    dur: 1.4, anchor: 'ground', pulse: 'cyclic', cam: { az: 70, el: 10 }, props: ['backpack'],
    fn: (p) => gait(p, { stride: 26, knee: 42, kneeBase: 8, arm: 22, elbow: 30, lean: 12, bounce: 0.02 }),
  },
  cycling: {
    dur: 1.1, anchor: 'fixed', pulse: 'cyclic', props: ['bike'],
    fn: (p) => ({ y: 0.97 - 0.975, pelvis: 30, spine: 40, chest: 46, head: 22, uarmA: 10, ...pedal(p, { cy: 0.32, cz: 0.2, r: 0.17, hand: [1.0, 0.64] }) }),
  },
  'stationary-bike': {
    dur: 1.1, anchor: 'fixed', pulse: 'cyclic', props: ['spinBike'],
    fn: (p) => ({ y: 0.97 - 0.975, pelvis: 22, spine: 30, chest: 34, head: 14, uarmA: 10, ...pedal(p, { cy: 0.34, cz: 0.22, r: 0.17, hand: [1.06, 0.58] }) }),
  },
  elliptical: {
    dur: 1.4, anchor: 'fixed', pulse: 'cyclic', props: ['elliptical'],
    fn: (p) => {
      const ph = TAU * p
      return {
        y: 1.27 - 0.975 + 0.02 * sin(2 * ph), pelvis: 4, spine: 6, chest: 8, uarmA: 10, foot: 0,
        footWL: [0.36 + 0.08 * sin(ph), 0.04 + 0.24 * cos(ph)],
        footWR: [0.36 + 0.08 * sin(ph + PI), 0.04 + 0.24 * cos(ph + PI)],
        handWL: [1.2, 0.36 - 0.14 * cos(ph)],
        handWR: [1.2, 0.36 + 0.14 * cos(ph)],
      }
    },
  },
  'stair-climber': {
    dur: 1.4, anchor: 'fixed', pulse: 'cyclic', props: ['steps'],
    fn: (p) => {
      const ph = TAU * p
      const up = (o) => 0.5 + 0.5 * sin(ph + o)
      return {
        y: 1.26 - 0.975 + 0.04 * sin(2 * ph), pelvis: 10, spine: 14, chest: 16, head: 6, uarmA: 12,
        footWL: [0.3 + 0.2 * up(0), 0.12 + 0.16 * up(0)],
        footWR: [0.3 + 0.2 * up(PI), 0.12 + 0.16 * up(PI)],
        handW: [1.08, 0.36],
      }
    },
  },
  rowing: {
    dur: 2.4, anchor: 'fixed', props: ['rower'],
    keys: [
      { y: 0.44 - 0.975, z: 0.26, pelvis: 24, spine: 30, chest: 32, head: 18, footW: [0.3, 0.84], foot: -40, handW: [0.74, 1.08] },
      { y: 0.44 - 0.975, z: -0.24, pelvis: -16, spine: -18, chest: -20, head: -8, footW: [0.3, 0.84], foot: -40, handW: [0.66, 0.02] },
    ],
  },
  swim: {
    dur: 1.8, anchor: 'fixed', pulse: 'cyclic', props: ['water'], cam: { az: 64, el: 22 },
    fn: (p) => {
      const ph = TAU * p
      const kick = (o) => 92 + 12 * sin(4 * ph + o)
      const arm = (o) => -90 + 360 * ((p + o) % 1)
      const aL = arm(0)
      const aR = arm(0.5)
      return {
        y: 0.5 - 0.975, pelvis: 90, spine: 90, chest: 90, head: 82, pelvisYaw: 28 * sin(ph),
        thigh: [kick(0), kick(PI)], shin: [kick(0) + 12, kick(PI) + 12], foot: [kick(0) + 70, kick(PI) + 70],
        uarm: [aL, aR], farm: [aL - 18, aR - 18], uarmA: 10,
      }
    },
  },

  // ---------------- กีฬา ----------------
  boxing: {
    dur: 2.2, armBend: -1, props: ['gloves'],
    keys: [
      { thigh: [-14, 14], shin: [2, 22], foot: [0, 12], pelvisYaw: 18, chestTwist: 6, handC: [0.36, 0.26], uarmA: 12 },
      { thigh: [-14, 14], shin: [2, 22], foot: [0, 12], pelvisYaw: 10, chestTwist: 18, handCL: [0.36, 0.66], handCR: [0.36, 0.26], uarmA: 12 },
      { thigh: [-14, 14], shin: [2, 22], foot: [0, 12], pelvisYaw: 18, chestTwist: 6, handC: [0.36, 0.26], uarmA: 12 },
      { thigh: [-16, 6], shin: [4, 14], foot: [0, 25], pelvisYaw: 30, chestTwist: -24, handCL: [0.36, 0.26], handCR: [0.36, 0.66], uarmA: 12 },
    ],
  },
  badminton: {
    dur: 2.4, armBend: -1, props: ['racket'], times: [1, 0.6, 1],
    keys: [
      { thigh: [-10, 14], shin: [6, 20], chest: -8, chestTwist: 22, handCR: [0.52, -0.12], handCL: [0.62, 0.36], uarmA: 18 },
      { lift: 0.12, chest: 6, chestTwist: -10, handCR: [0.86, 0.22], handCL: [0.25, 0.3], uarmA: 18, foot: 30 },
      { thigh: [-20, 10], shin: [10, 20], pelvis: 12, chest: 20, chestTwist: -30, handCR: [-0.05, 0.36], handCL: [0.1, 0.22], uarmA: 16 },
    ],
  },
  football: {
    dur: 2.4, anchor: 'footL', props: [{ type: 'ball', kind: 'football', pos: [-0.1, 0.11, 0.36] }], times: [1, 0.7, 1],
    keys: [
      { uarmA: [20, 20], thigh: [-6, 6], shin: [4, 10] },
      { uarmA: [55, 35], uarm: [-20, 20], thigh: [-10, 38], shin: [6, 112], foot: [0, 40], chestTwist: 14 },
      { uarmA: [50, 30], uarm: [20, -30], thigh: [-6, -78], shin: [6, -64], foot: [0, 25], pelvis: -10, chest: -6, chestTwist: -16 },
    ],
  },
  basketball: {
    dur: 2.4, armBend: -1, props: [{ type: 'ball', kind: 'basketball', follow: 'handsMid', offset: [0, 0.05, 0.1] }], times: [1, 0.8, 0.9],
    keys: [
      { pelvis: 16, spine: 18, chest: 18, thigh: -48, shin: 26, handC: [0.12, 0.3], uarmA: 18 },
      { handC: [0.5, 0.26], uarmA: 22, chest: -4 },
      { lift: 0.26, foot: 55, chest: -6, handC: [0.86, 0.22], uarmA: 18 },
    ],
  },
  dance: {
    dur: 2, anchor: 'ground',
    fn: (p) => {
      const ph = TAU * p
      const b = abs(sin(2 * ph))
      return {
        x: 0.1 * sin(ph), pelvisRoll: 6 * sin(ph), chestSide: -8 * sin(ph), chestTwist: 10 * sin(2 * ph), head: -4 * sin(ph),
        thigh: [-10 - 12 * b, -10 - 12 * (1 - b)], shin: [8 + 18 * b, 8 + 18 * (1 - b)], thighA: [6 + 10 * (0.5 + 0.5 * sin(ph)), 6 + 10 * (0.5 - 0.5 * sin(ph))],
        uarmA: [40 + 70 * (0.5 + 0.5 * sin(ph)), 40 + 70 * (0.5 - 0.5 * sin(ph))], elbowR: [-40 - 40 * b, -40 - 40 * (1 - b)],
      }
    },
  },
  'yoga-flow': {
    dur: 5, times: [1, 1, 1.4, 1], armBend: -1,
    keys: [
      { handC: [0.1, 0.22], uarmA: 30 },
      { chest: -10, head: -16, uarm: -176, farm: -178, uarmA: 12 },
      { pelvis: 78, spine: 88, chest: 98, head: 110, thigh: 0, shin: 0, uarm: 0, farm: 0, uarmA: 6 },
      { pelvis: 40, spine: 46, chest: 50, head: 30, uarm: 0, farm: 0, uarmA: 6 },
    ],
  },
}

// ค่าที่มีด้านซ้าย/ขวา
export const SIDED = ['uarm', 'farm', 'thigh', 'shin', 'foot', 'uarmA', 'thighA', 'uarmT', 'thighT', 'uarmRoll', 'elbowR']
const pick = (v, s) => (Array.isArray(v) && v.length === 2 && typeof v[0] !== 'object' ? v[s] : v)

// เติมค่าเริ่มต้นให้ครบทุก channel (ทำก่อน interpolate เพื่อให้ทุก keyframe มีคีย์เดียวกัน)
export function resolvePose(p) {
  const o = {}
  o.pelvis = p.pelvis ?? 0
  o.spine = p.spine ?? o.pelvis
  o.chest = p.chest ?? o.spine
  o.head = p.head ?? o.chest
  for (const k of ['chestTwist', 'chestSide', 'pelvisYaw', 'pelvisRoll', 'x', 'y', 'z', 'lift', 'handFix']) o[k] = p[k] ?? 0
  for (const k of SIDED) o[k] = [null, null]
  for (const s of [0, 1]) {
    const uarm = pick(p.uarm, s) ?? 0
    const thigh = pick(p.thigh, s) ?? 0
    o.uarm[s] = uarm
    o.farm[s] = pick(p.farm, s) ?? uarm - 6
    o.thigh[s] = thigh
    o.shin[s] = pick(p.shin, s) ?? thigh
    o.foot[s] = pick(p.foot, s) ?? 0
    o.uarmA[s] = pick(p.uarmA, s) ?? 8
    o.thighA[s] = pick(p.thighA, s) ?? 3
    o.uarmT[s] = pick(p.uarmT, s) ?? 0
    o.thighT[s] = pick(p.thighT, s) ?? 0
    o.uarmRoll[s] = pick(p.uarmRoll, s) ?? 0
    o.elbowR[s] = pick(p.elbowR, s) ?? null
  }
  for (const k of ['handC', 'handW', 'footW']) o[k] = [p[`${k}L`] ?? p[k] ?? null, p[`${k}R`] ?? p[k] ?? null]
  return o
}

const lerpV = (a, b, w) => {
  if (a == null || b == null) return w < 0.5 ? a : b
  if (Array.isArray(a)) return a.map((v, i) => lerpV(v, b[i], w))
  return a + (b - a) * w
}
const ease = (t) => t * t * (3 - 2 * t)

// t ∈ [0, 1) -> ท่า (resolved) ; keyframe วนกลับไปท่าแรก
export function samplePose(motion, t) {
  if (motion.fn) return resolvePose(motion.fn(t))
  const keys = motion._resolved || (motion._resolved = motion.keys.map(resolvePose))
  const times = motion.times || keys.map(() => 1)
  const total = times.reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < keys.length; i++) {
    const span = times[i] / total
    if (t < acc + span || i === keys.length - 1) {
      const w = ease(Math.min(1, Math.max(0, (t - acc) / span)))
      const a = keys[i]
      const b = keys[(i + 1) % keys.length]
      const out = {}
      for (const k of Object.keys(a)) out[k] = lerpV(a[k], b[k], w)
      return out
    }
    acc += span
  }
  return keys[0]
}

// ระดับการเกร็งกล้ามเนื้อ 0..1 (ใช้ทำให้กล้ามเนื้อเป้าหมายเรืองแสงแรงขึ้นตอนออกแรง)
export function contraction(motion, t) {
  if (motion.pulse === 'cyclic') return 0.5 + 0.5 * sin(TAU * t * 2)
  return sin(PI * t) ** 2
}

