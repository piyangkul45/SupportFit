import { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Mic, Square } from 'lucide-react'
import useAudioLevels from '../hooks/useAudioLevels'

// ปุ่มไมค์วงกลม + waveform ใช้ร่วมกันใน Voice Log (VoiceRecorder) และ AI Meal Logger (MealLogger)

const WAVE_BARS = 28

// ปุ่มไมค์ + วงแสงขยายออกเป็นจังหวะขณะอัดเสียง (render ใหม่เฉพาะตอนเริ่ม/หยุดอัด)
export const MicButton = memo(function MicButton({ isListening, onClick }) {
  const { t } = useTranslation()
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <AnimatePresence>
        {isListening &&
          [0, 0.6, 1.2].map((delay) => (
            <motion.span
              key={delay}
              aria-hidden
              className="absolute inset-3 rounded-full border-2 border-red-400/50"
              initial={{ scale: 0.85, opacity: 0.8 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 1.8, delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
      </AnimatePresence>
      {/* แสงเรือง: radial-gradient 2 ชั้นสลับ opacity (compositor ทำอย่างเดียว ไม่ต้องคำนวณ blur) */}
      <span
        aria-hidden
        className={`absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.35),transparent_65%)] transition-opacity duration-500 ${
          isListening ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <span
        aria-hidden
        className={`absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.45),transparent_65%)] transition-opacity duration-500 ${
          isListening ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <motion.button
        type="button"
        onClick={onClick}
        aria-pressed={isListening}
        aria-label={isListening ? t('voice.stop') : t('voice.start')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={`relative flex h-24 w-24 items-center justify-center rounded-full border text-white shadow-2xl transition-colors duration-300 ${
          isListening
            ? 'border-red-300/40 bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40'
            : 'border-emerald-300/40 bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/40'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isListening ? 'stop' : 'mic'}
            initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.18 }}
          >
            {isListening ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-9 w-9" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
})

// ปุ่มเปิดกล้อง AI วงกลมขนาดเท่า MicButton สีมินต์ให้แยกจากปุ่มไมค์ (ไอคอนเข้มเพราะพื้นสีอ่อน)
export const PoseCameraButton = memo(function PoseCameraButton({ disabled, onClick }) {
  const { t } = useTranslation()
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <span
        aria-hidden
        className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.32),transparent_65%)]"
      />
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={t('camera.open')}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full border border-teal-100/60 bg-gradient-to-br from-teal-200 to-emerald-300 text-emerald-950 shadow-2xl shadow-teal-300/30 disabled:opacity-50"
      >
        <Camera className="h-9 w-9" aria-hidden />
      </motion.button>
    </div>
  )
})

// waveform: ใช้ระดับเสียงจริงจากไมค์ ถ้าขอไมค์ไม่ได้ใช้อนิเมชันวิ่งแทน
// ระดับเสียงเขียนลง style.transform ของแท่งโดยตรงทุกเฟรม (useAudioLevels) ไม่ผ่าน React state
export const Waveform = memo(function Waveform({ isListening }) {
  const barsRef = useRef([])
  const isLive = useAudioLevels(isListening, barsRef)

  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: WAVE_BARS }, (_, i) => {
        const distance = Math.abs(i - (WAVE_BARS - 1) / 2) / ((WAVE_BARS - 1) / 2)
        return (
          <span
            key={i}
            ref={(el) => (barsRef.current[i] = el)}
            className={`h-full w-[3px] origin-center rounded-full transition-colors duration-300 ${
              isListening ? 'bg-gradient-to-b from-emerald-300 to-cyan-400' : 'bg-white/15'
            } ${isListening && !isLive ? 'animate-wave-bar' : ''}`}
            style={{
              transform: isListening ? undefined : `scaleY(${0.1 + (1 - distance) * 0.12})`,
              animationDelay: `${(i % 7) * 0.09}s`,
              willChange: isListening ? 'transform' : undefined,
            }}
          />
        )
      })}
    </div>
  )
})
