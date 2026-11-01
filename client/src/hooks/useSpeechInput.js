import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const SPEECH_LANG = { en: 'en-US', th: 'th-TH' }

// พูดเป็นข้อความด้วย Web Speech API: onFinal(text) เมื่อพูดจบแต่ละช่วง, interim = คำที่กำลังถอดความ
// onError: ไมค์ใช้ไม่ได้ (เช่น ไม่ได้ให้สิทธิ์) ; สร้าง recognizer ใหม่เมื่อเปลี่ยนภาษาของแอป
export default function useSpeechInput({ language, onFinal, onError }) {
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef(null)
  const handlersRef = useRef({ onFinal, onError })
  useEffect(() => {
    handlersRef.current = { onFinal, onError }
  })

  useEffect(() => {
    if (!SpeechRecognition) return undefined
    const recognition = new SpeechRecognition()
    recognition.lang = SPEECH_LANG[language] ?? SPEECH_LANG.th
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText.trim()) handlersRef.current.onFinal(finalText.trim())
      setInterim(interimText)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') handlersRef.current.onError()
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
      setIsListening(false)
      setInterim('')
    }
  }, [language])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      return
    }
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // start() ซ้ำระหว่างที่ยังไม่ปิดรอบก่อนจะ throw InvalidStateError
    }
  }, [isListening])

  // หยุดทันทีโดยไม่รอผลรอบสุดท้าย (ส่งข้อความไปแล้ว ผลที่มาทีหลังจะได้ไม่ค้างในช่องพิมพ์)
  const cancel = useCallback(() => recognitionRef.current?.abort(), [])

  return { isSupported: Boolean(SpeechRecognition), isListening, interim, toggle, cancel }
}
