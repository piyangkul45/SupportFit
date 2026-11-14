// คลังท่าเคลื่อนไหวของตัวละคร 3D (ข้อมูลล้วน ไม่ import three) ใช้โดย scene.js ตอนเรนเดอร์วิดีโอ
//
// พิกัดโลก (เมตร): y ขึ้น, +z = ด้านหน้าของตัวละคร, +x = ซ้ายของตัวละคร ; พื้น y = 0
// สัดส่วนร่าง (วัดจากกระดูกจริง): ข้อสะโพกยืน 0.884, ข้อไหล่ 1.388, ข้อเท้า 0.056 (= A), ต้นแขน 0.276, ปลายแขน 0.236,
//   ต้นขา 0.437, หน้าแข้ง 0.391 ; ไหล่ -> จุดกำ ~0.61
//
// ลำตัว (มุมโลกในระนาบด้านข้าง, องศา): pelvis / spine / chest / head : 0 = ตั้งตรง, + = เอนไปหน้า, -90 = นอนหงาย, 90 = คว่ำ
// ขา: hip: [y, z] = ตำแหน่งข้อสะโพก (กึ่งกลาง) ; ft: [x, y, z] = ตำแหน่งข้อเท้าซ้าย (ขวาสะท้อน x) -> leg IK วางเท้าราบ
//   toe = หมุนปลายเท้าออก (องศา เพิ่มจากท่ายืนปกติ ~17°) ; kneeP = ทิศที่เข่าชี้ ; footPitch = เอียงเท้า (+ ยกส้น/ปลายเท้าชี้ลง)
//   ไม่กำหนด ft = FK: thigh / shin / foot (0 = ห้อยลง, -90 = ชี้ไปหน้า) thighA = กางขา
// แขน: bar: [y, z] = กึ่งกลางบาร์ (barSpace: world | chest | root) มือจับห่าง gw ; grip: [x, y, z] = จุดกำมือซ้าย (gripSpace)
//   pole = ทิศที่ศอกชี้ (พิกัดอก: x ออกข้าง, y ไปทางศีรษะ, z ไปทางหน้าอก) ; gripAxis = แนวด้ามจับ ; palm = ทิศฝ่ามือ (วางมือราบ)
//   pron = คว่ำ/หงายมือ (0 = หงาย, 90 = ตั้ง, 180 = คว่ำ) ; curl = งอนิ้ว (1 = กำด้ามจับ) ; ไม่กำหนด grip/bar = FK: uarm / farm / uarmA / elbowR
// ค่าซ้าย/ขวาต่างกันใส่ [ซ้าย, ขวา] ; เวกเตอร์ด้านขวาเขียนแบบสะท้อน (x บวก = ออกด้านข้าง)
// anchor: feet | ground | pivot (ปลายเท้ายึดจุด pivotZ) | fixed (ใช้ hip) | contact (หลัง/ก้นแนบระนาบเบาะใน contact)

const { sin, cos, PI, abs } = Math
const TAU = 2 * PI
const A = 0.059 // ความสูงข้อเท้าเมื่อเท้าราบกับพื้น (ฝ่าเท้าแตะ y = 0 พอดี)
const R = (d) => (d * PI) / 180

// ม้านั่ง/เบาะเครื่อง: ใช้ทั้งสร้างโมเดล (prop) และระนาบสัมผัส (หลัง/ก้นแนบเบาะพอดี)
function seatPads({ top, back = 0, seatZ, seatLen = 0.36, t = 0.07 }) {
  const hingeZ = seatZ - seatLen / 2 - 0.01
  const a = R(back)
  const d = cos(a) * (top - t / 2) + sin(a) * hingeZ + t / 2
  return { hingeZ, seat: { set: 'seat', n: [0, 1, 0], d: top }, back: { set: 'torso', n: [0, cos(a), sin(a)], d } }
}

const FLAT = { top: 0.44, back: 0, seatZ: 0.2, seatLen: 0.4, backLen: 0.84 }
const flatPads = seatPads(FLAT)
const INCLINE = { top: 0.46, back: 35, seatZ: 0.12, seatLen: 0.36, backLen: 0.84 }
const inclinePads = seatPads(INCLINE)
const PRESS = { top: 0.45, back: 45, seatZ: 0.0, seatLen: 0.38, backLen: 0.7 }
const pressPads = seatPads(PRESS)
const EXT = { top: 0.5, back: 78, seatZ: 0.08, seatLen: 0.44, backLen: 0.62 }
const extPads = seatPads(EXT)

const STAND = { hip: [0.872, 0], ft: [0.12, A, 0], toe: 4 }
const HANG = { uarm: 0, uarmA: 9, elbowR: -8, pron: 85, curl: 0.35 }

// ---------- ท่าแบบวงจรต่อเนื่อง (วิ่ง เดิน) ----------
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
    thigh: [tL, tR], shin: [sL, sR], foot: [8 * sin(ph) + 4, 8 * sin(ph + PI) + 4],
    uarm: [aL, aR], farm: [aL - elbow, aR - elbow], uarmA: 9, pron: 70, curl: 0.75,
    lift: bounce * abs(sin(ph)), chestTwist: 6 * sin(ph), pelvisYaw: -4 * sin(ph),
  }
}

// จักรยาน: ข้อเท้าวิ่งเป็นวงกลมรอบแกนบันได (ข้อเท้าอยู่เหนือแป้น ~7 ซม. ถอยหลัง ~5 ซม.)
function pedal(p, { cy, cz, r, x = 0.11 }) {
  const ph = TAU * p
  const at = (o) => [x, cy + r * sin(ph + o) + 0.07, cz + r * cos(ph + o) - 0.05]
  return { ft: [at(0), at(PI)], footPitch: [10 * sin(ph) + 6, 10 * sin(ph + PI) + 6], toe: 0, kneeP: [0.08, 0.2, 1] }
}

