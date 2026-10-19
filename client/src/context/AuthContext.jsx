import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { clearStoredSession, readStoredSession, SESSION_EXPIRED_EVENT, storeSession } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // session = { token, user } จาก /api/verify-otp, null = ไม่ได้ล็อกอิน
  const [session, setSession] = useState(readStoredSession)

  const signIn = useCallback((nextSession) => {
    storeSession(nextSession)
    setSession(nextSession)
  }, [])

  const signOut = useCallback(() => {
    clearStoredSession()
    setSession(null)
  }, [])

  // api.js แจ้งมาเมื่อ server ตอบ 401 (token หมดอายุ/ไม่ถูกต้อง) -> กลับไปหน้าเข้าสู่ระบบ
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, signOut)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, signOut)
  }, [signOut])

  const value = { session, isLoading: false, signIn, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องถูกเรียกใช้ภายใน AuthProvider')
  return ctx
}
