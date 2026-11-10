// ฉากหุ่นจำลอง 3D (three.js) สำหรับเรนเดอร์วิดีโอสาธิตท่า — รันใน Chrome headless ผ่าน build-mannequin-videos.mjs
// หุ่นแบบ Stylized Anatomy: ร่างสีเทา-ฟ้า (slate) มีมัดกล้ามเนื้อเป็นก้อนลายเส้นใย กล้ามเนื้อเป้าหมายเรืองแสงส้ม-แดง (bloom)
// พื้นหลัง #0e1a24 เท่าสีการ์ดในแอป
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MOTIONS, samplePose, contraction, resolvePose } from './motions.js'

const W = 480
const H = 640
const BG = '#0e1a24'
const BASE_Y = 0.975 // ความสูงสะโพกตอนยืน (พื้นรองเท้าอยู่ y = 0)
const L = { uarm: 0.29, farm: 0.33, thigh: 0.43, shin: 0.42 } // farm = ข้อศอก -> กลางฝ่ามือ
const rad = THREE.MathUtils.degToRad
const deg = THREE.MathUtils.radToDeg
const norm = (a) => ((((a + 180) % 360) + 360) % 360) - 180
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.NoToneMapping // พื้นหลังต้องออกมาเป็น #0e1a24 ตรงเป๊ะ
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(BG)
const camera = new THREE.PerspectiveCamera(28, W / H, 0.05, 60)

scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x0e1a24, 0.85))
const key = new THREE.DirectionalLight(0xffffff, 1.9)
key.position.set(2.2, 4.2, 3.2)
key.castShadow = true
key.shadow.mapSize.set(1024, 1024)
Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 12 })
key.shadow.bias = -0.0008
key.shadow.radius = 4
scene.add(key)
const rim = new THREE.DirectionalLight(0x5cb6ff, 2.4)
rim.position.set(-2.6, 2.4, -3.2)
scene.add(rim)
const fill = new THREE.DirectionalLight(0xffd7b8, 0.35)
fill.position.set(-3, 1.2, 2.5)
scene.add(fill)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.75, 0.45, 0.66)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ---------- textures ----------
function canvasTexture(draw, w = 64, h = 128) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  return tex
}
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
// เส้นใยกล้ามเนื้อ: ริ้วแนวตั้ง (ตามแนวยาวของมัด)
const fiberTex = canvasTexture((g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 150 + Math.floor(rand() * 105)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(x, 0, 1, h)
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'
  for (let i = 0; i < 9; i++) g.fillRect(Math.floor(rand() * w), 0, 1, h)
})
// ซิกแพ็ก: กึ่งกลางด้านหน้าของทรงรีอยู่ที่ u = 0.25 (x = 16)
const absTex = canvasTexture((g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 175 + Math.floor(rand() * 70)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(x, 0, 1, h)
  }
  g.fillStyle = 'rgba(20,10,10,0.75)'
  g.fillRect(15, 0, 3, h)
  for (const y of [38, 62, 86]) g.fillRect(0, y, 32, 3)
})
const waterTex = canvasTexture((g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  grad.addColorStop(0, 'rgba(40,140,210,0.42)')
  grad.addColorStop(0.7, 'rgba(40,140,210,0.18)')
  grad.addColorStop(1, 'rgba(40,140,210,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(150,210,255,0.22)'
  for (const r of [18, 30, 44]) {
    g.beginPath()
    g.ellipse(w / 2, h / 2, r, r, 0, 0, Math.PI * 2)
    g.stroke()
  }
}, 128, 128)
// เส้นใยละเอียด คอนทราสต์ต่ำ สำหรับภาพนิ่งซูมใกล้ (ไม่เป็นลอนแบบฟักทอง)
const fineFiberTex = canvasTexture((g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 222 + Math.floor(rand() * 33)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(x, 0, 1, h)
  }
}, 512, 64)
const glowTex = canvasTexture((g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  grad.addColorStop(0, "rgba(80,150,210,0.16)")
  grad.addColorStop(1, 'rgba(80,150,210,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
}, 128, 128)

// ---------- materials ----------
const MAT = {
  skin: new THREE.MeshStandardMaterial({ color: 0x6c8198, roughness: 0.36, metalness: 0.28 }),
  joint: new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.45, metalness: 0.45 }),
  equip: new THREE.MeshStandardMaterial({ color: 0x3a4b5e, roughness: 0.4, metalness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa9b8, roughness: 0.25, metalness: 0.9 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.55, metalness: 0.4 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x3b5068, roughness: 0.7, metalness: 0.1 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.4, metalness: 0.2 }),
}
let theme = 'slate'
function muscleMat(kind, tex) {
  if (theme === 'silver') {
    if (kind === 'primary') return new THREE.MeshStandardMaterial({ color: 0xff4a24, map: tex, emissive: 0xd8260c, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.34, metalness: 0.08 })
    return new THREE.MeshStandardMaterial({ color: 0xd9dfe6, map: tex, roughness: 0.3, metalness: 0.42 })
  }
  if (kind === 'primary') {
    return new THREE.MeshStandardMaterial({
      color: 0xff6a3a, map: tex, emissive: 0xff3a12, emissiveMap: tex, emissiveIntensity: 2.4, roughness: 0.32, metalness: 0.1,
    })
  }
  if (kind === 'secondary') {
    return new THREE.MeshStandardMaterial({ color: 0xffa585, map: tex, emissive: 0xff5a2a, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.4 })
  }
  return new THREE.MeshStandardMaterial({ color: 0x8b9fb5, map: tex, roughness: 0.42, metalness: 0.18 })
}

