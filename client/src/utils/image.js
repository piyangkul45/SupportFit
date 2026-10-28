// ย่อรูปอาหารก่อนส่งให้ AI: ด้านยาวไม่เกิน MAX_SIDE px แล้วบีบเป็น JPEG
// รูปจากกล้องมือถือ 3-8MB -> ราว 100-400KB ส่งเร็วขึ้นมาก และ AI ยังมองเห็นอาหารได้ชัดพอ
// ถอดรหัสรูปไม่ได้ (เช่น HEIC บน Chrome) = ส่งไฟล์เดิม ถ้าชนิดไฟล์ที่ server รับและขนาดไม่เกิน MAX_ORIGINAL_BYTES

const MAX_SIDE = 1280
const QUALITY = 0.82
const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024
const PASSTHROUGH_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

const readAsBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // บางเบราว์เซอร์ไม่รองรับ option นี้ หรือถอดรหัสชนิดไฟล์นี้ไม่ได้ ลองวิธีถัดไป
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

// File -> { data: base64 (ไม่มี prefix), mimeType } ; throw Error('unsupported' | 'too_large')
export async function prepareMealImage(file) {
  let source
  try {
    source = await decode(file)
  } catch {
    if (!PASSTHROUGH_TYPES.includes(file.type)) throw new Error('unsupported')
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error('too_large')
    return { data: await readAsBase64(file), mimeType: file.type }
  }

  const width = source.width || source.naturalWidth
  const height = source.height || source.naturalHeight
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('unsupported')
  return { data: await readAsBase64(blob), mimeType: 'image/jpeg' }
}
