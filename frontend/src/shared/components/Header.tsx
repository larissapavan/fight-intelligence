import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, CircleDot, FolderGit2, Menu, Moon, Sun, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import logo from '../../assets/ufc-fight-predictor-logo-red.jpg'
import { useModelInfo } from '../hooks/useModelInfo'

const navItems = [
  { to: '/predictor', label: 'Predict' },
  { to: '/fighters', label: 'Fighters' },
  { to: '/events', label: 'Events' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/champions', label: 'Champions' },
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/matchup-intelligence', label: 'Matchup' },
  { to: '/data', label: 'Data' },
  { to: '/model', label: 'System' },
]

type ThemeMode = 'dark' | 'light'
const THEME_STORAGE_KEY = 'ufc-predictor:theme'

export function Header() {
  const { health, loading } = useModelInfo()
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference())
  const [menuOpen, setMenuOpen] = useState(false)
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

  useEffect(() => {
    if (!menuOpen) return
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [menuOpen])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return (
    <header>
      <div className="surface-card border-b border-white/10 rounded-[18px] px-2.5 py-2.5 sm:px-3.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--logo-bg)] shadow-[0_0_0_1px_var(--line-soft),0_12px_24px_rgba(0,0,0,0.16)]">
              <img
                src={logo}
                alt="UFC Fight Intelligence logo"
                className="h-7 w-7 object-contain transition duration-300 hover:scale-105"
              />
            </div>
            <div className="min-w-0">
              <div className="hidden items-center gap-2 text-[#E81B23] xs:flex">
                <Activity className="h-3.5 w-3.5" />
                <p className="broadcast-label text-[10px]">Matchup analytics</p>
              </div>
              <p className="data-value theme-text mt-0.5 truncate text-lg leading-none tracking-[0.03em] sm:text-xl">
                UFC Intelligence
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] xs:inline-flex ${apiClasses}`}>
              <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
              {apiLabel}
            </div>

            <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.035] p-1 lg:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition xl:px-3.5 xl:py-2 xl:text-sm xl:tracking-[0.1em]',
                      isActive ? 'nav-link-active' : 'text-[#999999] hover:bg-white/7 hover:text-white',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <button
              type="button"
              onClick={toggleTheme}
              className="ghost-action theme-text hidden min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] lg:inline-flex"
              aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
              title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden xl:inline">{isLight ? 'Dark' : 'Light'}</span>
            </button>

            <a
              href="https://github.com/lacpavan/ufcpredictor"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className="ghost-action hidden min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#E81B23] lg:inline-flex"
            >
              <FolderGit2 className="h-4 w-4" />
              <span className="hidden xl:inline">GitHub</span>
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="ghost-action theme-text inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden lg:hidden"
            >
              <div className="mt-2.5 flex flex-col gap-2 border-t border-white/8 pt-2.5">
                <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] xs:hidden ${apiClasses}`}>
                  <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
                  {apiLabel}
                </div>

                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        [
                          'rounded-xl px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] transition',
                          isActive ? 'nav-link-active' : 'text-[#999999] hover:bg-white/7 hover:text-white',
                        ].join(' ')
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <div className="flex items-center gap-1.5 border-t border-white/8 pt-2.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="ghost-action theme-text inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                  >
                    {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {isLight ? 'Dark mode' : 'Light mode'}
                  </button>

                  <a
                    href="https://github.com/lacpavan/ufcpredictor"
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#E81B23]"
                  >
                    <FolderGit2 className="h-4 w-4" />
                    GitHub
                  </a>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