export const MOTIONS = {
  // ================= ขา / สะโพก =================
  // Back squat (high bar): บาร์พาดบ่าบน (กล้ามเนื้อ trapezius) ; หลังตรง neutral ; ย่อถึงขนานพื้น ; เข่าชี้ตามปลายเท้า ; บาร์อยู่เหนือกลางเท้า
  'barbell-squat': {
    dur: 3.0, props: ['barbell'], barSpace: 'chest',
    keys: [
      { hip: [0.872, 0.03], ft: [0.17, A, 0], toe: 10, pelvis: 9, spine: 8, chest: 7, head: 2, bar: [0.268, -0.088], gw: 0.27, pron: 175, curl: 1, pole: [0.35, -1, -0.45] },
      { hip: [0.47, -0.22], ft: [0.17, A, 0], toe: 10, pelvis: 44, spine: 42, chest: 40, head: 24, bar: [0.268, -0.088], gw: 0.27, pron: 175, curl: 1, pole: [0.35, -1, -0.45] },
    ],
  },
  'bodyweight-squat': {
    dur: 2.6,
    keys: [
      { hip: [0.872, 0.0], ft: [0.16, A, 0], toe: 10, pelvis: 3, spine: 3, chest: 3, uarm: -10, uarmA: 10, elbowR: -10, pron: 80, curl: 0.3 },
      { hip: [0.47, -0.18], ft: [0.16, A, 0], toe: 10, pelvis: 38, spine: 36, chest: 34, head: 16, uarm: -84, uarmA: 12, elbowR: -6, pron: 170, curl: 0.15 },
    ],
  },
  // Pistol squat: ขาซ้ายรับน้ำหนัก ส้นเท้าติดพื้น ; ขาขวาเหยียดไปหน้า ; แขนยื่นถ่วงสมดุล
  'pistol-squat': {
    dur: 3.2,
    keys: [
      { hip: [0.85, 0.0], ft: [[0.09, A, 0.02], null], toe: 4, pelvis: 6, spine: 6, chest: 6, thigh: [0, -40], shin: [0, -30], foot: [0, -20], uarm: -70, elbowR: -8, pron: 170, curl: 0.2 },
      { hip: [0.36, -0.2], ft: [[0.09, A, 0.02], null], toe: 4, pelvis: 42, spine: 40, chest: 38, head: 20, thigh: [0, -78], shin: [0, -78], foot: [0, -30], uarm: -88, elbowR: -4, pron: 170, curl: 0.2 },
    ],
  },
  'jump-squat': {
    dur: 2.2, times: [1, 0.55, 0.8],
    keys: [
      { hip: [0.872, 0.0], ft: [0.16, A, 0], toe: 10, pelvis: 3, spine: 3, chest: 3, ...HANG },
      { hip: [0.5, -0.17], ft: [0.16, A, 0], toe: 10, pelvis: 36, spine: 34, chest: 32, head: 14, uarm: 35, elbowR: -10, uarmA: 10, pron: 85, curl: 0.4 },
      { hip: [1.18, 0.0], ft: [0.15, A + 0.27, -0.01], footPitch: 38, toe: 6, pelvis: -2, spine: -3, chest: -4, uarm: -160, elbowR: -10, uarmA: 16, pron: 85, curl: 0.3 },
    ],
  },
  // Split squat ถือดัมเบล: ลำตัวตั้งตรง เข่าหน้าอยู่เหนือข้อเท้า เข่าหลังลงเกือบแตะพื้น ส้นเท้าหลังยก
  lunge: {
    dur: 2.8, props: ['dumbbells'],
    keys: [
      { hip: [0.78, -0.06], ft: [[0.11, A, 0.3], [0.11, 0.133, -0.5]], footPitch: [0, 50], kneeP: [[0.1, 0, 1], [0.05, -0.4, 1]], toe: [3, 0], pelvis: 2, spine: 2, chest: 2, ...HANG, uarmA: 11 },
      { hip: [0.53, -0.07], ft: [[0.11, A, 0.3], [0.11, 0.133, -0.5]], footPitch: [0, 50], kneeP: [[0.1, 0, 1], [0.05, -0.4, 1]], toe: [3, 0], pelvis: 3, spine: 2, chest: 2, ...HANG, uarmA: 11 },
    ],
  },
  // Deadlift: บาร์เหนือกลางเท้า (แผ่นน้ำหนักแตะพื้น) ไหล่อยู่เหนือ/หน้าบาร์เล็กน้อย แขนเหยียด หลังตรง -> ยืนล็อกสะโพก (ไม่แอ่นหลัง)
  deadlift: {
    dur: 3.2, props: ['barbell'], times: [0.9, 0.8, 0.9, 0.8],
    keys: [
      { hip: [0.51, -0.31], ft: [0.13, A, 0], toe: 6, pelvis: 55, spine: 51, chest: 46, head: 30, bar: [0.226, 0.05], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.69, -0.245], ft: [0.13, A, 0], toe: 6, pelvis: 40, spine: 37, chest: 33, head: 20, bar: [0.5, 0.065], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.872, -0.01], ft: [0.13, A, 0], toe: 6, pelvis: 0, spine: 0, chest: -1, head: 0, bar: [0.79, 0.1], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.69, -0.245], ft: [0.13, A, 0], toe: 6, pelvis: 40, spine: 37, chest: 33, head: 20, bar: [0.5, 0.065], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
    ],
  },
  // Romanian deadlift: เข่างอเล็กน้อยคงที่ พับสะโพกไปหลัง หลังตรง บาร์ไถลชิดต้นขา-หน้าแข้ง
  rdl: {
    dur: 3.0, props: ['barbell'],
    keys: [
      { hip: [0.868, 0], ft: [0.12, A, 0], toe: 4, pelvis: 0, spine: 0, chest: -1, head: 0, bar: [0.79, 0.1], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.84, -0.15], ft: [0.12, A, 0], toe: 4, pelvis: 37, spine: 35, chest: 31, head: 22, bar: [0.65, 0.12], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.8, -0.27], ft: [0.12, A, 0], toe: 4, pelvis: 72, spine: 68, chest: 63, head: 46, bar: [0.48, 0.13], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.84, -0.15], ft: [0.12, A, 0], toe: 4, pelvis: 37, spine: 35, chest: 31, head: 22, bar: [0.65, 0.12], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
    ],
  },
  // Hip thrust: สะบักพาดขอบม้านั่ง เท้าราบ ดันสะโพกจนลำตัว-ต้นขาเป็นแนวราบ (คางชิด) บาร์วางบนข้อพับสะโพก
  'hip-thrust': {
    dur: 2.8, barSpace: 'root', cam: { el: 14 },
    edge: [0.38, -0.3],
    props: [{ type: 'barbell' }, { type: 'box', size: [1.0, 0.38, 0.4], pos: [0, 0.19, -0.5], mat: 'pad' }],
    keys: [
      { hip: [0.27, 0.0], ft: [0.2, A, 0.42], toe: 10, kneeP: [0.3, 1, 0.3], pelvis: -52, spine: -56, chest: -60, head: -40, bar: [-0.03, 0.15], gw: 0.3, pron: 175, curl: 1, pole: [0.6, -0.4, 1] },
      { hip: [0.5, 0.02], ft: [0.2, A, 0.42], toe: 10, kneeP: [0.3, 1, 0.3], pelvis: -92, spine: -90, chest: -86, head: -50, bar: [-0.03, 0.15], gw: 0.3, pron: 175, curl: 1, pole: [0.6, -0.4, 1] },
    ],
  },
  // Leg press 45°: หลัง/ก้นแนบเบาะ เท้าราบเต็มแผ่น กว้างระดับสะโพก ; ลงถึงเข่า ~90° ไม่ล็อกเข่าตอนเหยียด
  'leg-press': {
    dur: 3.0, anchor: 'contact', contact: [pressPads.seat, pressPads.back], cam: { el: 14 },
    props: [
      { type: 'bench', ...PRESS, machine: true },
      { type: 'tube', w: 0.06, from: [0.42, 0.5, 0.18], to: [0.42, 1.32, 1.0] },
      { type: 'tube', w: 0.06, from: [-0.42, 0.5, 0.18], to: [-0.42, 1.32, 1.0] },
      { type: 'tube', w: 0.07, from: [0.42, 0.0, 1.0], to: [0.42, 1.32, 1.0] },
      { type: 'tube', w: 0.07, from: [-0.42, 0.0, 1.0], to: [-0.42, 1.32, 1.0] },
      { type: 'tube', w: 0.07, from: [0.42, 0.0, 0.18], to: [0.42, 0.5, 0.18] },
      { type: 'tube', w: 0.07, from: [-0.42, 0.0, 0.18], to: [-0.42, 0.5, 0.18] },
      { type: 'box', size: [0.95, 0.06, 1.45], pos: [0, 0.03, 0.3], mat: 'frame' },
      { type: 'sled', angle: 45 },
    ],
    keys: [
      { hip: [0.58, 0.0], pelvis: -50, spine: -46, chest: -45, head: -32, ft: [0.13, 0.97, 0.43], toe: 8, footPitch: -135, kneeP: [0.25, 0.75, -0.6], uarm: 18, uarmA: 24, elbowR: -40, pron: 90, curl: 1 },
      { hip: [0.58, 0.0], pelvis: -50, spine: -46, chest: -45, head: -32, ft: [0.13, 1.13, 0.59], toe: 8, footPitch: -135, kneeP: [0.25, 0.75, -0.6], uarm: 18, uarmA: 24, elbowR: -40, pron: 90, curl: 1 },
    ],
  },
  // Leg extension: หลังพิงเบาะ แนวเข่าตรงจุดหมุนเครื่อง ลูกกลิ้งที่หน้าแข้งเหนือข้อเท้า
  'leg-extension': {
    dur: 2.6, anchor: 'contact', contact: [extPads.seat, extPads.back],
    props: [
      { type: 'bench', ...EXT, machine: true },
      { type: 'lever', pivot: 'kneeL', follow: 'kneeL', local: [-0.085, -0.33, 0.075] },
      { type: 'roller', follow: 'kneeL', local: [-0.085, -0.33, 0.075] },
    ],
    keys: [
      { hip: [0.6, 0.0], pelvis: -10, spine: -11, chest: -12, head: -4, thigh: -86, shin: 6, foot: -80, thighA: 4, uarm: 6, uarmA: 22, elbowR: -45, pron: 90, curl: 1 },
      { hip: [0.6, 0.0], pelvis: -10, spine: -11, chest: -12, head: -4, thigh: -86, shin: -78, foot: -150, thighA: 4, uarm: 6, uarmA: 22, elbowR: -45, pron: 90, curl: 1 },
    ],
  },
  // Lying leg curl: นอนคว่ำ สะโพกแนบเบาะ เข่าเลยขอบเบาะ ลูกกลิ้งที่เอ็นร้อยหวาย
  'leg-curl': {
    dur: 2.6, anchor: 'contact', contact: [{ set: 'torso', n: [0, 1, 0], d: 0.5 }], cam: { el: 18 },
    props: [
      { type: 'box', size: [0.34, 0.08, 1.2], pos: [0, 0.46, -0.32], mat: 'pad' },
      { type: 'tube', w: 0.07, from: [0, 0.0, -0.75], to: [0, 0.42, -0.75] },
      { type: 'tube', w: 0.07, from: [0, 0.0, 0.18], to: [0, 0.42, 0.18] },
      { type: 'box', size: [0.55, 0.05, 0.08], pos: [0, 0.025, -0.75], mat: 'frame' },
      { type: 'box', size: [0.55, 0.05, 0.08], pos: [0, 0.025, 0.18], mat: 'frame' },
      { type: 'lever', pivot: 'kneeL', follow: 'kneeL', local: [-0.085, -0.34, -0.08] },
      { type: 'roller', follow: 'kneeL', local: [-0.085, -0.34, -0.08] },
    ],
    keys: [
      { hip: [0.6, 0.0], pelvis: 90, spine: 90, chest: 90, head: 78, thigh: 92, shin: 92, foot: 150, thighA: 3, uarm: -15, uarmA: 22, elbowR: -50, pron: 120, curl: 1 },
      { hip: [0.6, 0.0], pelvis: 90, spine: 90, chest: 90, head: 78, thigh: 92, shin: 200, foot: 250, thighA: 3, uarm: -15, uarmA: 22, elbowR: -50, pron: 120, curl: 1 },
    ],
  },

  // ================= อก / ไหล่ / แขน =================
  // Bench press: หลังแนบเบาะ เท้าราบพื้น ; บาร์ลงแตะอกล่าง (แนวหัวนม) ขึ้นไปเหนือไหล่ ; กางศอก ~45–60° (ไม่กาง 90°)
  'bench-press': {
    dur: 2.8, anchor: 'contact', contact: [flatPads.back], barSpace: 'chest', cam: { el: 20 },
    props: [{ type: 'barbell' }, { type: 'bench', ...FLAT, uprights: 'auto' }],
    keys: [
      { hip: [0.56, 0.1], ft: [0.27, A, 0.6], toe: 12, kneeP: [0.3, 0.7, 0.7], pelvis: -90, spine: -88, chest: -86, head: -90, bar: [0.235, 0.565], gw: 0.28, pron: 175, curl: 1, pole: [1, -1.05, -0.55] },
      { hip: [0.56, 0.1], ft: [0.27, A, 0.6], toe: 12, kneeP: [0.3, 0.7, 0.7], pelvis: -90, spine: -88, chest: -86, head: -90, bar: [0.15, 0.215], gw: 0.28, pron: 175, curl: 1, pole: [1, -1.05, -0.55] },
    ],
  },
  'dumbbell-bench': {
    dur: 2.8, anchor: 'contact', contact: [flatPads.back], gripSpace: 'chest', gripAxis: [1, 0, 0], cam: { el: 20 },
    props: [{ type: 'dumbbells', size: 0.95 }, { type: 'bench', ...FLAT }],
    keys: [
      { hip: [0.56, 0.1], ft: [0.27, A, 0.6], toe: 12, kneeP: [0.3, 0.7, 0.7], pelvis: -90, spine: -88, chest: -86, head: -90, grip: [0.13, 0.22, 0.56], pron: 175, curl: 1, pole: [1, -1.05, -0.55] },
      { hip: [0.56, 0.1], ft: [0.27, A, 0.6], toe: 12, kneeP: [0.3, 0.7, 0.7], pelvis: -90, spine: -88, chest: -86, head: -90, grip: [0.28, 0.13, 0.21], pron: 175, curl: 1, pole: [1, -1.05, -0.55] },
    ],
  },
  // Incline bench 35°: บาร์แตะอกบน (ใต้ไหปลาร้า) ดันขึ้นแนวดิ่งเหนือไหล่
  'incline-bench': {
    dur: 2.8, anchor: 'contact', contact: [inclinePads.seat, inclinePads.back], barSpace: 'chest', cam: { el: 16 },
    props: [{ type: 'barbell' }, { type: 'bench', ...INCLINE, uprights: 'auto' }],
    keys: [
      { hip: [0.56, 0.05], ft: [0.25, A, 0.4], toe: 12, kneeP: [0.3, 0.6, 0.8], pelvis: -50, spine: -54, chest: -55, head: -48, bar: [0.565, 0.5], gw: 0.27, pron: 175, curl: 1, pole: [1, -0.8, -0.65] },
      { hip: [0.56, 0.05], ft: [0.25, A, 0.4], toe: 12, kneeP: [0.3, 0.6, 0.8], pelvis: -50, spine: -54, chest: -55, head: -48, bar: [0.215, 0.2], gw: 0.27, pron: 175, curl: 1, pole: [1, -0.8, -0.65] },
    ],
  },
  // Cable fly: ยืนก้าวเท้าสลับ เอนตัวเล็กน้อย ศอกงอคงที่ กางแขนกว้างแล้วโอบมาประกบหน้าอก
  'cable-fly': {
    dur: 2.8, gripAxis: [0, 1, 0],
    props: [
      { type: 'tower', x: 1.12, z: -0.1, h: 2.15, face: -90 },
      { type: 'tower', x: -1.12, z: -0.1, h: 2.15, face: 90 },
      { type: 'pulley', at: [0.98, 1.95, -0.1], axis: 'z' },
      { type: 'pulley', at: [-0.98, 1.95, -0.1], axis: 'z' },
      { type: 'cable', from: [0.98, 1.95, -0.1], to: 'gripL' },
      { type: 'cable', from: [-0.98, 1.95, -0.1], to: 'gripR' },
      { type: 'dHandles' },
    ],
    keys: [
      { hip: [0.86, -0.02], ft: [[0.12, A, 0.2], [0.13, A, -0.22]], toe: 6, pelvis: 10, spine: 13, chest: 15, head: 6, grip: [0.66, 1.28, 0.2], pron: 90, palmHint: [-0.3, 0, 1], curl: 1, pole: [0.5, 0.25, -1] },
      { hip: [0.86, -0.02], ft: [[0.12, A, 0.2], [0.13, A, -0.22]], toe: 6, pelvis: 10, spine: 13, chest: 15, head: 6, grip: [0.05, 1.08, 0.56], pron: 90, palmHint: [-1, 0, 0.3], curl: 1, pole: [0.8, 0.1, -1] },
    ],
  },
  // Overhead press: เริ่มจากบาร์พักหน้าไหล่ ศอกอยู่หน้าบาร์เล็กน้อย ; ศีรษะหลบไปหลังให้บาร์ผ่านใบหน้า แล้วดันศีรษะผ่านไปใต้บาร์ ; บาร์เป็นแนวดิ่งเหนือกลางเท้า
  'overhead-press': {
    dur: 3.0, props: ['barbell'], barSpace: 'chest', times: [0.8, 0.8, 0.8, 0.8],
    keys: [
      { ...STAND, toe: 6, ft: [0.13, A, 0], pelvis: 0, spine: -1, chest: -2, head: 0, bar: [0.235, 0.25], gw: 0.235, pron: 175, wrist: 55, palmHint: [0, 0.6, 1], curl: 0.85, pole: [0.3, -1, 0.75] },
      { ...STAND, toe: 6, ft: [0.13, A, 0], pelvis: -1, spine: -2, chest: -4, head: -14, bar: [0.52, 0.19], gw: 0.235, pron: 175, wrist: 25, palmHint: [0, 0.6, 1], curl: 1, pole: [0.7, -1, 0.4] },
      { ...STAND, toe: 6, ft: [0.13, A, 0], pelvis: 0, spine: -1, chest: -2, head: 2, bar: [0.8, 0.075], gw: 0.235, pron: 175, palmHint: [0, 0.2, 1], curl: 1, pole: [1, 0, 0] },
      { ...STAND, toe: 6, ft: [0.13, A, 0], pelvis: -1, spine: -2, chest: -4, head: -14, bar: [0.52, 0.19], gw: 0.235, pron: 175, wrist: 25, palmHint: [0, 0.6, 1], curl: 1, pole: [0.7, -1, 0.4] },
    ],
  },
  // Lateral raise: ยกถึงระดับไหล่ในระนาบสะบัก (เฉียงหน้า ~15°) ศอกงอเล็กน้อย ข้อมือ-ศอกระดับเดียวกัน
  'lateral-raise': {
    dur: 2.6, props: [{ type: 'dumbbells', size: 0.7 }],
    keys: [
      { ...STAND, pelvis: 3, spine: 4, chest: 5, uarmA: 10, uarmT: -12, elbowR: -14, pron: 85, curl: 1 },
      { ...STAND, pelvis: 3, spine: 4, chest: 5, uarmA: 82, uarmT: -15, elbowR: -16, pron: 85, curl: 1 },
    ],
  },
  // Dumbbell curl: ต้นแขนแนบลำตัว (ศอกไม่แกว่ง) ข้อมือตรง หงายมือ
  'bicep-curl': {
    dur: 2.4, props: [{ type: 'dumbbells', size: 0.8 }],
    keys: [
      { ...STAND, uarm: 3, uarmA: 7, elbowR: -6, pron: 8, curl: 1 },
      { ...STAND, uarm: -10, uarmA: 7, elbowR: -138, pron: 8, curl: 1 },
    ],
  },
  // Triceps pushdown: เอนตัวเล็กน้อย ศอกแนบข้างลำตัวคงที่ เหยียดศอกสุด
  'tricep-pushdown': {
    dur: 2.4, cam: { el: 10 },
    props: [
      { type: 'handle', width: 0.5 },
      { type: 'tower', x: 0, z: 0.62, h: 2.2, face: 180 },
      { type: 'pulley', at: [0, 2.05, 0.46], axis: 'x' },
      { type: 'cable', from: [0, 2.05, 0.46], to: 'handsMid' },
    ],
    keys: [
      { hip: [0.868, -0.05], ft: [0.13, A, 0], toe: 5, pelvis: 9, spine: 12, chest: 14, head: 6, uarm: 4, uarmA: 7, elbowR: -100, pron: 178, curl: 1 },
      { hip: [0.868, -0.05], ft: [0.13, A, 0], toe: 5, pelvis: 9, spine: 12, chest: 14, head: 6, uarm: 6, uarmA: 7, elbowR: -10, pron: 178, curl: 1 },
    ],
  },
  // Dips: จับบาร์คู่ (มือตั้ง) ลำตัวเอนหน้าเล็กน้อย ลงจนศอก ~90° ศอกชี้ไปหลัง
  dips: {
    dur: 2.6, gripAxis: [0, 0, 1], props: [{ type: 'dipbars', w: 0.25, y: 1.18 }],
    keys: [
      { hip: [1.2, -0.04], pelvis: 6, spine: 8, chest: 10, head: 4, grip: [0.25, 1.195, 0.0], pron: 90, curl: 1, pole: [0.25, -0.2, -1], thigh: -14, shin: 70, foot: 40 },
      { hip: [0.97, -0.12], pelvis: 20, spine: 24, chest: 27, head: 14, grip: [0.25, 1.195, 0.0], pron: 90, curl: 1, pole: [0.25, -0.2, -1], thigh: -10, shin: 76, foot: 40 },
    ],
  },
  // Push-up: ลำตัวตรงเป็นแนวเดียวศีรษะ-ส้นเท้า ปลายเท้ายึดพื้น ฝ่ามือราบใต้ไหล่ ศอกกาง ~45°
  'push-up': {
    dur: 2.4, anchor: 'pivot', pivotZ: 0, cam: { el: 16 },
    keys: [
      { pelvis: 70.5, spine: 70.5, chest: 70.5, head: 62, thigh: 70.5, shin: 70.5, foot: 0, grip: [0.24, 0.016, 1.29], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.7, -1, -0.45] },
      { pelvis: 81, spine: 81, chest: 81, head: 72, thigh: 81, shin: 81, foot: 14, grip: [0.24, 0.016, 1.29], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.7, -1, -0.45] },
    ],
  },
  // Handstand push-up: ฝ่ามือราบ กว้างกว่าไหล่เล็กน้อย ลำตัวตั้งตรง ลงจนศีรษะเกือบแตะพื้น ศอกชี้เฉียงหน้า-ข้าง
  'handstand-push-up': {
    dur: 2.8, cam: { el: 8 },
    keys: [
      { hip: [1.02, -0.03], pelvis: 180, spine: 180, chest: 180, head: 178, thigh: 180, shin: 180, foot: 210, grip: [0.24, 0.016, 0.02], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.7, 0.2, 0.7] },
      { hip: [0.86, -0.08], pelvis: 186, spine: 186, chest: 186, head: 186, thigh: 182, shin: 182, foot: 212, grip: [0.24, 0.016, 0.02], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.7, 0.2, 0.7] },
    ],
  },

  // ================= หลัง / ดึง =================
  // Barbell row: พับสะโพก ~52° หลังตรง เข่างอเล็กน้อย ดึงบาร์เข้าท้องส่วนบน ศอกไปหลัง (กางไม่เกิน 45°)
  'barbell-row': {
    dur: 2.6, props: ['barbell'], barSpace: 'chest',
    keys: [
      { hip: [0.79, -0.22], ft: [0.14, A, 0], toe: 6, pelvis: 55, spine: 52, chest: 47, head: 32, bar: [-0.12, 0.47], gw: 0.26, pron: 175, curl: 1, pole: [0.45, -0.7, -1] },
      { hip: [0.79, -0.22], ft: [0.14, A, 0], toe: 6, pelvis: 55, spine: 52, chest: 47, head: 32, bar: [0.02, 0.205], gw: 0.26, pron: 175, curl: 1, pole: [0.45, -0.7, -1] },
    ],
  },
  // Lat pulldown: นั่งต้นขาล็อกใต้เบาะ เอนหลังเล็กน้อย จับกว้างคว่ำมือ ดึงบาร์ลงอกบน ศอกลงข้างลำตัว
  'lat-pulldown': {
    dur: 2.8, anchor: 'contact', contact: [{ set: 'seat', n: [0, 1, 0], d: 0.5 }], barSpace: 'chest',
    props: [
      { type: 'handle', width: 1.2, bend: 18 },
      { type: 'box', size: [0.42, 0.08, 0.42], pos: [0, 0.46, 0.02], mat: 'pad' },
      { type: 'tube', w: 0.07, from: [0, 0.0, 0.02], to: [0, 0.42, 0.02] },
      { type: 'box', size: [0.55, 0.05, 0.5], pos: [0, 0.025, 0.02], mat: 'frame' },
      { type: 'roller', follow: 'hipL', local: [0.02, -0.16, 0.12], len: 0.5, fixed: true },
      { type: 'tower', x: 0, z: -0.52, h: 2.45, face: 0 },
      { type: 'tube', w: 0.07, from: [0, 2.45, -0.52], to: [0, 2.45, 0.08] },
      { type: 'pulley', at: [0, 2.4, 0.06], axis: 'x' },
      { type: 'cable', from: [0, 2.4, 0.06], to: 'handsMid' },
    ],
    keys: [
      { hip: [0.6, 0.0], ft: [0.16, A, 0.47], toe: 8, kneeP: [0.1, 0.4, 1], pelvis: -8, spine: -10, chest: -12, head: -14, bar: [0.78, 0.07], gw: 0.38, pron: 175, curl: 1, pole: [1, 0.2, 0.2] },
      { hip: [0.6, 0.0], ft: [0.16, A, 0.47], toe: 8, kneeP: [0.1, 0.4, 1], pelvis: -14, spine: -17, chest: -20, head: -8, bar: [0.255, 0.215], gw: 0.38, pron: 175, curl: 1, pole: [1, -0.5, -0.25] },
    ],
  },
  // Pull-up: จับกว้างคว่ำมือ ห้อยแขนเหยียด -> คางพ้นบาร์ ; ไม่เหวี่ยงตัว
  'pull-up': {
    dur: 2.8, gripAxis: [1, 0, 0], props: [{ type: 'pullbar', y: 2.2 }],
    keys: [
      { hip: [1.125, -0.03], pelvis: -2, spine: -2, chest: -3, head: -2, thigh: -12, shin: 40, foot: 30, thighA: 3, grip: [0.36, 2.2, 0], pron: 175, curl: 1, pole: [1, -0.3, 0] },
      { hip: [1.58, -0.17], pelvis: -10, spine: -12, chest: -16, head: -6, thigh: -18, shin: 46, foot: 30, thighA: 3, grip: [0.36, 2.2, 0], pron: 175, curl: 1, pole: [1, -0.8, -0.2] },
    ],
  },
  'chin-up': {
    dur: 2.8, gripAxis: [1, 0, 0], props: [{ type: 'pullbar', y: 2.2 }],
    keys: [
      { hip: [1.12, -0.03], pelvis: -2, spine: -2, chest: -3, head: -2, thigh: -12, shin: 40, foot: 30, thighA: 3, grip: [0.17, 2.2, 0], pron: 5, curl: 1, pole: [0.2, -0.4, 1] },
      { hip: [1.6, -0.15], pelvis: -8, spine: -10, chest: -13, head: -6, thigh: -18, shin: 46, foot: 30, thighA: 3, grip: [0.17, 2.2, 0], pron: 5, curl: 1, pole: [0.25, -1, 0.4] },
    ],
  },
  'muscle-up': {
    dur: 3.6, gripAxis: [1, 0, 0], props: [{ type: 'pullbar', y: 2.2 }], times: [1, 0.8, 0.9, 1],
    keys: [
      { hip: [1.12, -0.02], pelvis: -4, spine: -4, chest: -4, thigh: -16, shin: 20, foot: 20, grip: [0.27, 2.2, 0], pron: 178, curl: 1, pole: [1, -0.3, 0] },
      { hip: [1.6, -0.2], pelvis: -16, spine: -18, chest: -22, head: -8, thigh: -26, shin: 20, foot: 25, grip: [0.27, 2.2, 0], pron: 178, curl: 1, pole: [0.8, -0.8, -0.4] },
      { hip: [1.93, -0.21], pelvis: 30, spine: 36, chest: 40, head: 30, thigh: -34, shin: 15, foot: 20, grip: [0.27, 2.2, 0], pron: 178, wrist: 60, curl: 0.9, pole: [0.25, 0, -1] },
      { hip: [2.15, -0.12], pelvis: 10, spine: 12, chest: 14, head: 6, thigh: -6, shin: 8, foot: 30, grip: [0.27, 2.2, 0], pron: 178, wrist: 70, curl: 0.8, pole: [0.25, 0, -1] },
    ],
  },
  // Inverted row: ลำตัวตรงแข็ง ส้นเท้ายันพื้น ดึงอกเข้าหาบาร์
  'inverted-row': {
    dur: 2.6, anchor: 'pivot', pivotZ: 0, gripAxis: [1, 0, 0], cam: { el: 14 },
    props: [{ type: 'pullbar', y: 1.0, z: -1.08, w: 0.6 }],
    keys: [
      { pelvis: -63, spine: -63, chest: -63, head: -60, thigh: -63, shin: -63, foot: -150, grip: [0.3, 1.0, -1.08], pron: 175, curl: 1, pole: [0.6, -0.4, -1] },
      { pelvis: -50, spine: -50, chest: -50, head: -48, thigh: -50, shin: -50, foot: -138, grip: [0.3, 1.0, -1.08], pron: 175, curl: 1, pole: [0.6, -0.6, -1] },
    ],
  },
  'hanging-leg-raise': {
    dur: 2.8, gripAxis: [1, 0, 0], props: [{ type: 'pullbar', y: 2.2 }],
    keys: [
      { hip: [1.115, -0.03], pelvis: -2, spine: -2, chest: -3, thigh: -2, shin: 4, foot: 20, grip: [0.3, 2.2, 0], pron: 175, curl: 1, pole: [1, -0.3, 0] },
      { hip: [1.14, -0.06], pelvis: -20, spine: -10, chest: -6, head: 0, thigh: -108, shin: -104, foot: -70, grip: [0.3, 2.2, 0], pron: 175, curl: 1, pole: [1, -0.3, 0] },
    ],
  },

  // ================= แกนกลาง =================
  // Forearm plank: ศอกใต้ไหล่ ลำตัวตรงแนวเดียว ปลายเท้ายึดพื้น
  plank: {
    dur: 3, anchor: 'pivot', pivotZ: 0, pulse: 'cyclic', armsGround: true, cam: { el: 16 },
    fn: (p) => {
      const b = 0.8 * sin(TAU * p)
      return { pelvis: 77.5 + b, spine: 77.5, chest: 77.5 - b * 0.4, head: 66, thigh: 77.5 + b, shin: 77.5 + b, foot: -2, uarm: 0, farm: -88, uarmA: 6, uarmT: -6, pron: 70, curl: 0.8 }
    },
  },
  // Crunch: นอนหงาย เท้าราบ เข่างอ แขนไขว้อก ม้วนลำตัวส่วนบนจนสะบักพ้นพื้น (เอวยังแนบพื้น)
  crunch: {
    dur: 2.4, anchor: 'contact', contact: [{ set: 'torso', n: [0, 1, 0], d: 0 }], gripSpace: 'chest', axisSpace: 'chest', cam: { el: 18 },
    keys: [
      { hip: [0.1, 0.0], ft: [0.13, A, 0.5], toe: 4, kneeP: [0.15, 1, 0.3], pelvis: -90, spine: -90, chest: -89, head: -84, grip: [[-0.13, 0.215, 0.13], [-0.13, 0.17, 0.16]], palm: [0, 0, -1], gripAxis: [0, 1, 0], pron: 120, curl: 0.15, pole: [0.6, -0.5, 0.6] },
      { hip: [0.1, 0.0], ft: [0.13, A, 0.5], toe: 4, kneeP: [0.15, 1, 0.3], pelvis: -92, spine: -76, chest: -52, head: -40, grip: [[-0.13, 0.215, 0.13], [-0.13, 0.17, 0.16]], palm: [0, 0, -1], gripAxis: [0, 1, 0], pron: 120, curl: 0.15, pole: [0.6, -0.5, 0.6] },
    ],
  },
  'mountain-climber': {
    dur: 1.4, pulse: 'cyclic', cam: { el: 16 },
    fn: (p) => {
      const c = cos(TAU * p)
      const leg = (k) => {
        // k = 1 ขาดึงเข่ามาหน้าสุด (ลอยพ้นพื้น) ; k = 0 ขาเหยียดหลัง ปลายเท้าแตะพื้น
        return [0.13, 0.1 + 0.12 * k, -0.74 + 0.68 * k]
      }
      const kL = 0.5 + 0.5 * c
      const kR = 0.5 - 0.5 * c
      return {
        hip: [0.365, 0], pelvis: 72, spine: 72, chest: 71, head: 60,
        ft: [leg(kL), leg(kR)], footPitch: [60 - 30 * kL, 60 - 30 * kR], kneeP: [[0, -0.6, 1], [0, -0.6, 1]], toe: 0,
        grip: [0.22, 0.016, 0.47], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.4, -1, -0.4],
      }
    },
  },
  // Burpee: ยืน -> ย่อวางมือ -> กระโดดเท้าไปหลังเป็นแพลงก์ -> กลับย่อ -> กระโดดชูแขน ; มืออยู่ในพิกัดโลกทุกจังหวะ
  burpee: {
    dur: 3.8, times: [0.8, 0.7, 0.9, 0.7, 0.9], gripAxis: [0, -1, 0],
    keys: [
      { ...STAND, ft: [0.14, A, 0], toe: 6, pelvis: 2, spine: 2, chest: 2, grip: [0.26, 0.86, 0.02], palm: [-1, 0, 0], pron: 85, curl: 0.3, pole: [0.2, 0, -1] },
      { hip: [0.32, -0.1], ft: [0.14, A, 0], toe: 6, pelvis: 55, spine: 66, chest: 74, head: 52, grip: [0.22, 0.016, 0.3], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.4, -1, -0.4] },
      { hip: [0.365, -0.17], ft: [0.13, 0.13, -0.88], footPitch: 55, toe: 0, pelvis: 72, spine: 72, chest: 72, head: 60, grip: [0.22, 0.016, 0.3], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.4, -1, -0.4] },
      { hip: [0.32, -0.1], ft: [0.14, A, 0], toe: 6, pelvis: 55, spine: 66, chest: 74, head: 52, grip: [0.22, 0.016, 0.3], palm: [0, -1, 0], gripAxis: [0, 0, 1], pron: 175, curl: 0, pole: [0.4, -1, -0.4] },
      { hip: [1.2, 0], ft: [0.14, A + 0.3, -0.02], footPitch: 40, toe: 6, pelvis: -2, spine: -3, chest: -4, head: -4, grip: [0.24, 2.24, 0.04], palm: [-0.3, 0, 1], gripAxis: [0, 1, 0], pron: 30, curl: 0.2, pole: [1, 0, 0] },
    ],
  },

  // ================= พลังระเบิด / ฟังก์ชัน =================
  'clean-jerk': {
    dur: 4.4, props: ['barbell'], times: [1, 0.8, 0.9, 1.1, 0.9],
    keys: [
      { hip: [0.51, -0.31], ft: [0.13, A, 0], toe: 6, pelvis: 55, spine: 51, chest: 46, head: 30, bar: [0.226, 0.05], gw: 0.25, pron: 175, curl: 1, pole: [0.25, 0, -1] },
      { hip: [0.86, -0.06], ft: [0.13, A + 0.04, -0.01], footPitch: 20, toe: 6, pelvis: -3, spine: -4, chest: -6, head: 0, bar: [0.92, 0.1], gw: 0.25, pron: 175, curl: 1, pole: [0.6, 1, -0.3] },
      { hip: [0.66, -0.12], ft: [0.16, A, 0], toe: 10, pelvis: 12, spine: 10, chest: 8, head: 2, bar: [1.19, 0.24], gw: 0.25, pron: 175, wrist: 80, palmHint: [0, 1, 0.3], curl: 0.6, pole: [0.25, 0.4, 1] },
      { hip: [0.872, -0.02], ft: [0.14, A, 0], toe: 6, pelvis: 0, spine: -1, chest: -2, head: 0, bar: [1.36, 0.22], gw: 0.25, pron: 175, wrist: 80, palmHint: [0, 1, 0.3], curl: 0.6, pole: [0.25, 0.4, 1] },
      { hip: [0.73, -0.04], ft: [[0.13, A, 0.36], [0.13, 0.12, -0.5]], footPitch: [0, 48], kneeP: [[0.1, 0, 1], [0, -0.5, 1]], toe: [4, 0], pelvis: 0, spine: -1, chest: -2, head: 4, bar: [1.86, -0.03], gw: 0.25, pron: 175, palmHint: [0, 0.3, 1], curl: 1, pole: [1, 0, 0] },
    ],
  },
  // Kettlebell swing: พับสะโพก (ไม่ใช่สควอท) หลังตรง แขนเหยียด ; สะโพกดันส่งลูกตุ้มขึ้นระดับอก
  'kettlebell-swing': {
    dur: 2.2, props: ['kettlebell'], times: [0.9, 1, 1, 0.9],
    keys: [
      { hip: [0.78, -0.2], ft: [0.18, A, 0], toe: 12, pelvis: 58, spine: 57, chest: 55, head: 38, bar: [0.6, -0.08], gw: 0.035, pron: 175, palmHint: [0, 0, -1], curl: 1, pole: [0.2, 0, -1] },
      { hip: [0.84, -0.09], ft: [0.18, A, 0], toe: 12, pelvis: 26, spine: 26, chest: 25, head: 14, bar: [0.86, 0.44], gw: 0.035, pron: 175, palmHint: [0, -0.5, -1], curl: 1, pole: [0.2, -0.3, -1] },
      { hip: [0.872, 0.0], ft: [0.18, A, 0], toe: 12, pelvis: -1, spine: -2, chest: -3, head: 0, bar: [1.3, 0.58], gw: 0.035, pron: 175, palmHint: [0, -1, -0.3], curl: 1, pole: [0.2, -1, 0] },
      { hip: [0.84, -0.09], ft: [0.18, A, 0], toe: 12, pelvis: 26, spine: 26, chest: 25, head: 14, bar: [0.86, 0.44], gw: 0.035, pron: 175, palmHint: [0, -0.5, -1], curl: 1, pole: [0.2, -0.3, -1] },
    ],
  },
  'jumping-jack': {
    dur: 1.6, anchor: 'ground',
    fn: (p) => {
      const k = 0.5 - 0.5 * cos(TAU * p)
      return { uarmA: 12 + 150 * k, elbowR: -10, thighA: 3 + 16 * k, lift: 0.07 * abs(sin(TAU * p)), foot: 18 * abs(sin(TAU * p)), pron: 85 + 60 * k, curl: 0.3 }
    },
  },
  'jump-rope': {
    dur: 1.2, anchor: 'ground', props: ['rope'], pulse: 'cyclic',
    fn: (p) => {
      const j = abs(sin(TAU * 2 * p))
      return { lift: 0.07 * j, foot: 28 * j, thigh: -6, shin: 8 - 4 * j, uarm: 10, farm: -50, uarmA: 22, pron: 110, curl: 1 }
    },
  },

  // ================= คาร์ดิโอ =================
  run: { dur: 0.9, anchor: 'ground', pulse: 'cyclic', cam: { el: 10 }, fn: (p) => gait(p, {}) },
  'treadmill-run': { dur: 0.9, anchor: 'ground', floor: 0.132, pulse: 'cyclic', cam: { el: 12 }, props: ['treadmill'], fn: (p) => gait(p, {}) },
  walk: {
    dur: 1.3, anchor: 'ground', pulse: 'cyclic', cam: { el: 10 },
    fn: (p) => ({ ...gait(p, { stride: 22, knee: 32, kneeBase: 4, arm: 20, elbow: 18, lean: 3, bounce: 0.015 }), curl: 0.35, pron: 85 }),
  },
  hike: {
    dur: 1.4, anchor: 'ground', pulse: 'cyclic', cam: { el: 10 }, props: ['backpack'],
    fn: (p) => ({ ...gait(p, { stride: 26, knee: 42, kneeBase: 8, arm: 22, elbow: 30, lean: 12, bounce: 0.02 }), curl: 0.45, pron: 85 }),
  },
  cycling: {
    dur: 1.1, anchor: 'fixed', pulse: 'cyclic', props: ['bike'], gripAxis: [1, 0, 0],
    fn: (p) => ({ hip: [1.0, -0.06], pelvis: 34, spine: 44, chest: 50, head: 24, grip: [0.21, 1.0, 0.68], pron: 175, curl: 1, pole: [0.5, -0.6, -0.6], ...pedal(p, { cy: 0.3, cz: 0.2, r: 0.17 }) }),
  },
  'stationary-bike': {
    dur: 1.1, anchor: 'fixed', pulse: 'cyclic', props: ['spinBike'], gripAxis: [1, 0, 0],
    fn: (p) => ({ hip: [1.0, -0.06], pelvis: 24, spine: 30, chest: 34, head: 14, grip: [0.21, 1.06, 0.6], pron: 175, curl: 1, pole: [0.5, -0.6, -0.6], ...pedal(p, { cy: 0.34, cz: 0.22, r: 0.17 }) }),
  },
  elliptical: {
    dur: 1.4, pulse: 'cyclic', props: ['elliptical'], gripAxis: [0, 1, 0],
    fn: (p) => {
      const ph = TAU * p
      const ft = (o) => [0.12, 0.36 + 0.06 * sin(ph + o), 0.06 + 0.22 * cos(ph + o)]
      return {
        hip: [1.13 + 0.015 * sin(2 * ph), -0.02], pelvis: 3, spine: 5, chest: 7, toe: 2,
        ft: [ft(0), ft(PI)], footPitch: [6 * sin(ph), 6 * sin(ph + PI)],
        grip: [[0.25, 1.25, 0.32 - 0.1 * cos(ph)], [0.25, 1.25, 0.32 + 0.1 * cos(ph)]], pron: 90, curl: 1, pole: [0.3, -1, -0.3],
      }
    },
  },
  'stair-climber': {
    dur: 1.4, pulse: 'cyclic', props: ['steps'], gripAxis: [0, 0.4, 1],
    fn: (p) => {
      const ph = TAU * p
      const up = (o) => 0.5 + 0.5 * sin(ph + o)
      return {
        hip: [1.17 + 0.04 * sin(2 * ph), -0.04], pelvis: 10, spine: 13, chest: 15, head: 6, toe: 2,
        ft: [[0.11, 0.33 + 0.2 * up(0), 0.08 + 0.12 * up(0)], [0.11, 0.33 + 0.2 * up(PI), 0.08 + 0.12 * up(PI)]],
        grip: [0.3, 1.3, 0.25], pron: 90, palmHint: [-0.5, -1, 0], curl: 1, pole: [0.4, -1, -0.4],
      }
    },
  },
  // Rowing machine: catch (หน้าแข้งตั้ง ลำตัวเอนหน้า) -> ขาดัน -> เอนหลัง -> ดึงด้ามเข้าใต้อก
  rowing: {
    dur: 2.6, anchor: 'contact', contact: [{ set: 'seat', n: [0, 1, 0], d: 0.3 }], gripAxis: [1, 0, 0], props: ['rower'], seatTop: 0.3, times: [1, 1.3],
    keys: [
      { hip: [0.38, 0.32], ft: [0.11, 0.39, 0.8], footPitch: -48, toe: 0, kneeP: [0.15, 1, 0.1], pelvis: 22, spine: 28, chest: 30, head: 16, grip: [0.13, 0.62, 0.98], pron: 175, curl: 1, pole: [0.4, -0.3, -1] },
      { hip: [0.38, -0.08], ft: [0.11, 0.39, 0.8], footPitch: -48, toe: 0, kneeP: [0.15, 1, 0.1], pelvis: -18, spine: -20, chest: -22, head: -8, grip: [0.13, 0.69, 0.22], pron: 175, curl: 1, pole: [0.4, -0.3, -1] },
    ],
  },
  swim: {
    dur: 1.8, anchor: 'fixed', pulse: 'cyclic', props: ['water'], cam: { el: 22 },
    fn: (p) => {
      const ph = TAU * p
      const kick = (o) => 92 + 12 * sin(4 * ph + o)
      const arm = (o) => -90 + 360 * ((p + o) % 1)
      const aL = arm(0)
      const aR = arm(0.5)
      return {
        y: 0.56 - 0.884, pelvis: 90, spine: 90, chest: 90, head: 82, pelvisYaw: 28 * sin(ph),
        thigh: [kick(0), kick(PI)], shin: [kick(0) + 12, kick(PI) + 12], foot: [kick(0) + 70, kick(PI) + 70],
        uarm: [aL, aR], farm: [aL - 18, aR - 18], uarmA: 10, pron: 150, curl: 0.15,
      }
    },
  },

  // ================= กีฬา =================
  boxing: {
    dur: 2.2, props: ['gloves'], gripSpace: 'chest',
    keys: [
      { hip: [0.82, 0], ft: [[0.13, A, 0.18], [0.15, A, -0.22]], toe: [10, 25], pelvisYaw: 16, chestTwist: 6, pelvis: 4, spine: 6, chest: 8, head: 6, grip: [[0.1, 0.42, 0.24], [0.1, 0.4, 0.2]], pron: 120, curl: 1.15, pole: [0.5, -1, 0] },
      { hip: [0.82, 0], ft: [[0.13, A, 0.18], [0.15, A, -0.22]], toe: [10, 25], pelvisYaw: 10, chestTwist: 18, pelvis: 4, spine: 6, chest: 8, head: 6, grip: [[0.02, 0.38, 0.58], [0.1, 0.4, 0.2]], pron: 170, curl: 1.15, pole: [0.5, -1, 0] },
      { hip: [0.82, 0], ft: [[0.13, A, 0.18], [0.15, A, -0.22]], toe: [10, 25], pelvisYaw: 16, chestTwist: 6, pelvis: 4, spine: 6, chest: 8, head: 6, grip: [[0.1, 0.42, 0.24], [0.1, 0.4, 0.2]], pron: 120, curl: 1.15, pole: [0.5, -1, 0] },
      { hip: [0.82, 0.02], ft: [[0.13, A, 0.18], [0.15, A + 0.03, -0.22]], footPitch: [0, 20], toe: [10, 25], pelvisYaw: 30, chestTwist: -22, pelvis: 6, spine: 8, chest: 10, head: 6, grip: [[0.1, 0.42, 0.24], [-0.02, 0.38, 0.58]], pron: 170, curl: 1.15, pole: [0.5, -1, 0] },
    ],
  },
  badminton: {
    dur: 2.4, anchor: 'ground', props: ['racket'], times: [1, 0.6, 1],
    keys: [
      { thigh: [-10, 14], shin: [6, 20], chest: -8, chestTwist: 22, uarm: [-150, -110], uarmA: [12, 70], elbowR: [-10, -120], uarmRoll: [0, 70], pron: [85, 60], curl: [0.3, 1] },
      { lift: 0.12, chest: 6, chestTwist: -10, foot: 30, uarm: [-40, -175], uarmA: [20, 15], elbowR: [-30, -10], pron: [85, 110], curl: [0.3, 1] },
      { thigh: [-20, 10], shin: [10, 20], pelvis: 12, chest: 20, chestTwist: -30, uarm: [-20, -40], uarmA: [15, 10], elbowR: [-40, -20], pron: [85, 150], curl: [0.3, 1] },
    ],
  },
  football: {
    dur: 2.4, anchor: 'footL', props: [{ type: 'ball', kind: 'football', pos: [-0.1, 0.11, 0.36] }], times: [1, 0.7, 1],
    keys: [
      { uarmA: [20, 20], thigh: [-6, 6], shin: [4, 10], pron: 85, curl: 0.4 },
      { uarmA: [55, 35], uarm: [-20, 20], thigh: [-10, 38], shin: [6, 112], foot: [0, 40], chestTwist: 14, pron: 85, curl: 0.4 },
      { uarmA: [50, 30], uarm: [20, -30], thigh: [-6, -78], shin: [6, -64], foot: [0, 25], pelvis: -10, chest: -6, chestTwist: -16, pron: 85, curl: 0.4 },
    ],
  },
  basketball: {
    dur: 2.4, anchor: 'ground', gripSpace: 'chest', axisSpace: 'chest', gripAxis: [0, 1, 0.2], times: [1, 0.8, 0.9],
    props: [{ type: 'ball', kind: 'basketball', follow: 'handsMid', offset: [0, 0.02, 0] }],
    keys: [
      { pelvis: 16, spine: 18, chest: 18, thigh: -48, shin: 26, grip: [0.125, 0.12, 0.34], palm: [-1, 0, 0.15], pron: 90, curl: 0.25, pole: [0.8, -1, 0] },
      { chest: -4, grip: [0.125, 0.5, 0.3], palm: [-1, 0, 0.15], pron: 90, curl: 0.25, pole: [0.8, -1, 0] },
      { lift: 0.24, foot: 50, chest: -6, grip: [0.125, 0.76, 0.22], palm: [-1, 0, 0.15], pron: 90, curl: 0.25, pole: [0.8, -0.3, 0.3] },
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
        uarmA: [40 + 70 * (0.5 + 0.5 * sin(ph)), 40 + 70 * (0.5 - 0.5 * sin(ph))], elbowR: [-40 - 40 * b, -40 - 40 * (1 - b)], pron: 100, curl: 0.3,
      }
    },
  },
  // Yoga (Sun salutation ช่วงแรก): ยืนพนมมือ -> ชูแขนเอนหลังเล็กน้อย -> ก้มพับตัวมือแตะพื้น -> ครึ่งทาง หลังตรง
  'yoga-flow': {
    dur: 5.2, times: [1, 1, 1.4, 1],
    keys: [
      { ...STAND, ft: [0.09, A, 0], pelvis: 0, spine: 0, chest: 0, uarm: -30, uarmA: 12, uarmT: -40, elbowR: -110, pron: 90, curl: 0, spread: 0 },
      { ...STAND, ft: [0.09, A, 0], hip: [0.872, 0.02], pelvis: -4, spine: -8, chest: -12, head: -18, uarm: -176, uarmA: 8, elbowR: -4, pron: 90, curl: 0 },
      { hip: [0.86, -0.17], ft: [0.09, A, 0], toe: 4, pelvis: 80, spine: 92, chest: 104, head: 118, uarm: 4, uarmA: 6, elbowR: -2, pron: 175, curl: 0 },
      { hip: [0.86, -0.12], ft: [0.09, A, 0], toe: 4, pelvis: 42, spine: 46, chest: 50, head: 32, uarm: 0, uarmA: 6, elbowR: -2, pron: 175, curl: 0 },
    ],
  },
}
MOTIONS['hip-thrust'].contact = [{ set: 'torso', edge: MOTIONS['hip-thrust'].edge }]