// ---------- rig ----------
const SPHERE = new THREE.SphereGeometry(1, 44, 30)
const J = {}
const bodyMeshes = []
const muscles = []
const body = new THREE.Group()
scene.add(body)

function joint(name, parent, pos, order = 'XYZ') {
  const g = new THREE.Group()
  g.name = name
  g.position.set(...pos)
  g.rotation.order = order
  parent.add(g)
  J[name] = g
  return g
}
function add(parent, mesh, part) {
  mesh.castShadow = true
  mesh.userData.part = part
  parent.add(mesh)
  bodyMeshes.push(mesh)
  return mesh
}
function capsule(parent, len, r, mat, part, up = false) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 8, 20), mat)
  m.position.y = up ? len / 2 : -len / 2
  return add(parent, m, part)
}
function ellipsoid(parent, pos, scale, mat, part, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(SPHERE, mat)
  m.position.set(...pos)
  m.scale.set(...scale)
  m.rotation.set(...rot)
  return add(parent, m, part)
}
function muscle(parent, group, pos, scale, part, rot, tex = fiberTex) {
  const m = ellipsoid(parent, pos, scale, muscleMat('base', tex), part, rot)
  muscles.push({ mesh: m, group, tex })
  return m
}

// DETAIL (scene.html?detail=1): กายวิภาคละเอียดสำหรับภาพนิ่งไอคอนหมวดกล้ามเนื้อ
//   แยกมัดย่อย (อก 2 ส่วน, ไหล่ 3 หัว, ซิกแพ็ก 6 ก้อน, ปีกหลัง/ทราพีเซียส, ต้นขา 3 หัว ฯลฯ) และย่อโครงให้กล้ามเนื้อเป็นผิวนอก
// ไม่มี detail = หุ่นแบบเดิมที่ใช้เรนเดอร์วิดีโอสาธิตท่า (คงรูปร่างให้ตรงกับคลิปที่เรนเดอร์ไว้)
const DETAIL = new URLSearchParams(location.search).has('detail')
const root = joint('root', body, [0, BASE_Y, 0])
const spine = joint('spine', root, [0, 0.08, 0])
const chest = joint('chest', spine, [0, 0.2, 0])
const neck = joint('neck', chest, [0, 0.3, 0])
if (!DETAIL) {
  ellipsoid(root, [0, 0.0, 0], [0.165, 0.11, 0.115], MAT.skin, 'torso')
  for (const s of [1, -1]) muscle(root, 'glutes', [0.075 * s, -0.035, -0.072], [0.085, 0.095, 0.062], 'torso')
  capsule(spine, 0.2, 0.105, MAT.skin, 'torso', true).scale.set(1, 1, 0.82)
  muscle(spine, 'abs', [0, 0.1, 0.076], [0.07, 0.11, 0.035], 'torso', [0, 0, 0], absTex)
  for (const s of [1, -1]) muscle(spine, 'abs', [0.085 * s, 0.09, 0.03], [0.035, 0.09, 0.05], 'torso')
  ellipsoid(chest, [0, 0.14, 0], [0.185, 0.2, 0.122], MAT.skin, 'torso')
  for (const s of [1, -1]) {
    muscle(chest, 'chest', [0.075 * s, 0.19, 0.083], [0.08, 0.066, 0.042], 'torso', [0, 0, 0.25 * s])
    muscle(chest, 'back', [0.09 * s, 0.11, -0.07], [0.085, 0.15, 0.045], 'torso', [0, 0, -0.32 * s])
  }
  muscle(chest, 'back', [0, 0.27, -0.055], [0.12, 0.06, 0.05], 'torso')
} else {
  // เชิงกราน + ก้น (glute max ใหญ่ + glute med ด้านข้าง)
  ellipsoid(root, [0, 0.01, 0], [0.15, 0.1, 0.1], MAT.skin, 'torso')
  for (const s of [1, -1]) {
    muscle(root, 'glutes', [0.072 * s, -0.045, -0.068], [0.088, 0.1, 0.07], 'torso', [0.15, 0, 0.12 * s])
    muscle(root, 'glutes', [0.125 * s, 0.03, -0.03], [0.05, 0.065, 0.055], 'torso', [0, 0, 0.3 * s])
  }
  // ลำตัวช่วงท้อง: ซิกแพ็ก 3 แถว x 2 + ท้องน้อย + กล้ามเนื้อข้างลำตัว (oblique) + กล้ามเนื้อหลังส่วนล่าง (erector)
  capsule(spine, 0.2, 0.098, MAT.skin, 'torso', true).scale.set(1, 1, 0.78)
  for (const s of [1, -1]) {
    for (const [i, y] of [0.035, 0.095, 0.155].entries()) muscle(spine, 'abs', [0.031 * s, y, 0.07 + 0.004 * i], [0.03, 0.027, 0.017], 'torso')
    muscle(spine, 'abs', [0.022 * s, -0.025, 0.068], [0.026, 0.035, 0.016], 'torso')
    muscle(spine, 'abs', [0.083 * s, 0.07, 0.035], [0.034, 0.1, 0.045], 'torso', [0, 0, -0.12 * s])
    muscle(spine, 'back', [0.03 * s, 0.09, -0.068], [0.03, 0.12, 0.026], 'torso')
  }
  // ซี่โครง/อก: โครงเล็กลงให้มัดกล้ามเนื้อเป็นผิวนอก
  ellipsoid(chest, [0, 0.14, -0.005], [0.165, 0.19, 0.11], MAT.skin, 'torso')
  for (const s of [1, -1]) {
    // อกส่วนล่าง (sternal) + ส่วนบน (clavicular)
    muscle(chest, 'chest', [0.078 * s, 0.175, 0.088], [0.094, 0.066, 0.036], 'torso', [0.1, 0.22 * s, 0.3 * s])
    muscle(chest, 'chest', [0.07 * s, 0.232, 0.08], [0.078, 0.042, 0.03], 'torso', [0.2, 0.22 * s, 0.12 * s])
    // serratus (ซี่โครงข้าง) ไม่เป็นเป้าหมาย
    for (const y of [0.05, 0.085, 0.12]) muscle(chest, 'serratus', [0.138 * s, y, 0.055], [0.026, 0.016, 0.022], 'torso', [0, 0, -0.5 * s])
    // ปีกหลัง (lats) + rhomboid
    muscle(chest, 'back', [0.105 * s, 0.1, -0.055], [0.098, 0.17, 0.042], 'torso', [0, 0.25 * s, -0.36 * s])
    muscle(chest, 'back', [0.055 * s, 0.19, -0.088], [0.055, 0.06, 0.025], 'torso')
    // ทราพีเซียสลาดจากคอ
    muscle(chest, 'back', [0.075 * s, 0.3, -0.03], [0.07, 0.035, 0.045], 'torso', [0, 0, -0.42 * s])
  }
  muscle(chest, 'back', [0, 0.235, -0.085], [0.09, 0.11, 0.03], 'torso')
}
capsule(neck, 0.09, 0.048, MAT.skin, 'torso', true)
ellipsoid(neck, [0, 0.15, 0.005], [0.092, 0.105, 0.1], MAT.skin, 'torso')

