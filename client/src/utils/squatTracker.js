// นับ Squat และตรวจฟอร์มจาก landmark ของ MediaPipe Pose (ไม่ขึ้นกับกล้อง/React จึงทดสอบได้ด้วยข้อมูลจำลอง)
//
// 1 rep = ยืนตรง (เข่า > 160°) -> ย่อลง (เข่า < 140° ถือว่าตั้งใจย่อ) -> กลับมายืนตรง
// ครบรอบแล้วตัดสินฟอร์มจากทั้งรอบ:
//   - มุมเข่าต่ำสุด <= 90° (ต้นขาขนานพื้นหรือต่ำกว่า) และ
//   - ลำตัวไม่ก้มเกิน 55° จากแนวดิ่งติดกันหลายเฟรม
//   ผ่านทั้งคู่ = "ทำถูกต้อง" ไม่งั้น = "ทำผิดท่า" พร้อมเหตุผล (faults)
// faults: 'almost' (ต่ำสุด 91-99°) | 'depth' (ต่ำสุด >= 100°) | 'back' (ก้มตัวมากเกินไป)
// สถานะของแต่ละครั้ง (REP_STATUS): PERFECT | TOO_SHALLOW (almost/depth) | BAD_POSTURE (back)
// มุมหลังวัดจาก shoulder-hip เทียบแนวดิ่ง ตรวจได้เฉพาะการก้มตัว (หลังงอจับจาก landmark ไม่ได้)
// กล้องต้องอยู่ด้านข้างผู้เล่น มุมเข่าจากด้านหน้าจะเพี้ยน

export const STAND_ANGLE = 160
export const DOWN_ANGLE = 90
export const DEPTH_WARNING_ANGLE = 100
// เทียบเป็นองศาเต็มเหมือนตัวเลขที่แสดงบนจอ: จอขึ้น 90° = ผ่าน (มุมที่ smooth แล้วเข้าใกล้ 90 จากด้านบน เช่น 90.03)
const isDeep = (value) => Math.round(value) <= DOWN_ANGLE
// ต่ำกว่านี้ถึงถือว่าตั้งใจย่อ (ขยับตัวเล็กน้อยตอนยืนไม่นับเป็น rep และไม่เตือน)
export const ATTEMPT_ANGLE = 140
// มุมต้องเด้งขึ้นจากจุดต่ำสุดเท่านี้ถึงถือว่ากลับตัว (กัน noise ของ landmark)
const TURN_BACK_MARGIN = 15
// squat ปกติก้มตัวได้ราว 45° เปิด/ปิดคำเตือนคนละค่า ไม่ให้กะพริบตอนอยู่ตรงขอบ
export const BACK_LEAN_LIMIT = 55
const BACK_LEAN_RECOVER = 45
// ก้มเกินติดกันอย่างน้อยเท่านี้เฟรมถึงนับเป็นฟอร์มผิด (landmark กระตุกเฟรมเดียวไม่ปรับตก)
export const LEAN_FAULT_FRAMES = 3
const MIN_VISIBILITY = 0.5
const SMOOTHING = 0.5

// index ของ landmark ใน MediaPipe Pose
const SIDES = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
}

// มุมที่จุด b (องศา) ระหว่าง ba กับ bc
export function jointAngle(a, b, c) {
  const radians = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x))
  const degrees = (radians * 180) / Math.PI
  return degrees > 180 ? 360 - degrees : degrees
}

// มุมของลำตัวเทียบแนวดิ่ง: 0 = ตั้งตรง
export function torsoLean(shoulder, hip) {
  return (Math.atan2(Math.abs(shoulder.x - hip.x), Math.abs(shoulder.y - hip.y)) * 180) / Math.PI
}

// ใช้ข้างที่กล้องเห็นชัดกว่า เห็นไม่ครบ -> null
// x/y ของ MediaPipe เป็นสัดส่วนของกว้าง/สูงภาพ จึงคูณ aspect ให้หน่วยแกนเท่ากันก่อนวัดมุม
function visiblePoints(landmarks, aspect) {
  const pick = (side) => Object.fromEntries(Object.entries(side).map(([name, index]) => [name, landmarks[index]]))
  const score = (points) => Object.values(points).reduce((sum, point) => sum + (point?.visibility ?? 0), 0)
  const left = pick(SIDES.left)
  const right = pick(SIDES.right)
  const points = score(left) >= score(right) ? left : right
  if (Object.values(points).some((point) => !point || (point.visibility ?? 0) < MIN_VISIBILITY)) return null
  return Object.fromEntries(Object.entries(points).map(([name, point]) => [name, { x: point.x * aspect, y: point.y }]))
}

export const REP_STATUS = { PERFECT: 'PERFECT', TOO_SHALLOW: 'TOO_SHALLOW', BAD_POSTURE: 'BAD_POSTURE' }
// fault -> สถานะ: almost/depth = ย่อไม่สุด, back = ท่าทาง/หลังไม่ดี
export const statusOfFault = (fault) => (fault === 'back' ? REP_STATUS.BAD_POSTURE : REP_STATUS.TOO_SHALLOW)

