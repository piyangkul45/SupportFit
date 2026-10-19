export function toDateOnly(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : ''
}

export function isToday(dateStr) {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return toDateOnly(dateStr) === today
}