for (const [n, s] of [['L', 1], ['R', -1]]) {
  const sh = joint(`shoulder${n}`, chest, [0.2 * s, 0.25, 0], 'YXZ')
  const ur = joint(`uroll${n}`, sh, [0, 0, 0])
  const el = joint(`elbow${n}`, ur, [0, -0.29, 0])
  const hand = joint(`hand${n}`, el, [0, -0.33, 0])
  const hip = joint(`hip${n}`, root, [0.095 * s, -0.04, 0], 'YXZ')
  const knee = joint(`knee${n}`, hip, [0, -0.43, 0])
  const ankle = joint(`ankle${n}`, knee, [0, -0.42, 0])
  if (!DETAIL) {
    muscle(ur, 'shoulders', [0.012 * s, -0.025, 0], [0.068, 0.078, 0.068], 'arm')
    capsule(ur, 0.29, 0.048, MAT.skin, 'arm')
    muscle(ur, 'biceps', [0, -0.15, 0.03], [0.042, 0.1, 0.038], 'arm')
    muscle(ur, 'triceps', [0, -0.135, -0.032], [0.044, 0.11, 0.04], 'arm')
    capsule(el, 0.26, 0.04, MAT.skin, 'arm')
    muscle(el, 'forearms', [0, -0.085, 0.004], [0.046, 0.095, 0.046], 'arm')
    capsule(hip, 0.43, 0.072, MAT.skin, 'leg')
    muscle(hip, 'quads', [0, -0.2, 0.036], [0.068, 0.18, 0.052], 'leg')
    muscle(hip, 'hamstrings', [0, -0.2, -0.034], [0.062, 0.17, 0.05], 'leg')
    capsule(knee, 0.42, 0.052, MAT.skin, 'leg')
    muscle(knee, 'calves', [0, -0.13, -0.032], [0.05, 0.11, 0.045], 'leg')
  } else {
    // ไหล่ 3 หัว (หน้า / ข้าง / หลัง)
    muscle(ur, 'shoulders', [0.004 * s, -0.035, 0.034], [0.046, 0.085, 0.04], 'arm', [-0.2, 0, 0])
    muscle(ur, 'shoulders', [0.03 * s, -0.04, 0], [0.045, 0.09, 0.05], 'arm', [0, 0, 0.12 * s])
    muscle(ur, 'shoulders', [0.004 * s, -0.035, -0.034], [0.044, 0.08, 0.04], 'arm', [0.2, 0, 0])
    capsule(ur, 0.29, 0.042, MAT.skin, 'arm')
    // ต้นแขน: biceps + brachialis / triceps 2 หัว
    muscle(ur, 'biceps', [0, -0.155, 0.03], [0.039, 0.095, 0.038], 'arm')
    muscle(ur, 'biceps', [0.022 * s, -0.215, 0.012], [0.025, 0.05, 0.028], 'arm')
    muscle(ur, 'triceps', [-0.006 * s, -0.13, -0.034], [0.04, 0.11, 0.036], 'arm')
    muscle(ur, 'triceps', [0.027 * s, -0.11, -0.016], [0.028, 0.075, 0.03], 'arm')
    capsule(el, 0.26, 0.035, MAT.skin, 'arm')
    // ปลายแขน: กลุ่มงอ / กลุ่มเหยียด เรียวลงที่ข้อมือ
    muscle(el, 'forearms', [0.012 * s, -0.075, 0.012], [0.036, 0.1, 0.036], 'arm')
    muscle(el, 'forearms', [-0.012 * s, -0.07, -0.01], [0.032, 0.095, 0.032], 'arm')
    capsule(hip, 0.43, 0.066, MAT.skin, 'leg')
    // ต้นขาหน้า 3 หัว (vastus lateralis / rectus femoris / vastus medialis รูปหยดน้ำ) + ต้นขาด้านใน
    muscle(hip, 'quads', [0.034 * s, -0.2, 0.012], [0.05, 0.17, 0.052], 'leg', [0, 0, 0.05 * s])
    muscle(hip, 'quads', [0, -0.19, 0.046], [0.042, 0.18, 0.036], 'leg')
    muscle(hip, 'quads', [-0.03 * s, -0.33, 0.035], [0.04, 0.07, 0.038], 'leg')
    muscle(hip, 'adductors', [-0.04 * s, -0.12, 0], [0.036, 0.12, 0.045], 'leg')
    // ต้นขาหลัง 2 หัว
    muscle(hip, 'hamstrings', [0.022 * s, -0.21, -0.038], [0.038, 0.16, 0.038], 'leg')
    muscle(hip, 'hamstrings', [-0.022 * s, -0.21, -0.036], [0.036, 0.16, 0.038], 'leg')
    capsule(knee, 0.42, 0.046, MAT.skin, 'leg')
    // น่อง: gastrocnemius 2 หัว + soleus + หน้าแข้ง (tibialis)
    muscle(knee, 'calves', [0.021 * s, -0.105, -0.036], [0.033, 0.09, 0.04], 'leg')
    muscle(knee, 'calves', [-0.021 * s, -0.115, -0.034], [0.032, 0.095, 0.04], 'leg')
    muscle(knee, 'calves', [0, -0.21, -0.024], [0.04, 0.075, 0.03], 'leg')
    muscle(knee, 'tibialis', [0.018 * s, -0.15, 0.03], [0.022, 0.12, 0.022], 'leg')
  }
  ellipsoid(el, [0, 0, 0], [0.046, 0.046, 0.046], MAT.joint, 'arm')
  ellipsoid(hand, [0, 0.005, 0], [0.036, 0.062, 0.028], MAT.joint, 'arm')
  ellipsoid(knee, [0, 0, 0.01], [0.058, 0.058, 0.058], MAT.joint, 'leg')
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 14), MAT.joint)
  foot.rotation.x = Math.PI / 2
  foot.position.set(0, -0.045, 0.055)
  add(ankle, foot, 'leg')
}

