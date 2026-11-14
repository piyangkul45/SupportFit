// ร่างนักกีฬาชาย 3D แบบ "ชิ้นเดียวทึบ" (Unified Proportional Athletic Human Mesh) — โมเดลต้นฉบับของ SupportFit ทั้งหมด
// ไม่ใช้ไฟล์โมเดลภายนอก: ร่างกายประกอบจากรูปทรงกล้ามเนื้อ/เส้นเอ็น/แกนลำตัวที่ตั้งชื่อไว้ ~150 ชิ้น (ellipsoid / round cone)
// รวมเป็น distance field เดียวด้วย smooth union แล้วสร้างผิวต่อเนื่องผืนเดียวด้วย Surface Nets (ไม่มีช่องว่างระหว่างมัด)
// แต่ละ vertex รู้ว่าอยู่บนกล้ามเนื้อมัดไหน (กลุ่ม / ทิศเส้นใย / ปลายเอ็น / ร่องระหว่างมัด / กางเกง) -> shader วาดลายเส้นใยบนผิวโดยตรง
//
// พิกัด bind (เมตร): y ขึ้น, +z หน้า, +x ซ้ายของตัวละคร ; ฝ่าเท้า y = 0 ; ท่ากายวิภาค (แขนห้อย ฝ่ามือหันหน้า)
import * as THREE from 'three'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------- สัดส่วนโครงร่าง (สูง ~1.74 ม. นักกีฬาชาย) ----------
export const JOINTS = {
  hip: [0, 0.884, 0], l5: [0, 1.007, -0.023], t12: [0, 1.151, -0.023], c7: [0, 1.452, -0.011],
  shoulderL: [0.172, 1.392, -0.005], elbowL: [0.205, 1.116, -0.015], wristL: [0.235, 0.88, 0.015],
  hipL: [0.085, 0.884, 0], kneeL: [0.083, 0.447, 0.002], ankleL: [0.078, 0.059, -0.012], toeL: [0.112, 0.012, 0.155],
}
for (const k of Object.keys(JOINTS)) if (k.endsWith('L')) JOINTS[k.slice(0, -1) + 'R'] = [-JOINTS[k][0], JOINTS[k][1], JOINTS[k][2]]

// ---------- มือ: นิ้วกางเล็กน้อยในท่า bind (ร่องระหว่างนิ้วชัด) ----------
// [ชื่อ, x โคนนิ้วจากข้อมือ, มุมกาง (องศา, + = ไปทางนิ้วโป้ง), ความยาว, รัศมีโคน]
const FINGER_DEF = [
  ['index', 0.026, 7, 0.074, 0.0088],
  ['middle', 0.008, 1, 0.082, 0.0092],
  ['ring', -0.01, -5, 0.077, 0.0086],
  ['little', -0.026, -11, 0.062, 0.0076],
]
export function handLayout(side) {
  const m = side === 'L' ? 1 : -1
  const W = V(...JOINTS[`wrist${side}`])
  const fingers = {}
  const mcpY = W.y - 0.088
  for (const [name, dx, spread, len, r] of FINGER_DEF) {
    const a = THREE.MathUtils.degToRad(spread) * m
    const axis = V(Math.sin(a), -Math.cos(a), 0.12).normalize()
    fingers[name] = { base: V(W.x + dx * m, mcpY, W.z + 0.003), axis, len, r, spread: spread * m }
  }
  fingers.thumb = { base: V(W.x + 0.022 * m, W.y - 0.024, W.z + 0.012), axis: V(0.45 * m, -0.75, 0.48).normalize(), len: 0.105, r: 0.0105, spread: 0 }
  const mcp = V()
  const dir = V()
  for (const [name] of FINGER_DEF) {
    mcp.add(fingers[name].base)
    dir.add(fingers[name].axis)
  }
  mcp.divideScalar(4)
  dir.normalize()
  const palmN = V(0, 0, 1)
  const palmFront = W.z + 0.004 + 0.016 + 0.004
  const grip = mcp.clone().addScaledVector(dir, 0.012)
  grip.z = palmFront + 0.017
  const palm = V(W.x, W.y - 0.05, palmFront + 0.002)
  return { W, fingers, mcp, dir, palmN, grip, palm }
}
export const FINGERS = ['index', 'middle', 'ring', 'little']
export const SEG_FRAC = { finger: [0.46, 0.3, 0.24], thumb: [0.4, 0.34, 0.26] }

