// สร้างภาพกายวิภาค 3D ทั้งหมดของแอป:
//   - การ์ดหมวดกล้ามเนื้อ (MuscleCategorySelector / BodyPartFilter) -> public/muscles/<key>.webp
//   - กล้ามเนื้อเดี่ยว (ชิปใน MuscleTargetCard) -> public/muscles/m-<muscle>.webp
//   - รูปกล้ามเนื้อเป้าหมายของแต่ละท่า ด้านหน้า+หลัง (MuscleTargetCard / AI Coach) -> public/mannequin/<slug>-target.webp
// โมเดลกายวิภาคจริง (BodyParts3D + Z-Anatomy) ร่างสีเทาเงินเมทัลลิก ลายเส้นใยกล้ามเนื้อ มัดเป้าหมายเรืองแสงส้ม-แดง
// พื้นโปร่งใส (cutout) 720×540 (4:3) ซูมเฉพาะส่วนตามหมวด ; ใช้ฉากเดียวกับวิดีโอสาธิตท่า (scripts/mannequin/scene.js โหมด still)
//
// ใช้งาน: npm i --prefix <tools-dir> three@0.170.0 puppeteer-core@23 ffmpeg-static@5
//         TOOLS_DIR=<tools-dir> CHROME_PATH=<path to chrome> node scripts/build-muscle-icons.mjs [key ...]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureAnatomyData, launchBrowser, openScene, startServer, toolsRequire } from './mannequin/render-server.mjs'
import { EXERCISES } from '../src/utils/exerciseCatalog.js'
import { MUSCLES, getAnatomy } from '../src/utils/exerciseAnatomy.js'
import { mediaSlug } from '../src/utils/exerciseMedia.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../public/muscles')
const CLIP_DIR = resolve(HERE, '../public/mannequin')
const ffmpeg = toolsRequire('ffmpeg-static')