// ---------- พื้น ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.42 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
const halo = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false }))
halo.rotation.x = -Math.PI / 2
halo.position.y = 0.002
scene.add(halo)

// ---------- pose ----------
const v = new THREE.Vector3()
const wp = (o) => o.getWorldPosition(new THREE.Vector3())
const dirAngle = (dy, dz) => deg(Math.atan2(-dz, -dy))
// IK สองท่อนในระนาบด้านข้าง (y, z) -> มุมโลกของท่อนบนและท่อนล่าง
function solve2(P, T, l1, l2, bend) {
  const dy = T[0] - P.y
  const dz = T[1] - P.z
  const d = clamp(Math.hypot(dy, dz), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
  const base = dirAngle(dy, dz)
  const alpha = deg(Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)))
  const a1 = base + bend * alpha
  const ky = P.y - l1 * Math.cos(rad(a1))
  const kz = P.z - l1 * Math.sin(rad(a1))
  return [a1, dirAngle(T[0] - ky, T[1] - kz)]
}

let M = null // motion ปัจจุบัน
let fixPoint = null

function setAngles(o) {
  J.root.rotation.set(rad(o.pelvis), rad(o.pelvisYaw), rad(o.pelvisRoll))
  J.spine.rotation.set(rad(norm(o.spine - o.pelvis)), 0, 0)
  J.chest.rotation.set(rad(norm(o.chest - o.spine)), rad(o.chestTwist), rad(o.chestSide))
  J.neck.rotation.set(rad(norm(o.head - o.chest)), 0, 0)
  for (const [n, s] of [['L', 0], ['R', 1]]) {
    const m = s ? -1 : 1
    J[`shoulder${n}`].rotation.set(rad(norm(o.uarm[s] - o.chest)), m * rad(o.uarmT[s]), m * rad(o.uarmA[s]))
    J[`uroll${n}`].rotation.y = m * rad(o.uarmRoll[s])
    const elbow = o.elbowR[s] ?? clamp(norm(o.farm[s] - o.uarm[s]), -165, 4)
    J[`elbow${n}`].rotation.x = rad(elbow)
    J[`hip${n}`].rotation.set(rad(norm(o.thigh[s] - o.pelvis)), m * rad(o.thighT[s]), m * rad(o.thighA[s]))
    J[`knee${n}`].rotation.x = rad(clamp(norm(o.shin[s] - o.thigh[s]), -4, 165))
    J[`ankle${n}`].rotation.x = rad(norm(o.foot[s] - o.shin[s]))
  }
  J.root.position.set(o.x, BASE_Y + o.y, o.z)
  body.updateMatrixWorld(true)
}

