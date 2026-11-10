// เครื่องมือร่วมของสคริปต์เรนเดอร์ (build-mannequin-videos / build-muscle-icons)
// - ดาวน์โหลด mesh กายวิภาค (ล็อก commit) มาเก็บใน <TOOLS_DIR>/anatomy-data ครั้งแรกครั้งเดียว (ไม่ commit ไฟล์ดิบ)
// - เสิร์ฟ scene.html + three.js + mesh ผ่าน http (ES module โหลดจาก file:// ไม่ได้)
// - เปิด Chrome headless ใช้ GPU จริง (D3D11) ; ไม่มี GPU -> ตั้ง RENDER_GPU=0 ใช้ SwiftShader (ช้ากว่ามาก)
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const TOOLS = resolve(process.env.TOOLS_DIR || '.')
export const toolsRequire = createRequire(pathToFileURL(TOOLS + '/'))
const THREE_DIR = join(TOOLS, 'node_modules', 'three')
const DATA_DIR = join(TOOLS, 'anatomy-data')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

// anatomy.glb / skeleton.glb ของ BodyExplorer: BodyParts3D (CC BY-SA 2.1 JP) + Z-Anatomy (CC BY-SA 4.0)
const DATA_COMMIT = 'cd2a6391d31cf4da663304d671fae138adfd6b2d'
const DATA_BASE = `https://raw.githubusercontent.com/JohanBellander/BodyExplorer/${DATA_COMMIT}/public`

export async function ensureAnatomyData() {
  mkdirSync(DATA_DIR, { recursive: true })
  for (const name of ['anatomy.glb', 'skeleton.glb']) {
    const file = join(DATA_DIR, name)
    if (existsSync(file) && statSync(file).size > 1e6) continue
    console.log(`downloading ${name} ...`)
    const res = await fetch(`${DATA_BASE}/${name}`)
    if (!res.ok) throw new Error(`${res.status} ${name}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
}

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary' }
export async function startServer() {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0])
    const file = url.startsWith('/three/')
      ? join(THREE_DIR, url.slice(7))
      : url.startsWith('/data/')
        ? join(DATA_DIR, url.slice(6))
        : url.startsWith('/anatomy/')
          ? join(HERE, '..', 'anatomy', url.slice(9))
          : join(HERE, url)
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

// เปิดฉาก (โหมด anatomy = โหลด mesh + ผูก skinning) แล้วรอจนพร้อม
export async function openScene(page, base, query = 'model=anatomy') {
  await page.goto(`${base}/scene.html?${query}`)
  await page.waitForFunction('window.ready === true || window.loadError', { timeout: 300000 })
  const err = await page.evaluate(() => window.loadError)
  if (err) throw new Error(err)
}
