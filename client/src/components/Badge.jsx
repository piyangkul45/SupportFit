// badge ตัวเลข + หน่วย ใช้ในการ์ดรายการที่บันทึกและการ์ด preview
const BADGE_TONES = {
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
}

// ไม่แสดงถ้าไม่มีค่า
export default function Badge({ value, unit, tone, label, prefix }) {
  if (value == null) return null
  return (
    <span className={`badge ${BADGE_TONES[tone]}`} title={label}>
      {prefix && <span className="font-bold opacity-60">{prefix}</span>}
      {value}
      <span className="font-medium opacity-70">{unit}</span>
    </span>
  )
}