const handIK = (o) => o.handFix || o.handC[0] || o.handC[1] || o.handW[0] || o.handW[1]
function anchor(o) {
  const mode = M.anchor || 'feet'
  if (mode === 'fixed') return
  const shift = new THREE.Vector3()
  if (mode === 'hands') {
    const mid = wp(J.handL).add(wp(J.handR)).multiplyScalar(0.5)
    shift.set(...M.handsAt).sub(mid)
  } else {
    const box = new THREE.Box3()
    const skipArms = handIK(o)
    for (const mesh of bodyMeshes) if (!(skipArms && mesh.userData.part === 'arm')) box.expandByObject(mesh)
    shift.y = -box.min.y + o.lift
    if (mode !== 'ground') {
      const a = mode === 'footL' ? wp(J.ankleL) : mode === 'footR' ? wp(J.ankleR) : wp(J.ankleL).add(wp(J.ankleR)).multiplyScalar(0.5)
      shift.x = o.x - a.x
      shift.z = o.z - a.z
    }
  }
  J.root.position.add(shift)
  body.updateMatrixWorld(true)
}

function ik(o) {
  for (const [n, s] of [['L', 0], ['R', 1]]) {
    let T = null
    if (o.handFix && fixPoint) T = fixPoint
    else if (o.handW[s]) T = o.handW[s]
    else if (o.handC[s]) {
      const p = J.chest.localToWorld(new THREE.Vector3((s ? -1 : 1) * 0.2, o.handC[s][0], o.handC[s][1]))
      T = [p.y, p.z]
    }
    if (T) {
      const [a1, a2] = solve2(wp(J[`shoulder${n}`]), T, L.uarm, L.farm, M.armBend ?? 1)
      J[`shoulder${n}`].rotation.x = rad(norm(a1 - o.chest))
      J[`elbow${n}`].rotation.x = rad(norm(a2 - a1))
    }
    if (o.footW[s]) {
      const [a1, a2] = solve2(wp(J[`hip${n}`]), o.footW[s], L.thigh, L.shin, M.legBend ?? -1)
      J[`hip${n}`].rotation.x = rad(norm(a1 - o.pelvis))
      J[`knee${n}`].rotation.x = rad(norm(a2 - a1))
      J[`ankle${n}`].rotation.x = rad(norm(o.foot[s] - a2))
    }
  }
  body.updateMatrixWorld(true)
}

function pose(t) {
  const o = samplePose(M, t)
  setAngles(o)
  anchor(o)
  ik(o)
  return o
}

// ---------- props ----------
const props = []
const propRoot = new THREE.Group()
scene.add(propRoot)
const Y = new THREE.Vector3(0, 1, 0)
function cylBetween(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a)
  mesh.position.copy(a).addScaledVector(d, 0.5)
  mesh.scale.set(1, Math.max(d.length(), 1e-3), 1)
  mesh.quaternion.setFromUnitVectors(Y, d.normalize())
}
function mk(geo, mat, parent = propRoot) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
const unitCyl = (r) => new THREE.CylinderGeometry(r, r, 1, 16)
function box(size, pos, mat = MAT.equip, rot = [0, 0, 0], parent) {
  const m = mk(new THREE.BoxGeometry(...size), mat, parent)
  m.position.set(...pos)
  m.rotation.set(...rot.map(rad))
  return m
}
function cyl(r, from, to, mat = MAT.equip) {
  const m = mk(unitCyl(r), mat)
  cylBetween(m, new THREE.Vector3(...from), new THREE.Vector3(...to))
  return m
}
const handsMid = () => wp(J.handL).add(wp(J.handR)).multiplyScalar(0.5)
const feetMid = () => wp(J.ankleL).add(wp(J.ankleR)).multiplyScalar(0.5)
const point = (name) => (name === 'handsMid' ? handsMid() : name === 'feet' ? feetMid() : wp(J[name]))

function barbellGroup(width, plates) {
  const g = new THREE.Group()
  const bar = mk(new THREE.CylinderGeometry(0.014, 0.014, width, 14), MAT.steel, g)
  bar.rotation.z = Math.PI / 2
  if (plates) {
    for (const s of [1, -1]) {
      for (const [x, r, t] of [[0.72, 0.22, 0.05], [0.78, 0.17, 0.04]]) {
        const p = mk(new THREE.CylinderGeometry(r, r, t, 32), MAT.plate, g)
        p.rotation.z = Math.PI / 2
        p.position.x = x * s
      }
      const c = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 14), MAT.steel, g)
      c.rotation.z = Math.PI / 2
      c.position.x = 0.66 * s
    }
  }
  propRoot.add(g)
  return g
}
const X = new THREE.Vector3(1, 0, 0)
function alignToHands(g) {
  const a = wp(J.handL)
  const b = wp(J.handR)
  g.position.copy(a).add(b).multiplyScalar(0.5)
  g.quaternion.setFromUnitVectors(X, a.sub(b).normalize())
}

