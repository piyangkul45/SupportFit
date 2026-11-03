// สร้างวิดีโอ Anatomy วนซ้ำ (MP4 + WebM) + poster (WebP) ของท่าฝึก จากภาพวาด SVG ของ Everkinetic (CC BY-SA 4.0)
// ผลลัพธ์อยู่ใน client/public/anatomy/<slug>.{mp4,webm} และ <slug>-poster.webp ซึ่ง utils/exerciseMedia.js ชี้ไป
//
// ใช้งาน (เครื่องมือไม่ได้อยู่ใน dependencies ของโปรเจกต์):
//   npm i --prefix <tools-dir> puppeteer-core@23 ffmpeg-static@5
//   TOOLS_DIR=<tools-dir> CHROME_PATH=<path to chrome> node scripts/build-exercise-videos.mjs
//
// ขั้นตอน: วาดแต่ละเฟรม (relaxation / tension) ด้วย Chrome headless เป็นเส้นขาว-เทาบนพื้นดำสนิท
// แล้ว ffmpeg ต่อเป็นลูป ท่าเริ่ม -> ค่อย ๆ เปลี่ยนเป็นท่าเกร็ง -> กลับท่าเริ่ม (ต่อรอบได้เนียน)
// พื้นดำสนิทให้ UI ใช้ mix-blend-mode: screen ทำพื้นหลังโปร่งบน Dark Mode
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EVERKINETIC_IDS, EVERKINETIC_SVG_BASE, mediaSlug } from '../src/utils/exerciseMedia.js'

const toolsRequire = createRequire(pathToFileURL(resolve(process.env.TOOLS_DIR || '.') + '/'))
const puppeteer = toolsRequire('puppeteer-core')
const ffmpeg = toolsRequire('ffmpeg-static')

const SIZE = 480
const PAD = 14 // ขอบว่างรอบภาพ (px)
const HOLD = 0.7 // วินาทีที่ค้างแต่ละท่า
const FADE = 0.35 // วินาทีที่ค่อย ๆ เปลี่ยนท่า
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/anatomy')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args])

mkdirSync(OUT_DIR, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'anatomy-'))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: SIZE, height: SIZE })

const renderFrame = async (url, file) => {
  await page.setContent(
    `<html style="margin:0;background:#000"><body style="margin:0;background:#000;overflow:hidden">
       <img src="${url}" style="position:absolute;left:${PAD}px;top:${PAD}px;width:${SIZE - 2 * PAD}px;height:${SIZE - 2 * PAD}px;object-fit:contain;filter:invert(1) grayscale(1) contrast(1.15) brightness(0.92)">
     </body></html>`,
    { waitUntil: 'domcontentloaded' }
  )
  // รอภาพ SVG โหลด + decode เสร็จ (โหลดไม่ได้ = หยุด ไม่สร้างวิดีโอเปล่า)
  await page.$eval('img', (img) => img.decode())
  await page.screenshot({ path: file })
}

try {
  for (const [name, id] of Object.entries(EVERKINETIC_IDS)) {
    const slug = mediaSlug(name)
    const start = join(work, `${slug}-0.png`)
    const tension = join(work, `${slug}-1.png`)
    await renderFrame(`${EVERKINETIC_SVG_BASE}/${id}-relaxation.svg`, start)
    await renderFrame(`${EVERKINETIC_SVG_BASE}/${id}-tension.svg`, tension)

    // [ท่าเริ่ม] -fade-> [ท่าเกร็ง] -fade-> [ท่าเริ่ม] จบที่ภาพเดียวกับเฟรมแรก จึงวนซ้ำได้ไม่สะดุด
    const clip = HOLD + FADE
    const inputs = ['-loop', '1', '-t', `${clip}`, '-i', start, '-loop', '1', '-t', `${clip}`, '-i', tension, '-loop', '1', '-t', `${HOLD}`, '-i', start]
    const filter = `[0][1]xfade=transition=fade:duration=${FADE}:offset=${HOLD}[ab];[ab][2]xfade=transition=fade:duration=${FADE}:offset=${2 * HOLD},fps=24,format=yuv420p`
    const base = join(OUT_DIR, slug)
    run([...inputs, '-filter_complex', filter, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-movflags', '+faststart', '-an', `${base}.mp4`])
    run([...inputs, '-filter_complex', filter, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0', '-row-mt', '1', '-an', `${base}.webm`])
    run(['-i', start, '-c:v', 'libwebp', '-quality', '78', `${base}-poster.webp`])

    const kb = (ext) => Math.round(statSync(`${base}${ext}`).size / 1024)
    console.log(`${name.padEnd(22)} ${slug}.mp4 ${kb('.mp4')}KB  .webm ${kb('.webm')}KB  poster ${kb('-poster.webp')}KB`)
  }
} finally {
  await browser.close()
  rmSync(work, { recursive: true, force: true })
}