// az: 0 = มองตรงด้านหน้า, 180 = ด้านหลัง, + = ไปทางซ้ายของหุ่น ; focus = กลุ่มกล้ามเนื้อที่ใช้จัดเฟรม ; side = ใช้ข้างเดียว
export const ICONS = {
  // ร่างเต็มตัวด้านหน้า + ด้านหลังคู่กัน
  all: { primary: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hamstrings', 'calves'], focus: ['body'], az: 8, pairAz: 188, el: 3, pad: 0.02, pose: { uarmA: 10 } },
  // อกบน-ล่าง + ไหล่หน้า
  chest: { primary: ['chest'], focus: ['chest', 'shoulders'], az: 10, el: 6, pad: 0.03, pose: { uarmA: 16 } },
  // ปีกหลัง (lats) + ทราพีเซียส จากด้านหลัง
  back: { primary: ['back'], focus: ['back'], az: 180, el: 10, pad: 0.03, pose: { uarmA: 16 } },
  // ไหล่ (deltoids) + อกบน
  shoulders: { primary: ['shoulders'], focus: ['shoulders'], az: 24, el: 10, pad: 0.07, pose: { uarmA: 22 } },
  // แขนเบ่ง biceps ข้างซ้าย
  arms: {
    primary: ['biceps', 'triceps', 'forearms'], focus: ['biceps', 'triceps', 'forearms'], side: 'L', az: 74, el: 6, pad: 0.05,
    pose: { uarm: [-6, 0], uarmA: [10, 10], elbowR: [-100, -8] }, // ท่างอศอกบนสุดของ curl เห็น biceps นูนด้านข้าง (แขนไม่ยก ผิวไหล่ไม่ยืด)
  },
  // หน้าท้อง 6-pack + obliques
  core: { primary: ['abs'], focus: ['abs'], az: 6, el: 4, pad: 0.03, pose: { uarmA: 14 } },
  // สะโพก/ก้นจากด้านหลังเฉียง
  glutes: { primary: ['glutes'], focus: ['glutes'], az: 160, el: 6, pad: 0.06, pose: { uarmA: 10, thigh: [-6, 6] } },
  // ต้นขา quads + น่อง
  legs: { primary: ['quads', 'hamstrings', 'calves'], focus: ['quads', 'calves'], az: 20, el: 2, pad: 0.03, pose: { uarmA: 10, thighA: 4 } },
}

await ensureAnatomyData()
const { server, base } = await startServer()
const work = mkdtempSync(join(tmpdir(), 'muscle-icons-'))
const browser = await launchBrowser()
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))
mkdirSync(OUT_DIR, { recursive: true })
const only = new Set(process.argv.slice(2))
try {
  for (const [key, spec] of Object.entries(ICONS)) {
    if (only.size && !only.has(key)) continue
    // เรนเดอร์ 2 เท่าแล้วย่อ ให้ขอบเรียบ ; pairAz = อีกมุมวางคู่กัน (ครึ่งกรอบต่อภาพ)
    const shots = spec.pairAz == null ? [{ az: spec.az, width: 1440 }] : [{ az: spec.az, width: 720 }, { az: spec.pairAz, width: 720 }]
    const pngs = []
    for (const [i, shot] of shots.entries()) {
      await openScene(page, base)
      const url = await page.evaluate((s) => window.still(s), { ...spec, az: shot.az, width: shot.width, height: 1080 })
      const png = join(work, `${key}-${i}.png`)
      writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'))
      pngs.push(png)
    }
    const out = join(OUT_DIR, `${key}.webp`)
    const filter = (pngs.length > 1 ? '[0][1]hstack=inputs=2,' : '') + 'scale=720:540:flags=lanczos,format=yuva420p'
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...pngs.flatMap((p) => ['-i', p]), '-filter_complex', filter, '-c:v', 'libwebp', '-quality', '88', out])
    console.log(`${key.padEnd(10)} ${Math.round(statSync(out).size / 1024)}KB`)
  }

  // ภาพเต็มตัวแนวตั้ง (เรียก still ซ้ำในฉากเดียว ไม่ต้องโหลด mesh ใหม่)
  const FIGURE = { focus: ['body'], el: 3, pad: 0.015, pose: { uarmA: 10 }, width: 480, height: 960 }
  const shoot = async (spec, file) => {
    const url = await page.evaluate((s) => window.still(s), spec)
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  }
  const webp = (inputs, filter, out) =>
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs.flatMap((p) => ['-i', p]), '-filter_complex', filter, '-c:v', 'libwebp', '-quality', '86', out])
  if (!only.size || only.has('muscles')) {
    await openScene(page, base)
    for (const [muscle, { view }] of Object.entries(MUSCLES)) {
      if (muscle === 'fullbody') continue
      const png = join(work, `m-${muscle}.png`)
      await shoot({ ...FIGURE, primary: [muscle], az: view === 'back' ? 180 : 0 }, png)
      webp([png], 'scale=160:320:flags=lanczos,format=yuva420p', join(OUT_DIR, `m-${muscle}.webp`))
    }
    console.log('muscle chips done')
  }
  if (!only.size || only.has('targets')) {
    await openScene(page, base)
    for (const exercise of EXERCISES) {
      const anatomy = getAnatomy(exercise.name)
      if (!anatomy) continue
      const pngs = []
      for (const [i, az] of [0, 180].entries()) {
        const png = join(work, `t-${i}.png`)
        await shoot({ ...FIGURE, primary: anatomy.primary, secondary: anatomy.secondary, az }, png)
        pngs.push(png)
      }
      webp(pngs, '[0][1]hstack=inputs=2,scale=400:400:flags=lanczos,format=yuva420p', join(CLIP_DIR, `${mediaSlug(exercise.name)}-target.webp`))
    }
    console.log('exercise targets done')
  }
} finally {
  await browser.close()
  server.close()
  rmSync(work, { recursive: true, force: true })
}