const PROP = {
  barbell: () => {
    const g = barbellGroup(1.9, true)
    return () => alignToHands(g)
  },
  handle: ({ width }) => {
    const g = barbellGroup(width, false)
    return () => alignToHands(g)
  },
  dumbbells: ({ axis }) => {
    for (const n of ['L', 'R']) {
      const g = new THREE.Group()
      const h = mk(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), MAT.steel, g)
      for (const s of [1, -1]) {
        const head = mk(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20), MAT.plate, g)
        head.position.y = 0.105 * s
      }
      h.position.y = 0
      if (axis === 'x') g.rotation.z = Math.PI / 2
      else g.rotation.x = Math.PI / 2
      J[`hand${n}`].add(g)
    }
  },
  kettlebell: () => {
    const g = new THREE.Group()
    const b = mk(new THREE.SphereGeometry(0.1, 24, 18), MAT.plate, g)
    b.position.y = -0.13
    const handle = mk(new THREE.TorusGeometry(0.06, 0.012, 10, 24, Math.PI), MAT.plate, g)
    handle.position.y = -0.05
    propRoot.add(g)
    return () => {
      g.position.copy(handsMid())
      const d = handsMid().sub(wp(J.chest)).normalize()
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d)
    }
  },
  gloves: () => {
    for (const n of ['L', 'R']) ellipsoid(J[`hand${n}`], [0, 0, 0.01], [0.065, 0.075, 0.07], MAT.glove, 'arm')
  },
  racket: () => {
    const g = new THREE.Group()
    const h = mk(unitCyl(0.012), MAT.steel, g)
    h.scale.y = 0.42
    h.position.y = -0.21
    const head = mk(new THREE.TorusGeometry(0.11, 0.008, 8, 32), MAT.steel, g)
    head.scale.set(0.8, 1.15, 1)
    head.position.y = -0.52
    head.rotation.y = Math.PI / 2
    J.handR.add(g)
  },
  ball: ({ kind, pos, follow, offset = [0, 0, 0] }) => {
    const r = kind === 'basketball' ? 0.12 : 0.11
    const mat = new THREE.MeshStandardMaterial({ color: kind === 'basketball' ? 0xd9692b : 0xe8edf2, roughness: 0.6 })
    const b = mk(new THREE.SphereGeometry(r, 28, 20), mat)
    if (pos) b.position.set(...pos)
    if (follow) return () => b.position.copy(point(follow)).add(new THREE.Vector3(...offset))
  },
  rope: () => {
    const ring = mk(new THREE.TorusGeometry(1, 0.007, 6, 64, Math.PI), MAT.steel)
    const g = new THREE.Group()
    propRoot.add(g)
    g.add(ring)
    ring.scale.set(0.33, 0.95, 1)
    return (t) => {
      alignToHands(g)
      ring.rotation.x = 0
      g.rotateX(-Math.PI * 4 * t - Math.PI / 2)
    }
  },
  water: () => {
    ground.visible = false
    halo.visible = false
    const w = mk(new THREE.CircleGeometry(1.7, 64), new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, depthWrite: false }))
    w.rotation.x = -Math.PI / 2
    w.position.y = 0.6
    w.castShadow = false
    w.userData.noFrame = true
  },
  backpack: () => {
    box([0.26, 0.34, 0.14], [0, 0.17, -0.18], MAT.pad, [0, 0, 0], J.chest)
  },
  treadmill: () => {
    box([0.62, 0.08, 1.6], [0, 0.04, -0.12], MAT.equip)
    box([0.52, 0.012, 1.5], [0, 0.085, -0.12], MAT.pad)
    cyl(0.025, [0.34, 0.08, 0.6], [0.34, 1.15, 0.7])
    cyl(0.025, [-0.34, 0.08, 0.6], [-0.34, 1.15, 0.7])
    box([0.75, 0.12, 0.2], [0, 1.18, 0.72], MAT.equip)
  },
  bench: () => {
    box([0.32, 0.08, 1.25], [0, 0.48, -0.32], MAT.pad)
    box([0.1, 0.44, 0.1], [0, 0.22, 0.2], MAT.equip)
    box([0.1, 0.44, 0.1], [0, 0.22, -0.82], MAT.equip)
    box([0.5, 0.05, 0.1], [0, 0.025, 0.2], MAT.equip)
    box([0.5, 0.05, 0.1], [0, 0.025, -0.82], MAT.equip)
  },
  rack: () => {
    for (const s of [1, -1]) {
      cyl(0.03, [0.55 * s, 0, -0.62], [0.55 * s, 1.35, -0.62])
      box([0.08, 0.04, 0.12], [0.55 * s, 1.1, -0.56], MAT.equip)
    }
  },
  dipbars: () => {
    for (const s of [1, -1]) {
      cyl(0.022, [0.3 * s, 1.19, -0.5], [0.3 * s, 1.19, 0.5], MAT.steel)
      cyl(0.03, [0.3 * s, 0, -0.5], [0.3 * s, 1.19, -0.5])
      cyl(0.03, [0.3 * s, 0, 0.5], [0.3 * s, 1.19, 0.5])
    }
  },
  pullbar: () => {
    const y = M.handsAt[1] + 0.005
    cyl(0.018, [-0.75, y, M.handsAt[2]], [0.75, y, M.handsAt[2]], MAT.steel)
    for (const s of [1, -1]) cyl(0.035, [0.75 * s, 0, M.handsAt[2]], [0.75 * s, y + 0.1, M.handsAt[2]])
  },
  lowbar: () => {
    const [y, z] = fixPoint
    cyl(0.018, [-0.75, y, z], [0.75, y, z], MAT.steel)
    for (const s of [1, -1]) cyl(0.035, [0.75 * s, 0, z], [0.75 * s, y + 0.06, z])
  },
  cable: ({ from, to }) => {
    const m = mk(unitCyl(0.006), MAT.steel)
    const a = new THREE.Vector3(...from)
    return () => cylBetween(m, a, point(to))
  },
  box: ({ size, pos, rot, mat }) => {
    box(size, pos, MAT[mat] || MAT.equip, rot)
  },
  cyl: ({ r, from, to }) => {
    cyl(r, from, to)
  },
  plate: ({ follow, size, rot, offset }) => {
    const m = box(size, [0, 0, 0], MAT.equip, rot)
    return () => m.position.copy(point(follow)).add(new THREE.Vector3(...offset))
  },
  roller: ({ follow, offset }) => {
    const m = mk(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 20), MAT.pad)
    m.rotation.z = Math.PI / 2
    return () => m.position.copy(point(follow)).add(new THREE.Vector3(...offset))
  },
  bike: () => {
    const bb = [0, 0.32, 0.2]
    const seat = [0, 0.9, -0.05]
    const head = [0, 0.92, 0.6]
    const rear = [0, 0.33, -0.42]
    const front = [0, 0.33, 0.66]
    for (const c of [rear, front]) {
      const w = mk(new THREE.TorusGeometry(0.33, 0.018, 10, 48), MAT.plate)
      w.position.set(...c)
      w.rotation.y = Math.PI / 2
    }
    for (const [a, b] of [[bb, seat], [seat, head], [bb, [0, 0.8, 0.6]], [bb, rear], [seat, rear], [head, front]]) cyl(0.016, a, b)
    box([0.12, 0.04, 0.24], [0, 0.92, -0.06], MAT.pad)
    cyl(0.014, [-0.22, 1.0, 0.64], [0.22, 1.0, 0.64], MAT.steel)
    cyl(0.016, head, [0, 1.0, 0.64])
    return crank(bb)
  },
  spinBike: () => {
    const bb = [0, 0.34, 0.22]
    box([0.5, 0.06, 1.2], [0, 0.03, 0.1], MAT.equip)
    const fw = mk(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 40), MAT.plate)
    fw.rotation.z = Math.PI / 2
    fw.position.set(0, 0.34, 0.62)
    cyl(0.03, [0, 0.06, -0.15], [0, 0.88, -0.05])
    cyl(0.03, [0, 0.06, 0.55], [0, 1.0, 0.58])
    box([0.14, 0.05, 0.26], [0, 0.9, -0.06], MAT.pad)
    cyl(0.016, [-0.22, 1.06, 0.58], [0.22, 1.06, 0.58], MAT.steel)
    return crank(bb)
  },
  elliptical: () => {
    box([0.6, 0.12, 1.5], [0, 0.06, 0.15], MAT.equip)
    box([0.4, 1.2, 0.12], [0, 0.66, 0.85], MAT.equip)
    const poles = ['L', 'R'].map(() => mk(unitCyl(0.018), MAT.steel))
    const pedals = ['L', 'R'].map(() => box([0.12, 0.03, 0.32], [0, 0, 0], MAT.pad))
    return () => {
      ;['L', 'R'].forEach((n, i) => {
        const h = wp(J[`hand${n}`])
        cylBetween(poles[i], h, new THREE.Vector3(h.x, 0.55, 0.7))
        pedals[i].position.copy(wp(J[`ankle${n}`])).add(new THREE.Vector3(0, -0.09, 0.05))
      })
    }
  },
  steps: () => {
    for (let i = 0; i < 4; i++) box([0.7, 0.2, 0.3], [0, 0.1 + 0.2 * i, 0.2 + 0.3 * i - 0.3], MAT.equip)
    for (const s of [1, -1]) cyl(0.02, [0.4 * s, 0.9, -0.2], [0.4 * s, 1.08, 0.6], MAT.steel)
    const pedals = ['L', 'R'].map(() => box([0.14, 0.03, 0.3], [0, 0, 0], MAT.pad))
    return () => ['L', 'R'].forEach((n, i) => pedals[i].position.copy(wp(J[`ankle${n}`])).add(new THREE.Vector3(0, -0.09, 0.05)))
  },
  rower: () => {
    box([0.14, 0.06, 2.0], [0, 0.24, 0.25], MAT.equip)
    box([0.34, 0.42, 0.34], [0, 0.32, 1.28], MAT.equip)
    box([0.42, 0.26, 0.04], [0, 0.32, 0.92], MAT.equip, [-35, 0, 0])
    const seat = box([0.3, 0.05, 0.3], [0, 0, 0], MAT.pad)
    const chain = mk(unitCyl(0.005), MAT.steel)
    const hb = barbellGroup(0.5, false)
    return () => {
      seat.position.copy(wp(J.root)).add(new THREE.Vector3(0, -0.12, 0))
      alignToHands(hb)
      cylBetween(chain, handsMid(), new THREE.Vector3(0, 0.46, 1.1))
    }
  },
}
function crank(bb) {
  const c = new THREE.Vector3(...bb)
  const arms = ['L', 'R'].map(() => mk(new THREE.BoxGeometry(0.02, 1, 0.03), MAT.steel))
  const disk = mk(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 28), MAT.steel)
  disk.rotation.z = Math.PI / 2
  disk.position.copy(c)
  return () => ['L', 'R'].forEach((n, i) => {
    const a = wp(J[`ankle${n}`])
    const d = new THREE.Vector3().subVectors(a, c)
    arms[i].position.copy(c).addScaledVector(d, 0.5)
    arms[i].scale.y = d.length()
    arms[i].quaternion.setFromUnitVectors(Y, d.normalize())
  })
}

