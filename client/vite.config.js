import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// frontend เรียก backend ตรงที่ VITE_API_URL (ค่าเริ่มต้น http://localhost:5000) ดู src/utils/api.js
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
