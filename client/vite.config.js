import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// frontend เรียก backend ผ่าน path /api บน origin เดียวกัน แล้ว Vite proxy ต่อไปที่ backend
// จึงเปิดจากมือถือ (ผ่าน IP ในวง LAN หรือ tunnel HTTPS) ได้โดยไม่ต้องเปลี่ยน URL ของ API ดู src/utils/api.js
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // ฟังบน 0.0.0.0 ให้อุปกรณ์อื่นในวง LAN เข้าถึงได้
    port: 5173,
    // อนุญาตโดเมนของ tunnel (localtunnel / ngrok / cloudflared) ไม่งั้น Vite จะบล็อก Host header
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok.app', '.trycloudflare.com'],
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true },
    },
  },
})
