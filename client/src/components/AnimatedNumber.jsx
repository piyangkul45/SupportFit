import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

const format = (value, decimals) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })

// ตัวเลขที่นับขึ้น/ลงไปหาค่าใหม่ทุกครั้งที่ value เปลี่ยน (ครั้งแรกนับจาก 0)
// อัปเดต textContent ตรง ๆ ทุกเฟรม ไม่ทำให้ React render ใหม่
export default function AnimatedNumber({ value, decimals = 0, className = '' }) {
  const ref = useRef(null)
  const previous = useRef(0)
  const reduceMotion = useReducedMotion()
  // ข้อความตอน render คงที่ (React จะไม่เขียนทับค่าที่ effect กำลังนับ)
  const [initialText] = useState(() => format(0, decimals))

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (reduceMotion) {
      if (ref.current) ref.current.textContent = format(value, decimals)
      return undefined
    }
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = format(latest, decimals)
      },
    })
    return () => controls.stop()
  }, [value, decimals, reduceMotion])

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {initialText}
    </span>
  )
}
