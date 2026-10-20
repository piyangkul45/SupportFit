import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, ChevronDown, Copy, Layers, Pencil, Plus, Power, Trash2, TriangleAlert, Trophy } from 'lucide-react'
import WorkoutPrograms from '../components/WorkoutPrograms'
import ProgramBuilderModal from '../components/ProgramBuilderModal'
import { ButtonLabel } from '../components/Spinner'
import { createProgram, deleteProgram, getPrograms, setActiveProgram, updateProgram } from '../utils/api'
import { localDateString } from '../utils/date'
import { dayName, isRestDay, programDescription, programTitle, toBuilderDraft, trainingDayCount } from '../utils/programs'

const PRESET_ACCENTS = {
  ppl: 'from-fuchsia-500 to-purple-700',
  upper_lower: 'from-sky-500 to-blue-700',
  full_body: 'from-emerald-500 to-green-700',
}
const CUSTOM_ACCENT = 'from-amber-500 to-orange-600'
// กดลบครั้งแรก = ถาม กดซ้ำภายในเวลานี้ = ลบจริง
const DELETE_CONFIRM_MS = 3000

// รายชื่อวันในรอบ (กดเปิดดูท่าของแต่ละวัน)
function DayList({ program }) {
  const { t } = useTranslation()
  return (
    <ol className="space-y-1.5">
      {program.days.map((day, index) => (
        <li key={index} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 text-sm">
          <p className={`font-medium ${isRestDay(day) ? 'text-slate-500' : 'text-slate-100'}`}>
            <span className="mr-1.5 text-xs text-slate-500">{t('programs.dayFallback', { number: index + 1 })}</span>
            {dayName(day, index, t)}
          </p>
          {!isRestDay(day) && (
            <p className="mt-0.5 text-xs text-slate-400">
              {day.exercises.map((exercise) => `${exercise.exercise_name} ${t('programs.target', { sets: exercise.sets, reps: exercise.reps })}`).join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

function ProgramCard({ program, isActive, busy, onSelect, onCustomize, onEdit, onDelete, index }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const accent = program.key ? PRESET_ACCENTS[program.key] : CUSTOM_ACCENT

  useEffect(() => {
    if (!confirmingDelete) return undefined
    const timer = setTimeout(() => setConfirmingDelete(false), DELETE_CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirmingDelete])

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 28 }}
      className={`glass-card relative flex flex-col overflow-hidden ${isActive ? 'border-emerald-400/40' : ''}`}
    >
      <div aria-hidden className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-20 ${accent}`} />
      <div className="relative flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-white">{programTitle(program, t)}</h3>
          {isActive && (
            <span className="badge shrink-0 border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
              <Check className="mr-1 h-3 w-3" aria-hidden />
              {t('programs.activeBadge')}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {t('programs.trainingDays', { count: trainingDayCount(program) })} · {t('programs.cycleDays', { count: program.days.length })}
        </p>
        {programDescription(program, t) && <p className="mt-2 text-sm text-slate-300">{programDescription(program, t)}</p>}

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 flex items-center gap-1 self-start text-xs font-medium text-emerald-300 hover:text-emerald-200"
        >
          {t(expanded ? 'programs.hideDays' : 'programs.viewDays')}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <DayList program={program} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {!isActive && (
            <button type="button" disabled={busy} onClick={onSelect} className="btn-accent flex-1 px-3 py-2 text-xs">
              <ButtonLabel loading={busy} loadingText={t('programs.selecting')}>
                {t('programs.select')}
              </ButtonLabel>
            </button>
          )}
          {program.is_preset ? (
            <button type="button" onClick={onCustomize} className="btn-ghost flex items-center justify-center gap-1.5 px-3 py-2 text-xs">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t('programs.customize')}
            </button>
          ) : (
            <>
              <button type="button" onClick={onEdit} className="btn-ghost flex items-center justify-center gap-1.5 px-3 py-2 text-xs">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t('programs.edit')}
              </button>
              <button
                type="button"
                onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
                className={`btn-ghost flex items-center justify-center gap-1.5 px-3 py-2 text-xs ${confirmingDelete ? 'border-red-400/40 text-red-300' : ''}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {t(confirmingDelete ? 'programs.confirmDelete' : 'programs.delete')}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function ActiveOverview({ program, active, busy, onEdit, onStop }) {
  const { t, i18n } = useTranslation()
  if (!program) {
    return (
      <section className="glass-panel flex items-center gap-3 p-4">
        <span className="icon-tile border-white/10 bg-white/5 text-slate-400">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">{t('programs.active.none')}</p>
          <p className="text-xs text-slate-400">{t('programs.active.noneHint')}</p>
        </div>
      </section>
    )
  }

  const startedOn = active.started_on && new Date(`${active.started_on}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <section className="glass-card relative overflow-hidden border-emerald-400/30 p-5">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.16),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">{t('programs.active.title')}</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">{programTitle(program, t)}</h2>
          <p className="text-xs text-slate-400">
            {startedOn && `${t('programs.active.startedOn', { date: startedOn })} · `}{t('programs.trainingDays', { count: trainingDayCount(program) })}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-xs">
            {program.is_preset ? <Copy className="h-3.5 w-3.5" aria-hidden /> : <Pencil className="h-3.5 w-3.5" aria-hidden />}
            {t(program.is_preset ? 'programs.customize' : 'programs.edit')}
          </button>
          <button type="button" disabled={busy} onClick={onStop} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-xs hover:text-red-300">
            <Power className="h-3.5 w-3.5" aria-hidden />
            {t('programs.active.stop')}
          </button>
        </div>
      </div>
      <p className="relative mt-3 text-xs text-slate-500">{t('programs.active.switchHint')}</p>
    </section>
  )
}

function SectionHeading({ Icon, title, action }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 className="card-title text-base">
        <span className="icon-tile border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      {action}
    </div>
  )
}

// หน้าโปรแกรมฝึก: โปรแกรมที่ใช้อยู่, preset, โปรแกรมของฉัน (สร้าง/แก้/ลบ) และ routine คนดัง (เริ่มเฉพาะวันนี้)
// onActiveProgramChange: ให้ Dashboard โหลด "ตารางฝึกวันนี้" ใหม่ ; notify(type, ...parts): toast ของ Dashboard
function Programs({ onStartRoutine, onActiveProgramChange, notify }) {
  const { t } = useTranslation()
  const [data, setData] = useState({ programs: [], active: null, db_ready: true })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [builder, setBuilder] = useState(null) // { draft, editingId }

  useEffect(() => {
    let cancelled = false
    getPrograms()
      .then((result) => !cancelled && setData(result))
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoadError(true)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const presets = data.programs.filter((program) => program.is_preset)
  const custom = data.programs.filter((program) => !program.is_preset)
  const activeProgram = data.programs.find((program) => program.id === data.active?.program_id) || null

  const activate = async (program) => {
    setBusyId(program?.id ?? 'stop')
    try {
      const { active } = await setActiveProgram(program?.id ?? null, localDateString())
      setData((prev) => ({ ...prev, active }))
      onActiveProgramChange()
      notify('success', program ? { key: 'programs.feedback.activated', params: { name: programTitle(program, t) } } : { key: 'programs.feedback.stopped' })
    } catch (err) {
      notify('error', { key: 'programs.feedback.raw', params: { message: err.message } })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (program) => {
    try {
      await deleteProgram(program.id)
      setData((prev) => ({
        ...prev,
        programs: prev.programs.filter((item) => item.id !== program.id),
        active: prev.active?.program_id === program.id ? null : prev.active,
      }))
      if (data.active?.program_id === program.id) onActiveProgramChange()
      notify('success', { key: 'programs.feedback.deleted', params: { name: program.title } })
    } catch (err) {
      notify('error', { key: 'programs.feedback.raw', params: { message: err.message } })
    }
  }

  const openBuilder = (program, { copy = false } = {}) =>
    setBuilder({ draft: toBuilderDraft(program, t, { copy }), editingId: program && !copy ? program.id : null })
  const closeBuilder = useCallback(() => setBuilder(null), [])

  const saveBuilder = async (payload) => {
    const { editingId } = builder
    const saved = editingId ? await updateProgram(editingId, payload) : await createProgram(payload)
    setData((prev) => ({
      ...prev,
      programs: editingId
        ? prev.programs.map((program) => (program.id === editingId ? saved : program))
        : [...prev.programs.filter((program) => program.is_preset), saved, ...prev.programs.filter((program) => !program.is_preset)],
    }))
    setBuilder(null)
    if (editingId && data.active?.program_id === editingId) onActiveProgramChange()
    notify('success', { key: 'programs.feedback.saved', params: { name: saved.title } })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 text-center">
        <span className="icon-tile mx-auto mb-3 h-11 w-11 border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Trophy className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t('nav.programs')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('programs.pageIntro')}</p>
      </div>

      {!data.db_ready && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('programs.dbNotReady')}
        </p>
      )}
      {loadError && (
        <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{t('programs.feedback.loadFailed')}</p>
      )}

      {loading ? (
        <div className="space-y-4" aria-hidden>
          <div className="skeleton h-24" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-56" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <ActiveOverview
            program={activeProgram}
            active={data.active}
            busy={busyId === 'stop'}
            onEdit={() => openBuilder(activeProgram, { copy: activeProgram.is_preset })}
            onStop={() => activate(null)}
          />

          <SectionHeading Icon={Layers} title={t('programs.presetsTitle')} />
          <div className="grid gap-4 md:grid-cols-3">
            {presets.map((program, index) => (
              <ProgramCard
                key={program.id}
                index={index}
                program={program}
                isActive={program.id === data.active?.program_id}
                busy={busyId === program.id}
                onSelect={() => activate(program)}
                onCustomize={() => openBuilder(program, { copy: true })}
              />
            ))}
          </div>

          <SectionHeading
            Icon={Pencil}
            title={t('programs.customTitle')}
            action={
              <button type="button" onClick={() => openBuilder(null)} className="btn-accent flex items-center gap-1.5 px-3 py-2 text-xs">
                <Plus className="h-4 w-4" aria-hidden />
                {t('programs.create')}
              </button>
            }
          />
          {custom.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {custom.map((program, index) => (
                <ProgramCard
                  key={program.id}
                  index={index}
                  program={program}
                  isActive={program.id === data.active?.program_id}
                  busy={busyId === program.id}
                  onSelect={() => activate(program)}
                  onEdit={() => openBuilder(program)}
                  onDelete={() => remove(program)}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openBuilder(null)}
              className="glass-panel w-full border-dashed p-6 text-center text-sm text-slate-400 transition-colors hover:border-emerald-400/30 hover:text-slate-200"
            >
              {t('programs.customEmpty')}
            </button>
          )}
        </>
      )}

      <SectionHeading Icon={Trophy} title={t('programs.celebrityTitle')} />
      <p className="-mt-1 mb-4 text-sm text-slate-400">{t('programs.intro')}</p>
      <WorkoutPrograms onStart={onStartRoutine} />

      <AnimatePresence>
        {builder && (
          <ProgramBuilderModal
            key="builder"
            draft={builder.draft}
            isEditing={Boolean(builder.editingId)}
            onSave={saveBuilder}
            onClose={closeBuilder}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(Programs)
