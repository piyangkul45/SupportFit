import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import th from './locales/th.json'

export const SUPPORTED_LANGUAGES = ['en', 'th']
const STORAGE_KEY = 'supportfit_lang'
const DEFAULT_LANGUAGE = 'en'

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, th: { translation: th } },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React escape ให้อยู่แล้ว
  returnObjects: true, // ใช้กับ key ที่เป็น array เช่น password.levels
})

// จำภาษาที่เลือกไว้ และตั้ง <html lang> ให้ตรง (มีผลกับฟอนต์/การตัดคำ/screen reader)
function applyLanguage(lng) {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // private mode / storage ถูกปิด: ใช้ภาษาที่เลือกได้ต่อในหน้านี้ แค่จำข้าม reload ไม่ได้
  }
}

applyLanguage(i18n.language)
i18n.on('languageChanged', applyLanguage)

export default i18n
