// ฉากหุ่นจำลอง 3D (three.js) สำหรับเรนเดอร์วิดีโอสาธิตท่า — รันใน Chrome headless ผ่าน build-mannequin-videos.mjs
// หุ่นแบบ Stylized Anatomy: ร่างสีเทา-ฟ้า (slate) มีมัดกล้ามเนื้อเป็นก้อนลายเส้นใย กล้ามเนื้อเป้าหมายเรืองแสงส้ม-แดง (bloom)
// พื้นหลัง #0e1a24 เท่าสีการ์ดในแอป
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
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
// พิกเซล NaN/Inf (normal เสื่อมของ mesh ที่ผ่าน skinning บางท่า) ทำให้ bloom เบลอ NaN ไปทั้งภาพ -> เปลี่ยนเป็นพื้นหลัง
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, bg: { value: new THREE.Color(BG) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 bg; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bool bad = any(isnan(c)) || any(isinf(c)); gl_FragColor = bad ? vec4(bg, 1.0) : min(c, vec4(64.0)); }',
}))
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
    const box = bodyBox({ skipArms: !!handIK(o) })
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

// ---------- โมเดลกายวิภาคจริง (scene.html?model=anatomy) ----------
// mesh กล้ามเนื้อ 467 ชิ้น + กระดูก 201 ชิ้นจาก BodyParts3D (CC BY-SA 2.1 JP) + Z-Anatomy (CC BY-SA 4.0)
// ผ่าน anatomy.glb / skeleton.glb ของ BodyExplorer ; ผูก skinning กับ rig เดียวกับหุ่นเดิม (ท่าทั้ง 53 ใช้ได้ทันที)
// ข้อต่อวัดจากกระดูกจริง (หัวกระดูกต้นแขน/ต้นขา, กระดูกสันหลัง L5/T12/C7 ฯลฯ) ; หุ่นทรงกลมเดิมซ่อนไว้
const ANATOMY = new URLSearchParams(location.search).get('model') === 'anatomy'
let anat = null

const AMAT = {}
function anatomyMaterials() {
  // ลายเส้นใยกล้ามเนื้อ: bump map ริ้วละเอียดตามแนวยาวของมัด (uv ตามแกนหลักของแต่ละชิ้น)
  const fiberBump = canvasTexture((g, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = 70 + Math.floor(rand() * 150)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, 0, 1, h)
    }
  }, 256, 16)
  fiberBump.colorSpace = THREE.NoColorSpace
  fiberBump.wrapT = THREE.RepeatWrapping
  const common = { bumpMap: fiberBump, bumpScale: 2.2 }
  // vertexColors = กางเกงขาสั้นสีดำ (สีต่อ vertex) ; มัดเป้าหมาย (primary/secondary) ไม่ใช้ จึงเรืองแสงทับกางเกงได้
  AMAT.base = new THREE.MeshPhysicalMaterial({ color: 0xaab2bc, metalness: 0.6, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.45, vertexColors: true, ...common })
  AMAT.tendon = new THREE.MeshPhysicalMaterial({ color: 0xc9d0d8, metalness: 0.5, roughness: 0.3, clearcoat: 0.5, vertexColors: true })
  AMAT.bone = new THREE.MeshPhysicalMaterial({ color: 0x8e98a3, metalness: 0.35, roughness: 0.5, vertexColors: true })
  AMAT.primary = new THREE.MeshPhysicalMaterial({ color: 0xf97316, emissive: 0xff4a10, emissiveIntensity: 0.9, metalness: 0.12, roughness: 0.34, clearcoat: 0.45, ...common })
  const absBump = canvasTexture((g, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = 120 + Math.floor(rand() * 90)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, 0, 1, h)
    }
    // แนวยาว v: 0 = หัวหน่าว (ล่าง) .. 1 = ซี่โครง (บน) ; canvas y กลับด้าน (flipY)
    for (const t of [0.56, 0.72, 0.87]) {
      const y = Math.round((1 - t) * h)
      const grad = g.createLinearGradient(0, y - 7, 0, y + 7)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.5, 'rgba(0,0,0,0.95)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, y - 7, w, 14)
    }
  }, 256, 256)
  absBump.colorSpace = THREE.NoColorSpace
  // ร่องซิกแพ็กในสีด้วย (แสงเรืองไม่กลบร่อง)
  const absMap = canvasTexture((g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    for (const t of [0.56, 0.72, 0.87]) {
      const y = Math.round((1 - t) * h)
      const grad = g.createLinearGradient(0, y - 6, 0, y + 6)
      grad.addColorStop(0, 'rgba(60,30,25,0)')
      grad.addColorStop(0.5, 'rgba(60,30,25,0.75)')
      grad.addColorStop(1, 'rgba(60,30,25,0)')
      g.fillStyle = grad
      g.fillRect(0, y - 6, w, 12)
    }
  }, 16, 256)
  AMAT.secondary = new THREE.MeshPhysicalMaterial({ color: 0xffb393, emissive: 0xff6a3a, emissiveIntensity: 0.28, metalness: 0.35, roughness: 0.34, ...common })
  for (const k of ['base', 'primary', 'secondary']) {
    AMAT[`${k}Abs`] = AMAT[k].clone()
    Object.assign(AMAT[`${k}Abs`], { bumpMap: absBump, bumpScale: 9, map: absMap, emissiveMap: absMap })
  }
}

