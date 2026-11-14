// ฉาก 3D (three.js) สำหรับเรนเดอร์วิดีโอสาธิตท่า — รันใน Chrome headless ผ่าน build-mannequin-videos.mjs
//
// ตัวละคร: ร่างนักกีฬาชายชิ้นเดียวทึบแสง (body.js) — โมเดลต้นฉบับ ไม่ใช้ไฟล์โมเดลภายนอก
//   ผิวทั้งตัว = Procedural Canvas Texture (color + bump) ลายเส้นใยกล้ามเนื้อเทาเงิน #94a3b8 + เส้นเอ็น/พังผืดขาวนวล #e2e8f0 ; มัดเป้าหมายส้มอิฐ #e04f26 (ริ้วยังเห็น) ; กางเกงขาสั้นดำ
//   มือมีนิ้ว 3 ข้อ + นิ้วโป้ง กำอุปกรณ์ได้จริง ; ปลายแขนบิดคว่ำ-หงายผ่าน twist bone 3 ท่อน
// การเคลื่อนไหว: FK + IK สองท่อน 3 มิติ (ทิศศอก/เข่าด้วย pole) ล็อกจุดกำของมือกับอุปกรณ์ ; เท้าวางราบด้วย leg IK ; หลัง/ก้นแนบเบาะ
// พื้นหลัง #0e1a24 เรียบสนิท + High-contrast lighting (ambient ต่ำ + key บนเฉียง + rim #bae6fd) ; กล้อง bounding-box framing 83% ทุกท่า
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { MOTIONS, samplePose, contraction, resolvePose } from './motions.js'
import { JOINTS, handLayout, FINGERS, SEG_FRAC, buildBodyMeshes } from './body.js'

// 600×800 (3:4): การ์ด object-cover / ป๊อปอัปขนาดใหญ่ยังคมชัด
const W = 600
const H = 800
const BG = '#0e1a24'
const rad = THREE.MathUtils.degToRad
const deg = THREE.MathUtils.radToDeg
const norm = (a) => ((((a + 180) % 360) + 360) % 360) - 180
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const X = V(1, 0, 0)
const Y = V(0, 1, 0)
const SIDES = [['L', 0, 1], ['R', 1, -1]] // [ชื่อ, index, ทิศแกน x (ซ้ายของหุ่น = +x)]

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap // เงาเบลอนุ่ม (soft contact shadow)
renderer.toneMapping = THREE.NoToneMapping // พื้นหลังต้องออกมาเป็น #0e1a24 ตรงเป๊ะ
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(BG)
const camera = new THREE.PerspectiveCamera(28, W / H, 0.05, 60)

// High-contrast studio lighting: ambient ต่ำ (ร่องกล้ามเนื้อมืดลึก = cavity) + key light ขาวอุ่นจากมุมบนเฉียงหน้า
// + rim light ขาวอมฟ้า #bae6fd สองข้างจากด้านหลังตัดขอบกล้ามเนื้อให้นูนมีมิติ + fill อ่อนมาก
// ไฟทั้งชุดหมุนตามมุมกล้อง (aimLights) ทุกมุมมองจึงได้แสงแบบเดียวกัน
const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x0e1a24, 0.1)
scene.add(hemi)
const key = new THREE.DirectionalLight(0xfff4ea, 3.1)
scene.add(key)
const rim = new THREE.DirectionalLight(0xbae6fd, 5.5)
scene.add(rim)
const rim2 = new THREE.DirectionalLight(0xbae6fd, 4.0)
scene.add(rim2)
const fill = new THREE.DirectionalLight(0xdbe7f3, 0.22)
scene.add(fill)
// ไฟเงาพื้น: ส่องจากด้านบนตรง ๆ ความสว่าง 0 ใช้สร้างเงาตกกระทบนุ่ม ๆ ใต้ตัว/อุปกรณ์เท่านั้น
const shadowLight = new THREE.DirectionalLight(0xffffff, 0)
shadowLight.position.set(0.15, 6, 0.25)
shadowLight.castShadow = true
shadowLight.shadow.mapSize.set(1024, 1024)
Object.assign(shadowLight.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 9 })
shadowLight.shadow.radius = 12
shadowLight.shadow.blurSamples = 24
shadowLight.shadow.bias = -0.0005
scene.add(shadowLight)
scene.add(shadowLight.target)
function aimLights(az) {
  const at = (light, a, y, r) => light.position.set(Math.sin(rad(a)) * r, y, Math.cos(rad(a)) * r)
  at(key, az + 38, 5.2, 3.6)
  at(fill, az - 80, 1.2, 4)
  at(rim, az + 145, 2.8, 4)
  at(rim2, az - 145, 2.4, 4)
}
aimLights(40)


const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
// พิกเซล NaN/Inf (normal เสื่อมของ mesh ที่ผ่าน skinning บางท่า) ทำให้ bloom เบลอ NaN ไปทั้งภาพ -> เปลี่ยนเป็นพื้นหลัง
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, bg: { value: new THREE.Color(BG) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 bg; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bool bad = any(isnan(c)) || any(isinf(c)); gl_FragColor = bad ? vec4(bg, 1.0) : min(c, vec4(64.0)); }',
}))
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.28, 0.95)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ---------- textures ----------
function canvasTexture(draw, w = 64, h = 128, color = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}
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
// ลายกากเพชร (knurling) บนด้ามจับบาร์/ดัมเบล
const knurlTex = canvasTexture((g, w, h) => {
  g.fillStyle = '#808080'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.2
  for (let i = -h; i < w + h; i += 6) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + h, h)
    g.stroke()
    g.beginPath()
    g.moveTo(i + h, 0)
    g.lineTo(i, h)
    g.stroke()
  }
}, 64, 64, false)

// ---------- materials ----------
// อุปกรณ์: โทนเทาเมทัลลิก (โครงเหล็ก) + ดำด้าน (เบาะ/แผ่นน้ำหนักยาง) + โครเมียม (บาร์/ด้ามจับ)
const MAT = {
  frame: new THREE.MeshStandardMaterial({ color: 0x59626d, roughness: 0.36, metalness: 0.78 }),
  frameDark: new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.45, metalness: 0.65 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd3d9e0, roughness: 0.2, metalness: 1 }),
  knurl: new THREE.MeshStandardMaterial({ color: 0xbfc6ce, roughness: 0.34, metalness: 1, bumpMap: knurlTex, bumpScale: 1.2 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.86, metalness: 0.05 }),
  pad: new THREE.MeshPhysicalMaterial({ color: 0x1b1e23, roughness: 0.58, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.45 }),
  plateRim: new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.62, metalness: 0.3 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x8a949f, roughness: 0.3, metalness: 0.85 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.5, metalness: 0.4 }),
  glove: new THREE.MeshPhysicalMaterial({ color: 0x1f5fa6, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  basketball: new THREE.MeshStandardMaterial({ color: 0xd2662a, roughness: 0.65 }),
  football: new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.55 }),
  racket: new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.3, metalness: 0.7 }),
  string: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.5, transparent: true, opacity: 0.55 }),
}

// ---------- ลายเส้นใยกล้ามเนื้อ (Procedural Canvas Texture) ----------
// texture เดียว 2 ช่อง (ข้อมูล ไม่ใช่สี): R = color map (ความสว่างของมัดเส้นใยย่อย + ร่องพังผืดระหว่างมัด + ใยละเอียด)
//                                       G = bump/height map (มัดเส้นใยโค้งนูน ร่องระหว่างมัดลึก)
// แกน u = รอบแกนเส้นใย (ตั้งฉากเส้นใย) / แกน v = ตามความยาวเส้นใย ; ต่อกันไร้รอยทั้งสองแกน (repeat)
// 1 tile = 15 ซม. (ขวาง) x 36 ซม. (ตามยาว) -> มัดย่อยกว้าง ~1–1.6 ซม. (ร่องพังผืดเข้ม) เห็นเป็นริ้วชัดแม้ในการ์ดเต็มตัว
// + ใยละเอียดในมัด (เห็นเมื่อขยายในป๊อปอัป)
const FIBER_TILE = [0.15, 0.36]
const fiberTex = (() => {
  const w = 512
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const img = g.createImageData(w, h)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // ขอบเขตมัดเส้นใยย่อย (fascicle) ตามแกน u: กว้างสุ่ม ผลรวม = w พอดี (ต่อกันไร้รอย)
  const widths = []
  let sum = 0
  while (sum < w - 30) {
    const bw = 34 + rnd() * 22
    widths.push(bw)
    sum += bw
  }
  const k = w / sum
  const edges = [0]
  for (const bw of widths) edges.push(edges[edges.length - 1] + bw * k)
  const nb = widths.length
  const bright = widths.map(() => 0.82 + rnd() * 0.36)
  const phase = widths.map(() => rnd() * Math.PI * 2)
  const fineN = widths.map(() => 5 + Math.floor(rnd() * 4))
  // ความคดเล็กน้อยของมัดตามยาว (คาบเต็มรอบใน tile -> ต่อกันไร้รอย)
  const wob = (y, b) => Math.sin((y / h) * Math.PI * 2 * 2 + phase[b]) * 2.2 + Math.sin((y / h) * Math.PI * 2 * 5 + phase[b] * 1.7) * 0.9
  const TAU = Math.PI * 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // หา fascicle ที่พิกเซลนี้อยู่ (ขอบเลื่อนตามความคด)
      let b = 0
      while (b < nb - 1 && x >= edges[b + 1] + wob(y, b + 1)) b++
      const x0 = edges[b] + wob(y, b)
      const x1 = edges[b + 1] + wob(y, (b + 1) % nb)
      const t = Math.min(1, Math.max(0, (x - x0) / Math.max(1, x1 - x0)))
      const prof = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) // หน้าตัดโค้งนูนของมัด
      const fine = Math.sin(t * TAU * fineN[b] + phase[b]) * 0.5 + 0.5 // ใยละเอียดในมัด
      const along = 0.92 + 0.08 * Math.sin((y / h) * TAU * 3 + phase[b] * 2.3) // ความสว่างแปรตามยาว
      const edge = Math.pow(prof, 0.55) // ร่องพังผืดระหว่างมัด (เข้มชัด)
      const lum = Math.min(1, Math.max(0, (0.1 + 0.72 * edge * bright[b] * along) * (0.88 + 0.12 * fine)))
      const hgt = Math.min(1, Math.max(0, 0.05 + 0.82 * Math.pow(prof, 0.7) + 0.1 * fine * prof))
      const i = (y * w + x) * 4
      img.data[i] = lum * 255
      img.data[i + 1] = hgt * 255
      img.data[i + 2] = 0
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
})()

