// ทดสอบการนับ Squat และตรวจฟอร์มด้วย landmark จำลอง (ไม่ใช้กล้อง)
// รัน: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REP_STATUS, createSquatTracker, jointAngle, torsoLean } from './squatTracker.js'

// สร้างท่าจากมุมเข่าและมุมลำตัว (ข้างซ้ายของ landmark) ท่อนขาบน/ล่างยาว 0.2
function pose({ knee, lean = 0, visibility = 0.9 }) {
  const ankle = { x: 0.5, y: 0.9 }
  const kneePoint = { x: 0.5, y: 0.7 }
  const radians = (knee * Math.PI) / 180
  const hip = { x: kneePoint.x + 0.2 * Math.sin(radians), y: kneePoint.y + 0.2 * Math.cos(radians) }
  const leanRadians = (lean * Math.PI) / 180
  const shoulder = { x: hip.x + 0.3 * Math.sin(leanRadians), y: hip.y - 0.3 * Math.cos(leanRadians) }
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  for (const [index, point] of [[11, shoulder], [23, hip], [25, kneePoint], [27, ankle]]) {
    landmarks[index] = { ...point, visibility }
  }
  return landmarks
}

// เล่นมุมเข่าตามลำดับ โดยค่อย ๆ เปลี่ยนทีละเฟรมเหมือนวิดีโอจริง คืนสถานะสุดท้าย
function play(tracker, keyAngles, options = {}) {
  let state
  let previous = keyAngles[0]
  for (const target of keyAngles) {
    for (let step = 1; step <= 8; step++) {
      state = tracker.update(pose({ ...options, knee: previous + ((target - previous) * step) / 8 }))
    }
    for (let hold = 0; hold < 6; hold++) state = tracker.update(pose({ ...options, knee: target }))
    previous = target
  }
  return state
}

test('jointAngle and torsoLean measure degrees', () => {
  assert.equal(Math.round(jointAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })), 90)
  assert.equal(Math.round(jointAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0, y: -1 })), 180)
  assert.equal(Math.round(torsoLean({ x: 0, y: 0 }, { x: 0, y: 1 })), 0)
  assert.equal(Math.round(torsoLean({ x: 1, y: 0 }, { x: 0, y: 1 })), 45)
})

test('a deep, upright rep counts as correct', () => {
  const tracker = createSquatTracker()
  const state = play(tracker, [175, 80, 175])
  assert.equal(state.totalReps, 1)
  assert.equal(state.correctReps, 1)
  assert.equal(state.incorrectReps, 0)
  assert.deepEqual(state.lastRep, { number: 1, correct: true, status: 'PERFECT', faults: [], lowest: state.lastRep.lowest })
  assert.ok(state.lastRep.lowest < 90)
  assert.equal(play(tracker, [175, 80, 175, 80, 175]).correctReps, 3)
})

test('the rep counts only after standing back up', () => {
  const tracker = createSquatTracker()
  const down = play(tracker, [175, 80])
  assert.equal(down.phase, 'down')
  assert.equal(down.totalReps, 0)
})

test('needs a standing start', () => {
  const tracker = createSquatTracker()
  assert.equal(play(tracker, [120, 80, 120]).totalReps, 0)
})

test('a shallow squat counts as incorrect (depth)', () => {
  const tracker = createSquatTracker()
  // ระหว่างดันขึ้นก่อนถึง 90° = เตือนสด
  assert.equal(play(tracker, [175, 120, 150]).issue, 'depth')
  const state = play(tracker, [150, 175])
  assert.equal(state.totalReps, 1)
  assert.equal(state.correctReps, 0)
  assert.equal(state.incorrectReps, 1)
  assert.deepEqual(state.lastRep.faults, ['depth'])
  assert.equal(state.issue, null)
})

test('turning back between 90 and 100 is incorrect (almost)', () => {
  const state = play(createSquatTracker(), [175, 95, 175])
  assert.equal(state.incorrectReps, 1)
  assert.deepEqual(state.lastRep.faults, ['almost'])
})

test('a shallow dip that then goes deep is one correct rep', () => {
  const state = play(createSquatTracker(), [175, 120, 140, 80, 175])
  assert.equal(state.totalReps, 1)
  assert.equal(state.correctReps, 1)
})

test('small movements while standing are not reps and do not warn', () => {
  const state = play(createSquatTracker(), [175, 150, 175, 152, 175])
  assert.equal(state.totalReps, 0)
  assert.equal(state.issue, null)
})

test('leaning too far warns back live and the rep is incorrect', () => {
  const tracker = createSquatTracker()
  assert.equal(play(tracker, [175, 80], { lean: 70 }).issue, 'back')
  const state = play(tracker, [80, 175], { lean: 70 })
  assert.equal(state.totalReps, 1)
  assert.equal(state.incorrectReps, 1)
  assert.deepEqual(state.lastRep.faults, ['back'])
  assert.equal(state.issue, null)
})

test('a shallow, leaning rep records both faults', () => {
  const state = play(createSquatTracker(), [175, 120, 175], { lean: 70 })
  assert.deepEqual(state.lastRep.faults, ['depth', 'back'])
})

