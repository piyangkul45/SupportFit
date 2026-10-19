import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header({ userName }) {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()
  const [showProfile, setShowProfile] = useState(false)
  const email = session?.user?.email
  const initial = (userName || email || '?')[0]?.toUpperCase()

  return (
    <header className="glass-card mx-auto mb-6 flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <BrandMark className="h-11 w-11" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">SupportFit</h1>
          <p className="hidden truncate text-xs text-slate-400 sm:block">{t('header.subtitle')}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitcher />

        <div className="relative">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10 font-semibold text-lime-300 transition-colors hover:bg-lime-400/20"
            aria-label={t('header.profile')}
          >
            {initial}
          </button>

          {showProfile && (
            <div className="glass-card absolute right-0 z-20 mt-2 w-56 p-3">
              <p className="truncate text-sm font-medium text-slate-100">
                {userName || t('common.userFallback')}
              </p>
              <p className="truncate text-xs text-slate-400">{email}</p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="btn-danger-ghost px-3 py-2 text-sm"
          aria-label={t('header.logout')}
        >
          <span className="hidden sm:inline">{t('header.logout')}</span>
          <span className="sm:hidden">⏻</span>
        </button>
      </div>
    </header>
  )
}
