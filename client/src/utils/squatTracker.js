// นับ Squat และตรวจฟอร์มจาก landmark ของ MediaPipe Pose (ไม่ขึ้นกับกล้อง/React จึงทดสอบได้ด้วยข้อมูลจำลอง)
//
// State machine: ยืนตรง (เข่า > 160°) -> ย่อ (เข่า < 90°) -> ยืนตรง = +1 rep
// ท่าย้อนขึ้นก่อนถึง 90° ไม่นับ: ต่ำสุด >= 100° = 'depth' (ฟอร์มผิด), 90-100° = 'almost' (อีกนิดเดียว)
// มุมหลังวัดจาก shoulder-hip เทียบแนวดิ่ง ตรวจได้เฉพาะการก้มตัว (หลังงอจับจาก landmark ไม่ได้)
// กล้องต้องอยู่ด้านข้างผู้เล่น มุมเข่าจากด้านหน้าจะเพี้ยน

export const STAND_ANGLE = 160
export const DOWN_ANGLE = 90
export const DEPTH_WARNING_ANGLE = 100
// ต่ำกว่านี้ถึงถือว่าตั้งใจย่อ (กันการขยับตัวเล็กน้อยตอนยืนขึ้นเตือนผิด)
const ATTEMPT_ANGLE = 140
// มุมต้องเด้งขึ้นจากจุดต่ำสุดเท่านี้ถึงถือว่ากลับตัว (กัน noise ของ landmark)
const TURN_BACK_MARGIN = 15
// squat ปกติก้มตัวได้ราว 45° เปิด/ปิดคำเตือนคนละค่า ไม่ให้กะพริบตอนอยู่ตรงขอบ
export const BACK_LEAN_LIMIT = 55
const BACK_LEAN_RECOVER = 45
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

// update(landmarks, aspect) -> { reps, phase, issue, tracking, angle }
// phase: 'waiting' (ยังไม่เคยยืนตรง) | 'up' | 'moving' | 'down'
// issue: null | 'depth' | 'almost' | 'back' ; 'depth'/'almost' ค้างจนเริ่มย่อรอบถัดไป ให้อ่านทันหลังยืนขึ้นแล้ว
export function createSquatTracker() {
  let reps = 0
  let phase = 'waiting'
  let angle = null
  let lowest = Infinity
  let depthIssue = null
  let leaning = false

  const snapshot = (tracking) => ({ reps, phase, issue: leaning ? 'back' : depthIssue, tracking, angle })

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
        if (angle < STAND_ANGLE) {
          phase = 'moving'
          lowest = angle
          depthIssue = null
        }
      } else if (phase === 'moving') {
        lowest = Math.min(lowest, angle)
        if (angle < DOWN_ANGLE) {
          phase = 'down'
        } else {
          if (lowest < ATTEMPT_ANGLE && angle > lowest + TURN_BACK_MARGIN) {
            depthIssue = lowest >= DEPTH_WARNING_ANGLE ? 'depth' : 'almost'
          }
          if (angle > STAND_ANGLE) phase = 'up'
        }
      } else if (angle > STAND_ANGLE) {
        reps += 1
        phase = 'up'
      }

      if (phase === 'moving' || phase === 'down') {
        const lean = torsoLean(points.shoulder, points.hip)
        leaning = leaning ? lean > BACK_LEAN_RECOVER : lean > BACK_LEAN_LIMIT
      } else {
        leaning = false
      }

      return snapshot(true)
    },
  }
}
