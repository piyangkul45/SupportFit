// เรนเดอร์วิดีโอสาธิตท่า 3D (MP4 + WebM วนซ้ำ) + poster (WebP) ของทุกท่าใน exerciseCatalog
// โมเดลกายวิภาคจริง (BodyParts3D + Z-Anatomy) ผูก skinning กับ rig ท่าเคลื่อนไหวใน scripts/mannequin (three.js)
// ร่างสีเทาเงิน มัดกล้ามเนื้อเป้าหมายเรืองแสงส้ม-แดง ; ผลลัพธ์ -> client/public/mannequin/<slug>.{mp4,webm} และ <slug>-poster.webp
//
// ใช้งาน (เครื่องมือไม่ได้อยู่ใน dependencies ของโปรเจกต์):
//   npm i --prefix <tools-dir> three@0.170.0 puppeteer-core@23 ffmpeg-static@5
//   TOOLS_DIR=<tools-dir> CHROME_PATH=<path to chrome> node scripts/build-mannequin-videos.mjs [ชื่อท่า ...]
//   --preview <out.png>  เรนเดอร์แค่ 3 เฟรมต่อท่าแล้วรวมเป็นภาพตรวจทาน (ไม่เขียนวิดีโอ)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureAnatomyData, launchBrowser, openScene, startServer, toolsRequire } from './mannequin/render-server.mjs'
import { EXERCISES } from '../src/utils/exerciseCatalog.js'
import { getAnatomy } from '../src/utils/exerciseAnatomy.js'
import { mediaSlug, motionFor } from '../src/utils/exerciseMedia.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ffmpeg = toolsRequire('ffmpeg-static')
const OUT_DIR = resolve(HERE, '../public/mannequin')
const FPS = 24

const args = process.argv.slice(2)
const previewAt = args.indexOf('--preview')
const previewOut = previewAt >= 0 ? args.splice(previewAt, 2)[1] : null
const viewAt = args.indexOf('--views')
const VIEWS = viewAt >= 0 ? args.splice(viewAt, 2)[1].split(',') : ['oblique', 'side']
const only = new Set(args)
const jobs = EXERCISES.filter((e) => !only.size || only.has(e.name)).map((e) => ({ name: e.name, motion: motionFor(e.name) }))

await ensureAnatomyData()
const { server, base: BASE } = await startServer()

const run = (a) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...a])
// แท็กสี bt709 ให้เบราว์เซอร์แปลงกลับเป็น #0e1a24 ตรงกับพื้นการ์ด
const COLOR = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']

mkdirSync(OUT_DIR, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'mannequin-'))
const browser = await launchBrowser()
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))
await page.setViewport({ width: 600, height: 800 })
const preview = []

try {
  for (const { name, motion } of jobs) for (const view of VIEWS) {
    if (!motion) throw new Error(`${name}: no motion`)
    const anatomy = getAnatomy(name) || { primary: [], secondary: [] }
    await openScene(page, BASE)
    const { frames } = await page.evaluate((spec) => window.setup(spec), { motion, view, primary: anatomy.primary, secondary: anatomy.secondary, fps: FPS })
    // มุมเฉียง 3/4 = ไฟล์หลัก <slug>.* ; มุมด้านข้าง = <slug>-side.mp4 + <slug>-side-poster.webp (MP4 อย่างเดียว ประหยัดขนาด repo)
    const slug = mediaSlug(name) + (view === 'side' ? '-side' : '')
    const dir = join(work, slug)
    mkdirSync(dir)
    const grab = async (i, file) => {
      // GPU บางครั้งคืนเฟรมว่าง -> เรนเดอร์ซ้ำ (เฟรมจริงมีขนาดหลายสิบ KB)
      let url = ''
      for (let tries = 0; tries < 4 && url.length < 20000; tries++) url = await page.evaluate((i, n) => window.frame(i, n), i, frames)
      if (url.length < 20000) throw new Error(`${name}: empty frame ${i}`)
      writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
    }

    if (previewOut) {
      for (const [k, i] of [0, Math.round(frames / 3), Math.round((2 * frames) / 3)].entries()) {
        const file = join(dir, `p${k}.png`)
        await grab(i, file)
        preview.push({ name, file })
      }
      console.log(`preview ${name}`)
      continue
    }

    for (let i = 0; i < frames; i++) await grab(i, join(dir, `${String(i).padStart(4, '0')}.png`))
    const seq = ['-framerate', `${FPS}`, '-i', join(dir, '%04d.png')]
    const base = join(OUT_DIR, slug)
    run([...seq, ...COLOR, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', `${base}.mp4`])
    if (view !== 'side') run([...seq, '-pix_fmt', 'yuv420p', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1', '-an', `${base}.webm`])
    // poster = ท่าช่วงออกแรงสุด (กลางลูป)
    run(['-i', join(dir, `${String(Math.floor(frames / 2)).padStart(4, '0')}.png`), '-c:v', 'libwebp', '-quality', '82', `${base}-poster.webp`])
    const kb = (ext) => Math.round(statSync(`${base}${ext}`).size / 1024)
    console.log(`${name.padEnd(22)} ${view.padEnd(8)} ${motion.padEnd(18)} mp4 ${kb('.mp4')}KB  poster ${kb('-poster.webp')}KB`)
  }

  if (previewOut) {
    // ภาพตรวจทาน: แถวละ 1 ท่า x 3 เฟรม (ย่อ 1/3) ; 4 ท่าต่อแถว
    const big = process.env.PREVIEW_FULL === '1'
    const [cw, ch] = big ? [480, 640] : [240, 320]
    const per = big ? 1 : 2
    const rows = Math.ceil(preview.length / 3 / per)
    const inputs = preview.flatMap((p) => ['-i', p.file])
    const n = preview.length
    const scaled = preview.map((_, i) => `[${i}]scale=${cw}:${ch}[s${i}]`).join(';')
    const cells = preview.map((_, i) => `[s${i}]`).join('')
    const layout = preview.map((_, i) => `${(i % (per * 3)) * cw}_${Math.floor(i / (per * 3)) * ch}`).join('|')
    run([...inputs, '-filter_complex', `${scaled};${cells}xstack=inputs=${n}:layout=${layout}:fill=black`, '-frames:v', '1', previewOut])
    console.log(`preview sheet -> ${previewOut} (${rows} rows)`)
  }
} finally {
  await browser.close()
  server.close()
  rmSync(work, { recursive: true, force: true })
}
