import { useEffect, useState } from 'react'

// ระดับเสียงจริงจากไมค์ (Web Audio AnalyserNode) ขณะอัดเสียง สำหรับ waveform visualizer
// เขียน transform ของแท่งแต่ละอันตรง ๆ ทุกเฟรมผ่าน barsRef (ไม่ทำให้ React render ใหม่ 60 ครั้ง/วินาที)
// คืน true เมื่อได้สัญญาณเสียงจริง ถ้าขอไมค์ไม่ได้ (ไม่อนุญาต/ไม่รองรับ) คืน false ให้ใช้อนิเมชันแทน
export default function useAudioLevels(active, barsRef) {
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return undefined

    const bars = barsRef.current
    let cancelled = false
    let stream = null
    let audioContext = null
    let frame = 0

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.78
        audioContext.createMediaStreamSource(stream).connect(analyser)
        const levels = new Uint8Array(analyser.frequencyBinCount)

        const draw = () => {
          analyser.getByteFrequencyData(levels)
          const center = (bars.length - 1) / 2
          bars.forEach((bar, i) => {
            if (!bar) return
            // แท่งกลางใช้ความถี่ต่ำ (เสียงพูดดังสุด) ไล่ออกไปขอบเป็นความถี่สูง -> รูปทรงสมมาตร
            const bin = Math.min(levels.length - 1, Math.round((Math.abs(i - center) / center) * 14) + 1)
            bar.style.transform = `scaleY(${0.1 + (levels[bin] / 255) * 0.9})`
          })
          frame = requestAnimationFrame(draw)
        }
        draw()
        setIsLive(true)
      })
      .catch(() => setIsLive(false))

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      audioContext?.close()
      bars.forEach((bar) => bar && (bar.style.transform = ''))
      setIsLive(false)
    }
  }, [active, barsRef])

  return isLive
}
