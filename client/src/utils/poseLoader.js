// โหลด MediaPipe Pose จาก CDN เมื่อเปิดกล้องครั้งแรก
//
// @mediapipe/pose เป็นสคริปต์แบบ global (window.Pose) ไม่ใช่ ES module ที่ bundle ได้ และโมเดล+wasm รวมกันหลาย MB
// จึงไม่ import เข้า bundle ล็อกเวอร์ชันไว้เพราะไฟล์ wasm ต้องตรงกับ pose.js
// instance ใช้ซ้ำตลอดการเปิดหน้าเว็บ: close() แล้วสร้างใหม่ในหน้าเดิมจะ error ใน wasm ของ MediaPipe

const POSE_VERSION = '0.5.1675469404'
const POSE_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}`

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.crossOrigin = 'anonymous'
    script.onload = resolve
    script.onerror = () => reject(new Error(`โหลด ${src} ไม่สำเร็จ`))
    document.head.appendChild(script)
  })
}

let posePromise = null

async function createPose() {
  if (!window.Pose) await loadScript(`${POSE_CDN}/pose.js`)
  const pose = new window.Pose({ locateFile: (file) => `${POSE_CDN}/${file}` })
  pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
  await pose.initialize()
  return pose
}

export function loadPose() {
  if (!posePromise) {
    posePromise = createPose().catch((error) => {
      posePromise = null // เน็ตหลุด: เปิดใหม่แล้วลองโหลดอีกครั้งได้
      throw error
    })
  }
  return posePromise
}
