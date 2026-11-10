// สร้างภาพการ์ดหมวดกล้ามเนื้อ (client/public/muscles/*.webp) จากภาพเรนเดอร์ 3D ของ BodyParts3D (CC BY-SA 2.1 JP) — ดู public/muscles/LICENSE.md
// ใช้งาน: npm i --prefix <tools-dir> sharp@0.33 ; SHARP=<tools-dir>/node_modules/sharp node process-render.cjs ...
// shoulders: yellow 20 170 860 | back: yellow 100 170 700 | arms (ต้นฉบับ 4500px): BG_MIN=255 white 188 797 4125
// glutes: yellow 180 150 340 40 | legs: SAT=0.2 white 172 225 296 0
// node proc.cjs <in> <out.webp> <mode yellow|white> <left> <top> <width> [page]
const sharp = require(process.env.SHARP)
const [inp, out, mode, l, t, w, page] = process.argv.slice(2)
const H = Math.round(+w * 0.75), OW = 720, OH = 540
const toHsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, mx ? d / mx : 0, mx / 255] }
const fromHsv = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : [0, c, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255] }
;(async () => {
  let src = sharp(inp, page ? { page: +page } : {}).flatten({ background: '#ffffff' }); if (page) src = sharp(await src.median(3).png().toBuffer())
  const { data, info } = await src.extract({ left: +l, top: +t, width: +w, height: H }).raw().toBuffer({ resolveWithObject: true })
  const W = info.width, N = W * info.height, ch = info.channels
  const alpha = new Float32Array(N).fill(1)
  const at = (i) => [data[i * ch], data[i * ch + 1], data[i * ch + 2]]
  if (mode === 'yellow') {
    for (let i = 0; i < N; i++) { const [r, g, b] = at(i); const yel = Math.min(r, g) - b
      if (r - g < 45) alpha[i] = 1 - Math.min(1, Math.max(0, (yel - 12) / 26)) }
  } else {
    // flood fill near-white, low-saturation background from the borders
    const isBg = (i) => { const [r, g, b] = at(i); return Math.min(r, g, b) >= (+process.env.BG_MIN || 239) && Math.max(r, g, b) - Math.min(r, g, b) < 10 }
    const seen = new Uint8Array(N), q = []
    for (let x = 0; x < W; x++) q.push(x, N - W + x)
    for (let y = 0; y < info.height; y++) q.push(y * W, y * W + W - 1)
    while (q.length) { const i = q.pop(); if (seen[i] || !isBg(i)) continue; seen[i] = 1; alpha[i] = 0
      const x = i % W; if (x > 0) q.push(i - 1); if (x < W - 1) q.push(i + 1); if (i >= W) q.push(i - W); if (i < N - W) q.push(i + W) }
    // soften: pixels touching background get partial alpha by darkness
    for (let i = 0; i < N; i++) if (alpha[i] === 1) { const x = i % W
      const nb = (x > 0 && seen[i - 1]) || (x < W - 1 && seen[i + 1]) || (i >= W && seen[i - W]) || (i < N - W && seen[i + W])
      if (nb) { const [r, g, b] = at(i); alpha[i] = Math.min(1, Math.max(0.25, (255 - Math.min(r, g, b)) / 40)) } }
  }
  const px = Buffer.alloc(N * 4)
  for (let i = 0; i < N; i++) {
    let [r, g, b] = at(i); const [, s, v] = toHsv(r, g, b)
    if (s > (+process.env.SAT || 0.35) && alpha[i] > 0.5) { // muscle -> unified orange-red, keep shading
      ;[r, g, b] = fromHsv(9, Math.min(1, 0.55 + s * 0.4), Math.min(1, v * 0.98 + 0.03))
    } else { const k = 0.78; r *= k; g *= k; b *= k; if (alpha[i] < 1) { const m = Math.max(r, g, b); r = g = b = m } } // bone: dimmed so muscle pops
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = Math.round(alpha[i] * 255)
  }
  await sharp(px, { raw: { width: W, height: info.height, channels: 4 } }).resize(OW, OH, { kernel: 'lanczos3' }).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(out)
})()