// uv ตามแกนหลักของชิ้น (PCA): v = ตามแนวยาว (ทิศเส้นใย), u = รอบแกน (ระยะโค้ง) -> ริ้วใน bump map วิ่งตามมัดกล้ามเนื้อ
function fiberUV(geo, lengthwise01 = false) {
  const p = geo.attributes.position
  const n = p.count
  const c = new THREE.Vector3()
  for (let i = 0; i < n; i++) c.add(v.fromBufferAttribute(p, i))
  c.divideScalar(n)
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).sub(c)
    const a = [v.x, v.y, v.z]
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cov[r * 3 + k] += a[r] * a[k]
  }
  let axis = new THREE.Vector3(0.3, 1, 0.2).normalize()
  for (let it = 0; it < 24; it++) {
    axis = new THREE.Vector3(
      cov[0] * axis.x + cov[1] * axis.y + cov[2] * axis.z,
      cov[3] * axis.x + cov[4] * axis.y + cov[5] * axis.z,
      cov[6] * axis.x + cov[7] * axis.y + cov[8] * axis.z,
    ).normalize()
  }
  const b1 = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? Y : X).normalize()
  const b2 = new THREE.Vector3().crossVectors(axis, b1)
  let rSum = 0
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).sub(c)
    rSum += v.clone().addScaledVector(axis, -v.dot(axis)).length()
  }
  const R = rSum / n || 0.01
  if (lengthwise01 && axis.y < 0) axis.negate()
  let tMin = Infinity
  let tMax = -Infinity
  for (let i = 0; i < n; i++) {
    const t = v.fromBufferAttribute(p, i).sub(c).dot(axis)
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).sub(c)
    const t = v.dot(axis)
    const ang = Math.atan2(v.dot(b2), v.dot(b1))
    uv[i * 2] = (ang * R) / 0.012 / 256 // ริ้วละ ~1.2 มม. x 256 คอลัมน์
    uv[i * 2 + 1] = lengthwise01 ? (t - tMin) / (tMax - tMin) : t / 0.05
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

