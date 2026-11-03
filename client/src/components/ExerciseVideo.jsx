import { useState } from 'react'

// วิดีโอ Anatomy ของท่า (HTML5 <video> วนซ้ำ ไม่มีเสียง เล่นในหน้าได้บนมือถือ)
// - poster = ภาพลายเส้นนิ่งของท่าเริ่ม แสดงระหว่างรอโหลด/ก่อนเล่น
// - โหลดวิดีโอไม่ได้ทุก source -> แสดงภาพลายเส้นนิ่ง (SVG จาก CDN อีกที่หนึ่ง) แทน
// - preload="metadata": โหลดแค่ข้อมูลหัวไฟล์ จนกว่าจะสั่ง play() (หรือ autoPlay)
// ref (React 19 ส่งเป็น prop ได้) ใช้สั่ง play()/pause() จากภายนอก ; onPlayingChange(boolean) แจ้งสถานะเล่น/หยุด
export default function ExerciseVideo({ media, ref, autoPlay = false, label, className = '', onPlayingChange }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <img src={media.still} alt={label} draggable={false} className={`anatomy-art ${className}`} />
  }
  return (
    <video
      ref={ref}
      poster={media.poster}
      autoPlay={autoPlay}
      loop
      muted
      playsInline
      preload="metadata"
      disablePictureInPicture
      disableRemotePlayback
      aria-label={label}
      onPlay={() => onPlayingChange?.(true)}
      onPause={() => onPlayingChange?.(false)}
      className={`anatomy-video ${className}`}
    >
      {media.sources.map((source, index) => (
        <source
          key={source.src}
          src={source.src}
          type={source.type}
          // error ของ <video> ไม่ยิงเมื่อ <source> โหลดไม่ได้ ต้องฟังที่ source ตัวสุดท้าย (ลองครบทุกตัวแล้ว)
          onError={index === media.sources.length - 1 ? () => setFailed(true) : undefined}
        />
      ))}
    </video>
  )
}