// ---------- รูปทรงพื้นฐาน (signed distance) ----------
// ellipsoid หมุนได้: d ≈ k0 (k0 - 1) / k1 (IQ bound)
function makeEll(c, r, rotDeg = [0, 0, 0]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotDeg.map(THREE.MathUtils.degToRad)))
  const inv = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q.clone().invert())).elements
  const R = Math.max(...r)
  return {
    kind: 'ell', c: V(...c), r, q, R,
    local(x, y, z, out) {
      const px = x - this.c.x
      const py = y - this.c.y
      const pz = z - this.c.z
      out[0] = inv[0] * px + inv[3] * py + inv[6] * pz
      out[1] = inv[1] * px + inv[4] * py + inv[7] * pz
      out[2] = inv[2] * px + inv[5] * py + inv[8] * pz
      return out
    },
    sdf(x, y, z, t = [0, 0, 0]) {
      this.local(x, y, z, t)
      const a = t[0] / r[0]
      const b = t[1] / r[1]
      const cc = t[2] / r[2]
      const k0 = Math.sqrt(a * a + b * b + cc * cc)
      const k1 = Math.sqrt((a / r[0]) ** 2 + (b / r[1]) ** 2 + (cc / r[2]) ** 2)
      return k1 < 1e-9 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
    },
    // พิกัดตามแนวยาวของมัด (-1 .. 1) ใช้หาปลายเอ็น
    along(x, y, z, t = [0, 0, 0]) {
      this.local(x, y, z, t)
      return t[1] / r[1]
    },
    axis() {
      return V(0, 1, 0).applyQuaternion(q)
    },
    box() {
      return new THREE.Box3(this.c.clone().subScalar(R), this.c.clone().addScalar(R))
    },
  }
}
// round cone (แคปซูลเรียว) จาก a ไป b รัศมี ra -> rb
function makeCap(a, b, ra, rb = ra) {
  const A = V(...a)
  const B = V(...b)
  const ab = B.clone().sub(A)
  const L2 = ab.lengthSq()
  return {
    kind: 'cap', a: A, b: B, ra, rb, R: Math.max(ra, rb),
    sdf(x, y, z) {
      const px = x - A.x
      const py = y - A.y
      const pz = z - A.z
      const t = clamp((px * ab.x + py * ab.y + pz * ab.z) / L2, 0, 1)
      const dx = px - ab.x * t
      const dy = py - ab.y * t
      const dz = pz - ab.z * t
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t)
    },
    along(x, y, z) {
      const t = ((x - A.x) * ab.x + (y - A.y) * ab.y + (z - A.z) * ab.z) / L2
      return t * 2 - 1
    },
    axis() {
      return ab.clone().normalize()
    },
    box() {
      const bx = new THREE.Box3().setFromPoints([A, B])
      return bx.expandByScalar(this.R)
    },
  }
}