// ค่าที่มีด้านซ้าย/ขวา (ตัวเลข) และเวกเตอร์
export const SIDED = ['uarm', 'farm', 'thigh', 'shin', 'foot', 'uarmA', 'thighA', 'uarmT', 'thighT', 'uarmRoll', 'elbowR', 'pron', 'curl', 'spread', 'toe', 'footPitch', 'footRoll', 'wrist']
const VEC = ['grip', 'pole', 'ft', 'kneeP', 'palm', 'palmHint']
const pick = (v, s) => (Array.isArray(v) && v.length === 2 && typeof v[0] !== 'object' ? v[s] : v)
const pickV = (v, s) => (Array.isArray(v) && v.length === 2 && (Array.isArray(v[0]) || v[0] === null || Array.isArray(v[1])) ? v[s] : v)

// เติมค่าเริ่มต้นให้ครบทุก channel (ทำก่อน interpolate เพื่อให้ทุก keyframe มีคีย์เดียวกัน)
export function resolvePose(p) {
  const o = {}
  o.pelvis = p.pelvis ?? 0
  o.spine = p.spine ?? o.pelvis
  o.chest = p.chest ?? o.spine
  o.head = p.head ?? o.chest
  for (const k of ['chestTwist', 'chestSide', 'pelvisYaw', 'pelvisRoll', 'spineTwist', 'headTurn', 'x', 'y', 'z', 'lift']) o[k] = p[k] ?? 0
  o.hip = p.hip ?? null
  o.bar = p.bar ?? null
  o.gw = p.gw ?? 0.25
  o.gripSpace = p.gripSpace ?? null
  o.gripAxis = p.gripAxis ?? null
  for (const k of SIDED) o[k] = [null, null]
  for (const k of VEC) o[k] = [null, null]
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
    o.pron[s] = pick(p.pron, s) ?? 85
    o.curl[s] = pick(p.curl, s) ?? 0.35
    o.spread[s] = pick(p.spread, s) ?? 0
    o.toe[s] = pick(p.toe, s) ?? 0
    o.footPitch[s] = pick(p.footPitch, s) ?? 0
    o.footRoll[s] = pick(p.footRoll, s) ?? 0
    o.wrist[s] = pick(p.wrist, s) ?? 0
    for (const k of VEC) o[k][s] = pickV(p[k], s) ?? null
  }
  return o
}

