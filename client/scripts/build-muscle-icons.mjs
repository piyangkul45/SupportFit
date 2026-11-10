// สร้างภาพการ์ดหมวดกล้ามเนื้อ (MuscleCategorySelector / BodyPartFilter) -> client/public/muscles/<key>.webp
// หุ่นกล้ามเนื้อ 3D สีเงิน-เทา มัดกล้ามเนื้อเป้าหมายสีแดง-ส้ม พื้นโปร่งใส (cutout) ซูมเฉพาะส่วนตามหมวด 720×540 (4:3)
// ใช้หุ่นตัวเดียวกับวิดีโอสาธิตท่า (scripts/mannequin/scene.js โหมด window.still)
//
// ใช้งาน: npm i --prefix <tools-dir> three@0.170.0 puppeteer-core@23 ffmpeg-static@5
//         TOOLS_DIR=<tools-dir> CHROME_PATH=<path to chrome> node scripts/build-muscle-icons.mjs
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOLS = resolve(process.env.TOOLS_DIR || '.')
const toolsRequire = createRequire(pathToFileURL(TOOLS + '/'))
const puppeteer = toolsRequire('puppeteer-core')
const ffmpeg = toolsRequire('ffmpeg-static')
const THREE_DIR = join(TOOLS, 'node_modules', 'three')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT_DIR = resolve(HERE, '../public/muscles')

// key = หมวดใน BODY_PARTS (+ all) ; az: 0 = มองด้านหน้า, 180 = ด้านหลัง ; focus = กลุ่มกล้ามเนื้อที่ใช้จัดเฟรม
export const ICONS = {
  // all = ร่างเต็มตัวด้านหน้า + ด้านหลังคู่กัน (เต็มกรอบ 4:3)
  all: { primary: ['fullbody'], focus: ['body'], az: 18, pairAz: 198, el: 4, pad: 0.02, pose: { uarmA: 14, farm: -8, thigh: [-4, 4] } },
  chest: { primary: ['chest'], focus: ['chest'], az: 16, el: 6, pad: 0.13, pose: { uarmA: 24, farm: -10 } },
  back: { primary: ['back'], focus: ['back'], az: 162, el: 8, pad: 0.12, pose: { uarmA: 26, farm: -10 } },
  shoulders: { primary: ['shoulders'], focus: ['shoulders'], az: 26, el: 8, pad: 0.12, pose: { uarmA: 34, farm: -14 } },
  arms: {
    primary: ['biceps', 'triceps', 'forearms'], focus: ['biceps', 'triceps', 'forearms', 'shoulders'], az: 14, el: 4, pad: 0.05,
    pose: { uarmA: 84, uarmRoll: 90, elbowR: -105 }, // ท่าเกร็งต้นแขนคู่ (double biceps)
  },
  core: { primary: ['abs'], focus: ['abs'], az: 14, el: 4, pad: 0.11, pose: { uarmA: 22, farm: -10 } },
  glutes: { primary: ['glutes'], focus: ['glutes'], az: 148, el: 6, pad: 0.15, pose: { uarmA: 14, thigh: [-8, 8], shin: [-2, 12] } },
  legs: { primary: ['quads', 'hamstrings', 'calves'], focus: ['quads', 'hamstrings', 'calves'], az: 26, el: 2, pad: 0.05, pose: { uarmA: 14, thigh: [-6, 6], thighA: 6 } },
}

const TYPES = { '.js': 'text/javascript', '.html': 'text/html' }
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const file = url.startsWith('/three/') ? join(THREE_DIR, url.slice(7)) : join(HERE, 'mannequin', url)
  if (!existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

mkdirSync(OUT_DIR, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'muscle-icons-'))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))
try {
  for (const [key, spec] of Object.entries(ICONS)) {
    await page.goto(`${BASE}/scene.html?detail=1`)
    await page.waitForFunction('window.ready === true', { timeout: 30000 })
    // เรนเดอร์ 2 เท่าแล้วย่อ ให้ขอบเรียบ ; pairAz = เรนเดอร์อีกมุมแล้ววางคู่กัน (ครึ่งกรอบต่อภาพ)
    const shots = spec.pairAz == null ? [{ az: spec.az, width: 1440 }] : [{ az: spec.az, width: 720 }, { az: spec.pairAz, width: 720 }]
    const pngs = []
    for (const [i, shot] of shots.entries()) {
      if (i) {
        await page.goto(`${BASE}/scene.html?detail=1`)
        await page.waitForFunction('window.ready === true', { timeout: 30000 })
      }
      const url = await page.evaluate((s) => window.still(s), { ...spec, az: shot.az, width: shot.width, height: 1080 })
      const png = join(work, `${key}-${i}.png`)
      writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'))
      pngs.push(png)
    }
    const out = join(OUT_DIR, `${key}.webp`)
    const inputs = pngs.flatMap((p) => ['-i', p])
    const filter = (pngs.length > 1 ? '[0][1]hstack=inputs=2,' : '') + 'scale=720:540:flags=lanczos,format=yuva420p'
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-c:v', 'libwebp', '-quality', '86', out])
    const size = await page.evaluate(() => window.lastFocus)
    console.log(`${key.padEnd(10)} ${Math.round(statSync(out).size / 1024)}KB  focus ${size.map((v) => v.toFixed(2)).join('x')}`)
  }
} finally {
  await browser.close()
  server.close()
  rmSync(work, { recursive: true, force: true })
}