// ---------- รายการชิ้นส่วนร่างกาย ----------
// opts: g = กลุ่มกล้ามเนื้อ (ตรงกับ MUSCLES ของแอป หรือ 'base') ; reg = ช่วงร่างกาย (ใช้กำหนด bone ตอน skinning)
//       kind = muscle | core | tendon | smooth | shorts ; ends = ปลายที่เป็นเส้นเอ็นขาว (-1 ล่าง / 1 บน ตามแกนยาว) ; k = ความนุ่มรอยต่อ
//       fiber = ทิศเส้นใย (ถ้าไม่ใช่แกนยาว) ; sub = ตัดเนื้อออก (เบ้าตา)
function parts() {
  const P = []
  const add = (shape, o) => P.push({ shape, g: o.g ?? 'base', reg: o.reg, kind: o.kind ?? 'muscle', ends: o.ends ?? [], k: o.k ?? 0.02, fiber: o.fiber ?? null, sub: !!o.sub, name: o.name, layer: o.layer ?? layerOf(o.reg) })
  // ชั้นผิว: ลำตัว/ศีรษะ/กางเกง = body ; แขน (รวม deltoid) และขาแต่ละข้างเป็นผิวปิดของตัวเองที่ซ้อนเข้าไปในลำตัว
  // -> แขน/ขาไม่หลอมติดลำตัวหรือขาอีกข้างตรงจุดที่อยู่ใกล้กัน (ไม่มีพังผืดยืดเวลาขยับ) แต่ยังดูเป็นร่างเดียว
  function layerOf(reg) {
    const m = /^([LR])(upperarm|forearm|hand|:)/.exec(reg) || /^([LR]):/.exec(reg)
    if (m) return 'arm' + m[1]
    const l = /^([LR])(thigh|shin|foot)$/.exec(reg)
    if (l) return 'leg' + l[1]
    return 'body'
  }
  const E = (name, c, r, rot, o) => add(makeEll(c, r, rot), { name, ...o })
  const C = (name, a, b, ra, rb, o) => add(makeCap(a, b, ra, rb), { name, ...o })
  // ---- ศีรษะ / คอ (เรียบ ไม่มีลายเส้นใย ไม่มีรอยกะโหลก) ----
  const head = { reg: 'head', kind: 'smooth', k: 0.018 }
  E('cranium', [0, 1.655, 0.004], [0.077, 0.092, 0.097], [0, 0, 0], head)
  E('face', [0, 1.602, 0.042], [0.063, 0.074, 0.071], [0, 0, 0], head)
  E('jaw', [0, 1.556, 0.054], [0.053, 0.035, 0.05], [-8, 0, 0], head)
  E('chin', [0, 1.534, 0.086], [0.021, 0.018, 0.02], [0, 0, 0], { ...head, k: 0.01 })
  E('brow', [0, 1.654, 0.094], [0.052, 0.013, 0.016], [0, 0, 0], { ...head, k: 0.016 })
  C('noseBridge', [0, 1.636, 0.106], [0, 1.603, 0.121], 0.0065, 0.0098, { ...head, k: 0.006 })
  E('noseTip', [0, 1.599, 0.115], [0.015, 0.009, 0.01], [0, 0, 0], { ...head, k: 0.006 })
  E('lips', [0, 1.567, 0.102], [0.022, 0.009, 0.009], [0, 0, 0], { ...head, k: 0.006 })
  for (const s of [1, -1]) {
    E(`cheek${s}`, [0.046 * s, 1.613, 0.083], [0.021, 0.013, 0.013], [0, 0, 0], { ...head, k: 0.022 })
    E(`socket${s}`, [0.031 * s, 1.636, 0.113], [0.0145, 0.011, 0.012], [0, 0, 0], { ...head, sub: true, k: 0.01 })
    E(`lid${s}`, [0.031 * s, 1.635, 0.097], [0.0125, 0.0105, 0.0105], [0, 0, 0], { ...head, k: 0.006 })
    E(`ear${s}`, [0.078 * s, 1.613, -0.002], [0.008, 0.03, 0.018], [0, 15 * s, 0], { ...head, k: 0.004 })
  }
  C('neck', [0, 1.425, -0.012], [0, 1.575, 0.002], 0.062, 0.052, { reg: 'neck', kind: 'core', k: 0.02 })
  for (const s of [1, -1]) C(`scm${s}`, [0.034 * s, 1.448, 0.056], [0.056 * s, 1.565, -0.004], 0.015, 0.013, { reg: 'neck', g: 'base', k: 0.006 })

  // ---- ลำตัว (แกน) ----
  E('ribcage', [0, 1.268, 0.0], [0.146, 0.18, 0.104], [0, 0, 0], { reg: 'chest', kind: 'core', k: 0.03 })
  E('girdle', [0, 1.385, -0.012], [0.172, 0.072, 0.088], [0, 0, 0], { reg: 'chest', kind: 'core', k: 0.03 })
  E('belly', [0, 1.075, 0.004], [0.128, 0.13, 0.09], [0, 0, 0], { reg: 'abdomen', kind: 'core', k: 0.03 })
  E('pelvis', [0, 0.93, -0.006], [0.152, 0.104, 0.1], [0, 0, 0], { reg: 'pelvis', kind: 'core', k: 0.03 })
  // linea alba (ร่องกลางท้องเป็นพังผืดขาว)
  E('lineaAlba', [0, 1.075, 0.092], [0.004, 0.13, 0.007], [0, 0, 0], { reg: 'abdomen', kind: 'tendon', k: 0.004 })

  for (const s of [1, -1]) {
    const sh = { reg: `${s > 0 ? 'L' : 'R'}shoulder` }
    const n = s > 0 ? 'L' : 'R'
    E(`shoulderFill${n}`, [0.168 * s, 1.385, -0.004], [0.06, 0.06, 0.066], [0, 0, 0], { ...sh, kind: 'core', k: 0.03 })
    // อก (pectoralis major) สองส่วน — เส้นใยวิ่งไปหาต้นแขน
    E(`pecUpper${n}`, [0.074 * s, 1.318, 0.084], [0.086, 0.052, 0.031], [0, 0, -10 * s], { ...sh, g: 'chest', fiber: [1 * s, 0.25, 0], k: 0.016 })
    E(`pecLower${n}`, [0.07 * s, 1.262, 0.086], [0.08, 0.04, 0.028], [0, 0, 14 * s], { ...sh, g: 'chest', fiber: [1 * s, 0.45, 0], k: 0.016 })
    // ไหล่ (deltoid) หน้า / ข้าง / หลัง
    E(`deltFront${n}`, [0.19 * s, 1.37, 0.036], [0.044, 0.08, 0.04], [12, 0, 10 * s], { ...sh, g: 'shoulders', ends: [-1], layer: 'arm' + n })
    E(`deltSide${n}`, [0.214 * s, 1.365, -0.002], [0.05, 0.088, 0.058], [0, 0, 14 * s], { ...sh, g: 'shoulders', ends: [-1], layer: 'arm' + n })
    E(`deltRear${n}`, [0.19 * s, 1.368, -0.04], [0.044, 0.078, 0.04], [-12, 0, 10 * s], { ...sh, g: 'shoulders', ends: [-1], layer: 'arm' + n })
    // หลัง: trapezius บน/กลาง, lats, infraspinatus/teres, rhomboid, erector spinae
    E(`trapUpper${n}`, [0.086 * s, 1.44, -0.036], [0.083, 0.034, 0.04], [0, 0, -24 * s], { reg: 'chest', g: 'back', fiber: [1 * s, -0.4, 0] })
    E(`trapMid${n}`, [0.052 * s, 1.335, -0.09], [0.07, 0.085, 0.025], [0, 0, 8 * s], { reg: 'chest', g: 'back', fiber: [1 * s, 0.1, 0] })
    E(`lat${n}`, [0.112 * s, 1.18, -0.064], [0.064, 0.155, 0.045], [0, 18 * s, -16 * s], { ...sh, g: 'back', fiber: [0.6 * s, 1, 0] })
    E(`infra${n}`, [0.118 * s, 1.31, -0.086], [0.058, 0.044, 0.025], [0, 10 * s, 22 * s], { ...sh, g: 'back', fiber: [1 * s, 0.2, 0] })
    E(`teres${n}`, [0.15 * s, 1.27, -0.075], [0.035, 0.025, 0.024], [0, 0, 30 * s], { ...sh, g: 'back', fiber: [1 * s, 0.5, 0] })
    E(`erector${n}`, [0.032 * s, 1.07, -0.094], [0.026, 0.16, 0.028], [0, 0, 0], { reg: 'abdomen', g: 'back', ends: [-1] })
    // หน้าท้อง: rectus abdominis 4 ระดับ (ร่องระหว่างก้อน = เส้นเอ็นขวาง) + obliques + serratus
    for (const [i, y] of [1.172, 1.106, 1.04].entries()) E(`abs${i}${n}`, [0.034 * s, y, 0.092 - i * 0.002], [0.033, 0.032, 0.015], [0, 0, 0], { reg: i === 0 ? 'chest' : 'abdomen', g: 'abs', k: 0.008 })
    E(`absLow${n}`, [0.03 * s, 0.965, 0.085], [0.03, 0.048, 0.014], [0, 0, 0], { reg: 'abdomen', g: 'abs', k: 0.008 })
    E(`oblique${n}`, [0.114 * s, 1.06, 0.03], [0.034, 0.09, 0.062], [0, 0, 8 * s], { reg: 'abdomen', g: 'abs', fiber: [-0.5 * s, -1, 0.6] })
    for (const [i, y] of [1.2, 1.235, 1.27].entries()) E(`serratus${i}${n}`, [0.134 * s, y, 0.06], [0.022, 0.015, 0.024], [0, 0, -30 * s], { reg: 'chest', g: 'base', fiber: [1 * s, 0.4, 0] })
    // ก้น
    E(`gluteMax${n}`, [0.078 * s, 0.868, -0.086], [0.086, 0.1, 0.07], [-10, 0, 8 * s], { reg: 'pelvis', g: 'glutes', fiber: [1 * s, -0.7, 0] })
    E(`gluteMed${n}`, [0.135 * s, 0.94, -0.03], [0.045, 0.056, 0.05], [0, 0, -10 * s], { reg: 'pelvis', g: 'glutes', fiber: [0.3 * s, -1, 0] })

    // ---- แขน ----
    const [shx, shy, shz] = JOINTS[`shoulder${n}`]
    const [elx, ely, elz] = JOINTS[`elbow${n}`]
    const [wrx, wry, wrz] = JOINTS[`wrist${n}`]
    const ua = { reg: `${n}upperarm` }
    const fa = { reg: `${n}forearm` }
    C(`humerus${n}`, [shx, shy - 0.03, shz], [elx, ely, elz], 0.039, 0.031, { ...ua, kind: 'core', k: 0.015 })
    E(`biceps${n}`, [0.2 * s, 1.236, 0.03], [0.034, 0.088, 0.033], [0, 0, 6 * s], { ...ua, g: 'biceps', ends: [-1] })
    E(`brachialis${n}`, [0.218 * s, 1.165, 0.012], [0.029, 0.05, 0.027], [0, 0, 8 * s], { ...ua, g: 'biceps' })
    E(`tricepsLong${n}`, [0.196 * s, 1.262, -0.041], [0.033, 0.1, 0.034], [0, 0, 6 * s], { ...ua, g: 'triceps', ends: [-1] })
    E(`tricepsLat${n}`, [0.226 * s, 1.27, -0.024], [0.025, 0.072, 0.028], [0, 0, 8 * s], { ...ua, g: 'triceps' })
    E(`tricepsTendon${n}`, [0.206 * s, 1.15, -0.036], [0.022, 0.036, 0.012], [0, 0, 6 * s], { ...ua, kind: 'tendon', k: 0.006 })
    C(`forearm${n}`, [elx, ely, elz], [wrx, wry + 0.01, wrz], 0.033, 0.021, { ...fa, kind: 'core', k: 0.015 })
    E(`brachiorad${n}`, [0.232 * s, 1.06, 0.008], [0.026, 0.078, 0.026], [0, 0, 8 * s], { ...fa, g: 'forearms', ends: [-1] })
    E(`flexors${n}`, [0.206 * s, 1.03, 0.022], [0.03, 0.088, 0.026], [0, 0, 7 * s], { ...fa, g: 'forearms', ends: [-1] })
    E(`extensors${n}`, [0.229 * s, 1.012, -0.012], [0.027, 0.088, 0.025], [0, 0, 7 * s], { ...fa, g: 'forearms', ends: [-1] })
    // ---- มือ ----
    const h = handLayout(n)
    const W = h.W
    E(`palm${n}`, [W.x, W.y - 0.048, W.z + 0.004], [0.04, 0.048, 0.016], [0, 0, 0], { reg: `${n}hand`, kind: 'smooth', k: 0.008 })
    E(`hypothenar${n}`, [W.x - 0.027 * s, W.y - 0.05, W.z + 0.009], [0.012, 0.03, 0.012], [0, 0, 0], { reg: `${n}hand`, kind: 'smooth', k: 0.008 })
    for (const f of [...FINGERS, 'thumb']) {
      const { base, axis, len, r } = h.fingers[f]
      const fr = SEG_FRAC[f === 'thumb' ? 'thumb' : 'finger']
      let p = base.clone()
      fr.forEach((frac, k) => {
        const q = p.clone().addScaledVector(axis, len * frac)
        const r0 = r * (1 - 0.07 * k)
        const r1 = r * (1 - 0.07 * (k + 1))
        // ปลายแคปซูลชนกันพอดีที่ข้อนิ้ว (ไม่ทับยาว) ; โคนนิ้วฝังในฝ่ามือเล็กน้อย
        const a = k === 0 && f !== 'thumb' ? p.clone().addScaledVector(axis, -0.008) : p
        C(`${f}${k}${n}`, a.toArray(), q.toArray(), r0, r1, { reg: `${n}:${f}:${k}`, kind: 'smooth', k: k === 0 ? 0.004 : 0.002 })
        if (f === 'thumb' && k === 0) E(`thenar${n}`, p.clone().lerp(q, 0.5).add(V(-0.006 * s, 0, 0.004)).toArray(), [0.017, 0.03, 0.015], [-20, 0, -30 * s], { reg: `${n}hand`, kind: 'smooth', k: 0.01 })
        p = q
      })
    }

    // ---- ขา ----
    const [hx, hy, hz] = JOINTS[`hip${n}`]
    const [kx, ky, kz] = JOINTS[`knee${n}`]
    const [ax, ay, az] = JOINTS[`ankle${n}`]
    const th = { reg: `${n}thigh` }
    const sn = { reg: `${n}shin` }
    C(`femur${n}`, [hx, hy - 0.02, hz], [kx, ky + 0.02, kz], 0.074, 0.05, { ...th, kind: 'core', k: 0.02 })
    E(`vastusLat${n}`, [0.122 * s, 0.62, 0.014], [0.05, 0.17, 0.056], [0, 0, 4 * s], { ...th, g: 'quads', ends: [-1] })
    E(`rectusFem${n}`, [0.088 * s, 0.645, 0.056], [0.04, 0.18, 0.038], [4, 0, 0], { ...th, g: 'quads', ends: [-1] })
    E(`vastusMed${n}`, [0.054 * s, 0.51, 0.04], [0.044, 0.076, 0.044], [0, 0, -12 * s], { ...th, g: 'quads' })
    E(`adductor${n}`, [0.046 * s, 0.705, 0.0], [0.045, 0.14, 0.056], [0, 0, -8 * s], { ...th, g: 'base' })
    C(`sartorius${n}`, [0.122 * s, 0.83, 0.062], [0.042 * s, 0.5, 0.012], 0.0125, 0.011, { ...th, g: 'base', k: 0.005 })
    E(`bicepsFem${n}`, [0.106 * s, 0.63, -0.048], [0.04, 0.17, 0.045], [0, 0, 4 * s], { ...th, g: 'hamstrings', ends: [-1] })
    E(`semiT${n}`, [0.062 * s, 0.63, -0.052], [0.04, 0.17, 0.045], [0, 0, -3 * s], { ...th, g: 'hamstrings', ends: [-1] })
    E(`patella${n}`, [kx, 0.452, 0.056], [0.024, 0.027, 0.015], [0, 0, 0], { ...sn, kind: 'tendon', k: 0.008 })
    C(`patellarT${n}`, [kx, 0.432, 0.056], [kx, 0.372, 0.05], 0.009, 0.009, { ...sn, kind: 'tendon', k: 0.006 })
    E(`knee${n}`, [kx, ky, kz], [0.052, 0.054, 0.052], [0, 0, 0], { ...sn, kind: 'core', k: 0.02 })
    C(`tibia${n}`, [kx, ky - 0.02, kz], [ax, ay + 0.04, az], 0.046, 0.027, { ...sn, kind: 'core', k: 0.02 })
    E(`gastroMed${n}`, [0.06 * s, 0.33, -0.046], [0.038, 0.096, 0.04], [0, 0, -4 * s], { ...sn, g: 'calves', ends: [-1] })
    E(`gastroLat${n}`, [0.102 * s, 0.34, -0.04], [0.034, 0.088, 0.036], [0, 0, 4 * s], { ...sn, g: 'calves', ends: [-1] })
    E(`soleus${n}`, [0.08 * s, 0.23, -0.032], [0.046, 0.1, 0.034], [0, 0, 0], { ...sn, g: 'calves', ends: [-1] })
    C(`achilles${n}`, [0.079 * s, 0.17, -0.042], [0.078 * s, 0.065, -0.05], 0.009, 0.011, { ...sn, kind: 'tendon', k: 0.008 })
    E(`tibialis${n}`, [0.098 * s, 0.27, 0.034], [0.02, 0.12, 0.02], [0, 0, 3 * s], { ...sn, g: 'base', ends: [-1] })
    // ---- เท้า (ฝ่าเท้าราบที่ y = 0) ----
    const ft = { reg: `${n}foot`, kind: 'smooth', k: 0.014 }
    E(`ankleJ${n}`, [ax, ay + 0.005, az], [0.03, 0.028, 0.032], [0, 0, 0], ft)
    E(`heel${n}`, [0.077 * s, 0.033, -0.035], [0.032, 0.036, 0.04], [0, 0, 0], ft)
    C(`footBody${n}`, [0.08 * s, 0.032, -0.005], [0.108 * s, 0.022, 0.125], 0.036, 0.031, ft)
    C(`toes${n}`, [0.085 * s, 0.014, 0.148], [0.128 * s, 0.013, 0.165], 0.015, 0.012, ft)

    // ---- กางเกงขาสั้นสีดำ: เปลือกผ้าเรียบคลุมสะโพก-กลางต้นขา (ขอบเอว/ขากางเกงตัดตรง) ----
    C(`shortsLeg${n}`, [0.086 * s, 0.86, -0.006], [0.094 * s, 0.66, 0.002], 0.09, 0.08, { reg: `${n}thigh`, kind: 'shorts', k: 0.012, layer: 'body' })
  }
  E('shortsHip', [0, 0.905, -0.02], [0.17, 0.122, 0.128], [0, 0, 0], { reg: 'pelvis', kind: 'shorts', k: 0.012 })
  for (const s of [1, -1]) E(`shortsSeat${s}`, [0.078 * s, 0.868, -0.09], [0.093, 0.108, 0.076], [-10, 0, 8 * s], { reg: 'pelvis', kind: 'shorts', k: 0.016 })
  return P
}

