import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'
import LanguageSwitcher from './LanguageSwitcher'

const SPRING = { type: 'spring', stiffness: 420, damping: 34 }

// แท็บนำทาง: pill สีเขียวเลื่อนตามแท็บที่เลือก (layoutId)
function NavTabs({ tabs, activeTab, onChange, layoutId, className, itemClassName }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('nav.label')} className={className}>
      {tabs.map(({ id, labelKey, Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex items-center justify-center rounded-xl font-medium transition-colors duration-200 ${itemClassName} ${
              active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="absolute inset-0 rounded-xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/20 to-emerald-500/5 shadow-[0_0_18px_-6px_rgba(16,185,129,0.8)]"
              />
            )}
            <Icon className={`relative h-4.5 w-4.5 ${active ? 'text-emerald-300' : ''}`} strokeWidth={2} aria-hidden />
            <span className="relative">{t(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}

function ProfileMenu({ userName, onOpenProfile }) {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const email = session?.user?.email
  const displayName = userName || t('common.userFallback')
  const initial = (userName || email || '?')[0]?.toUpperCase()

  // ปิดเมนูเมื่อคลิกนอกเมนูหรือกด Escape
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => !menuRef.current?.contains(event.target) && setOpen(false)
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('header.profile')}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-cyan-500 p-[2px] shadow-[0_0_16px_-4px_rgba(16,185,129,0.8)]"
      >
        {userName || email ? (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-obsidian text-sm font-bold text-emerald-200">
            {initial}
          </span>
        ) : (
          <span className="skeleton h-full w-full rounded-full" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="glass-card absolute right-0 z-50 mt-2 w-64 origin-top-right bg-obsidian-raised/90 p-2"
          >
            <div className="flex items-center gap-3 rounded-xl px-2.5 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 font-bold text-emerald-200">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
                <p className="truncate text-xs text-slate-400">{email}</p>
              </div>
            </div>
            <div className="my-1.5 h-px bg-white/10" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenProfile()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-300" aria-hidden />
              {t('header.profileSettings')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('header.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Navbar ติดขอบบน (desktop มีแท็บตรงกลาง) + แถบนำทางด้านล่างบนมือถือ
function Header({ userName, tabs, activeTab, onTabChange, onOpenProfile }) {
  const { t } = useTranslation()

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-obsidian/75 glass-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight text-white">
                Support<span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">Fit</span>
              </p>
              <p className="hidden truncate text-[11px] text-slate-500 lg:block">{t('header.subtitle')}</p>
            </div>
          </div>

          <NavTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={onTabChange}
            layoutId="nav-pill-desktop"
            className="glass-panel hidden items-center gap-1 p-1 md:flex"
            itemClassName="gap-2 px-4 py-2 text-sm"
          />

          <div className="flex shrink-0 items-center gap-2.5">
            <LanguageSwitcher />
            <ProfileMenu userName={userName} onOpenProfile={onOpenProfile} />
          </div>
        </div>
      </header>

      <NavTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={onTabChange}
        layoutId="nav-pill-mobile"
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-obsidian-raised/85 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.8)] glass-blur md:hidden"
        itemClassName="flex-col gap-1 py-2 text-[11px]"
      />
    </>
  )
}

// props เดิม = ไม่ render ใหม่เมื่อ Dashboard render (เช่น ตอน toast/modal เปลี่ยน)
export default memo(Header)
