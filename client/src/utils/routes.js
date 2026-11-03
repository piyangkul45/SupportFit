// แท็บหลักของแอป <-> path ใน URL (ไม่ใช้ router library: แอปมีหน้าระดับเดียว ใช้ History API ตรง ๆ)
// เข้า URL ตรง ๆ / รีเฟรช / ปุ่มย้อนกลับของเบราว์เซอร์ = เปิดแท็บตาม path
// (โฮสต์ production ต้องตั้ง SPA fallback ให้ทุก path ส่ง index.html — Vite dev server ทำให้อยู่แล้ว)

export const TAB_PATHS = {
  home: '/',
  programs: '/programs',
  nutrition: '/nutrition',
  coach: '/coach',
  community: '/community',
  analytics: '/analytics',
}

const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab]))

// '/nutrition', '/nutrition/', '/NUTRITION' -> 'nutrition' ; path ที่ไม่รู้จัก -> 'home'
export function tabFromPath(pathname) {
  const path = `/${String(pathname || '').toLowerCase().replace(/^\/+|\/+$/g, '')}`
  return PATH_TABS[path] || 'home'
}

export const pathForTab = (tab) => TAB_PATHS[tab] || TAB_PATHS.home
