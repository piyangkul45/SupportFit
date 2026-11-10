// สร้างวิดีโอสาธิตท่าวนซ้ำ (MP4 + WebM) + poster (WebP) จากภาพถ่ายท่าเริ่ม/ท่าจบของ free-exercise-db (Public Domain)
// สำหรับท่าที่ Everkinetic ไม่มี ; ผลลัพธ์อยู่ใน client/public/anatomy/<slug>.{mp4,webm} และ <slug>-poster.webp
//
// ใช้งาน (เครื่องมือไม่ได้อยู่ใน dependencies ของโปรเจกต์):
//   npm i --prefix <tools-dir> ffmpeg-static@5
//   TOOLS_DIR=<tools-dir> node scripts/build-photo-videos.mjs [ชื่อท่า ...]   (ไม่ระบุ = ทุกท่าใน FREE_EXERCISE_DB_IDS)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FREE_EXERCISE_DB_BASE, FREE_EXERCISE_DB_IDS, PHOTO_START_FRAME, mediaSlug } from '../src/utils/exerciseMedia.js'

const toolsRequire = createRequire(pathToFileURL(resolve(process.env.TOOLS_DIR || '.') + '/'))
const ffmpeg = toolsRequire('ffmpeg-static')

const W = 480
const H = 320 // 3:2 เท่าภาพต้นฉบับ (850×567)
const HOLD = 0.9 // วินาทีที่ค้างแต่ละท่า
const FADE = 0.4 // วินาทีที่ค่อย ๆ เปลี่ยนท่า
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/anatomy')

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
// ภาพทั้งสองต้องขนาดเท่ากัน: ขยายให้เต็มกรอบแล้วตัดส่วนเกินตรงกลาง (ไม่มีแถบขอบขาวบนพื้นเข้ม)
// แล้วปรับโทนให้เข้ากับ Dark Theme: ลดความอิ่มสี + มืดลงเล็กน้อย + ขอบมืด (vignette)
const FIT = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,eq=saturation=0.35:brightness=-0.07:contrast=1.06,vignette=PI/4.5`

const download = async (url, file) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

const only = process.argv.slice(2)
const entries = Object.entries(FREE_EXERCISE_DB_IDS).filter(([name]) => !only.length || only.includes(name))

mkdirSync(OUT_DIR, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'photo-demo-'))
try {
  for (const [name, id] of entries) {
    const slug = mediaSlug(name)
    const start = join(work, `${slug}-0.jpg`)
    const end = join(work, `${slug}-1.jpg`)
    const first = PHOTO_START_FRAME[name] || 0
    await download(`${FREE_EXERCISE_DB_BASE}/${id}/${first}.jpg`, start)
    await download(`${FREE_EXERCISE_DB_BASE}/${id}/${1 - first}.jpg`, end)

    // [ท่าเริ่ม] -fade-> [ท่าจบ] -fade-> [ท่าเริ่ม] จบที่ภาพเดียวกับเฟรมแรก จึงวนซ้ำได้ไม่สะดุด
    const clip = HOLD + FADE
    const inputs = ['-loop', '1', '-t', `${clip}`, '-i', start, '-loop', '1', '-t', `${clip}`, '-i', end, '-loop', '1', '-t', `${HOLD}`, '-i', start]
    const filter =
      `[0]${FIT}[a];[1]${FIT}[b];[2]${FIT}[c];` +
      `[a][b]xfade=transition=fade:duration=${FADE}:offset=${HOLD}[ab];[ab][c]xfade=transition=fade:duration=${FADE}:offset=${2 * HOLD},fps=24,format=yuv420p`
    const base = join(OUT_DIR, slug)
    run([...inputs, '-filter_complex', filter, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-movflags', '+faststart', '-an', `${base}.mp4`])
    run([...inputs, '-filter_complex', filter, '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-an', `${base}.webm`])
    run(['-i', start, '-vf', FIT, '-c:v', 'libwebp', '-quality', '78', `${base}-poster.webp`])

    const kb = (ext) => Math.round(statSync(`${base}${ext}`).size / 1024)
    console.log(`${name.padEnd(20)} ${slug}.mp4 ${kb('.mp4')}KB  .webm ${kb('.webm')}KB  poster ${kb('-poster.webp')}KB`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
