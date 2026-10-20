import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ChartColumn, LayoutDashboard, Trophy } from 'lucide-react'
import VoiceRecorder from './components/VoiceRecorder'
import RestTimer from './components/RestTimer'
import LogsList from './components/LogsList'
import MacroDashboard from './components/MacroDashboard'
import AuthPage from './components/AuthPage'
import Header from './components/Header'
import Programs from './pages/Programs'
import TodayRoutineCard from './components/TodayRoutineCard'
import TodayProgramCard from './components/TodayProgramCard'
import AnalyticsSkeleton from './components/AnalyticsSkeleton'
import EditLogModal from './components/EditLogModal'
import ProfileModal from './components/ProfileModal'
import Toast from './components/Toast'
import BrandMark from './components/BrandMark'
import { AuthProvider, useAuth } from './context/AuthContext'
import { speak } from './utils/speech'
import { isToday, localDateString } from './utils/date'
import { countSetsByExercise } from './utils/programs'
import {
  getMe,
  getTodayRoutine,
  updateProfile,
  getWorkoutLogs,
  createWorkoutLog,
  updateWorkoutLog,
  deleteWorkoutLog,
  getFoodLogs,
  createFoodLog,
  updateFoodLog,
  deleteFoodLog,
} from './utils/api'

// กราฟ (recharts) โหลดเมื่อเปิดแท็บ Analytics ครั้งแรก ไม่ถ่วงการโหลดหน้าแรก
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage'))

const REST_DURATION = 90

const TABS = [
  { id: 'home', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { id: 'programs', labelKey: 'nav.programs', Icon: Trophy },
  { id: 'analytics', labelKey: 'nav.analytics', Icon: ChartColumn },
]

const nameOf = (kind, log) => (kind === 'workout' ? log.exercise_name : log.food_name)
const sumOf = (rows, field) => rows.reduce((sum, row) => sum + (row[field] || 0), 0)

// การ์ดในหน้าเลื่อนขึ้นทีละใบ (stagger)
const STAGGER = { animate: { transition: { staggerChildren: 0.06 } } }
const RISE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
}
const PAGE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
}

const Greeting = memo(function Greeting({ userName }) {
  const { t, i18n } = useTranslation()
  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const today = new Date().toLocaleDateString(i18n.resolvedLanguage === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <motion.div variants={RISE} className="mb-5">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80">{today}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {userName ? (
          t(`dashboard.greeting.${period}`, { name: userName })
        ) : (
          <span className="skeleton inline-block h-8 w-56 align-middle" />
        )}
      </h1>
    </motion.div>
  )
})