// update(landmarks, aspect) -> {
//   totalReps, correctReps, incorrectReps,   จำนวนทั้งหมด / ทำถูกต้อง / ทำผิดฟอร์ม
//   currentRepStatus: REP_STATUS             ระหว่างทำ = สถานะสดของครั้งนี้ ; ยืนอยู่ = ผลของครั้งล่าสุด
//   phase: 'waiting' (ยังไม่เคยยืนตรง) | 'up' | 'moving' | 'down' (ย่อถึง 90° แล้ว),
//   issue: null | 'depth' | 'almost' | 'back'   ปัญหาสดของครั้งที่กำลังทำ (ขึ้นเมื่อครั้งนี้จะนับเป็นผิดแล้ว)
//   lastRep: null | { number, correct, status, faults, lowest }   ผลของครั้งล่าสุด
//   tracking, angle
// }
// summary() -> { totalReps, correctReps, incorrectReps, accuracy (%), faultCounts: { TOO_SHALLOW, BAD_POSTURE }, history: lastRep[] }
export function createSquatTracker() {
  let correct = 0
  let incorrect = 0
  let phase = 'waiting'
  let angle = null
  let lean = null
  let lowest = Infinity
  let depthIssue = null
  let leaning = false
  let leanFrames = 0
  let lastRep = null
  const history = []
  const faultCounts = { [REP_STATUS.TOO_SHALLOW]: 0, [REP_STATUS.BAD_POSTURE]: 0 }

  // ก้มเกินติดกันครบเกณฑ์แล้ว = ครั้งนี้นับเป็นผิดแน่นอน (ไม่เตือนจาก landmark กระตุกสั้น ๆ)
  const postureFault = () => leanFrames >= LEAN_FAULT_FRAMES
  const inRep = () => phase === 'moving' || phase === 'down'
  const currentRepStatus = () => {
    if (inRep()) {
      if (postureFault()) return REP_STATUS.BAD_POSTURE
      if (depthIssue) return REP_STATUS.TOO_SHALLOW
      return REP_STATUS.PERFECT
    }
    return lastRep?.status ?? REP_STATUS.PERFECT
  }

  const snapshot = (tracking) => ({
    totalReps: correct + incorrect,
    correctReps: correct,
    incorrectReps: incorrect,
    currentRepStatus: currentRepStatus(),
    phase,
    issue: leaning && postureFault() ? 'back' : depthIssue,
    lastRep,
    tracking,
    angle,
  })

  const startRep = () => {
    phase = 'moving'
    lowest = angle
    lean = null
    leanFrames = 0
    depthIssue = null
  }

  const completeRep = () => {
    const faults = []
    if (!isDeep(lowest)) faults.push(lowest >= DEPTH_WARNING_ANGLE ? 'depth' : 'almost')
    if (postureFault()) faults.push('back')
    const ok = faults.length === 0
    if (ok) correct += 1
    else incorrect += 1
    for (const fault of faults) faultCounts[statusOfFault(fault)] += 1
    const status = ok ? REP_STATUS.PERFECT : statusOfFault(faults[0])
    lastRep = { number: correct + incorrect, correct: ok, status, faults, lowest: Math.round(lowest) }
    history.push(lastRep)
    depthIssue = null
  }

  return {
    update(landmarks, aspect = 1) {
      const points = landmarks ? visiblePoints(landmarks, aspect) : null
      // หลุดเฟรมชั่วคราวไม่ล้างสถานะ เดินกลับเข้ากล้องแล้วนับต่อได้
      if (!points) return snapshot(false)

      const measured = jointAngle(points.hip, points.knee, points.ankle)
      angle = angle == null ? measured : angle + (measured - angle) * SMOOTHING

      if (phase === 'waiting') {
        if (angle > STAND_ANGLE) phase = 'up'
      } else if (phase === 'up') {
        if (angle < STAND_ANGLE) startRep()
      }

      if (phase === 'moving' || phase === 'down') {
        lowest = Math.min(lowest, angle)

        // หลัง: ค่าเฉลี่ยถ่วงน้ำหนัก + hysteresis ; นับเฟรมที่ก้มเกินไว้ตัดสินตอนจบรอบ
        const measuredLean = torsoLean(points.shoulder, points.hip)
        lean = lean == null ? measuredLean : lean + (measuredLean - lean) * SMOOTHING
        leaning = leaning ? lean > BACK_LEAN_RECOVER : lean > BACK_LEAN_LIMIT
        if (leaning) leanFrames += 1

        if (angle > STAND_ANGLE) {
          // ย่อจริง (ต่ำกว่า 140°) แล้วยืนขึ้น = ครบ 1 rep ; แค่ขยับตัวเล็กน้อย = ไม่นับ
          if (lowest < ATTEMPT_ANGLE) completeRep()
          phase = 'up'
          leaning = false
        } else if (isDeep(angle)) {
          phase = 'down'
          depthIssue = null
        } else if (phase === 'moving' && lowest < ATTEMPT_ANGLE && angle > lowest + TURN_BACK_MARGIN) {
          // ดันตัวขึ้นก่อนถึง 90° = เตือนสด (รอบนี้จะนับเป็นทำผิดท่าเมื่อยืนขึ้น)
          depthIssue = lowest >= DEPTH_WARNING_ANGLE ? 'depth' : 'almost'
        }
      }

      return snapshot(true)
    },

    summary() {
      const total = correct + incorrect
      return {
        totalReps: total,
        correctReps: correct,
        incorrectReps: incorrect,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
        faultCounts: { ...faultCounts },
        history: history.map((rep) => ({ ...rep, faults: [...rep.faults] })),
      }
    },
  }
}
