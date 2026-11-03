// ผู้ใช้ตั้งค่าให้ลดการเคลื่อนไหว (prefers-reduced-motion) -> ไม่เล่นวิดีโอ/อนิเมชันอัตโนมัติ
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
