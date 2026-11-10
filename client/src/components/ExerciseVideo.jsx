import { useState } from 'react'

// วิดีโอสาธิตท่า (HTML5 <video> วนซ้ำ ไม่มีเสียง เล่นในหน้าได้บนมือถือ)
// - poster = ภาพนิ่งของท่าเริ่ม แสดงทันทีระหว่างรอโหลด/ก่อนเล่น
// - ลำดับสำรองเมื่อโหลดไม่ได้: วิดีโอ (MP4 -> WebM) -> poster ในเว็บเอง -> ภาพนิ่งบน CDN -> onUnavailable() (ให้ parent แสดง Anatomy)
// - media.kind: 'lineart' = เส้นขาวบนพื้นดำ ใช้ screen blend ให้พื้นโปร่ง ; 'photo' = ภาพถ่ายสี แสดงตามจริง
// - preload="metadata": โหลดแค่ข้อมูลหัวไฟล์ จนกว่าจะสั่ง play() (หรือ autoPlay)
// ref (React 19 ส่งเป็น prop ได้) ใช้สั่ง play()/pause() จากภายนอก ; onPlayingChange(boolean) แจ้งสถานะเล่น/หยุด
export default function ExerciseVideo({ media, ref, autoPlay = false, label, className = '', onPlayingChange, onUnavailable }) {
  const [stage, setStage] = useState(0) // 0 = วิดีโอ, 1 = poster, 2 = ภาพนิ่ง CDN
  const photo = media.kind === 'photo'

  if (stage > 0) {
    const src = stage === 1 ? media.poster : media.still
    // poster ของ lineart เป็นเส้นขาวบนดำอยู่แล้ว ; ภาพนิ่ง SVG บน CDN เป็นเส้นดำบนขาว ต้องกลับสี (anatomy-art)
    const artClass = photo ? (stage === 2 ? 'rounded-lg saturate-[0.35] brightness-90' : 'rounded-lg') : stage === 1 ? 'anatomy-video' : 'anatomy-art'
    return (
      <img
        key={src}
        src={src}
        alt={label}
        draggable={false}
        onError={() => (stage === 1 ? setStage(2) : onUnavailable?.())}
        className={`${artClass} ${className}`}
      />
    )
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
      className={`${photo ? 'rounded-lg' : 'anatomy-video'} ${className}`}
    >
      {media.sources.map((source, index) => (
        <source
          key={source.src}
          src={source.src}
          type={source.type}
          // error ของ <video> ไม่ยิงเมื่อ <source> โหลดไม่ได้ ต้องฟังที่ source ตัวสุดท้าย (ลองครบทุกตัวแล้ว)
          onError={index === media.sources.length - 1 ? () => setStage(1) : undefined}
        />
      ))}
    </video>
  )
}