test('a normal forward lean is still correct', () => {
  const tracker = createSquatTracker()
  assert.equal(play(tracker, [175, 80], { lean: 40 }).issue, null)
  assert.equal(play(tracker, [80, 175], { lean: 40 }).correctReps, 1)
})

test('a one-frame lean glitch does not fail the rep', () => {
  const tracker = createSquatTracker()
  play(tracker, [175, 80], { lean: 30 })
  tracker.update(pose({ knee: 80, lean: 90 })) // landmark กระตุก 1 เฟรม
  const state = play(tracker, [80, 175], { lean: 30 })
  assert.equal(state.correctReps, 1)
  assert.equal(state.incorrectReps, 0)
})

test('summary reports totals, accuracy, faults and history', () => {
  const tracker = createSquatTracker()
  assert.deepEqual(tracker.summary(), { totalReps: 0, correctReps: 0, incorrectReps: 0, accuracy: 0, faultCounts: { TOO_SHALLOW: 0, BAD_POSTURE: 0 }, history: [] })
  play(tracker, [175, 80, 175, 80, 175, 80, 175, 120, 175]) // ถูก 3 ผิด 1
  play(tracker, [175, 80, 175], { lean: 70 }) // ผิด 1 (หลัง)
  const summary = tracker.summary()
  assert.equal(summary.totalReps, 5)
  assert.equal(summary.correctReps, 3)
  assert.equal(summary.incorrectReps, 2)
  assert.equal(summary.accuracy, 60)
  assert.deepEqual(summary.faultCounts, { TOO_SHALLOW: 1, BAD_POSTURE: 1 })
  assert.deepEqual(summary.history.map((rep) => rep.correct), [true, true, true, false, false])
  // summary เป็นสำเนา แก้แล้วไม่กระทบ tracker
  summary.history[0].faults.push('x')
  assert.deepEqual(tracker.summary().history[0].faults, [])
})

test('a lost body pauses without losing progress', () => {
  const tracker = createSquatTracker()
  play(tracker, [175, 80])
  assert.equal(tracker.update(pose({ knee: 80, visibility: 0.1 })).tracking, false)
  assert.equal(tracker.update(null).tracking, false)
  assert.equal(play(tracker, [80, 175]).totalReps, 1)
})

test('corrects for the frame aspect ratio', () => {
  // จุดเดียวกัน: ภาพกว้าง 16:9 ท่อนขาไม่ได้ตั้งฉากจริง ถ้าไม่คูณ aspect จะได้มุมผิด
  const tracker = createSquatTracker()
  const raw = pose({ knee: 90 })
  assert.equal(Math.round(tracker.update(raw, 1).angle), 90)
  assert.ok(Math.abs(createSquatTracker().update(raw, 16 / 9).angle - 90) < 1)
  const skewed = raw.map((point) => ({ ...point }))
  skewed[23] = { ...skewed[23], y: 0.8 }
  assert.notEqual(Math.round(createSquatTracker().update(skewed, 1).angle), Math.round(createSquatTracker().update(skewed, 16 / 9).angle))
})

test('a knee angle of exactly 90 degrees counts as deep enough', () => {
  const state = play(createSquatTracker(), [175, 90, 175])
  assert.equal(state.correctReps, 1)
  assert.equal(state.incorrectReps, 0)
})

test('currentRepStatus follows the rep in progress, then the last result', () => {
  const tracker = createSquatTracker()
  assert.equal(play(tracker, [175]).currentRepStatus, REP_STATUS.PERFECT)
  assert.equal(play(tracker, [175, 80]).currentRepStatus, REP_STATUS.PERFECT)
  assert.equal(play(tracker, [80, 175]).currentRepStatus, REP_STATUS.PERFECT)
  // ย่อไม่สุดแล้วดันขึ้น = TOO_SHALLOW ตั้งแต่ระหว่างทำ และค้างหลังยืนขึ้น
  assert.equal(play(tracker, [175, 120, 150]).currentRepStatus, REP_STATUS.TOO_SHALLOW)
  const shallow = play(tracker, [150, 175])
  assert.equal(shallow.currentRepStatus, REP_STATUS.TOO_SHALLOW)
  assert.equal(shallow.lastRep.status, REP_STATUS.TOO_SHALLOW)
  // ก้มตัว = BAD_POSTURE
  assert.equal(play(tracker, [175, 80], { lean: 70 }).currentRepStatus, REP_STATUS.BAD_POSTURE)
  assert.equal(play(tracker, [80, 175], { lean: 70 }).lastRep.status, REP_STATUS.BAD_POSTURE)
  // ครั้งใหม่ที่ดีกลับเป็น PERFECT
  assert.equal(play(tracker, [175, 80, 175]).currentRepStatus, REP_STATUS.PERFECT)
})

test('the live back warning only appears once the rep is really failing', () => {
  const tracker = createSquatTracker()
  play(tracker, [175, 80], { lean: 30 })
  tracker.update(pose({ knee: 80, lean: 90 }))
  const glitch = tracker.update(pose({ knee: 80, lean: 30 }))
  assert.equal(glitch.issue, null) // กระตุกสั้น ๆ ไม่เตือน
  assert.equal(glitch.currentRepStatus, REP_STATUS.PERFECT)
})
