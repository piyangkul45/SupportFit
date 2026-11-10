import { useState } from 'react'

// วิดีโอสาธิตท่าแบบหุ่นจำลอง 3D (HTML5 <video> วนซ้ำ ไม่มีเสียง เล่นในหน้าได้บนมือถือ)
// - พื้นวิดีโอ #0e1a24 เท่าพื้นกรอบ ; .mannequin-video จางขอบด้วย mask ให้กลืนกับการ์ด (ไม่เห็นกรอบสี่เหลี่ยม)
// - poster = เฟรมหุ่น 3D ช่วงออกแรงสุด แสดงทันทีระหว่างรอโหลด/ก่อนเล่น
// - ลำดับสำรองเมื่อโหลดไม่ได้: วิดีโอ (MP4 -> WebM) -> poster -> onUnavailable() (ให้ parent แสดงไอคอนแทน)
// - preload="metadata": โหลดแค่ข้อมูลหัวไฟล์ จนกว่าจะสั่ง play() (หรือ autoPlay)
// ref (React 19 ส่งเป็น prop ได้) ใช้สั่ง play()/pause() จากภายนอก ; onPlayingChange(boolean) แจ้งสถานะเล่น/หยุด
export default function ExerciseVideo({ media, ref, autoPlay = false, label, className = '', onPlayingChange, onUnavailable }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <img src={media.poster} alt={label} draggable={false} onError={() => onUnavailable?.()} className={`mannequin-video ${className}`} />
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
      className={`mannequin-video ${className}`}
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