// ---------- กล้อง: จัดเฟรมจากกล่องครอบของท่าทั้งลูป (ภาพนิ่งไม่สั่น) ----------
function frameCamera(boxes, az, el) {
  const center = new THREE.Box3()
  for (const b of boxes) center.union(b)
  const target = center.getCenter(new THREE.Vector3())
  const dir = new THREE.Vector3(Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el)))
  let dist = 5
  for (let i = 0; i < 5; i++) {
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    let mx = 0
    let my = 0
    for (const b of boxes) {
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        v.set(x, y, z).project(camera)
        mx = Math.max(mx, Math.abs(v.x))
        my = Math.max(my, Math.abs(v.y))
      }
    }
    dist *= Math.max(mx / 0.78, my / 0.8)
  }
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.lookAt(target)
  halo.position.x = target.x
  halo.position.z = target.z
}

// spec: { motion, primary: [...], secondary: [...], fps }
window.setup = (spec) => {
  M = MOTIONS[spec.motion]
  if (!M) throw new Error(`unknown motion ${spec.motion}`)
  const all = spec.primary.includes('fullbody')
  for (const m of muscles) {
    const kind = all || spec.primary.includes(m.group) ? 'primary' : spec.secondary.includes(m.group) ? 'secondary' : 'base'
    m.mesh.material = muscleMat(kind, m.tex)
    m.kind = kind
  }
  // จุดยึดมือ (พื้นใต้ไหล่ / บาร์เหนือไหล่) คำนวณจากท่าแรก
  fixPoint = null
  if (M.fix) {
    const o = samplePose(M, 0)
    setAngles(o)
    anchor({ ...o, handFix: 1 })
    const sh = wp(J.shoulderL).add(wp(J.shoulderR)).multiplyScalar(0.5)
    fixPoint = M.fix === 'floor' ? [0.04, sh.z + 0.02] : [sh.y + 0.6, sh.z]
  }
  for (const p of M.props || []) {
    const def = typeof p === 'string' ? { type: p } : p
    const upd = PROP[def.type](def)
    if (upd) props.push(upd)
  }
  const fps = spec.fps || 24
  const frames = Math.max(12, Math.round(M.dur * fps))
  const boxes = []
  for (let i = 0; i < 16; i++) {
    const t = i / 16
    pose(t)
    props.forEach((u) => u(t))
    const b = new THREE.Box3()
    for (const m of bodyMeshes) b.expandByObject(m)
    propRoot.traverse((o) => o.isMesh && !o.userData.noFrame && b.expandByObject(o))
    boxes.push(b)
  }
  const cam = { az: 52, el: 12, ...(M.cam || {}) }
  frameCamera(boxes, cam.az, cam.el)
  return { frames }
}

