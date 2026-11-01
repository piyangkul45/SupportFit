export function toDateOnly(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : ''
}

// วันที่ตามเขตเวลาของเครื่อง 'YYYY-MM-DD' (toISOString เป็นวันที่ UTC ซึ่งในไทยเปลี่ยนวันตอน 7 โมงเช้า)
export function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const TIME_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

// "5 นาทีที่ผ่านมา" / "5 minutes ago" ตามภาษาที่เลือก ; ต่ำกว่า 1 นาที = "ตอนนี้"
export function timeAgo(dateStr, language, now = Date.now()) {
  const seconds = Math.max(0, (now - new Date(dateStr).getTime()) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const [unit, size] = TIME_UNITS.find(([, length]) => seconds >= length) ?? ['second', 1]
  return unit === 'second' ? format.format(0, 'second') : format.format(-Math.floor(seconds / size), unit)
}

// created_at (timestamptz) อยู่ในวันนี้ตามเวลาของเครื่องหรือไม่
export function isToday(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !Number.isNaN(date.getTime()) && localDateString(date) === localDateString()
}
