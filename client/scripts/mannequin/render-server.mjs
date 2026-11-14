// เครื่องมือร่วมของสคริปต์เรนเดอร์ (build-mannequin-videos / build-muscle-icons)
// - เสิร์ฟ scene.html + three.js ผ่าน http (ES module โหลดจาก file:// ไม่ได้)
// - เปิด Chrome headless ใช้ GPU จริง (D3D11) ; ไม่มี GPU -> ตั้ง RENDER_GPU=0 ใช้ SwiftShader (ช้ากว่ามาก)
// ร่างกาย 3D สร้างในฉากเอง (body.js) — ไม่ดาวน์โหลด/ไม่ใช้ไฟล์โมเดลภายนอก
import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const TOOLS = resolve(process.env.TOOLS_DIR || '.')
export const toolsRequire = createRequire(pathToFileURL(TOOLS + '/'))
const THREE_DIR = join(TOOLS, 'node_modules', 'three')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html' }
export async function startServer() {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0])
    const file = url.startsWith('/three/') ? join(THREE_DIR, url.slice(7)) : join(HERE, url)
    if (!existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

export async function launchBrowser() {
  const puppeteer = toolsRequire('puppeteer-core')
  const gpu = process.env.RENDER_GPU !== '0'
  const args = gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  return puppeteer.launch({ executablePath: CHROME, headless: true, args, protocolTimeout: 600000 })
}

// เปิดฉาก (สร้างร่างกาย + rig) แล้วรอจนพร้อม
export async function openScene(page, base) {
  await page.goto(`${base}/scene.html`)
  await page.waitForFunction('window.ready === true || window.loadError', { timeout: 300000 })
  const err = await page.evaluate(() => window.loadError)
  if (err) throw new Error(err)
}
