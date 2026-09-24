import { useEffect, useState } from 'react'
import { Activity, CircleDot, FolderGit2, Moon, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import logo from '../../assets/ufc-fight-predictor-logo-red.jpg'
import { useModelInfo } from '../hooks/useModelInfo'

const navItems = [
  { to: '/', label: 'Predict' },
  { to: '/fighters', label: 'Fighters' },
  { to: '/events', label: 'Events' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/model', label: 'System' },
]

type ThemeMode = 'dark' | 'light'
const THEME_STORAGE_KEY = 'ufc-predictor:theme'

export function Header() {
  const { health, loading } = useModelInfo()
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference())
  const apiLabel = loading ? 'Checking' : health?.model_loaded ? 'Live' : 'Offline'
  const apiClasses = loading
    ? 'border-white/10 bg-white/[0.04] text-[#CCCCCC]'
    : health?.model_loaded
      ? 'border-[#E81B23]/24 bg-[#E81B23]/10 text-[#E81B23]'
      : 'border-white/10 bg-white/[0.04] text-[#999999]'
  const apiDotClasses = loading ? '' : health?.model_loaded ? 'animate-pulse' : ''
  const isLight = theme === 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return (
    <header className="sticky top-2 z-30">
      <div className="surface-card rounded-[18px] px-2.5 py-2 sm:px-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--logo-bg)] shadow-[0_0_0_1px_var(--line-soft),0_12px_24px_rgba(0,0,0,0.16)]">
              <img
                src={logo}
                alt="UFC Fight Predictor logo"
                className="h-7 w-7 object-contain transition duration-300 hover:scale-105"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#E81B23]">
                <Activity className="h-3.5 w-3.5" />
                <p className="broadcast-label text-[10px]">Matchup analytics</p>
              </div>
              <p className="theme-text mt-0.5 truncate text-base font-bold uppercase tracking-[0.04em] sm:text-lg">
                UFC Predictor
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <div className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${apiClasses}`}>
              <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
              {apiLabel}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <nav className="flex min-w-max items-center gap-1 rounded-full border border-white/8 bg-white/[0.035] p-0.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition',
                      isActive ? 'bg-[#FFFFFF] text-[#050505] shadow-sm' : 'text-[#999999] hover:bg-white/7 hover:text-white',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              </nav>

              <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                className="ghost-action theme-text inline-flex min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
                aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
                title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
              >
                {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {isLight ? 'Dark' : 'Light'}
              </button>

              <a
                href="https://github.com/lacpavan/ufcpredictor"
                target="_blank"
                rel="noreferrer"
                className="ghost-action inline-flex min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#E81B23]"
              >
                <FolderGit2 className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function readThemePreference(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}