async function loadAnatomy() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const { muscleGroup, bodyRegion, HIDDEN } = await import('/anatomy/groups.js')
  anatomyMaterials()
  const loader = new GLTFLoader()
  const [mus, bone] = await Promise.all(['/data/anatomy.glb', '/data/skeleton.glb'].map((u) => loader.loadAsync(u)))
  // mm, Z ขึ้น, หน้า = -Y  ->  เมตร, Y ขึ้น, หน้า = +Z
  const toWorld = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001))
  const parts = []
  for (const [gltf, isBone] of [[mus, false], [bone, true]]) {
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(toWorld)
      parts.push({ name: o.name.replace(/_/g, ' '), geo, isBone }) // GLTFLoader แทนช่องว่างในชื่อด้วย _
    })
  }
  // ยกให้ฝ่าเท้าอยู่ที่ y = 0 และสะโพกอยู่กลาง x/z
  const all = new THREE.Box3()
  for (const p of parts) {
    p.geo.computeBoundingBox()
    all.union(p.geo.boundingBox)
  }
  const byName = new Map(parts.map((p) => [p.name, p]))
  // external oblique ของ BodyParts3D รวมเยื่อพังผืดด้านหน้า (aponeurosis) ที่คลุม rectus abdominis ทั้งแผ่น
  // -> ตัดสามเหลี่ยมช่วงหน้าท้องตรงกลางออก ให้เห็นซิกแพ็กเหมือนร่างจริงที่ไขมันน้อย
  for (const side of ['left', 'right']) {
    const ob = byName.get(`${side} external oblique`)
    const ra = byName.get(`${side} rectus abdominis`)
    if (!ob || !ra) continue
    ra.geo.computeBoundingBox()
    const half = Math.max(Math.abs(ra.geo.boundingBox.min.x), Math.abs(ra.geo.boundingBox.max.x)) - 0.006
    const zFront = ra.geo.boundingBox.min.z
    const g = ob.geo.index ? ob.geo.toNonIndexed() : ob.geo
    const pos = g.attributes.position
    const nor = g.attributes.normal
    const keepP = []
    const keepN = []
    for (let t = 0; t < pos.count; t += 3) {
      let cx = 0
      let cz = 0
      for (let k = 0; k < 3; k++) {
        cx += pos.getX(t + k) / 3
        cz += pos.getZ(t + k) / 3
      }
      if (Math.abs(cx) < half && cz > zFront) continue
      for (let k = 0; k < 3; k++) {
        keepP.push(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k))
        keepN.push(nor.getX(t + k), nor.getY(t + k), nor.getZ(t + k))
      }
    }
    const cut = new THREE.BufferGeometry()
    cut.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3))
    cut.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3))
    ob.geo = cut
  }
  const verts = (name) => {
    const g = byName.get(name)?.geo
    if (!g) throw new Error(`missing bone ${name}`)
    const out = []
    for (let i = 0; i < g.attributes.position.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(g.attributes.position, i))
    return out
  }
  const centroid = (pts) => pts.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(pts.length)
  const cap = (name, end, depth, filter = () => true) => {
    const pts = verts(name)
    const ys = pts.map((q) => q.y)
    const lim = end === 'top' ? Math.max(...ys) - depth : Math.min(...ys) + depth
    return centroid(pts.filter((q) => (end === 'top' ? q.y >= lim : q.y <= lim) && filter(q)))
  }
  const S = {}
  for (const [n, side] of [['L', 'left'], ['R', 'right']]) {
    const femurTop = verts(`${side} femur`).filter((q, _, arr) => q.y > Math.max(...arr.map((r) => r.y)) - 0.07)
    const medX = femurTop.map((q) => Math.abs(q.x)).sort((a, b) => a - b)[Math.floor(femurTop.length / 2)]
    S[`hip${n}`] = centroid(femurTop.filter((q) => Math.abs(q.x) < medX))
    S[`knee${n}`] = cap(`${side} femur`, 'bottom', 0.03).add(cap(`${side} tibia`, 'top', 0.02)).multiplyScalar(0.5)
    S[`ankle${n}`] = centroid(verts(`${side} talus`))
    S[`toe${n}`] = centroid(verts(`distal phalanx of ${side} big toe`))
    S[`shoulder${n}`] = cap(`${side} humerus`, 'top', 0.035)
    S[`elbow${n}`] = cap(`${side} humerus`, 'bottom', 0.025)
    S[`wrist${n}`] = cap(`${side} radius`, 'bottom', 0.015)
    S[`hand${n}`] = centroid(verts(`${side} third metacarpal bone`))
  }
  S.hip = S.hipL.clone().add(S.hipR).multiplyScalar(0.5)
  S.l5 = centroid(verts('fifth lumbar vertebra'))
  S.t12 = centroid(verts('twelfth thoracic vertebra'))
  S.c7 = centroid(verts('seventh cervical vertebra'))
  const shift = new THREE.Vector3(-S.hip.x, -all.min.y, -S.hip.z)
  for (const p of parts) p.geo.translate(shift.x, shift.y, shift.z)
  for (const k of Object.keys(S)) S[k].add(shift)

  // ตั้งตำแหน่งข้อต่อของ rig ตามกระดูกจริง (ท่ายืนตรง = bind pose)
  const rel = (a, b) => new THREE.Vector3().subVectors(a, b)
  J.root.rotation.set(0, 0, 0)
  J.root.position.copy(S.hip)
  J.spine.position.copy(rel(S.l5, S.hip))
  J.chest.position.copy(rel(S.t12, S.l5))
  J.neck.position.copy(rel(S.c7, S.t12))
  for (const n of ['L', 'R']) {
    J[`shoulder${n}`].position.copy(rel(S[`shoulder${n}`], S.t12))
    J[`elbow${n}`].position.copy(rel(S[`elbow${n}`], S[`shoulder${n}`]))
    J[`hand${n}`].position.copy(rel(S[`hand${n}`], S[`elbow${n}`]))
    J[`hip${n}`].position.copy(rel(S[`hip${n}`], S.hip))
    J[`knee${n}`].position.copy(rel(S[`knee${n}`], S[`hip${n}`]))
    J[`ankle${n}`].position.copy(rel(S[`ankle${n}`], S[`knee${n}`]))
  }
  for (const k of Object.keys(J)) J[k].rotation.set(0, 0, 0)
  body.updateMatrixWorld(true)
  L.uarm = S.shoulderL.distanceTo(S.elbowL)
  L.farm = S.elbowL.distanceTo(S.handL)
  L.thigh = S.hipL.distanceTo(S.kneeL)
  L.shin = S.kneeL.distanceTo(S.ankleL)
  for (const m of bodyMeshes) m.visible = false // ซ่อนหุ่นทรงกลมเดิม

  // กระดูกของ skeleton + ช่วงของแต่ละกระดูกไว้คำนวณน้ำหนัก
  const up = (p, d) => p.clone().add(new THREE.Vector3(0, d, 0))
  const BONES = {
    root: [J.root, S.hip, S.l5], spine: [J.spine, S.l5, S.t12], chest: [J.chest, S.t12, S.c7], neck: [J.neck, S.c7, up(S.c7, 0.25)],
  }
  for (const n of ['L', 'R']) {
    BONES[`arm${n}`] = [J[`uroll${n}`], S[`shoulder${n}`], S[`elbow${n}`]]
    BONES[`fore${n}`] = [J[`elbow${n}`], S[`elbow${n}`], S[`wrist${n}`]]
    BONES[`hand${n}`] = [J[`hand${n}`], S[`wrist${n}`], up(S[`wrist${n}`], -0.1)]
    BONES[`thigh${n}`] = [J[`hip${n}`], S[`hip${n}`], S[`knee${n}`]]
    BONES[`shin${n}`] = [J[`knee${n}`], S[`knee${n}`], S[`ankle${n}`]]
    BONES[`foot${n}`] = [J[`ankle${n}`], S[`ankle${n}`], S[`toe${n}`]]
  }
  const names = Object.keys(BONES)
  // รัศมีโดยประมาณของแต่ละท่อน: วัดระยะถึง "ผิว" ของท่อนแทนแกนกลาง -> เนื้อเยื่อลำตัว (อก ปีกหลัง) ยึดกับลำตัว ไม่ถูกแขนดึงเป็นแผ่น
  const RADIUS = { root: 0.1, spine: 0.11, chest: 0.13, neck: 0.04 }
  for (const n of ['L', 'R']) Object.assign(RADIUS, { [`arm${n}`]: 0.03, [`fore${n}`]: 0.03, [`hand${n}`]: 0.02, [`thigh${n}`]: 0.05, [`shin${n}`]: 0.04, [`foot${n}`]: 0.03 })
  const skeleton = new THREE.Skeleton(names.map((k) => BONES[k][0]))
  skeleton.calculateInverses()
  const ALLOW = {
    head: ['neck'], neck: ['neck', 'chest'], chest: ['chest', 'spine', 'neck'], abdomen: ['spine', 'root', 'chest'], pelvis: ['root', 'spine', 'thighL', 'thighR'],
  }
  for (const n of ['L', 'R']) {
    Object.assign(ALLOW, {
      [`${n}shoulder`]: ['chest', `arm${n}`, 'neck'], [`${n}upperarm`]: [`arm${n}`, `fore${n}`, 'chest'], [`${n}forearm`]: [`fore${n}`, `arm${n}`, `hand${n}`],
      [`${n}hand`]: [`hand${n}`, `fore${n}`], [`${n}thigh`]: [`thigh${n}`, 'root', `shin${n}`], [`${n}shin`]: [`shin${n}`, `thigh${n}`, `foot${n}`], [`${n}foot`]: [`foot${n}`, `shin${n}`],
    })
  }
  const segDist = (q, a, b) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const t = clamp(new THREE.Vector3().subVectors(q, a).dot(ab) / ab.lengthSq(), 0, 1)
    return q.distanceTo(a.clone().addScaledVector(ab, t))
  }

  // กางเกงขาสั้นสีดำ: เอวต่ำกว่า L5 เล็กน้อย ถึงกลางต้นขา (สีคูณกับสีเงิน -> ดำด้าน)
  const shortsTop = S.l5.y - 0.005
  const shortsHem = S.hip.y - 0.5 * L.thigh
  const SHORTS = [0.13, 0.135, 0.15]
  anat = { meshes: [], samples: [] }
  const q = new THREE.Vector3()
  for (const part of parts) {
    if (part.name === 'Skeleton' || HIDDEN.test(part.name.toLowerCase())) continue
    let region = bodyRegion(part.name)
    // ข้อมูลบางชิ้นติดป้ายซ้าย/ขวาสลับ (เช่น flexor pollicis brevis) -> เชื่อตำแหน่งจริง (ซ้ายของหุ่น = x บวก)
    if (region && (region[0] === 'L' || region[0] === 'R')) {
      part.geo.computeBoundingBox()
      const cx = part.geo.boundingBox.getCenter(new THREE.Vector3()).x
      if (Math.abs(cx) > 0.05 && (cx > 0) !== (region[0] === 'L')) region = (cx > 0 ? 'L' : 'R') + region.slice(1)
    }
    if (!region) {
      part.geo.computeBoundingBox()
      const c = part.geo.boundingBox.getCenter(new THREE.Vector3())
      let best = 'chest'
      let bd = Infinity
      for (const k of names) {
        const d = segDist(c, BONES[k][1], BONES[k][2])
        if (d < bd) [bd, best] = [d, k]
      }
      const side = best.endsWith('L') ? 'L' : best.endsWith('R') ? 'R' : ''
      region = { root: 'pelvis', spine: 'abdomen', chest: 'chest', neck: 'neck' }[best] ||
        side + { arm: 'upperarm', fore: 'forearm', hand: 'hand', thigh: 'thigh', shin: 'shin', foot: 'foot' }[best.slice(0, -1)]
    }
    const allow = (ALLOW[region] || ALLOW.chest).map((k) => names.indexOf(k))
    const geo = part.geo
    const pos = geo.attributes.position
    const n = pos.count
    const si = new Uint16Array(n * 4)
    const sw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      q.fromBufferAttribute(pos, i)
      if (part.isBone) {
        si[i * 4] = allow[0]
        sw[i * 4] = 1
        continue
      }
      const ws = allow.map((b) => {
        const [, a, e] = BONES[names[b]]
        return 1 / (Math.max(0, segDist(q, a, e) - RADIUS[names[b]]) + 0.012) ** 6
      })
      const tot = ws.reduce((x, y) => x + y, 0)
      allow.forEach((b, k) => {
        si[i * 4 + k] = b
        sw[i * 4 + k] = ws[k] / tot
      })
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    const col = new Float32Array(n * 3).fill(1)
    if (/pelvis|thigh|abdomen/.test(region)) {
      for (let i = 0; i < n; i++) {
        const y = pos.getY(i)
        if (y < shortsTop && y > shortsHem) col.set(SHORTS, i * 3)
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const lower = part.name.toLowerCase()
    const tendon = /tendon|aponeuros|fascia|retinacul|ligament|membrane|sheath|linea|arch/.test(lower)
    const group = part.isBone || tendon ? null : muscleGroup(part.name)
    const rectus = /rectus abdominis/.test(lower)
    if (!part.isBone && !tendon) fiberUV(geo, rectus)
    const mesh = new THREE.SkinnedMesh(geo, part.isBone ? AMAT.bone : tendon ? AMAT.tendon : AMAT.base)
    mesh.bind(skeleton, new THREE.Matrix4())
    mesh.castShadow = true
    mesh.frustumCulled = false
    scene.add(mesh)
    const arm = /hand|forearm|upperarm/.test(region)
    anat.meshes.push({ mesh, group, isBone: part.isBone, rectus, name: part.name, region })
    // จุดตัวอย่างของผิว (คำนวณกล่องครอบหลัง skinning แบบเร็ว: ใช้ยึดพื้น / จัดเฟรมกล้อง)
    const step = Math.max(1, Math.floor(n / 40))
    const side = region[0] === 'L' || region[0] === 'R' ? region[0] : /left/.test(lower) ? 'L' : /right/.test(lower) ? 'R' : ''
    for (let i = 0; i < n; i += step) anat.samples.push({ mesh, i, group, arm, side })
  }
}

// กล่องครอบร่างกายหลังจัดท่า: โหมด anatomy ใช้จุดตัวอย่างที่ผ่าน skinning ; หุ่นเดิมใช้ mesh
function bodyBox({ skipArms = false, groups = null, side = null } = {}) {
  const box = new THREE.Box3()
  if (anat) {
    const p = new THREE.Vector3()
    for (const s of anat.samples) {
      if (skipArms && s.arm) continue
      if (groups && !groups.includes(s.group)) continue
      if (side && s.side !== side) continue
      p.fromBufferAttribute(s.mesh.geometry.attributes.position, s.i)
      s.mesh.applyBoneTransform(s.i, p)
      box.expandByPoint(p)
    }
    return box
  }
  for (const mesh of bodyMeshes) {
    if (skipArms && mesh.userData.part === 'arm') continue
    if (groups && !muscles.some((m) => m.mesh === mesh && groups.includes(m.group))) continue
    box.expandByObject(mesh)
  }
  return box
}

function paintAnatomy(primary, secondary) {
  const all = primary.includes('fullbody')
  for (const m of anat.meshes) {
    if (!m.group) continue
    // fullbody = มัดหลักทุกกลุ่ม (กล้ามเนื้อย่อยอื่นยังเป็นสีเงิน ให้เห็นรูปร่าง)
    m.kind = (all && m.group !== 'base') || primary.includes(m.group) ? 'primary' : secondary.includes(m.group) ? 'secondary' : 'base'
    m.mesh.material = AMAT[m.rectus ? `${m.kind}Abs` : m.kind]
  }
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
    dist *= Math.max(mx / 0.9, my / 0.88) // หุ่นสูง ~88% ของกรอบ อยู่กลางภาพ
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
  if (anat) paintAnatomy(spec.primary, spec.secondary)
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
    const b = bodyBox()
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
  if (anat) AMAT.primary.emissiveIntensity = AMAT.primaryAbs.emissiveIntensity = 0.65 + 0.75 * c
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
  if (anat) {
    paintAnatomy(spec.primary, spec.secondary || [])
    AMAT.primary.emissiveIntensity = 0.55
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
  const focus = spec.focus.includes('body') ? bodyBox() : bodyBox({ groups: spec.focus, side: spec.side || null })
  focus.expandByScalar(spec.pad ?? 0.04)
  frameCamera([focus], spec.az, spec.el)
  renderer.render(scene, camera)
  window.lastFocus = focus.getSize(new THREE.Vector3()).toArray()
  return renderer.domElement.toDataURL('image/png')
}

if (ANATOMY) {
  loadAnatomy()
    .then(() => {
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.32
      // ร่างเงินสะท้อนแสงสูง: bloom เฉพาะจุดที่สว่างจัด (กล้ามเนื้อเรืองแสง) ไม่ให้ทั้งร่างฟุ้ง
      Object.assign(bloom, { threshold: 0.92, strength: 0.6, radius: 0.35 })
      // พื้นหลังเรียบ #0e1a24 ผืนเดียว: ไม่มีเงาพื้น / วงแสงใต้เท้า
      ground.visible = false
      halo.visible = false
      key.intensity = 1.55
      rim.intensity = 1.8
      window.ready = true
    })
    .catch((e) => {
      window.loadError = String(e && e.stack ? e.stack : e)
    })
} else window.ready = true