// เนื้อหาแต่ละแท็บ + อนิเมชันเปลี่ยนหน้า (memo: state ของ Dashboard อย่าง toast/modal ไม่ทำให้ส่วนนี้ render ใหม่)
const DashboardPages = memo(function DashboardPages({
  activeTab,
  user,
  activeProgram,
  completedNamesToday,
  routine,
  isLoadingRoutine,
  setsDoneToday,
  routineExercise,
  selectExercise,
  goToPrograms,
  loadRoutine,
  notify,
  isResting,
  totalsToday,
  workoutLogs,
  foodLogs,
  isLoadingLogs,
  clearProgram,
  handleSaveItems,
  handleRestFinish,
  openEditor,
  handleDelete,
  handleStartProgram,
}) {
  return (
    <AnimatePresence mode="wait">
      {activeTab === 'home' && (
        <motion.div key="home" variants={PAGE} initial="initial" animate="animate" exit="exit">
          <motion.div variants={STAGGER} initial="initial" animate="animate">
            <Greeting userName={user?.name} />

            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-7">
                <motion.div variants={RISE}>
                  <TodayRoutineCard
                    routine={routine}
                    loading={isLoadingRoutine}
                    setsDone={setsDoneToday}
                    selectedExercise={routineExercise}
                    onSelectExercise={selectExercise}
                    onChooseProgram={goToPrograms}
                  />
                </motion.div>
                {activeProgram && (
                  <motion.div variants={RISE}>
                    <TodayProgramCard
                      program={activeProgram.program}
                      day={activeProgram.day}
                      completedNames={completedNamesToday}
                      onClear={clearProgram}
                    />
                  </motion.div>
                )}
                <motion.div variants={RISE}>
                  <VoiceRecorder
                    onSave={handleSaveItems}
                    exerciseHint={routineExercise}
                    onClearHint={selectExercise}
                  />
                </motion.div>
                <AnimatePresence>
                  {isResting && (
                    <RestTimer
                      key="rest"
                      duration={REST_DURATION}
                      active={isResting}
                      onFinish={handleRestFinish}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-5 lg:col-span-5">
                <motion.div variants={RISE}>
                  <MacroDashboard
                    totals={totalsToday}
                    targetCalories={user?.target_calories ?? 2000}
                    targetProtein={user?.target_protein ?? 150}
                    targetCarbs={user?.target_carbs}
                    targetFat={user?.target_fat}
                    loading={isLoadingLogs}
                  />
                </motion.div>
                <motion.div variants={RISE}>
                  <LogsList
                    workoutLogs={workoutLogs}
                    foodLogs={foodLogs}
                    loading={isLoadingLogs}
                    onEdit={openEditor}
                    onDelete={handleDelete}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {activeTab === 'programs' && (
        <motion.div key="programs" variants={PAGE} initial="initial" animate="animate" exit="exit">
          <Programs onStartRoutine={handleStartProgram} onActiveProgramChange={loadRoutine} notify={notify} />
        </motion.div>
      )}

      {activeTab === 'analytics' && (
        <motion.div key="analytics" variants={PAGE} initial="initial" animate="animate" exit="exit">
          <Suspense fallback={<AnalyticsSkeleton />}>
            <AnalyticsPage workoutLogs={workoutLogs} foodLogs={foodLogs} loading={isLoadingLogs} />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

function Dashboard() {
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [foodLogs, setFoodLogs] = useState([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [toast, setToast] = useState(null)
  const [isResting, setIsResting] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [activeProgram, setActiveProgram] = useState(null) // { program, day }
  const [editing, setEditing] = useState(null) // { kind: 'workout' | 'food', log }
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [routine, setRoutine] = useState(null) // GET /api/users/me/active-program/today
  const [isLoadingRoutine, setIsLoadingRoutine] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState(null) // ท่าที่แตะเลือกไว้ใน "ตารางฝึกวันนี้"

  const didInitUserRef = useRef(false)

  const userId = user?.id ?? null

  // toast: parts = [{ key, params?, icon? }] แปลตอนแสดง (สลับภาษาแล้วข้อความเปลี่ยนตาม)
  const notify = useCallback((type, ...parts) => setToast({ type, parts, id: Date.now() + Math.random() }), [])
  const closeToast = useCallback(() => setToast(null), [])

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
        setIsLoadingLogs(false)
        notify('error', { key: 'dashboard.feedback.backendDown' })
      }
    }
    initUser()
  }, [notify])

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
    } finally {
      setIsLoadingLogs(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (userId) refreshLogs(userId)
  }, [userId, refreshLogs])

  // ---- ตารางฝึกวันนี้ (โปรแกรมที่ใช้อยู่) ----
  // วันที่ตามเครื่องผู้ใช้ เปิดแอปค้างข้ามวันแล้วกลับมาที่แท็บ = โหลดตารางของวันใหม่
  const loadRoutine = useCallback(async () => {
    try {
      setRoutine(await getTodayRoutine(localDateString()))
    } catch (err) {
      console.error('โหลดตารางฝึกวันนี้ไม่สำเร็จ', err)
      setRoutine(null)
    } finally {
      setIsLoadingRoutine(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    loadRoutine()
    const onVisible = () => document.visibilityState === 'visible' && loadRoutine()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, loadRoutine])

  const routineExercises = useMemo(
    () => (routine?.today && !routine.today.is_rest_day ? routine.today.day.exercises : []),
    [routine]
  )
  // ท่าที่เลือกไว้ใช้เป็น hint ของคำสั่งเสียงเฉพาะเมื่อยังอยู่ในตารางวันนี้ (เปลี่ยนโปรแกรม/ข้ามวัน = ไม่ใช้)
  const routineExercise = routineExercises.some((exercise) => exercise.exercise_name === selectedExercise)
    ? selectedExercise
    : null
  const selectExercise = useCallback((name) => setSelectedExercise(name), [])
  const goToPrograms = useCallback(() => {
    setActiveTab('programs')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // บันทึกรายการที่ผู้ใช้ตรวจ/แก้ใน preview แล้ว (ผลจาก /api/parse) คืน boolean[] ว่ารายการไหนสำเร็จ
  const handleSaveItems = useCallback(
    async (items) => {
      if (!userId) {
        notify('error', { key: 'dashboard.feedback.notReady' })
        return items.map(() => false)
      }

      const results = []
      const parts = []
      let hasWorkout = false
      for (const parsed of items) {
        try {
          if (parsed.type === 'workout') {
            const saved = await createWorkoutLog({
              user_id: userId,
              exercise_name: parsed.exercise_name,
              weight_kg: parsed.weight_kg,
              reps: parsed.reps,
              sets: parsed.sets,
            })
            hasWorkout = true
            parts.push({ key: 'dashboard.feedback.logged', params: { name: parsed.exercise_name } })
            if (saved.is_volume_pr) parts.push({ key: 'dashboard.feedback.volumePr', icon: '🏆' })
            if (saved.is_1rm_pr) parts.push({ key: 'dashboard.feedback.oneRmPr', icon: '🏆' })
          } else {
            await createFoodLog({
              user_id: userId,
              food_name: parsed.food_name,
              calories: parsed.calories,
              protein: parsed.protein,
              carbs: parsed.carbs,
              fat: parsed.fat,
            })
            parts.push({ key: 'dashboard.feedback.logged', params: { name: parsed.food_name } })
          }
          results.push(true)
        } catch (err) {
          console.error(err)
          results.push(false)
        }
      }

      if (hasWorkout) {
        parts.push({ key: 'dashboard.feedback.restStarted', params: { seconds: REST_DURATION } })
        setIsResting(true)
      }
      if (results.includes(false)) {
        notify('error', ...parts, { key: 'dashboard.feedback.saveFailed' })
      } else {
        notify('success', ...parts)
      }
      if (parts.length) speak(parts.map((part) => t(part.key, part.params)).join(' '), i18n.resolvedLanguage)

      refreshLogs()
      return results
    },
    [userId, refreshLogs, t, i18n, notify]
  )

  // ---- แก้ไข / ลบ รายการที่บันทึกแล้ว ----
  const handleEditSave = useCallback(
    async (values) => {
      const { kind, log } = editing
      const updated = kind === 'workout' ? await updateWorkoutLog(log.id, values) : await updateFoodLog(log.id, values)
      const setLogs = kind === 'workout' ? setWorkoutLogs : setFoodLogs
      setLogs((prev) => prev.map((row) => (row.id === log.id ? updated : row)))
      setEditing(null)
      notify('success', { key: 'dashboard.feedback.updated', params: { name: nameOf(kind, updated) } })
    },
    [editing, notify]
  )

  // ลบออกจากหน้าจอทันที (progress ring อัปเดตเลย) ถ้า server ลบไม่สำเร็จค่อยใส่กลับ
  const handleDelete = useCallback(
    async (kind, log) => {
      const setLogs = kind === 'workout' ? setWorkoutLogs : setFoodLogs
      setLogs((prev) => prev.filter((row) => row.id !== log.id))
      try {
        await (kind === 'workout' ? deleteWorkoutLog(log.id) : deleteFoodLog(log.id))
        notify('success', { key: 'dashboard.feedback.deleted', params: { name: nameOf(kind, log) } })
      } catch (err) {
        console.error(err)
        // 404 = ถูกลบไปแล้ว (เช่น จากอีกอุปกรณ์) ไม่ต้องใส่กลับ
        if (err.status !== 404) {
          setLogs((prev) =>
            [...prev, log].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          )
          notify('error', { key: 'dashboard.feedback.deleteFailed' })
        }
      }
    },
    [notify]
  )

  const closeEditor = useCallback(() => setEditing(null), [])

  // ---- Onboarding / Profile Settings ----
  // is_onboarded === false = ยังไม่เคยกรอกข้อมูลร่างกาย -> เปิด onboarding อัตโนมัติ (ปิดไม่ได้จนกว่าจะบันทึก)
  // undefined = ฐานข้อมูลยังไม่มีคอลัมน์ onboarding จึงไม่บังคับ (เปิดเองได้จาก Profile Settings)
  const needsOnboarding = user?.is_onboarded === false
  const openProfile = useCallback(() => setIsProfileOpen(true), [])
  const closeProfile = useCallback(() => setIsProfileOpen(false), [])
  const handleProfileSave = useCallback(
    async (values) => {
      const updated = await updateProfile(values)
      setUser(updated)
      setIsProfileOpen(false)
      notify('success', { key: 'profile.saved' })
    },
    [notify]
  )
  // callback คงที่ เพื่อให้ component ที่ห่อ React.memo ไม่ render ใหม่ตอน state อื่นของ Dashboard เปลี่ยน
  const openEditor = useCallback((kind, log) => setEditing({ kind, log }), [])
  const clearProgram = useCallback(() => setActiveProgram(null), [])

  const handleRestFinish = useCallback(() => {
    setIsResting(false)
    speak(t('dashboard.restOver'), i18n.resolvedLanguage)
  }, [t, i18n])

  const handleStartProgram = useCallback((program, day) => {
    setActiveProgram({ program, day })
    setActiveTab('home')
  }, [])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ผลรวมสารอาหารวันนี้ (ปัดทศนิยมกันผลบวกแบบ 52.599999)
  const totalsToday = useMemo(() => {
    const today = foodLogs.filter((log) => isToday(log.created_at))
    return {
      calories: Math.round(sumOf(today, 'calories')),
      protein: Math.round(sumOf(today, 'protein') * 10) / 10,
      carbs: Math.round(sumOf(today, 'carbs')),
      fat: Math.round(sumOf(today, 'fat')),
    }
  }, [foodLogs])

  // เซตที่ทำไปแล้ววันนี้ของแต่ละท่า (ชื่อตัวพิมพ์เล็ก -> จำนวนเซต)
  const setsDoneToday = useMemo(
    () => countSetsByExercise(workoutLogs.filter((log) => isToday(log.created_at))),
    [workoutLogs]
  )

  // ท่าที่เลือกไว้ครบเซตเป้าหมายแล้ว (จากการบันทึกครั้งนี้) -> เลื่อนไปท่าถัดไปที่ยังไม่ครบ
  // เทียบกับจำนวนเซตครั้งก่อน: แตะเลือกท่าที่ครบแล้วเพื่อบันทึกเซตเพิ่มได้ ไม่ถูกเลื่อนออกทันที
  const previousSetsRef = useRef(null)
  useEffect(() => {
    const exercise = routineExercises.find((item) => item.exercise_name === routineExercise)
    const done = exercise ? setsDoneToday.get(exercise.exercise_name.toLowerCase()) || 0 : 0
    const previous = previousSetsRef.current
    previousSetsRef.current = { name: routineExercise, done }
    if (!exercise || previous?.name !== routineExercise || done <= previous.done || done < exercise.sets) return

    const next = routineExercises.find((item) => (setsDoneToday.get(item.exercise_name.toLowerCase()) || 0) < item.sets)
    setSelectedExercise(next?.exercise_name ?? null)
  }, [setsDoneToday, routineExercise, routineExercises])

  const completedNamesToday = useMemo(() => {
    return new Set(
      workoutLogs
        .filter((log) => isToday(log.created_at))
        .map((log) => (log.exercise_name || '').toLowerCase())
    )
  }, [workoutLogs])

  return (
    <div className="relative min-h-screen bg-obsidian pb-28 md:pb-12">
      {/* แสงพื้นหลัง: radial-gradient คงที่ชั้นเดียว (แทน div ใหญ่ที่ blur 120px + อนิเมชันลอย
          ซึ่งบังคับ GPU คำนวณเบลอใหม่ทุกเฟรม) หน้าตาเกือบเหมือนเดิมแต่แทบไม่มีต้นทุน */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(38rem 30rem at 0% 0%, rgba(16,185,129,0.12), transparent 70%)',
            'radial-gradient(34rem 28rem at 100% 45%, rgba(6,182,212,0.07), transparent 70%)',
            'radial-gradient(32rem 26rem at 40% 100%, rgba(124,58,237,0.07), transparent 70%)',
            'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: 'auto, auto, auto, 24px 24px',
        }}
      />

      <Header
        userName={user?.name}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenProfile={openProfile}
      />
      <Toast toast={toast} onClose={closeToast} />

      <main className="relative mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <DashboardPages
          activeTab={activeTab}
          user={user}
          activeProgram={activeProgram}
          completedNamesToday={completedNamesToday}
          routine={routine}
          isLoadingRoutine={isLoadingRoutine}
          setsDoneToday={setsDoneToday}
          routineExercise={routineExercise}
          selectExercise={selectExercise}
          goToPrograms={goToPrograms}
          loadRoutine={loadRoutine}
          notify={notify}
          isResting={isResting}
          totalsToday={totalsToday}
          workoutLogs={workoutLogs}
          foodLogs={foodLogs}
          isLoadingLogs={isLoadingLogs}
          clearProgram={clearProgram}
          handleSaveItems={handleSaveItems}
          handleRestFinish={handleRestFinish}
          openEditor={openEditor}
          handleDelete={handleDelete}
          handleStartProgram={handleStartProgram}
        />
      </main>

      <AnimatePresence>
        {editing && (
          <EditLogModal
            key={editing.log.id}
            kind={editing.kind}
            log={editing.log}
            onSave={handleEditSave}
            onClose={closeEditor}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(needsOnboarding || isProfileOpen) && (
          <ProfileModal
            key="profile"
            user={user}
            mode={needsOnboarding ? 'onboarding' : 'edit'}
            onSave={handleProfileSave}
            onClose={closeProfile}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function AuthGate() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-obsidian">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandMark className="h-14 w-14" />
        </motion.div>
      </div>
    )
  }

  return session ? <Dashboard /> : <AuthPage />
}

function App() {
  return (
    // เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของระบบปฏิบัติการ
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </MotionConfig>
  )
}

export default App