// แกนตั้งฉากเส้นใยของแต่ละมัด (คงที่ทั้งมัด): ตั้งฉากทั้งทิศเส้นใยและทิศออกจากแกนกลางลำตัว -> ริ้วตรงขนานตามแนวมัด
// พิกัดเส้นใย = ระยะโค้งรอบแกนเส้นใยของมัด (มุม x รัศมีเฉลี่ย) -> ริ้ววิ่งตามความยาวมัด ไม่เป็นวงแหวน
// มุม 0 หันออกจากแกนกลางลำตัว รอยต่อของมุม (±180°) จึงอยู่ด้านในที่แนบตัว (มองไม่เห็น)
function fiberFrame(p) {
  if (p._f) return p._f
  const f = p.fiber ? V(...p.fiber).normalize() : p.shape.axis()
  const c = p.shape.c || p.shape.a.clone().lerp(p.shape.b, 0.5)
  let out = V(c.x, 0, c.z + 0.03)
  if (out.lengthSq() < 1e-6) out = V(0, 0, 1)
  out.normalize()
  let e1 = out.clone().addScaledVector(f, -out.dot(f))
  if (e1.lengthSq() < 0.05) e1 = V(0, 1, 0).addScaledVector(f, -f.y)
  e1.normalize()
  const e2 = V().crossVectors(f, e1)
  const R = p.shape.r ? (p.shape.r[0] + p.shape.r[1] + p.shape.r[2]) / 3 : p.shape.R
  p._f = { c, e1, e2, R }
  return p._f
}
function fiberCoord(p, q) {
  const { c, e1, e2, R } = fiberFrame(p)
  const t = q.clone().sub(c)
  return Math.atan2(t.dot(e2), t.dot(e1)) * R
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a, b, k) => -smin(-a, -b, k)
export const SHORTS_TOP = 1.003
export const SHORTS_HEM = 0.668

