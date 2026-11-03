import { useEffect, useState } from 'react'

const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// สลับเฟรมภาพ (ท่าเริ่ม <-> ท่าจบ) เป็นภาพเคลื่อนไหวแบบ GIF ขณะ playing ; หยุด = กลับเฟรมแรก
// ผู้ใช้ที่ตั้ง prefers-reduced-motion จะไม่สลับเฟรมอัตโนมัติ
export default function useFrameAnimation(frameCount, playing, intervalMs = 750) {
  const [tick, setTick] = useState(0)
  const active = playing && frameCount > 1 && !prefersReducedMotion()

  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setTick((current) => current + 1), intervalMs)
    return () => {
      clearInterval(id)
      setTick(0)
    }
  }, [active, intervalMs])

  // เริ่มเล่น = แสดงเฟรมที่ 2 ทันที (ผู้ใช้เห็นว่าท่าขยับ) แล้วค่อยสลับตามเวลา
  return active ? (tick + 1) % frameCount : 0
}