// ผิวร่างกาย (ทึบ 100%): ลายเส้นใยกล้ามเนื้อเทาเงิน #94a3b8 (color + bump จาก fiberTex) + เส้นเอ็น/พังผืดขาวนวล #e2e8f0
// มัดเป้าหมาย = ส้มอิฐ #e04f26 ผสมลายเส้นใย (ริ้วเข้มยังเห็นใต้สีส้ม ไม่ทึบแบน) ; กางเกงขาสั้นดำด้าน
const BODY_U = {
  uSilver: { value: new THREE.Color(0x94a3b8) },
  uTendon: { value: new THREE.Color(0xe2e8f0) },
  uTarget: { value: new THREE.Color(0xe04f26) },
  uShorts: { value: new THREE.Color(0x111317) },
  uGlow: { value: 0.1 },
  uFiber: { value: fiberTex },
  uFiberScale: { value: new THREE.Vector2(1 / FIBER_TILE[0], 1 / FIBER_TILE[1]) },
  uBump: { value: 0.0032 },
}
function bodyMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.16, clearcoat: 0.1, clearcoatRoughness: 0.6, side: THREE.FrontSide })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, BODY_U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aU; attribute float aV; attribute float aFib; attribute float aTendon; attribute float aGroove; attribute float aShorts; attribute float aTarget;
varying float vU; varying float vV; varying float vFib; varying float vTendon; varying float vGroove; varying float vShorts; varying float vTarget;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vU = aU; vV = aV; vFib = aFib; vTendon = aTendon; vGroove = aGroove; vShorts = aShorts; vTarget = aTarget;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uSilver; uniform vec3 uTendon; uniform vec3 uTarget; uniform vec3 uShorts; uniform float uGlow;
uniform sampler2D uFiber; uniform vec2 uFiberScale; uniform float uBump;
varying float vU; varying float vV; varying float vFib; varying float vTendon; varying float vGroove; varying float vShorts; varying float vTarget;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 fx = texture2D(uFiber, vec2(vU, vV) * uFiberScale);
float fib = vFib * (1.0 - vShorts);
float tend = clamp(vTendon, 0.0, 1.0) * (1.0 - vShorts);
vec3 base = mix(uSilver, uTarget, vTarget);
// color map: ริ้วมัดเส้นใย (เป้าหมายเข้มกว่าเล็กน้อย -> เห็นริ้วสีเข้มใต้สีส้มอิฐ)
float strip = mix(1.0, 0.38 + 0.95 * fx.r, fib * mix(0.9, 1.0, vTarget));
base *= strip;
// เส้นเอ็น/พังผืด: ขาวนวลมีริ้วจาง ๆ ตามแนวเส้นใย
base = mix(base, uTendon * (0.86 + 0.18 * fx.r), tend);
// ร่องลึกระหว่างมัด (cavity)
base *= 1.0 - 0.62 * vGroove * (1.0 - vShorts);
// กางเกง: ผ้าดำด้าน ; ถ้าคลุมมัดเป้าหมาย (เช่นก้น) ผ้าเป็นสีส้มอิฐ ให้เห็นว่ามัดนั้นทำงาน
vec3 cloth = mix(uShorts, uTarget * 0.8, vTarget * 0.85);
base = mix(base, cloth, vShorts);
diffuseColor.rgb = base;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // bump map จาก fiberTex.g : มัดเส้นใยนูน ร่องระหว่างมัดลึก (เส้นเอ็นเรียบกว่า)
  float hgt = (fx.g - 0.5) * uBump * fib * (1.0 - 0.7 * tend);
  vec3 dpdx = dFdx(-vViewPosition); vec3 dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(hgt); float dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, normal); vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 nb = normalize(abs(det) * normal - grad);
  if (all(equal(nb, nb))) normal = nb;
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uTarget * vTarget * uGlow * (0.55 + 0.6 * fx.r);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.48, tend);
roughnessFactor = mix(roughnessFactor, 0.88, vShorts);
roughnessFactor += (0.5 - fx.g) * 0.12 * fib;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, max(vShorts, vTarget * 0.85));`)
  }
  return mat
}

// ---------- ฉากพื้น ----------
// พื้นล่องหน: รับแค่เงาตกกระทบนุ่ม ๆ ใต้ตัว (สีเข้ม ไม่มีวง/แท่น) พื้นหลังเป็น #0e1a24 เรียบสนิท
const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.4 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ======================================================================
// ร่างกาย (mesh ชิ้นเดียวจาก body.js) + rig
// ======================================================================
const J = {} // joints (THREE.Bone)
const BIND = {} // ตำแหน่งโลกของข้อต่อในท่า bind (rotation = identity ทุกข้อ)
const body = new THREE.Group()
scene.add(body)
const L = {} // ความยาวท่อน
const HAND = {} // ข้อมูลมือ: จุดกำ / จุดฝ่ามือ / นิ้ว
const FORE_AXIS = {} // แกนบิดปลายแขน (ข้อศอก -> ข้อมือ)
let anat = null

function buildRig() {
  const S = {}
  for (const [k, p] of Object.entries(JOINTS)) S[k] = V(...p)
  const mkJ = (name, parent, p, pp, order = 'XYZ') => {
    const g = new THREE.Bone()
    g.name = name
    g.rotation.order = order
    g.position.copy(p).sub(pp)
    parent.add(g)
    J[name] = g
    BIND[name] = p.clone()
    return g
  }
  mkJ('root', body, S.hip, V())
  mkJ('spine', J.root, S.l5, S.hip)
  mkJ('chest', J.spine, S.t12, S.l5)
  mkJ('neck', J.chest, S.c7, S.t12)
  for (const [n] of SIDES) {
    const e = S[`elbow${n}`]
    const w = S[`wrist${n}`]
    const a = e.clone().lerp(w, 1 / 3)
    const b = e.clone().lerp(w, 2 / 3)
    mkJ(`shoulder${n}`, J.chest, S[`shoulder${n}`], S.t12, 'YXZ')
    mkJ(`uroll${n}`, J[`shoulder${n}`], S[`shoulder${n}`], S[`shoulder${n}`])
    mkJ(`elbow${n}`, J[`uroll${n}`], e, S[`shoulder${n}`])
    // twist bone 3 ท่อน แบ่งมุมคว่ำ-หงายมือเท่า ๆ กัน: ปลายแขนบิดนุ่มไม่ยุบ
    mkJ(`tw1${n}`, J[`elbow${n}`], a, e)
    mkJ(`tw2${n}`, J[`tw1${n}`], b, a)
    mkJ(`hand${n}`, J[`tw2${n}`], w, b) // ข้อต่อมือ = ข้อมือ
    FORE_AXIS[n] = w.clone().sub(e).normalize()
    mkJ(`hip${n}`, J.root, S[`hip${n}`], S.hip, 'YXZ')
    mkJ(`knee${n}`, J[`hip${n}`], S[`knee${n}`], S[`hip${n}`])
    mkJ(`ankle${n}`, J[`knee${n}`], S[`ankle${n}`], S[`knee${n}`])
    // นิ้ว: ข้อ MCP / PIP / DIP (นิ้วโป้ง CMC / MCP / IP)
    const h = handLayout(n)
    HAND[n] = { fingers: h.fingers, mcp: h.mcp, dir: h.dir, palmN: h.palmN, grip: h.grip.clone().sub(w), palm: h.palm.clone().sub(w), joints: {} }
    for (const f of [...FINGERS, 'thumb']) {
      const { base, axis, len, spread } = h.fingers[f]
      let flex
      if (f === 'thumb') {
        // นิ้วโป้งพับเข้าหาจุดกำ (อ้อมด้ามจับด้านตรงข้ามนิ้วทั้งสี่)
        const toGrip = h.grip.clone().sub(base)
        const side = toGrip.addScaledVector(axis, -toGrip.dot(axis)).normalize()
        flex = V().crossVectors(axis, side).normalize()
      } else flex = V().crossVectors(axis, h.palmN).normalize()
      const chain = []
      let parent = J[`hand${n}`]
      let pp = w
      let p = base.clone()
      SEG_FRAC[f === 'thumb' ? 'thumb' : 'finger'].forEach((frac, k) => {
        const j = mkJ(`${n}:${f}:${k}`, parent, p, pp)
        const q = p.clone().addScaledVector(axis, len * frac)
        BIND[`${n}:${f}:${k}:end`] = q
        chain.push(j)
        parent = j
        pp = p
        p = q
      })
      HAND[n].joints[f] = { chain, flex, spread }
    }
  }
  body.updateMatrixWorld(true)
  L.uarm = S.shoulderL.distanceTo(S.elbowL)
  L.farm = S.elbowL.distanceTo(S.wristL)
  L.thigh = S.hipL.distanceTo(S.kneeL)
  L.shin = S.kneeL.distanceTo(S.ankleL)
  L.ankleY = S.ankleL.y // ความสูงข้อเท้าเมื่อเท้าวางราบ (ฝ่าเท้า y = 0)
  L.hipY = S.hip.y
  L.shoulderW = S.shoulderL.x

  // ---- โครงกระดูกสำหรับ skinning + ช่วงของแต่ละท่อน ----
  const up = (p, d) => p.clone().add(V(0, d, 0))
  const BONES = { root: [J.root, S.hip, S.l5], spine: [J.spine, S.l5, S.t12], chest: [J.chest, S.t12, S.c7], neck: [J.neck, S.c7, up(S.c7, 0.25)] }
  const RADIUS = { root: 0.1, spine: 0.11, chest: 0.13, neck: 0.04 }
  const ALLOW = { head: ['neck'], neck: ['neck', 'chest'], chest: ['chest', 'spine', 'neck'], abdomen: ['spine', 'root', 'chest'], pelvis: ['root', 'spine', 'thighL', 'thighR'] }
  for (const [n] of SIDES) {
    const e = S[`elbow${n}`]
    const w = S[`wrist${n}`]
    BONES[`arm${n}`] = [J[`uroll${n}`], S[`shoulder${n}`], e]
    BONES[`fore${n}`] = [J[`elbow${n}`], e, e.clone().lerp(w, 1 / 3)]
    BONES[`tw1${n}`] = [J[`tw1${n}`], e.clone().lerp(w, 1 / 3), e.clone().lerp(w, 2 / 3)]
    BONES[`tw2${n}`] = [J[`tw2${n}`], e.clone().lerp(w, 2 / 3), w]
    BONES[`hand${n}`] = [J[`hand${n}`], w, HAND[n].mcp]
    BONES[`thigh${n}`] = [J[`hip${n}`], S[`hip${n}`], S[`knee${n}`]]
    BONES[`shin${n}`] = [J[`knee${n}`], S[`knee${n}`], S[`ankle${n}`]]
    BONES[`foot${n}`] = [J[`ankle${n}`], S[`ankle${n}`], S[`toe${n}`]]
    Object.assign(RADIUS, { [`arm${n}`]: 0.03, [`fore${n}`]: 0.028, [`tw1${n}`]: 0.026, [`tw2${n}`]: 0.022, [`hand${n}`]: 0.02, [`thigh${n}`]: 0.05, [`shin${n}`]: 0.04, [`foot${n}`]: 0.03 })
    Object.assign(ALLOW, {
      [`${n}shoulder`]: ['chest', `arm${n}`, 'neck'],
      [`${n}upperarm`]: [`arm${n}`, `fore${n}`, 'chest'],
      [`${n}forearm`]: [`fore${n}`, `tw1${n}`, `tw2${n}`, `hand${n}`, `arm${n}`],
      [`${n}hand`]: [`hand${n}`, `tw2${n}`, `tw1${n}`],
      [`${n}thigh`]: [`thigh${n}`, 'root', `shin${n}`],
      [`${n}shin`]: [`shin${n}`, `thigh${n}`, `foot${n}`],
      [`${n}foot`]: [`foot${n}`, `shin${n}`],
    })
    for (const f of [...FINGERS, 'thumb']) {
      for (let k = 0; k < 3; k++) {
        const key = `${n}:${f}:${k}`
        BONES[key] = [J[key], BIND[key], BIND[`${key}:end`]]
        RADIUS[key] = 0.006
        ALLOW[key] = [key, k === 0 ? `hand${n}` : `${n}:${f}:${k - 1}`].concat(k < 2 ? [`${n}:${f}:${k + 1}`] : [])
      }
    }
  }
  const names = Object.keys(BONES)
  const skeleton = new THREE.Skeleton(names.map((k) => BONES[k][0]))
  skeleton.calculateInverses()
  const segDist = (q, a, b) => {
    const ab = V().subVectors(b, a)
    const t = clamp(V().subVectors(q, a).dot(ab) / ab.lengthSq(), 0, 1)
    return q.distanceTo(a.clone().addScaledVector(ab, t))
  }

  // ---- ผิวร่างกาย (ลำตัว+ศีรษะ+กางเกง / แขน / ขา ซ้อนกันเป็นร่างเดียว) ----
  const allowIdx = {}
  for (const [k, list] of Object.entries(ALLOW)) allowIdx[k] = list.map((b) => names.indexOf(b))
  const material = bodyMaterial()
  const samples = []
  const meshes = []
  const stats = []
  const p = V()
  for (const { layer, geometry: geo, vReg, vGroup, stats: st } of buildBodyMeshes()) {
    // อก/ปีกหลังในชั้นลำตัวไม่ถูกแขนดึง (ไม่เกิดแผ่นยืดตอนยกแขน) ; หมวกไหล่ (deltoid) ในชั้นแขนปิดรอยต่อ
    const regAllow = (r) => (layer === 'body' && /^[LR]shoulder$/.test(r) ? allowIdx.chest : layer !== 'body' && /^[LR]shoulder$/.test(r) ? [names.indexOf('arm' + r[0]), names.indexOf('chest')] : allowIdx[r] || allowIdx.chest)
    stats.push({ layer, ...st })
    const pos = geo.attributes.position
    const nv = pos.count
    const si = new Uint16Array(nv * 4)
    const sw = new Float32Array(nv * 4)
    for (let i = 0; i < nv; i++) {
      p.fromBufferAttribute(pos, i)
      const allow = regAllow(vReg[i])
      // น้ำหนักตามระยะถึงผิวของแต่ละท่อน (ยกกำลัง 4 + เผื่อ) ; นิ้วใช้ระยะเผื่อเล็กให้ข้อนิ้วพับคม
      const soft = vReg[i].includes(':') ? 0.004 : 0.02
      const ws = allow.map((b) => [b, 1 / (Math.max(0, segDist(p, BONES[names[b]][1], BONES[names[b]][2]) - RADIUS[names[b]]) + soft) ** 4])
      ws.sort((x, y) => y[1] - x[1])
      const top = ws.slice(0, 4)
      const tot = top.reduce((x, y) => x + y[1], 0)
      top.forEach(([bi, w], k) => {
        si[i * 4 + k] = bi
        sw[i * 4 + k] = w / tot
      })
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    const mesh = new THREE.SkinnedMesh(geo, material)
    mesh.bind(skeleton, new THREE.Matrix4())
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    scene.add(mesh)
    meshes.push({ mesh, geo, vGroup })
    // จุดตัวอย่างบนผิว (ยึดพื้น / หาจุดสัมผัสเบาะ / จัดเฟรมกล้อง)
    for (let i = 0; i < nv; i += 7) {
      const region = vReg[i]
      const side = region[0] === 'L' || region[0] === 'R' ? region[0] : ''
      const arm = /hand|forearm|upperarm|:/.test(region)
      const torso = /^(chest|abdomen|pelvis|neck|[LR]shoulder)$/.test(region)
      // จุดนั่ง: ก้น + ต้นขาส่วนบน (ใกล้สะโพก)
      const seat = region === 'pelvis' || (/^[LR]thigh$/.test(region) && pos.getY(i) > L.hipY - 0.2)
      samples.push({ mesh, i, group: vGroup[i], region, side, arm, torso, seat })
    }
  }
  window.bodyStats = stats
  anat = { meshes, samples }

}

const samplePos = (s, out) => {
  out.fromBufferAttribute(s.mesh.geometry.attributes.position, s.i)
  return s.mesh.applyBoneTransform(s.i, out)
}

// องศางอนิ้วต่อข้อเมื่อ curl = 1 (กำด้ามจับ ~3 ซม.) ; นิ้วที่กางในท่า bind หุบเข้าหากันเมื่อกำ
const CURL = { finger: [62, 92, 52], thumb: [24, 38, 42] }
const SPREAD_W = { index: 1, middle: 0.3, ring: -0.4, little: -1 }
function setCurl(n, g, spread = 0) {
  const h = HAND[n]
  for (const f of [...FINGERS, 'thumb']) {
    const { chain, flex, spread: s0 } = h.joints[f]
    const a = CURL[f === 'thumb' ? 'thumb' : 'finger']
    chain.forEach((j, k) => j.quaternion.setFromAxisAngle(flex, rad(a[k] * g)))
    if (f !== 'thumb') {
      const add = -s0 * clamp(g, 0, 1) * 0.85 + spread * SPREAD_W[f] * (n === 'L' ? 1 : -1)
      chain[0].quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(h.palmN, rad(add)))
    }
  }
}

// ---------- ระบายสีกล้ามเนื้อเป้าหมาย ----------
// primary = ส้ม-แดงเต็ม #ea580c ; secondary = ส้มอ่อนลง (ยังเป็นสีไฮไลต์) ; ที่เหลือ = เทาเงิน
function paintAnatomy(primary, secondary = []) {
  const all = primary.includes('fullbody')
  for (const { geo, vGroup } of anat.meshes) {
    const arr = geo.attributes.aTarget.array
    for (let i = 0; i < arr.length; i++) {
      const g = vGroup[i]
      arr[i] = g === 'base' ? 0 : all || primary.includes(g) ? 1 : secondary.includes(g) ? 0.62 : 0
    }
    geo.attributes.aTarget.needsUpdate = true
  }
}

// ======================================================================
// การจัดท่า
// ======================================================================
const wp = (o) => o.getWorldPosition(V())
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion())
let M = null // motion ปัจจุบัน
// แกนบิดปลายแขน: หมุน tw1 / tw2 / มือ ข้อละ 1/3 ของมุม (องศา ; 0 = หงายมือแบบกายวิภาค, + = คว่ำมือ)
function setPron(n, m, pronDeg) {
  const a = rad(pronDeg * m) / 3
  const ax = FORE_AXIS[n]
  J[`tw1${n}`].quaternion.setFromAxisAngle(ax, a)
  J[`tw2${n}`].quaternion.setFromAxisAngle(ax, a)
  J[`hand${n}`].quaternion.setFromAxisAngle(ax, a)
}

// FK จากมุมในระนาบด้านข้าง (ดูคำอธิบายใน motions.js)
function setAngles(o) {
  J.root.rotation.set(rad(o.pelvis), rad(o.pelvisYaw), rad(o.pelvisRoll))
  J.spine.rotation.set(rad(norm(o.spine - o.pelvis)), rad(o.spineTwist), 0)
  J.chest.rotation.set(rad(norm(o.chest - o.spine)), rad(o.chestTwist), rad(o.chestSide))
  J.neck.rotation.set(rad(norm(o.head - o.chest)), rad(o.headTurn), 0)
  for (const [n, s, m] of SIDES) {
    J[`shoulder${n}`].rotation.set(rad(norm(o.uarm[s] - o.chest)), m * rad(o.uarmT[s]), m * rad(o.uarmA[s]))
    J[`uroll${n}`].rotation.set(0, m * rad(o.uarmRoll[s]), 0)
    const elbow = o.elbowR[s] ?? clamp(norm(o.farm[s] - o.uarm[s]), -150, 0)
    J[`elbow${n}`].rotation.set(rad(clamp(elbow, -150, 0)), 0, 0)
    setPron(n, m, o.pron[s])
    J[`hip${n}`].rotation.set(rad(norm(o.thigh[s] - o.pelvis)), m * rad(o.thighT[s]), m * rad(o.thighA[s]))
    J[`knee${n}`].rotation.set(rad(clamp(norm(o.shin[s] - o.thigh[s]), 0, 155)), 0, 0)
    J[`ankle${n}`].rotation.set(rad(norm(o.foot[s] - o.shin[s])), 0, 0)
    setCurl(n, o.curl[s], o.spread[s])
  }
  J.root.position.set(o.x, L.hipY + o.y, o.z)
  if (o.hip) J.root.position.set(o.x, o.hip[0], o.hip[1])
  body.updateMatrixWorld(true)
}

// ---- IK สองท่อนแบบ 3 มิติ ----
// upper: ข้อต่อต้น (หมุนอิสระ) ; mid: ข้อพับ (หมุนรอบแกน x ของตัวเอง) ; endBind: ตำแหน่ง bind ของปลายท่อน
// target: ตำแหน่งโลกที่ต้องการ ; pole: ทิศโลกที่ข้อพับ (ศอก/เข่า) ควรชี้ ; range: ช่วงมุมพับ (องศา)
function solveLimb(upper, mid, upperB, midB, endB, target, pole, range) {
  const a0 = V().subVectors(midB, upperB)
  const c0 = V().subVectors(endB, midB)
  const S = wp(upper)
  const T = V().subVectors(target, S)
  const want = T.length()
  // หามุมพับที่ทำให้ระยะต้น -> ปลาย เท่าระยะเป้า (ค้นหาละเอียด 1° แล้วประมาณเชิงเส้น)
  const reach = (th) => a0.clone().add(c0.clone().applyAxisAngle(X, rad(th))).length()
  let best = range[0]
  let err = Infinity
  for (let th = range[0]; th <= range[1]; th += 1) {
    const e = Math.abs(reach(th) - want)
    if (e < err) [err, best] = [e, th]
  }
  for (const step of [0.5, 0.25, 0.1, 0.05]) {
    for (const th of [best - step, best + step]) {
      if (th < range[0] || th > range[1]) continue
      const e = Math.abs(reach(th) - want)
      if (e < err) [err, best] = [e, th]
    }
  }
  mid.quaternion.setFromAxisAngle(X, rad(best))
  const endL = a0.clone().add(c0.clone().applyAxisAngle(X, rad(best)))
  // หมุนให้ปลายชี้เป้า แล้วบิดรอบแกนต้น -> เป้า ให้ข้อพับชี้ไปทาง pole
  const Tn = T.clone().normalize()
  const q1 = new THREE.Quaternion().setFromUnitVectors(endL.clone().normalize(), Tn)
  const e1 = a0.clone().applyQuaternion(q1)
  const perp = (v) => v.clone().addScaledVector(Tn, -v.dot(Tn))
  const ep = perp(e1)
  const pp = perp(pole)
  let q = q1
  if (ep.lengthSq() > 1e-10 && pp.lengthSq() > 1e-10) {
    ep.normalize()
    pp.normalize()
    const ang = Math.atan2(V().crossVectors(ep, pp).dot(Tn), ep.dot(pp))
    q = new THREE.Quaternion().setFromAxisAngle(Tn, ang).multiply(q1)
  }
  const parentQ = wq(upper.parent)
  upper.quaternion.copy(parentQ.invert().multiply(q))
  upper.updateMatrixWorld(true)
}

// วางมือให้แกนข้างมือขนานด้ามจับ (A) : เลือกมุมบิดปลายแขนที่ใกล้ hint (คว่ำ/หงาย) แล้วข้อมือแก้มุมที่เหลือ
// palmN (ถ้ามี) = ทิศฝ่ามือที่ต้องการ (เช่น วางฝ่ามือราบกับพื้น)
// palm (วางมือราบ/ประกบ): A = ทิศปลายนิ้ว, palmN = ทิศฝ่ามือ -> กำหนดเฟรมมือเต็ม ; เลือกมุมบิดปลายแขนที่ทำให้ข้อมือหมุนน้อยสุด
const PRON_RANGE = [-35, 195] // ช่วงคว่ำ-หงายที่ทำได้จริง (รวมการหมุนต้นแขนเล็กน้อย)
function orientHand(n, m, A, pronHint, palmN = null, palmHint = null) {
  const elbow = J[`elbow${n}`]
  const hand = J[`hand${n}`]
  setPron(n, m, 0)
  elbow.updateMatrixWorld(true)
  const qe = wq(elbow)
  const f = FORE_AXIS[n].clone().applyQuaternion(qe)
  const hint = rad(pronHint * m)
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  const inRange = (th) => {
    const p = deg(th) * m
    return p >= PRON_RANGE[0] && p <= PRON_RANGE[1]
  }
  if (palmN) {
    // เฟรมมือที่ต้องการ: Z = ฝ่ามือ, Y = ทิศข้อมือ (ตรงข้ามปลายนิ้ว), X = Y × Z
    const zd = palmN.clone().normalize()
    const fing = (A || f).clone()
    const yd = fing.addScaledVector(zd, -fing.dot(zd)).normalize().negate()
    const xd = V().crossVectors(yd, zd).normalize()
    const zb = HAND[n].palmN.clone().addScaledVector(X, -HAND[n].palmN.dot(X)).normalize()
    const mb = new THREE.Matrix4().makeBasis(X, V().crossVectors(zb, X), zb)
    const md = new THREE.Matrix4().makeBasis(xd, yd, zd)
    const qd = new THREE.Quaternion().setFromRotationMatrix(md.multiply(mb.transpose()))
    let best = 0
    let cost = Infinity
    for (let a = -180; a < 180; a += 4) {
      const th = rad(a)
      const qr = new THREE.Quaternion().setFromAxisAngle(f, th).multiply(qe)
      const c = qr.angleTo(qd) + 0.15 * Math.abs(wrap(th - hint)) + (inRange(th) ? 0 : 3)
      if (c < cost) [cost, best] = [c, th]
    }
    setPron(n, m, deg(best) * m)
    hand.updateMatrixWorld(true)
    hand.quaternion.copy(wq(hand.parent).invert().multiply(qd)) // ข้อมือรับส่วนที่เหลือ
    hand.updateMatrixWorld(true)
    return
  }
  let th = hint
  if (A) {
    const X1 = X.clone().applyQuaternion(qe)
    const proj = (v) => v.clone().addScaledVector(f, -v.dot(f))
    const ap = proj(A)
    const xp = proj(X1)
    if (ap.lengthSq() > 1e-8) {
      const th0 = Math.atan2(V().crossVectors(xp, ap).dot(f), xp.dot(ap))
      // palmHint (ทิศฝ่ามือโดยประมาณ) ตัดสินคำตอบที่กำกวม (ฝ่ามือหน้า/หลัง) ได้มั่นคงกว่ามุม pron
      const Z1 = HAND[n].palmN.clone().applyQuaternion(qe)
      const dist = (c) => (palmHint ? -Z1.clone().applyAxisAngle(f, c).dot(palmHint) * 4 : 0) + Math.abs(wrap(c - hint)) * (palmHint ? 0.05 : 1) + (inRange(c) ? 0 : 10)
      th = [th0, th0 + Math.PI, th0 - Math.PI, th0 + 2 * Math.PI, th0 - 2 * Math.PI].reduce((b, c) => (dist(c) < dist(b) ? c : b))
    }
  }
  setPron(n, m, deg(th) * m)
  hand.updateMatrixWorld(true)
  if (!A) return
  // ข้อมือ: หมุนน้อยที่สุดให้แกนข้างมือขนานด้ามจับ
  const qh = wq(hand)
  const Xh = X.clone().applyQuaternion(qh)
  const xd = A.clone().multiplyScalar(Math.sign(Xh.dot(A)) || 1)
  const qd = new THREE.Quaternion().setFromUnitVectors(Xh, xd).multiply(qh)
  hand.quaternion.copy(wq(hand.parent).invert().multiply(qd))
  hand.updateMatrixWorld(true)
}

const gripWorld = (n, contact = 'grip') => J[`hand${n}`].localToWorld(HAND[n][contact].clone())
const mirror = (v, m) => V(v[0] * m, v[1], v[2])
function chestPoint(v) {
  return J.chest.localToWorld(V(...v))
}
// พิกัดเป้าหมายของมือ: world | chest (เทียบข้อต่ออก T12 หมุนตามลำตัว) | root (เทียบสะโพก)
function spacePoint(space, v) {
  if (space === 'chest') return chestPoint(v)
  if (space === 'root') return J.root.localToWorld(V(...v))
  if (space === 'neck') return J.neck.localToWorld(V(...v))
  return V(...v)
}
function spaceDir(space, v) {
  const d = V(...v).normalize()
  if (space === 'chest') return d.applyQuaternion(wq(J.chest))
  if (space === 'root') return d.applyQuaternion(wq(J.root))
  return d
}

// เป้าหมายมือของเฟรมนี้: { L: {at, axis, contact}, R: ... } หรือ null
function handTargets(o) {
  const out = {}
  if (o.bar) {
    // บาร์เบล / บาร์ยาว: จุดกึ่งกลาง [y, z] (+x) ; มือจับห่างกึ่งกลาง gw ; แกนบาร์ตามแนว x ของพื้นที่นั้น
    const sp = M.barSpace || 'world'
    const c = o.bar.length === 3 ? o.bar : [0, o.bar[0], o.bar[1]]
    const pl = spacePoint(sp, [c[0] + o.gw, c[1], c[2]])
    const pr = spacePoint(sp, [c[0] - o.gw, c[1], c[2]])
    const axis = pl.clone().sub(pr).normalize()
    const ph = (s, m) => (o.palmHint[s] ? spaceDir(M.axisSpace || 'world', mirror(o.palmHint[s], m)) : null)
    out.L = { at: pl, axis, contact: 'grip', palmHint: ph(0, 1) }
    out.R = { at: pr, axis, contact: 'grip', palmHint: ph(1, -1) }
    return out
  }
  for (const [n, s, m] of SIDES) {
    if (!o.grip[s]) continue
    const sp = o.gripSpace || M.gripSpace || 'world'
    const at = spacePoint(sp, mirror(o.grip[s], m))
    const axis = o.gripAxis ? spaceDir(M.axisSpace || 'world', mirror(o.gripAxis, m)) : null
    out[n] = { at, axis, palmHint: o.palmHint[s] ? spaceDir(M.axisSpace || 'world', mirror(o.palmHint[s], m)) : null, contact: o.palm[s] ? 'palm' : 'grip', palmN: o.palm[s] ? spaceDir(M.axisSpace || 'world', mirror(o.palm[s], m)) : null }
  }
  return out
}

function armIK(o) {
  const T = handTargets(o)
  for (const [n, s, m] of SIDES) {
    const t = T[n]
    if (!t) continue
    const poleV = o.pole[s] ? spaceDir(M.poleSpace || 'chest', mirror(o.pole[s], m)) : spaceDir('chest', [m * 0.6, -0.4, -0.7])
    J[`uroll${n}`].quaternion.identity()
    // เดาเริ่ม: จุดกำอยู่เลยข้อมือไป ~10 ซม. ตามแนวไหล่ -> เป้า
    const S0 = wp(J[`shoulder${n}`])
    let Ht = t.at.clone().addScaledVector(t.at.clone().sub(S0).normalize(), t.contact === 'palm' ? -0.04 : -0.1)
    // ปรับเป้าข้อมือแบบหน่วง (damped) + จำคำตอบที่ดีที่สุด: ทิศมือขึ้นกับตำแหน่งข้อมือ จึงไม่แกว่งไปมา
    const solve = (H) => {
      solveLimb(J[`shoulder${n}`], J[`elbow${n}`], BIND[`shoulder${n}`], BIND[`elbow${n}`], BIND[`hand${n}`], H, poleV, [-160, 0])
      orientHand(n, m, t.axis, o.pron[s], t.palmN, t.palmHint)
      if (o.wrist[s]) {
        // เหยียดข้อมือ (หลังมือเข้าหาปลายแขน) เช่น ท่า front rack ; แกนข้างมือคงเดิม -> ยังขนานด้ามจับ
        const h = J[`hand${n}`]
        h.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(X, rad(o.wrist[s])))
        h.updateMatrixWorld(true)
      }
      return t.at.clone().sub(gripWorld(n, t.contact))
    }
    let best = { e: Infinity, H: Ht.clone(), err: V() }
    let k = 1
    for (let it = 0; it < 24; it++) {
      const err = solve(Ht)
      const e = err.length()
      if (window.__trace) window.__trace.push([n, it, +e.toFixed(4)])
      if (e < best.e) best = { e, H: Ht.clone(), err }
      else k *= 0.5
      if (best.e < 3e-4 || k < 0.01) break
      Ht = best.H.clone().addScaledVector(best.err, k)
    }
    solve(best.H)
    if (window.__trace) window.__trace.push([n, 'final', +best.e.toFixed(4)])
  }
}

// ---- เท้า: leg IK ไปยังจุดข้อเท้าที่กำหนด + วางเท้าราบ (หรือเอียงตาม footPitch) หมุนปลายเท้าออกตาม toe ----
function legIK(o) {
  for (const [n, s, m] of SIDES) {
    if (!o.ft[s]) continue
    const target = spacePoint(M.footSpace || 'world', mirror(o.ft[s], m))
    const toe = o.toe[s]
    const fwd = V(Math.sin(rad(toe)) * m, 0, Math.cos(rad(toe)))
    const pole = o.kneeP[s] ? V(...mirror(o.kneeP[s], m)).normalize() : fwd.clone()
    solveLimb(J[`hip${n}`], J[`knee${n}`], BIND[`hip${n}`], BIND[`knee${n}`], BIND[`ankle${n}`], target, pole, [0, 155])
    // เท้า: ทิศปลายเท้าในโลก = หมุนรอบแกนตั้ง toe องศา จากทิศ bind ; เอียงตาม footPitch (+ = ปลายเท้าชี้ลง/ยกส้น)
    const qd = new THREE.Quaternion().setFromAxisAngle(Y, rad(toe) * m)
    if (o.footPitch[s]) {
      const side = X.clone().applyQuaternion(qd)
      qd.premultiply(new THREE.Quaternion().setFromAxisAngle(side, rad(o.footPitch[s])))
    }
    if (o.footRoll[s]) qd.premultiply(new THREE.Quaternion().setFromAxisAngle(fwd, rad(o.footRoll[s]) * m))
    const ankle = J[`ankle${n}`]
    ankle.quaternion.copy(wq(ankle.parent).invert().multiply(qd))
    ankle.updateMatrixWorld(true)
  }
}

// กล่องครอบร่างกายหลังจัดท่า (จุดตัวอย่างที่ผ่าน skinning)
function bodyBox({ skipArms = false, groups = null, side = null, filter = null } = {}) {
  const box = new THREE.Box3()
  const p = V()
  for (const s of anat.samples) {
    if (skipArms && s.arm) continue
    if (groups && !groups.includes(s.group)) continue
    if (side && s.side !== side) continue
    if (filter && !filter(s)) continue
    box.expandByPoint(samplePos(s, p))
  }
  return box
}
// ระยะต่ำสุดของจุดผิว (ชุด torso / seat) ถึงระนาบ n·p = d
function minPlaneDist(set, nrm, d) {
  let min = Infinity
  const p = V()
  for (const s of anat.samples) {
    if (!s[set]) continue
    min = Math.min(min, samplePos(s, p).dot(nrm) - d)
  }
  return min
}

// ยึดตัว: feet/ground = จุดต่ำสุดแตะพื้น ; contact = หลัง/ก้นแนบระนาบเบาะ (แก้ตำแหน่งสะโพก) ; fixed = ตามคีย์
// ระนาบสัมผัสของเฟรมนี้ ; edge = ขอบม้านั่ง [y, z]: ระนาบผ่านขอบ ตั้งฉากกับแนวหลัง (สะบักพาดขอบ หมุนรอบขอบได้)
function contactPlanes() {
  return (M.contact || []).map((c) => {
    if (!c.edge) return { ...c, n: V(...c.n).normalize() }
    const nrm = V(0, 0, 1).applyQuaternion(wq(J.chest)).setX(0).normalize()
    return { ...c, n: nrm, d: nrm.dot(V(0, c.edge[0], c.edge[1])) }
  })
}
function contactAnchor() {
  const planes = contactPlanes()
  if (!planes.length) return
  const d = planes.map((c) => minPlaneDist(c.set, c.n, c.d) - (c.gap ?? -0.004))
  let shift
  if (planes.length === 1) shift = planes[0].n.clone().multiplyScalar(-d[0])
  else {
    // 2 ระนาบ (เบาะนั่ง + พนักพิง): แก้ระบบ 2x2 ในระนาบ y-z
    const [a, b] = planes.map((c) => c.n)
    const det = a.y * b.z - a.z * b.y
    const dy = (-d[0] * b.z + d[1] * a.z) / det
    const dz = (-a.y * d[1] + b.y * d[0]) / det
    shift = V(0, dy, dz)
  }
  J.root.position.add(shift)
  body.updateMatrixWorld(true)
}
function groundAnchor(o) {
  const mode = M.anchor || 'feet'
  if (mode === 'fixed' || mode === 'contact') return
  const floor = M.floor ?? 0
  if (mode === 'pivot') {
    // ปลายเท้า (จุดต่ำสุดของเท้า) ยึดพื้นที่ z = pivotZ
    let low = null
    const p = V()
    for (const s of anat.samples) {
      if (!/foot$/.test(s.region || '')) continue
      samplePos(s, p)
      if (!low || p.y < low.y) low = p.clone()
    }
    J.root.position.add(V(0, floor - low.y, (M.pivotZ ?? 0) - low.z))
    body.updateMatrixWorld(true)
    return
  }
  const box = bodyBox({ skipArms: !M.armsGround })
  const shift = V(0, -box.min.y + o.lift + floor, 0)
  if (mode === 'feet') {
    const a = wp(J.ankleL).add(wp(J.ankleR)).multiplyScalar(0.5)
    shift.x = o.x - a.x
    shift.z = o.z - a.z
  }
  J.root.position.add(shift)
  body.updateMatrixWorld(true)
}

function pose(t) {
  const o = samplePose(M, t)
  setAngles(o)
  if (M.contact) {
    // สลับ leg IK <-> ระนาบสัมผัส ให้ต้นขา/ก้นอยู่ในท่าจริงก่อนหาจุดแนบเบาะ
    for (let it = 0; it < 5; it++) {
      legIK(o)
      contactAnchor()
    }
  }
  legIK(o)
  if (!o.ft[0] && !o.ft[1] && !o.hip) groundAnchor(o)
  armIK(o)
  body.updateMatrixWorld(true)
  return o
}

// ======================================================================
// อุปกรณ์ฟิตเนส (สัดส่วนจริง: บาร์โอลิมปิก 2.2 ม. / แผ่นยาง 45 ซม. / ม้านั่งสูง 43 ซม. ฯลฯ)
// ======================================================================
const props = []
const propRoot = new THREE.Group()
scene.add(propRoot)
function mk(geo, mat, parent = propRoot) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
function cylBetween(mesh, a, b) {
  const d = V().subVectors(b, a)
  mesh.position.copy(a).addScaledVector(d, 0.5)
  mesh.scale.set(1, Math.max(d.length(), 1e-3), 1)
  mesh.quaternion.setFromUnitVectors(Y, d.normalize())
}
const unitCyl = (r, seg = 20) => new THREE.CylinderGeometry(r, r, 1, seg)
function cyl(r, from, to, mat = MAT.frame, parent) {
  const m = mk(unitCyl(r), mat, parent)
  cylBetween(m, V(...from), V(...to))
  return m
}
// ท่อเหล็กเหลี่ยม (โครงเครื่อง) ระหว่างสองจุด
function tube(w, from, to, mat = MAT.frame, parent) {
  const a = V(...from)
  const b = V(...to)
  const m = mk(new RoundedBoxGeometry(w, 1, w, 2, w * 0.18), mat, parent)
  const d = V().subVectors(b, a)
  m.position.copy(a).addScaledVector(d, 0.5)
  m.scale.set(1, d.length(), 1)
  m.quaternion.setFromUnitVectors(Y, d.normalize())
  return m
}
function rbox(size, pos, mat = MAT.pad, rot = [0, 0, 0], parent, r = 0.02) {
  const m = mk(new RoundedBoxGeometry(...size, 3, Math.min(r, ...size.map((s) => s / 2 - 1e-3))), mat, parent)
  m.position.set(...pos)
  m.rotation.set(...rot.map(rad))
  return m
}
// แผ่นน้ำหนัก (lathe): ขอบหนา ผิวในบางลง ดุมเหล็กตรงกลาง
function plateGeo(R, T, hub = 0.026) {
  const p = [[hub, -T / 2], [R * 0.32, -T / 2], [R * 0.36, -T * 0.32], [R * 0.86, -T * 0.32], [R * 0.9, -T / 2], [R - 0.004, -T / 2], [R, -T / 2 + 0.004], [R, T / 2 - 0.004], [R - 0.004, T / 2], [R * 0.9, T / 2], [R * 0.86, T * 0.32], [R * 0.36, T * 0.32], [R * 0.32, T / 2], [hub, T / 2]]
  return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 48)
}
// บาร์เบลโอลิมปิก: แกน 28 มม. ลายกากเพชร + ปลอก (sleeve) 50 มม. + ปลอกล็อก + แผ่นยาง 45 ซม.
function barbellGroup({ plates = 'bumper', len = 2.2 } = {}) {
  const g = new THREE.Group()
  const inner = 0.655
  const shaft = mk(new THREE.CylinderGeometry(0.014, 0.014, inner * 2, 18), MAT.knurl, g)
  shaft.rotation.z = Math.PI / 2
  shaft.material = MAT.knurl.clone()
  shaft.material.map = null
  for (const s of [1, -1]) {
    const collar = mk(new THREE.CylinderGeometry(0.031, 0.031, 0.026, 24), MAT.chrome, g)
    collar.rotation.z = Math.PI / 2
    collar.position.x = s * (inner + 0.013)
    const sleeve = mk(new THREE.CylinderGeometry(0.025, 0.025, len / 2 - inner - 0.026, 24), MAT.chrome, g)
    sleeve.rotation.z = Math.PI / 2
    sleeve.position.x = s * (inner + 0.026 + (len / 2 - inner - 0.026) / 2)
    if (plates) {
      const stack = plates === 'bumper' ? [[0.225, 0.062], [0.225, 0.045]] : plates === 'light' ? [[0.225, 0.04]] : [[0.17, 0.035]]
      let x = inner + 0.03
      for (const [R, T] of stack) {
        const p = mk(plateGeo(R, T), MAT.rubber, g)
        p.rotation.z = Math.PI / 2
        p.position.x = s * (x + T / 2)
        const hub = mk(new THREE.CylinderGeometry(0.05, 0.05, T + 0.002, 28, 1, true), MAT.chrome, g)
        hub.rotation.z = Math.PI / 2
        hub.position.x = p.position.x
        x += T + 0.002
      }
      const clip = mk(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 20), MAT.frameDark, g)
      clip.rotation.z = Math.PI / 2
      clip.position.x = s * (x + 0.015)
    }
  }
  propRoot.add(g)
  return g
}
// แกนสั้น/ด้ามจับเคเบิล (ไม่มีแผ่นน้ำหนัก)
function handleGroup(width, { ends = true, bend = 0 } = {}) {
  const g = new THREE.Group()
  const bar = mk(new THREE.CylinderGeometry(0.014, 0.014, width * (bend ? 0.62 : 1), 16), MAT.knurl, g)
  bar.rotation.z = Math.PI / 2
  if (bend) {
    // ปลายบาร์ lat pulldown งอลง
    for (const s of [1, -1]) {
      const e = mk(new THREE.CylinderGeometry(0.014, 0.014, width * 0.22, 14), MAT.chrome, g)
      e.position.set(s * width * 0.39, -width * 0.04, 0)
      e.rotation.z = Math.PI / 2 + s * rad(bend)
      const cap = mk(new THREE.CylinderGeometry(0.019, 0.019, 0.08, 14), MAT.rubber, g)
      cap.position.set(s * width * 0.48, -width * 0.075, 0)
      cap.rotation.z = Math.PI / 2 + s * rad(bend)
    }
  } else if (ends) {
    for (const s of [1, -1]) {
      const c = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), MAT.chrome, g)
      c.rotation.z = Math.PI / 2
      c.position.x = (s * width) / 2
    }
  }
  const ring = mk(new THREE.TorusGeometry(0.018, 0.005, 8, 18), MAT.chrome, g)
  ring.position.y = 0.024
  propRoot.add(g)
  return g
}
// ดัมเบล: ด้าม 3.1 ซม. ลายกากเพชร + หัวยางกลม (lathe) + ฝาโครเมียม ; แกนดัมเบล = แกน x ของกลุ่ม
function dumbbellGroup(R = 0.058, T = 0.07) {
  const g = new THREE.Group()
  const h = mk(new THREE.CylinderGeometry(0.0155, 0.0155, 0.13, 16), MAT.knurl, g)
  h.rotation.z = Math.PI / 2
  for (const s of [1, -1]) {
    const head = mk(plateGeo(R, T, 0.016), MAT.rubber, g)
    head.rotation.z = Math.PI / 2
    head.position.x = s * (0.065 + T / 2)
    const cap = mk(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.006, 24), MAT.chrome, g)
    cap.rotation.z = Math.PI / 2
    cap.position.x = s * (0.065 + T + 0.002)
    const ring = mk(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 18), MAT.chrome, g)
    ring.rotation.z = Math.PI / 2
    ring.position.x = s * 0.07
  }
  return g
}
// ทำให้กลุ่มอุปกรณ์อยู่กึ่งกลางระหว่างจุดกำของสองมือ แกน x ตามแนวมือ
function alignToGrips(g) {
  const a = gripWorld('L')
  const b = gripWorld('R')
  g.position.copy(a).add(b).multiplyScalar(0.5)
  g.quaternion.setFromUnitVectors(X, a.sub(b).normalize())
}
const handsMid = () => gripWorld('L').add(gripWorld('R')).multiplyScalar(0.5)
const feetMid = () => wp(J.ankleL).add(wp(J.ankleR)).multiplyScalar(0.5)
const point = (name) => (name === 'handsMid' ? handsMid() : name === 'feet' ? feetMid() : name === 'gripL' ? gripWorld('L') : name === 'gripR' ? gripWorld('R') : wp(J[name]))

// ม้านั่งปรับระดับ: โครงเหล็กเทา ขาตั้งหน้า/หลังมียางรอง เบาะดำด้านขอบมน ; back = มุมพนัก (0 = ราบ)
// ตำแหน่งเบาะได้จาก contact plane ของท่า (หลัง/ก้นแนบเบาะพอดี)
function benchModel({ top = 0.44, back = 0, seatZ = 0.12, backLen = 0.84, seatLen = 0.36, w = 0.27, uprights = false, machine = false }) {
  if (machine) return machineSeat({ top, back, seatZ, backLen, seatLen, w: w + 0.1 })
  const g = new THREE.Group()
  propRoot.add(g)
  const t = 0.07 // ความหนาเบาะ
  // เบาะนั่ง: หน้าเบาะที่ z = seatZ + seatLen/2
  rbox([w, t, seatLen], [0, top - t / 2, seatZ], MAT.pad, [0, 0, 0], g, 0.025)
  // พนักพิง: หมุนรอบขอบหลังของเบาะนั่ง
  const hingeZ = seatZ - seatLen / 2 - 0.01
  const a = rad(back)
  const bc = V(0, top - t / 2 + Math.sin(a) * backLen / 2, hingeZ - Math.cos(a) * backLen / 2)
  rbox([w, t, backLen], bc.toArray(), MAT.pad, [back, 0, 0], g, 0.025)
  // แผ่นรองใต้เบาะ (เหล็ก)
  rbox([w * 0.62, 0.025, seatLen * 0.9], [0, top - t - 0.013, seatZ], MAT.frameDark, [0, 0, 0], g, 0.004)
  rbox([w * 0.62, 0.025, backLen * 0.92], [0, bc.y - Math.cos(a) * (t / 2 + 0.013), bc.z - Math.sin(a) * (t / 2 + 0.013)], MAT.frameDark, [back, 0, 0], g, 0.004)
  // คานหลัก + ขาตั้ง
  const zFront = seatZ + seatLen / 2 - 0.04
  const zBack = Math.min(hingeZ - backLen * 0.85, hingeZ - 0.55)
  const beamY = 0.16
  tube(0.07, [0, beamY, zFront], [0, beamY, zBack], MAT.frame, g).rotation.order = 'XYZ'
  for (const z of [zFront, zBack]) {
    tube(0.06, [0, 0.03, z], [0, beamY, z], MAT.frame, g)
    rbox([0.5, 0.05, 0.07], [0, 0.025, z], MAT.frame, [0, 0, 0], g, 0.01)
    for (const s of [1, -1]) rbox([0.06, 0.02, 0.08], [s * 0.24, 0.01, z], MAT.rubber, [0, 0, 0], g, 0.006)
  }
  // เสาค้ำเบาะนั่ง + เสาปรับพนัก (ladder)
  tube(0.055, [0, beamY, seatZ], [0, top - t - 0.025, seatZ], MAT.frame, g)
  if (back > 3) {
    const sup = V(0, bc.y - 0.1, bc.z + 0.05)
    tube(0.05, [0, beamY, sup.z + 0.18], sup.toArray(), MAT.frame, g)
    for (let i = 0; i < 6; i++) rbox([0.075, 0.012, 0.03], [0, beamY + 0.04, hingeZ - 0.08 - i * 0.07], MAT.accent, [0, 0, 0], g, 0.004)
  } else tube(0.055, [0, beamY, bc.z], [0, top - t - 0.025, bc.z], MAT.frame, g)
  // ที่พักบาร์ (bench press)
  if (uprights) {
    const z = uprights.z
    for (const s of [1, -1]) {
      tube(0.06, [s * 0.56, 0.0, z], [s * 0.56, uprights.y + 0.12, z], MAT.frame, g)
      rbox([0.09, 0.05, 0.16], [s * 0.56, 0.025, z], MAT.frame, [0, 0, 0], g, 0.01)
      // J-hook
      rbox([0.07, 0.03, 0.07], [s * 0.56, uprights.y - 0.03, z + 0.05], MAT.accent, [0, 0, 0], g, 0.008)
      rbox([0.07, 0.06, 0.016], [s * 0.56, uprights.y, z + 0.085], MAT.accent, [0, 0, 0], g, 0.006)
    }
    tube(0.05, [0.56, 0.04, z], [-0.56, 0.04, z], MAT.frame, g)
  }
  return g
}

// เบาะนั่ง + พนักพิงของเครื่อง (leg press / leg extension): ฐานเหล็กปิด ค้ำพนักพิงด้วยท่อเฉียง
function machineSeat({ top, back, seatZ, backLen, seatLen, w }) {
  const g = new THREE.Group()
  propRoot.add(g)
  const t = 0.075
  rbox([w, t, seatLen], [0, top - t / 2, seatZ], MAT.pad, [0, 0, 0], g, 0.03)
  const hingeZ = seatZ - seatLen / 2 - 0.01
  const a = rad(back)
  const bc = V(0, top - t / 2 + Math.sin(a) * backLen / 2, hingeZ - Math.cos(a) * backLen / 2)
  rbox([w, t, backLen], bc.toArray(), MAT.pad, [back, 0, 0], g, 0.03)
  // ฐานใต้เบาะ + เสาค้ำพนัก
  rbox([w * 0.8, top - t - 0.02, seatLen * 0.8], [0, (top - t - 0.02) / 2, seatZ], MAT.frameDark, [0, 0, 0], g, 0.02)
  const backTop = bc.clone().add(V(0, Math.sin(a) * backLen * 0.3, -Math.cos(a) * backLen * 0.3))
  const behind = backTop.clone().add(V(0, -Math.cos(a) * (t / 2 + 0.03), -Math.sin(a) * (t / 2 + 0.03)))
  tube(0.06, [0, 0.0, behind.z - 0.05], behind.toArray(), MAT.frame, g)
  rbox([0.5, 0.05, 0.12], [0, 0.025, behind.z - 0.05], MAT.frame, [0, 0, 0], g, 0.01)
  rbox([0.5, 0.05, 0.12], [0, 0.025, seatZ], MAT.frame, [0, 0, 0], g, 0.01)
  tube(0.06, [0, 0.03, behind.z - 0.05], [0, 0.03, seatZ], MAT.frame, g)
  // มือจับข้างเบาะ
  for (const s of [1, -1]) {
    tube(0.04, [s * (w / 2 + 0.04), top - 0.12, seatZ - 0.05], [s * (w / 2 + 0.04), top - 0.02, seatZ + 0.1], MAT.frame, g)
    cyl(0.017, [s * (w / 2 + 0.04), top - 0.02, seatZ + 0.1], [s * (w / 2 + 0.04), top - 0.02, seatZ + 0.22], MAT.rubber, g)
  }
  return g
}

// เครื่องเคเบิล: เสา + รอก + กองน้ำหนัก ; รอกที่ pulley ; สายจากรอกไปจุดกำ
function cableTower(x, z, h = 2.15, face = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rad(face)
  propRoot.add(g)
  for (const s of [1, -1]) tube(0.07, [s * 0.16, 0, 0], [s * 0.16, h, 0], MAT.frame, g)
  rbox([0.42, 0.06, 0.5], [0, 0.03, 0], MAT.frame, [0, 0, 0], g, 0.01)
  rbox([0.42, 0.08, 0.14], [0, h, 0], MAT.frame, [0, 0, 0], g, 0.01)
  // กองแผ่นน้ำหนัก + แกนนำ
  for (let i = 0; i < 12; i++) rbox([0.26, 0.04, 0.12], [0, 0.12 + i * 0.044, 0], i > 8 ? MAT.accent : MAT.frameDark, [0, 0, 0], g, 0.006)
  for (const s of [1, -1]) cyl(0.008, [s * 0.09, 0.06, 0], [s * 0.09, h - 0.05, 0], MAT.chrome, g)
  // แผ่นปิดด้านข้าง
  rbox([0.03, h * 0.62, 0.3], [0.2, h * 0.36, 0], MAT.frameDark, [0, 0, 0], g, 0.006)
  rbox([0.03, h * 0.62, 0.3], [-0.2, h * 0.36, 0], MAT.frameDark, [0, 0, 0], g, 0.006)
  return g
}
function pulleyAt(p, axis = 'x') {
  const w = mk(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 24), MAT.frameDark)
  w.position.set(...p)
  if (axis === 'x') w.rotation.z = Math.PI / 2
  else w.rotation.x = Math.PI / 2
  const hub = mk(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12), MAT.chrome)
  hub.position.copy(w.position)
  hub.rotation.copy(w.rotation)
}
function cableLine(from, to) {
  const m = mk(unitCyl(0.0035, 8), MAT.cable)
  const a = V(...from)
  return () => cylBetween(m, a, point(to))
}
// ห่วงจับเคเบิล (D-handle) ในมือ: แกนจับตามแกน x ของมือ
function dHandle(n) {
  const g = new THREE.Group()
  const bar = mk(new THREE.CylinderGeometry(0.015, 0.015, 0.11, 14), MAT.rubber, g)
  bar.rotation.z = Math.PI / 2
  const loop = mk(new THREE.TorusGeometry(0.07, 0.006, 8, 24, Math.PI), MAT.chrome, g)
  loop.rotation.x = Math.PI / 2
  loop.rotation.z = 0
  loop.position.z = 0
  loop.scale.set(0.85, 1, 1)
  loop.rotation.set(-Math.PI / 2, 0, 0)
  loop.position.set(0, 0, 0)
  g.position.copy(HAND[n].grip)
  J[`hand${n}`].add(g)
  return g
}

const PROP = {
  barbell: (d) => {
    const g = barbellGroup(d)
    return () => alignToGrips(g)
  },
  ezbar: () => {
    const g = barbellGroup({ plates: 'small', len: 1.3 })
    return () => alignToGrips(g)
  },
  handle: ({ width, bend }) => {
    const g = handleGroup(width, { bend })
    return () => alignToGrips(g)
  },
  dumbbells: ({ size = 1 }) => {
    for (const [n] of SIDES) {
      const g = dumbbellGroup(0.058 * size, 0.07 * size)
      g.position.copy(HAND[n].grip)
      J[`hand${n}`].add(g)
    }
  },
  dHandles: () => {
    for (const [n] of SIDES) dHandle(n)
  },
  kettlebell: () => {
    const g = new THREE.Group()
    const b = mk(new THREE.SphereGeometry(0.105, 32, 24), MAT.rubber, g)
    b.position.y = -0.15
    b.scale.y = 0.95
    const base = mk(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), MAT.rubber, g)
    base.position.y = -0.245
    const curve = new THREE.CatmullRomCurve3([V(-0.07, -0.09, 0), V(-0.07, -0.02, 0), V(-0.055, 0.012, 0), V(0, 0.018, 0), V(0.055, 0.012, 0), V(0.07, -0.02, 0), V(0.07, -0.09, 0)])
    mk(new THREE.TubeGeometry(curve, 32, 0.013, 10), MAT.frameDark, g)
    propRoot.add(g)
    return () => {
      const a = gripWorld('L')
      const c = gripWorld('R')
      g.position.copy(a).add(c).multiplyScalar(0.5)
      const xAxis = a.clone().sub(c).normalize()
      // ห้อยตามแนวปลายแขน (ทิศจากข้อศอกไปมือ)
      const down = handsMid().sub(wp(J.elbowL).add(wp(J.elbowR)).multiplyScalar(0.5)).normalize()
      const yAxis = down.negate().addScaledVector(xAxis, -down.dot(xAxis)).normalize()
      const zAxis = V().crossVectors(xAxis, yAxis)
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
    }
  },
  gloves: () => {
    for (const [n] of SIDES) {
      const h = HAND[n]
      const m = mk(new THREE.SphereGeometry(1, 28, 20), MAT.glove, J[`hand${n}`])
      m.position.copy(h.palm).add(V(0, -0.025, 0.0)).addScaledVector(h.palmN, -0.008)
      m.scale.set(0.058, 0.082, 0.062)
      const cuff = mk(new THREE.CylinderGeometry(0.042, 0.046, 0.07, 20), MAT.glove, J[`hand${n}`])
      cuff.position.set(0, 0.0, 0.004)
    }
  },
  racket: () => {
    const g = new THREE.Group()
    const shaft = mk(new THREE.CylinderGeometry(0.0055, 0.0055, 0.3, 10), MAT.racket, g)
    shaft.position.y = -0.2
    const grip = mk(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), MAT.rubber, g)
    grip.position.y = 0.0
    const head = mk(new THREE.TorusGeometry(0.1, 0.006, 8, 40), MAT.racket, g)
    head.scale.set(0.8, 1.12, 1)
    head.position.y = -0.46
    const net = mk(new THREE.CircleGeometry(0.098, 32), MAT.string, g)
    net.scale.set(0.8, 1.12, 1)
    net.position.y = -0.46
    // ด้ามแร็กเก็ตตั้งฉากกับแกนข้างมือ ผ่านจุดกำ
    g.position.copy(HAND.R.grip)
    g.rotation.z = Math.PI / 2
    J.handR.add(g)
  },
  ball: ({ kind, pos, follow, offset = [0, 0, 0] }) => {
    const r = kind === 'basketball' ? 0.12 : 0.11
    const b = mk(new THREE.SphereGeometry(r, 32, 24), kind === 'basketball' ? MAT.basketball : MAT.football)
    if (pos) b.position.set(...pos)
    if (follow) return () => b.position.copy(point(follow)).add(V(...offset))
  },
  rope: () => {
    const ring = mk(new THREE.TorusGeometry(1, 0.006, 6, 64, Math.PI), MAT.cable)
    const g = new THREE.Group()
    propRoot.add(g)
    g.add(ring)
    ring.scale.set(0.36, 1.0, 1)
    for (const [n] of SIDES) {
      const h = mk(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 12), MAT.frameDark, J[`hand${n}`])
      h.position.copy(HAND[n].grip)
      h.rotation.z = Math.PI / 2
    }
    return (t) => {
      alignToGrips(g)
      g.rotateX(-Math.PI * 4 * t - Math.PI / 2)
    }
  },
  water: () => {
    ground.visible = false
    const w = mk(new THREE.CircleGeometry(1.8, 64), new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, depthWrite: false }))
    w.rotation.x = -Math.PI / 2
    w.position.y = 0.66
    w.castShadow = false
    w.userData.noFrame = true
  },
  backpack: () => {
    const g = new THREE.Group()
    J.chest.add(g)
    rbox([0.28, 0.4, 0.15], [0, 0.17, -0.17], MAT.pad, [0, 0, 0], g, 0.05)
    rbox([0.22, 0.14, 0.05], [0, 0.07, -0.25], MAT.frameDark, [0, 0, 0], g, 0.02)
  },
  treadmill: () => {
    rbox([0.78, 0.12, 1.9], [0, 0.06, -0.15], MAT.frameDark, [0, 0, 0], undefined, 0.03)
    rbox([0.56, 0.012, 1.7], [0, 0.126, -0.15], MAT.rubber, [0, 0, 0], undefined, 0.004)
    for (const s of [1, -1]) {
      tube(0.06, [0.36 * s, 0.1, 0.7], [0.36 * s, 1.1, 0.82])
      cyl(0.016, [0.36 * s, 1.0, 0.8], [0.36 * s, 1.02, 0.45], MAT.chrome)
    }
    rbox([0.8, 0.24, 0.12], [0, 1.18, 0.84], MAT.frameDark, [-18, 0, 0], undefined, 0.03)
  },
  // ม้านั่ง (ราบ/เอียง) วางตามระนาบสัมผัสของท่า
  bench: (d) => {
    let uprights = d.uprights
    // ที่พักบาร์อัตโนมัติ: ตะขอ J-hook ต่ำกว่าบาร์ท่าแรก (แขนเหยียด) เล็กน้อย อยู่หลังแนวบาร์ฝั่งศีรษะ
    if (uprights === 'auto') {
      const hm = handsMid()
      uprights = { z: hm.z - 0.075, y: hm.y - 0.06 }
    }
    benchModel({ ...d, uprights })
  },
  box: ({ size, pos, rot, mat }) => {
    rbox(size, pos, MAT[mat] || MAT.pad, rot, undefined, 0.03)
  },
  tube: ({ w = 0.06, from, to, mat }) => {
    tube(w, from, to, MAT[mat] || MAT.frame)
  },
  cyl: ({ r, from, to, mat }) => {
    cyl(r, from, to, MAT[mat] || MAT.frame)
  },
  tower: ({ x, z, h, face }) => {
    cableTower(x, z, h, face)
  },
  pulley: ({ at, axis }) => {
    pulleyAt(at, axis)
  },
  cable: ({ from, to }) => cableLine(from, to),
  dipbars: ({ w = 0.25, y = 1.18, len = 0.6 }) => {
    for (const s of [1, -1]) {
      cyl(0.02, [w * s + 0.002 * s, y, -len / 2], [w * s, y, len / 2], MAT.knurl)
      tube(0.055, [w * s + 0.06 * s, 0, -len / 2 + 0.04], [w * s + 0.06 * s, y - 0.03, -len / 2 + 0.04])
      tube(0.055, [w * s + 0.06 * s, 0, len / 2 - 0.04], [w * s + 0.06 * s, y - 0.03, len / 2 - 0.04])
      tube(0.05, [w * s, y - 0.03, -len / 2 + 0.04], [w * s + 0.06 * s, y - 0.03, -len / 2 + 0.04])
      tube(0.05, [w * s, y - 0.03, len / 2 - 0.04], [w * s + 0.06 * s, y - 0.03, len / 2 - 0.04])
      rbox([0.12, 0.04, len + 0.1], [w * s + 0.06 * s, 0.02, 0], MAT.frame, [0, 0, 0], undefined, 0.01)
    }
  },
  pullbar: ({ y, z = 0, w = 0.62 }) => {
    cyl(0.016, [-w, y, z], [w, y, z], MAT.knurl)
    for (const s of [1, -1]) {
      tube(0.07, [w * s + 0.04 * s, 0, z - 0.02], [w * s + 0.04 * s, y + 0.12, z - 0.02])
      rbox([0.1, 0.06, 0.9], [w * s + 0.04 * s, 0.03, z - 0.02], MAT.frame, [0, 0, 0], undefined, 0.01)
    }
    tube(0.06, [-w - 0.04, y + 0.12, z - 0.02], [w + 0.04, y + 0.12, z - 0.02])
  },
  // ลูกกลิ้งเบาะ: ตำแหน่ง = จุด local ในข้อต่อ follow (กึ่งกลาง x = 0) ; fixed = วางครั้งเดียวตามท่าแรก
  roller: ({ follow, local, offset = [0, 0, 0], len = 0.36, fixed }) => {
    const g = new THREE.Group()
    propRoot.add(g)
    for (const s of [1, -1]) {
      const r = mk(new THREE.CylinderGeometry(0.055, 0.055, len / 2 - 0.03, 24), MAT.pad, g)
      r.rotation.z = Math.PI / 2
      r.position.x = s * (len / 4 + 0.01)
    }
    const axle = mk(new THREE.CylinderGeometry(0.012, 0.012, len, 12), MAT.chrome, g)
    axle.rotation.z = Math.PI / 2
    const place = () => {
      const p = local ? J[follow].localToWorld(V(...local)) : point(follow).add(V(...offset))
      g.position.set(0, p.y, p.z)
    }
    place()
    if (!fixed) return place
  },
  // แขนเครื่อง (leg extension / leg curl): จากแกนหมุนตรงข้อเข่า ไปที่ลูกกลิ้ง (ด้านนอกขา)
  lever: ({ pivot, follow, local }) => {
    const m = mk(new RoundedBoxGeometry(0.05, 1, 0.05, 2, 0.008), MAT.frame)
    const p = wp(J[pivot])
    const hub = mk(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 24), MAT.frameDark)
    hub.rotation.z = Math.PI / 2
    hub.position.set(0.25, p.y, p.z)
    const post = tube(0.06, [0.25, 0, p.z - 0.05], [0.25, p.y - 0.03, p.z - 0.05])
    post.userData.noFrame = false
    return () => {
      const t = J[follow].localToWorld(V(...local))
      t.x = 0.25
      const a = V(0.25, p.y, p.z)
      const d = V().subVectors(t, a)
      m.position.copy(a).addScaledVector(d, 0.5)
      m.scale.set(1, d.length(), 1)
      m.quaternion.setFromUnitVectors(Y, d.normalize())
    }
  },
  // แท่นถีบ leg press: วิ่งบนราง 45° ตามเท้า
  sled: ({ angle = 45 }) => {
    const g = new THREE.Group()
    propRoot.add(g)
    const a = rad(angle)
    rbox([0.66, 0.5, 0.035], [0, 0, 0], MAT.frame, [0, 0, 0], g, 0.01)
    rbox([0.6, 0.44, 0.012], [0, 0, 0.022], MAT.rubber, [0, 0, 0], g, 0.004)
    for (const s of [1, -1]) {
      rbox([0.06, 0.06, 0.4], [s * 0.38, -0.12, -0.2], MAT.frame, [0, 0, 0], g, 0.01)
      const horn = mk(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 16), MAT.chrome, g)
      horn.rotation.z = Math.PI / 2
      horn.position.set(s * 0.48, -0.12, -0.3)
      const pl = mk(plateGeo(0.225, 0.05), MAT.rubber, g)
      pl.rotation.z = Math.PI / 2
      pl.position.set(s * 0.47, -0.12, -0.3)
    }
    return () => {
      const f = feetMid()
      // แผ่นเท้าตั้งฉากกับแนวราง ; ฝ่าเท้าแนบแผ่น
      g.rotation.set(-(Math.PI / 2 - a), 0, 0)
      const nrm = V(0, -Math.sin(Math.PI / 2 - a), -Math.cos(Math.PI / 2 - a)).negate()
      g.position.copy(f).addScaledVector(nrm, 0.085).add(V(0, 0, 0))
      g.position.x = 0
    }
  },
  bike: () => {
    const bb = [0, 0.3, 0.2]
    const seat = [0, 0.86, -0.06]
    const head = [0, 0.95, 0.62]
    const rear = [0, 0.34, -0.42]
    const front = [0, 0.34, 0.7]
    for (const c of [rear, front]) {
      const w = mk(new THREE.TorusGeometry(0.33, 0.02, 10, 48), MAT.rubber)
      w.position.set(...c)
      w.rotation.y = Math.PI / 2
      const rim0 = mk(new THREE.TorusGeometry(0.3, 0.006, 6, 48), MAT.chrome)
      rim0.position.set(...c)
      rim0.rotation.y = Math.PI / 2
    }
    for (const [a, b] of [[bb, seat], [seat, head], [bb, [0, 0.86, 0.6]], [bb, rear], [seat, rear], [head, front]]) cyl(0.017, a, b, MAT.frame)
    rbox([0.13, 0.045, 0.26], [0, seat[1] + 0.03, seat[2] - 0.02], MAT.pad, [0, 0, 0], undefined, 0.02)
    cyl(0.014, [-0.22, 1.0, 0.68], [0.22, 1.0, 0.68], MAT.rubber)
    cyl(0.016, head, [0, 1.0, 0.68], MAT.frame)
    return crank(bb)
  },
  spinBike: () => {
    const bb = [0, 0.34, 0.22]
    rbox([0.55, 0.06, 1.2], [0, 0.03, 0.12], MAT.frame, [0, 0, 0], undefined, 0.02)
    const fw = mk(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 48), MAT.frameDark)
    fw.rotation.z = Math.PI / 2
    fw.position.set(0, 0.34, 0.64)
    tube(0.06, [0, 0.06, -0.12], [0, 0.86, -0.05])
    tube(0.06, [0, 0.06, 0.52], [0, 1.0, 0.6])
    rbox([0.15, 0.05, 0.27], [0, 0.89, -0.06], MAT.pad, [0, 0, 0], undefined, 0.02)
    cyl(0.016, [-0.22, 1.06, 0.6], [0.22, 1.06, 0.6], MAT.rubber)
    return crank(bb)
  },
  elliptical: () => {
    rbox([0.64, 0.12, 1.6], [0, 0.06, 0.15], MAT.frameDark, [0, 0, 0], undefined, 0.03)
    rbox([0.42, 1.2, 0.14], [0, 0.66, 0.9], MAT.frame, [0, 0, 0], undefined, 0.03)
    const poles = SIDES.map(() => mk(unitCyl(0.018), MAT.chrome))
    const pedals = SIDES.map(() => rbox([0.13, 0.035, 0.34], [0, 0, 0], MAT.rubber, [0, 0, 0], undefined, 0.01))
    return () => {
      SIDES.forEach(([n], i) => {
        const h = gripWorld(n)
        cylBetween(poles[i], h.clone().add(V(0, 0.08, 0)), V(h.x, 0.55, 0.78))
        footPedal(pedals[i], n)
      })
    }
  },
  steps: () => {
    for (let i = 0; i < 4; i++) rbox([0.72, 0.2, 0.3], [0, 0.1 + 0.2 * i, 0.2 + 0.3 * i - 0.3], MAT.frameDark, [0, 0, 0], undefined, 0.02)
    for (const s of [1, -1]) {
      cyl(0.018, [0.3 * s, 1.22, -0.2], [0.3 * s, 1.36, 0.65], MAT.knurl)
      tube(0.05, [0.3 * s, 0.0, 0.65], [0.3 * s, 1.36, 0.65])
    }
    const pedals = SIDES.map(() => rbox([0.15, 0.03, 0.3], [0, 0, 0], MAT.rubber, [0, 0, 0], undefined, 0.01))
    return () => SIDES.forEach(([n], i) => footPedal(pedals[i], n))
  },
  rower: () => {
    rbox([0.14, 0.06, 2.1], [0, 0.22, 0.25], MAT.frame, [0, 0, 0], undefined, 0.02)
    rbox([0.4, 0.46, 0.4], [0, 0.32, 1.3], MAT.frameDark, [0, 0, 0], undefined, 0.06)
    for (const s of [1, -1]) rbox([0.14, 0.03, 0.3], [s * 0.1, 0.3, 0.86], MAT.rubber, [-50, 0, 0], undefined, 0.01)
    const seat = rbox([0.3, 0.05, 0.3], [0, 0, 0], MAT.pad, [0, 0, 0], undefined, 0.02)
    const chain = mk(unitCyl(0.004), MAT.cable)
    const hb = handleGroup(0.52)
    return () => {
      seat.position.set(0, seatTop() - 0.025, wp(J.root).z - 0.02)
      alignToGrips(hb)
      cylBetween(chain, handsMid(), V(0, 0.48, 1.12))
    }
  },
}
let seatTop = () => 0.43
// แป้นเหยียบใต้ฝ่าเท้า (หมุนตามเท้า)
function footPedal(m, n) {
  const a = J[`ankle${n}`]
  m.position.copy(a.localToWorld(V(0, -L.ankleY - 0.012, 0.06)))
  m.quaternion.copy(wq(a))
}
function crank(bb) {
  const c = V(...bb)
  const arms = SIDES.map(() => mk(new RoundedBoxGeometry(0.02, 1, 0.03, 1, 0.006), MAT.chrome))
  const pedals = SIDES.map(() => rbox([0.1, 0.022, 0.12], [0, 0, 0], MAT.rubber, [0, 0, 0], undefined, 0.006))
  const disk = mk(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 32), MAT.chrome)
  disk.rotation.z = Math.PI / 2
  disk.position.copy(c)
  return () => SIDES.forEach(([n], i) => {
    const p = J[`ankle${n}`].localToWorld(V(0, -L.ankleY - 0.01, 0.07))
    const a = V(p.x, p.y, p.z)
    a.x = c.x + (n === 'L' ? 0.09 : -0.09)
    const d = V().subVectors(a, c.clone().setX(a.x))
    arms[i].position.copy(c).setX(a.x).addScaledVector(d, 0.5)
    arms[i].scale.y = d.length()
    arms[i].quaternion.setFromUnitVectors(Y, d.normalize())
    footPedal(pedals[i], n)
  })
}

// ======================================================================
// กล้อง: 3/4 perspective เฉียง 40° ; ตัวผู้เล่นสูง ~83% ของกรอบ (อุปกรณ์อยู่ในกรอบ)
// ======================================================================
function propPoints(out) {
  propRoot.updateMatrixWorld(true)
  const visit = (root) => root.traverse((o) => {
    if (!o.isMesh || o.userData.noFrame) return
    const p = o.geometry.attributes.position
    const step = Math.max(1, Math.floor(p.count / 60))
    for (let i = 0; i < p.count; i += step) out.push(V().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld))
  })
  visit(propRoot)
}
function bodyPoints(out, stride = 3) {
  for (let k = 0; k < anat.samples.length; k += stride) out.push(samplePos(anat.samples[k], V()))
}
const v = V()
function fitCamera(bodyPts, propPts, az, el, fill = 0.83) {
  const dir = V(Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el)))
  const all = bodyPts.concat(propPts)
  const target = new THREE.Box3().setFromPoints(bodyPts.concat(propPts)).getCenter(V())
  const right = V()
  const upv = V()
  const bounds = (pts) => {
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const q of pts) {
      v.copy(q).project(camera)
      x0 = Math.min(x0, v.x)
      x1 = Math.max(x1, v.x)
      y0 = Math.min(y0, v.y)
      y1 = Math.max(y1, v.y)
    }
    return { x0, x1, y0, y1 }
  }
  let dist = 6
  for (let it = 0; it < 12; it++) {
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    const a = bounds(all)
    // Bounding-box framing: กึ่งกลางกรอบรวม (ตัว + อุปกรณ์ ตลอดลูป) อยู่กลางภาพ
    // ด้านที่ยาวกว่า (เทียบสัดส่วนเฟรม) กินพื้นที่ fill (83%) เท่ากันทุกท่า ไม่ว่าท่านอนหรือท่ายืน
    const cx = (a.x0 + a.x1) / 2
    const cy = (a.y0 + a.y1) / 2
    const halfH = Math.tan(rad(camera.fov / 2)) * dist
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    upv.setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(right, cx * halfH * camera.aspect).addScaledVector(upv, cy * halfH)
    const need = Math.max((a.y1 - a.y0) / 2, (a.x1 - a.x0) / 2) / fill
    dist *= need
  }
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.lookAt(target)
  camera.updateMatrixWorld()
}
function frameCamera(boxes, az, el) {
  const center = new THREE.Box3()
  for (const b of boxes) center.union(b)
  const target = center.getCenter(V())
  const dir = V(Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el)))
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
    dist *= Math.max(mx / 0.9, my / 0.88)
  }
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.lookAt(target)
}

// ======================================================================
// API ที่สคริปต์เรนเดอร์เรียก
// ======================================================================
// spec: { motion, view: 'oblique'|'side', primary: [...], secondary: [...], fps }
window.setup = (spec) => {
  M = MOTIONS[spec.motion]
  if (!M) throw new Error(`unknown motion ${spec.motion}`)
  paintAnatomy(spec.primary, spec.secondary)
  // อุปกรณ์สร้างหลังจัดท่าแรก (บางชิ้นอิงตำแหน่งร่างกาย)
  pose(0)
  for (const p of M.props || []) {
    const def = typeof p === 'string' ? { type: p } : p
    const upd = PROP[def.type](def)
    if (upd) props.push(upd)
  }
  const fps = spec.fps || 24
  const frames = Math.max(12, Math.round(M.dur * fps))
  // มุมกล้อง: oblique = 3/4 perspective เฉียง 40° ; side = ด้านข้าง 72° (ตรง 90° แผ่นน้ำหนักบังตัว)
  const view = spec.view || 'oblique'
  const az = view === 'side' ? (M.cam?.side ?? 72) : (M.cam?.az ?? 40)
  const el = view === 'side' ? (M.cam?.sideEl ?? 8) : clamp(M.cam?.el ?? 12, 6, 24)
  aimLights(az)
  const bodyPts = []
  const propPts = []
  const feet = V()
  for (let i = 0; i < 16; i++) {
    const t = i / 16
    pose(t)
    props.forEach((u) => u(t))
    bodyPoints(bodyPts)
    propPoints(propPts)
    feet.add(wp(J.root))
  }
  fitCamera(bodyPts, propPts, az, el, M.cam?.fill ?? 0.83)
  feet.divideScalar(16)
  shadowLight.position.set(feet.x + 0.15, 6, feet.z + 0.25)
  shadowLight.target.position.set(feet.x, 0, feet.z)
  return { frames }
}

window.frame = (i, frames) => {
  const t = i / frames
  pose(t)
  props.forEach((u) => u(t))
  const c = contraction(M, t)
  BODY_U.uGlow.value = 0.03 + 0.16 * c
  composer.render()
  return renderer.domElement.toDataURL('image/png')
}

// ภาพซูมตรวจทาน (มือ/เท้า/จุดสัมผัส): { t, at: ชื่อข้อต่อหรือ [x,y,z], az, el, dist }
window.closeup = (spec) => {
  pose(spec.t ?? 0)
  props.forEach((u) => u(spec.t ?? 0))
  const target = Array.isArray(spec.at) ? V(...spec.at) : spec.at === 'gripL' || spec.at === 'gripR' ? gripWorld(spec.at.slice(-1)) : wp(J[spec.at])
  const dir = V(Math.sin(rad(spec.az)) * Math.cos(rad(spec.el)), Math.sin(rad(spec.el)), Math.cos(rad(spec.az)) * Math.cos(rad(spec.el)))
  camera.position.copy(target).addScaledVector(dir, spec.dist ?? 0.5)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  aimLights(spec.az)
  composer.render()
  return renderer.domElement.toDataURL('image/png')
}

// ตรวจความถูกต้องเชิงตัวเลขทั้งลูป: มือ-อุปกรณ์ / เท้า-พื้น / หลัง-เบาะ / มุมกางศอก / เข่าหุบ / หลังงอ
window.audit = (n = 24) => {
  const out = { gripErr: 0, footLift: 0, footSink: 0, footTilt: 0, contactGap: 0, contactPen: 0, elbowFlare: [180, 0], kneeIn: 0, spineBend: 0, elbowMin: 0, kneeMax: 0 }
  for (let i = 0; i < n; i++) {
    const t = i / n
    const o = pose(t)
    props.forEach((u) => u(t))
    const T = handTargets(o)
    for (const [hn] of SIDES) if (T[hn]) out.gripErr = Math.max(out.gripErr, T[hn].at.distanceTo(gripWorld(hn, T[hn].contact)))
    for (const [fn, s, m] of SIDES) {
      if (o.ft[s] && !o.footPitch[s] && o.ft[s][1] < L.ankleY + 0.02) {
        const box = bodyBox({ filter: (x) => x.region === `${fn}foot` })
        out.footLift = Math.max(out.footLift, box.min.y)
        out.footSink = Math.max(out.footSink, -box.min.y)
        const up = Y.clone().applyQuaternion(wq(J[`ankle${fn}`]))
        out.footTilt = Math.max(out.footTilt, deg(up.angleTo(Y)))
      }
      // เข่าหุบ: เข่าเข้าด้านในมากกว่าแนวสะโพก-ข้อเท้า (ในระนาบพื้น ตั้งฉากกับทิศปลายเท้า)
      const hp = wp(J[`hip${fn}`])
      const kn = wp(J[`knee${fn}`])
      const an = wp(J[`ankle${fn}`])
      const mid = hp.clone().lerp(an, 0.5)
      out.kneeIn = Math.max(out.kneeIn, (mid.x - kn.x) * m)
      const kneeAngle = 180 - deg(V().subVectors(hp, kn).angleTo(V().subVectors(an, kn)))
      out.kneeMax = Math.max(out.kneeMax, kneeAngle)
      // มุมกางศอก: มุมระหว่างต้นแขนกับแกนลำตัว (หัว -> สะโพก) ในระนาบหน้า-หลังของลำตัว
      const sh = wp(J[`shoulder${fn}`])
      const el = wp(J[`elbow${fn}`])
      const qc = wq(J.chest)
      const down = V(0, -1, 0).applyQuaternion(qc)
      const fwd = V(0, 0, 1).applyQuaternion(qc)
      const ua = el.clone().sub(sh)
      const fr = ua.clone().addScaledVector(fwd, -ua.dot(fwd))
      if (T[fn] && fr.length() > 0.05) {
        const a = deg(fr.angleTo(down))
        out.elbowFlare = [Math.min(out.elbowFlare[0], a), Math.max(out.elbowFlare[1], a)]
      }
    }
    out.spineBend = Math.max(out.spineBend, Math.abs(o.chest - o.pelvis))
    if (M.armsGround) out.armMinY = Math.min(out.armMinY ?? 9, bodyBox({ filter: (x) => x.arm }).min.y)
    for (const c of contactPlanes()) {
      const d = minPlaneDist(c.set, c.n, c.d)
      out.contactGap = Math.max(out.contactGap, d)
      out.contactPen = Math.max(out.contactPen, -d)
    }
  }
  for (const k of Object.keys(out)) out[k] = Array.isArray(out[k]) ? out[k].map((x) => +x.toFixed(1)) : +(/Err|foot[LS]|contact|kneeIn/.test(k) ? out[k] * 1000 : out[k]).toFixed(1)
  return out
}

// ---------- ภาพนิ่งไอคอนหมวดกล้ามเนื้อ: หุ่นกล้ามเนื้อสีเงิน พื้นโปร่งใส ซูมเฉพาะส่วน ----------
// spec: { pose, primary, az, el, focus: [กลุ่มกล้ามเนื้อที่ใช้จัดเฟรม], pad, width, height }
window.still = (spec) => {
  M = { anchor: 'feet' }
  paintAnatomy(spec.primary, spec.secondary || [])
  BODY_U.uGlow.value = 0.08
  ground.visible = false
  scene.background = null
  aimLights(spec.az)
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(spec.width, spec.height)
  camera.aspect = spec.width / spec.height
  camera.updateProjectionMatrix()
  const o = resolvePose(spec.pose || {})
  setAngles(o)
  groundAnchor(o)
  const focus = spec.focus.includes('body') ? bodyBox() : bodyBox({ groups: spec.focus, side: spec.side || null })
  focus.expandByScalar(spec.pad ?? 0.04)
  frameCamera([focus], spec.az, spec.el)
  renderer.render(scene, camera)
  window.lastFocus = focus.getSize(V()).toArray()
  return renderer.domElement.toDataURL('image/png')
}

try {
  buildRig()
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.18
  scene.background = new THREE.Color(BG)
  seatTop = () => (M?.seatTop ?? 0.43)
  window.ready = true
} catch (e) {
  window.loadError = String(e && e.stack ? e.stack : e)
}

// ดีบัก (สคริปต์ตรวจทานเรียกผ่าน page.evaluate)
window.__dbg = { J, HAND, L, BIND, pose, gripWorld, handTargets, contactPlanes, minPlaneDist, wp, V, get M() { return M } }
