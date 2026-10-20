export function toDateOnly(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : ''
}

// วันที่ตามเขตเวลาของเครื่อง 'YYYY-MM-DD' (toISOString เป็นวันที่ UTC ซึ่งในไทยเปลี่ยนวันตอน 7 โมงเช้า)
export function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// created_at (timestamptz) อยู่ในวันนี้ตามเวลาของเครื่องหรือไม่
export function isToday(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !Number.isNaN(date.getTime()) && localDateString(date) === localDateString()
}
