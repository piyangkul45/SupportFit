// พูดข้อความตอบกลับผู้ใช้ผ่าน Web Speech API (SpeechSynthesis) ตามภาษาที่เลือกในแอป
const VOICE_LANG = { en: 'en-US', th: 'th-TH' }

export function speak(text, language = 'th') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = VOICE_LANG[language] ?? VOICE_LANG.th
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}
