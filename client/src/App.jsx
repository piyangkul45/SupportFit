import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import VoiceRecorder from './components/VoiceRecorder'
import RestTimer from './components/RestTimer'
import LogsList from './components/LogsList'
import MacroDashboard from './components/MacroDashboard'
import AnalyticsPage from './components/AnalyticsPage'
import AuthPage from './components/AuthPage'
import Header from './components/Header'
import WorkoutPrograms from './components/WorkoutPrograms'
import TodayProgramCard from './components/TodayProgramCard'
import { AuthProvider, useAuth } from './context/AuthContext'
import { parseVoiceText } from './utils/parser'
import { speak } from './utils/speech'
import { isToday } from './utils/date'
import {
  getMe,
  getWorkoutLogs,
  createWorkoutLog,
  getFoodLogs,
  createFoodLog,
} from './utils/api'

const REST_DURATION = 90

const TABS = [
  { id: 'home', labelKey: 'nav.dashboard', icon: '🏠' },
  { id: 'programs', labelKey: 'nav.programs', icon: '🏆' },
  { id: 'analytics', labelKey: 'nav.analytics', icon: '📊' },
]

// feedback ที่แสดงใต้ปุ่มอัดเสียง เก็บเป็น translation key (VoiceRecorder แปลตอน render)
const feedbackOf = (tone, ...parts) => ({ tone, parts })

function Dashboard() {
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [foodLogs, setFoodLogs] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [isResting, setIsResting] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [activeProgram, setActiveProgram] = useState(null) // { program, day }
  const didInitUserRef = useRef(false)

  const userId = user?.id ?? null

  // โหลดโปรไฟล์ผู้ใช้ (ตาราง users) ของบัญชีที่ล็อกอินอยู่
  useEffect(() => {
    if (didInitUserRef.current) return
    didInitUserRef.current = true

    async function initUser() {
      try {
        const me = await getMe()
        setUser(me)
      } catch (err) {
        console.error('ไม่สามารถเตรียมผู้ใช้งานได้', err)
        setFeedback(feedbackOf('error', { key: 'dashboard.feedback.backendDown' }))
      }
    }
    initUser()
  }, [])

  const refreshLogs = useCallback(async (id) => {
    const targetId = id ?? userId
    if (!targetId) return
    try {
      const [workouts, foods] = await Promise.all([
        getWorkoutLogs(targetId),
        getFoodLogs(targetId),
      ])
      setWorkoutLogs(workouts)
      setFoodLogs(foods)
    } catch (err) {
      console.error('โหลดข้อมูลล้มเหลว', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (userId) refreshLogs(userId)
  }, [userId, refreshLogs])

  const handleFinalResult = useCallback(
    async (text) => {
      if (!userId) {
        setFeedback(feedbackOf('error', { key: 'dashboard.feedback.notReady' }))
        return
      }

      const parsed = parseVoiceText(text)

      if (!parsed) {
        setFeedback(feedbackOf('warning', { key: 'dashboard.feedback.notUnderstood', params: { text } }))
        return
      }

      try {
        if (parsed.type === 'WORKOUT') {
          const saved = await createWorkoutLog({
            user_id: userId,
            exercise_name: parsed.exercise_name,
            weight_kg: parsed.weight_kg,
            reps: parsed.reps,
            sets: parsed.sets,
          })

          const parts = [
            {
              key: 'dashboard.feedback.workoutSaved',
              params: { name: parsed.exercise_name, seconds: REST_DURATION },
            },
          ]
          if (saved.is_volume_pr) parts.push({ key: 'dashboard.feedback.volumePr', icon: '🏆' })
          if (saved.is_1rm_pr) parts.push({ key: 'dashboard.feedback.oneRmPr', icon: '🏆' })

          setFeedback(feedbackOf('success', ...parts))
          speak(parts.map((part) => t(part.key, part.params)).join(' '), i18n.resolvedLanguage)
          setIsResting(true)
        } else {
          await createFoodLog({
            user_id: userId,
            food_name: parsed.food_name,
            calories: parsed.calories,
            protein: parsed.protein,
            carbs: parsed.carbs,
            fat: parsed.fat,
          })

          const part = { key: 'dashboard.feedback.foodSaved', params: { name: parsed.food_name } }
          setFeedback(feedbackOf('success', part))
          speak(t(part.key, part.params), i18n.resolvedLanguage)
        }

        refreshLogs()
      } catch (err) {
        console.error(err)
        setFeedback(feedbackOf('error', { key: 'dashboard.feedback.saveFailed' }))
      }
    },
    [userId, refreshLogs, t, i18n]
  )

  const handleRestFinish = useCallback(() => {
    setIsResting(false)
    speak(t('dashboard.restOver'), i18n.resolvedLanguage)
  }, [t, i18n])

  const handleStartProgram = useCallback((program, day) => {
    setActiveProgram({ program, day })
    setActiveTab('home')
  }, [])

  const todayFoodLogs = foodLogs.filter((log) => isToday(log.created_at))
  const totalCaloriesToday = todayFoodLogs.reduce((sum, f) => sum + (f.calories || 0), 0)
  const totalProteinToday = todayFoodLogs.reduce((sum, f) => sum + (f.protein || 0), 0)

  const completedNamesToday = useMemo(() => {
    return new Set(
      workoutLogs
        .filter((log) => isToday(log.created_at))
        .map((log) => (log.exercise_name || '').toLowerCase())
    )
  }, [workoutLogs])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 py-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-lime-500/20 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-[110px]"
      />

      <div className="relative mx-auto max-w-2xl px-4">
        <Header userName={user?.name} />

        <div className="glass-panel mx-auto mb-6 flex w-full max-w-md justify-center gap-1 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-lime-400 text-slate-950 shadow-[0_0_16px_-4px_rgba(163,230,53,0.8)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>

        {activeTab === 'home' && (
          <>
            {activeProgram && (
              <TodayProgramCard
                program={activeProgram.program}
                day={activeProgram.day}
                completedNames={completedNamesToday}
                onClear={() => setActiveProgram(null)}
              />
            )}

            <VoiceRecorder onFinalResult={handleFinalResult} feedback={feedback} />

            {isResting && (
              <div className="mt-4">
                <RestTimer duration={REST_DURATION} active={isResting} onFinish={handleRestFinish} />
              </div>
            )}

            <MacroDashboard
              totalCalories={totalCaloriesToday}
              totalProtein={totalProteinToday}
              targetCalories={user?.target_calories ?? 2000}
              targetProtein={user?.target_protein ?? 150}
            />

            <LogsList workoutLogs={workoutLogs} foodLogs={foodLogs} />
          </>
        )}

        {activeTab === 'programs' && <WorkoutPrograms onStart={handleStartProgram} />}

        {activeTab === 'analytics' && (
          <AnalyticsPage workoutLogs={workoutLogs} foodLogs={foodLogs} />
        )}
      </div>
    </div>
  )
}

function AuthGate() {
  const { t } = useTranslation()
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="animate-pulse text-slate-500">{t('common.loading')}</p>
      </div>
    )
  }

  return session ? <Dashboard /> : <AuthPage />
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

export default App