const lerpV = (a, b, w) => {
  if (a == null || b == null) return w < 0.5 ? a : b
  if (Array.isArray(a)) return a.map((v, i) => lerpV(v, b[i], w))
  if (typeof a !== 'number') return w < 0.5 ? a : b
  return a + (b - a) * w
}
// smootherstep (quintic ease-in-out): ความเร็วและความเร่งเป็นศูนย์ที่จุดกลับทิศ -> หยุดค้างนุ่ม ๆ ที่ล่างสุด/บนสุดเหมือนคนจริง
const ease = (t) => t * t * t * (t * (6 * t - 15) + 10)

// t ∈ [0, 1) -> ท่า (resolved) ; keyframe วนกลับไปท่าแรก
export function samplePose(motion, t) {
  if (motion.fn) {
    const o = resolvePose({ gripSpace: motion.gripSpace, gripAxis: motion.gripAxis, ...motion.fn(t) })
    return o
  }
  const keys = motion._resolved || (motion._resolved = motion.keys.map((k) => resolvePose({ gripAxis: motion.gripAxis, ...k })))
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

// ระดับการเกร็งกล้ามเนื้อ 0..1 (กล้ามเนื้อเป้าหมายเรืองแสงแรงขึ้นตอนออกแรง)
export function contraction(motion, t) {
  if (motion.pulse === 'cyclic') return 0.5 + 0.5 * sin(TAU * t * 2)
  return sin(PI * t) ** 2
}