window.frame = (i, frames) => {
  const t = i / frames
  pose(t)
  props.forEach((u) => u(t))
  const c = contraction(M, t)
  for (const m of muscles) if (m.kind === 'primary') m.mesh.material.emissiveIntensity = 1.35 + 1.1 * c
  composer.render()
  return renderer.domElement.toDataURL('image/png')
}

// ---------- ภาพนิ่งไอคอนหมวดกล้ามเนื้อ: หุ่นกล้ามเนื้อสีเงิน พื้นโปร่งใส ซูมเฉพาะส่วน ----------
// spec: { pose, primary, az, el, focus: [กลุ่มกล้ามเนื้อที่ใช้จัดเฟรม], pad, width, height }
window.still = (spec) => {
  theme = 'silver'
  M = { anchor: 'feet' }
  Object.assign(MAT.skin, { color: new THREE.Color(0xb8c1cb), roughness: 0.28, metalness: 0.5 })
  Object.assign(MAT.joint, { color: new THREE.Color(0x8a96a3), roughness: 0.35, metalness: 0.55 })
  const all = spec.primary.includes('fullbody')
  for (const m of muscles) {
    m.kind = all || spec.primary.includes(m.group) ? 'primary' : 'base'
    m.mesh.material = muscleMat(m.kind, m.tex === absTex ? absTex : fineFiberTex)
  }
  ground.visible = false
  halo.visible = false
  scene.background = null
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55
  rim.color.set(0xcfe6ff)
  rim.intensity = 2.2
  key.intensity = 2.3
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(spec.width, spec.height)
  camera.aspect = spec.width / spec.height
  camera.updateProjectionMatrix()
  const o = resolvePose(spec.pose || {})
  setAngles(o)
  anchor(o)
  const focus = new THREE.Box3()
  for (const m of muscles) if (spec.focus.includes(m.group)) focus.expandByObject(m.mesh)
  if (spec.focus.includes('body')) for (const m of bodyMeshes) focus.expandByObject(m)
  focus.expandByScalar(spec.pad ?? 0.04)
  frameCamera([focus], spec.az, spec.el)
  renderer.render(scene, camera)
  window.lastFocus = focus.getSize(new THREE.Vector3()).toArray()
  return renderer.domElement.toDataURL('image/png')
}

window.ready = true