// ---------- สร้าง mesh ----------
// คืน { geometry (position, normal, index + attributes ลายผิว), vReg (ช่วงร่างกายต่อ vertex), vGroup, parts }
export function buildBodyMeshes({ h = 0.004 } = {}) {
  const all = parts()
  const layers = [...new Set(all.map((p) => p.layer))]
  return layers.map((layer) => {
    const P = all.filter((p) => p.layer === layer)
    const box = new THREE.Box3()
    for (const p of P) box.union(p.shape.box())
    box.expandByScalar(0.03)
    const min = box.min.max(V(-0.34, -0.006, -0.2))
    const max = box.max.min(V(0.34, 1.76, 0.24))
    return { layer, ...buildLayer(P, min, max, h) }
  })
}
function buildLayer(P, min, max, h) {
  const nx = Math.ceil((max.x - min.x) / h) + 1
  const ny = Math.ceil((max.y - min.y) / h) + 1
  const nz = Math.ceil((max.z - min.z) / h) + 1
  const F = new Float32Array(nx * ny * nz).fill(0.05)
  const id = (i, j, k) => i + nx * (j + ny * k)
  const shortsSlab = (y) => Math.max(y - SHORTS_TOP, SHORTS_HEM - y)
  const t3 = [0, 0, 0]
  // 1) รวมชิ้นส่วน (smooth union) ; ตัดเบ้าตา (smooth subtraction) ทีหลัง
  for (const pass of [false, true]) {
    for (const p of P) {
      if (p.sub !== pass) continue
      const b = p.shape.box().expandByScalar(p.k + 0.012)
      const i0 = Math.max(0, Math.floor((b.min.x - min.x) / h))
      const i1 = Math.min(nx - 1, Math.ceil((b.max.x - min.x) / h))
      const j0 = Math.max(0, Math.floor((b.min.y - min.y) / h))
      const j1 = Math.min(ny - 1, Math.ceil((b.max.y - min.y) / h))
      const k0 = Math.max(0, Math.floor((b.min.z - min.z) / h))
      const k1 = Math.min(nz - 1, Math.ceil((b.max.z - min.z) / h))
      for (let k = k0; k <= k1; k++) {
        const z = min.z + k * h
        for (let j = j0; j <= j1; j++) {
          const y = min.y + j * h
          for (let i = i0; i <= i1; i++) {
            const x = min.x + i * h
            let d = p.shape.sdf(x, y, z, t3)
            if (p.kind === 'shorts') d = Math.max(d, shortsSlab(y))
            const n = id(i, j, k)
            F[n] = pass ? smax(F[n], -d, p.k) : smin(F[n], d, p.k)
          }
        }
      }
    }
  }
  // ฝ่าเท้าราบ: ไม่มีเนื้อใต้ y = 0
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const y = min.y + j * h
    if (y > 0.004) break
    for (let i = 0; i < nx; i++) {
      const n = id(i, j, k)
      F[n] = Math.max(F[n], -y)
    }
  }

  // 2) Surface Nets: vertex หนึ่งจุดต่อ cell ที่ผิวตัดผ่าน (ค่าเฉลี่ยจุดตัดบนขอบ) -> quad ต่อขอบที่เปลี่ยนเครื่องหมาย
  const cellV = new Int32Array(nx * ny * nz).fill(-1)
  const pos = []
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  const val = new Float32Array(8)
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0
    for (let c = 0; c < 8; c++) {
      const [a, b, d] = corner[c]
      val[c] = F[id(i + a, j + b, k + d)]
      if (val[c] < 0) mask |= 1 << c
    }
    if (mask === 0 || mask === 255) continue
    let sx = 0
    let sy = 0
    let sz = 0
    let cnt = 0
    for (const [e0, e1] of edges) {
      if ((val[e0] < 0) === (val[e1] < 0)) continue
      const t = val[e0] / (val[e0] - val[e1])
      const A = corner[e0]
      const B = corner[e1]
      sx += A[0] + (B[0] - A[0]) * t
      sy += A[1] + (B[1] - A[1]) * t
      sz += A[2] + (B[2] - A[2]) * t
      cnt++
    }
    cellV[id(i, j, k)] = pos.length / 3
    pos.push(min.x + (i + sx / cnt) * h, min.y + (j + sy / cnt) * h, min.z + (k + sz / cnt) * h)
  }
  const index = []
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    if (flip) index.push(a, c, b, a, d, c)
    else index.push(a, b, c, a, c, d)
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const inside = F[id(i, j, k)] < 0
    if (inside !== (F[id(i + 1, j, k)] < 0)) quad(cellV[id(i, j - 1, k - 1)], cellV[id(i, j, k - 1)], cellV[id(i, j, k)], cellV[id(i, j - 1, k)], inside)
    if (inside !== (F[id(i, j + 1, k)] < 0)) quad(cellV[id(i - 1, j, k - 1)], cellV[id(i - 1, j, k)], cellV[id(i, j, k)], cellV[id(i, j, k - 1)], inside)
    if (inside !== (F[id(i, j, k + 1)] < 0)) quad(cellV[id(i - 1, j - 1, k)], cellV[id(i, j - 1, k)], cellV[id(i, j, k)], cellV[id(i - 1, j, k)], inside)
  }

  // 3) normal จาก gradient ของ field (เรียบกว่า normal ของหน้า)
  const nv = pos.length / 3
  const nor = new Float32Array(nv * 3)
  const sample = (x, y, z) => {
    const fx = clamp((x - min.x) / h, 0, nx - 1.001)
    const fy = clamp((y - min.y) / h, 0, ny - 1.001)
    const fz = clamp((z - min.z) / h, 0, nz - 1.001)
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const k = Math.floor(fz)
    const u = fx - i
    const v = fy - j
    const w = fz - k
    const g = (a, b, c) => F[id(i + a, j + b, k + c)]
    return (
      (g(0, 0, 0) * (1 - u) + g(1, 0, 0) * u) * (1 - v) * (1 - w) + (g(0, 1, 0) * (1 - u) + g(1, 1, 0) * u) * v * (1 - w) +
      (g(0, 0, 1) * (1 - u) + g(1, 0, 1) * u) * (1 - v) * w + (g(0, 1, 1) * (1 - u) + g(1, 1, 1) * u) * v * w
    )
  }
  for (let n = 0; n < nv; n++) {
    const x = pos[n * 3]
    const y = pos[n * 3 + 1]
    const z = pos[n * 3 + 2]
    const gx = sample(x + h, y, z) - sample(x - h, y, z)
    const gy = sample(x, y + h, z) - sample(x, y - h, z)
    const gz = sample(x, y, z + h) - sample(x, y, z - h)
    const l = Math.hypot(gx, gy, gz) || 1
    nor.set([gx / l, gy / l, gz / l], n * 3)
  }
  // ทิศหน้า triangle ให้ตรงกับ normal (ผิวหันออก)
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]]
    const ux = pos[b * 3] - pos[a * 3]
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1]
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2]
    const vx = pos[c * 3] - pos[a * 3]
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1]
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2]
    const fx = uy * vz - uz * vy
    const fy = uz * vx - ux * vz
    const fz = ux * vy - uy * vx
    if (fx * (nor[a * 3] + nor[b * 3] + nor[c * 3]) + fy * (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) + fz * (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) < 0) {
      index[t + 1] = c
      index[t + 2] = b
    }
  }

  // 4) ลายผิวต่อ vertex: มัดที่ใกล้สุด -> กลุ่ม / ช่วงร่างกาย / เส้นใย / ปลายเอ็น / ร่องระหว่างมัด / กางเกง
  const aU = new Float32Array(nv)
  const aFib = new Float32Array(nv)
  const aTendon = new Float32Array(nv)
  const aGroove = new Float32Array(nv)
  const aShorts = new Float32Array(nv)
  const vReg = new Array(nv)
  const vGroup = new Array(nv)
  const boxes = P.map((p) => p.shape.box().expandByScalar(0.02))
  const q = V()
  for (let n = 0; n < nv; n++) {
    const x = pos[n * 3]
    const y = pos[n * 3 + 1]
    const z = pos[n * 3 + 2]
    q.set(x, y, z)
    let best = null
    let bd = Infinity
    let best2 = Infinity
    let shortsD = Infinity
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      if (p.sub || !boxes[i].containsPoint(q)) continue
      let d = p.shape.sdf(x, y, z, t3)
      if (p.kind === 'shorts') {
        shortsD = Math.min(shortsD, Math.max(d, shortsSlab(y)))
        continue
      }
      if (d < bd) {
        if (best && best.kind === 'muscle') best2 = Math.min(best2, bd)
        bd = d
        best = p
      } else if (p.kind === 'muscle' && d < best2) best2 = d
    }
    if (!best) best = P.find((p) => p.name === 'belly')
    const shorts = shortsD < 0.0015 && !/upperarm|forearm|hand|:/.test(best.reg)
    aShorts[n] = shorts ? 1 : 0
    // ช่วงร่างกาย: ผิวกางเกงใช้ตำแหน่ง (เชิงกราน / ต้นขา)
    vReg[n] = shorts ? (y > 0.85 ? 'pelvis' : x >= 0 ? 'Lthigh' : 'Rthigh') : best.reg
    vGroup[n] = best.kind === 'muscle' && (!shorts || bd < 0.035) ? best.g : 'base'
    if (shorts) continue
    if (best.kind === 'muscle') {
      aFib[n] = 1
      if (best.kind === 'muscle' && best2 < Infinity) aGroove[n] = 1 - smooth(0.0, 0.0045, best2 - bd)
      const t = best.shape.along(x, y, z, t3)
      for (const e of best.ends) aTendon[n] = Math.max(aTendon[n], smooth(0.62, 0.95, t * e))
      // ลายเส้นใย: พิกัดตั้งฉากกับทิศเส้นใยบนผิว (ริ้ววิ่งตามแนวมัด)
      aU[n] = fiberCoord(best, q)
    } else if (best.kind === 'tendon') {
      aTendon[n] = 1
      aFib[n] = 0.35
      aU[n] = fiberCoord(best, q)
    } else if (best.kind === 'core') {
      // แกนลำตัว/แขนขาที่โผล่ระหว่างมัด = พังผืดเทาเข้มเล็กน้อย (มีริ้วจาง ๆ)
      aFib[n] = 0.4
      aGroove[n] = 0.35
      aU[n] = x * 0.7 + z * 0.7
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setIndex(index)
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
  geo.setAttribute('aFib', new THREE.BufferAttribute(aFib, 1))
  geo.setAttribute('aTendon', new THREE.BufferAttribute(aTendon, 1))
  geo.setAttribute('aGroove', new THREE.BufferAttribute(aGroove, 1))
  geo.setAttribute('aShorts', new THREE.BufferAttribute(aShorts, 1))
  geo.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(nv), 1))
  return { geometry: geo, vReg, vGroup, stats: { nv, tris: index.length / 3, grid: [nx, ny, nz] } }
}
