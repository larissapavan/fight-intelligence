import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleDot, FolderGit2, Menu, Moon, Sun, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { useTranslation } from 'react-i18next'

import { isLandingPath, LANDING_PATH, orgPath, type OrgConfig } from '../data/orgs'
import { useModelInfo } from '../hooks/useModelInfo'
import { useOrg } from '../hooks/useOrg'
import { BrandMark } from './BrandMark'
import { FighterSearch } from './FighterSearch'
import { LanguageSwitcher } from './LanguageSwitcher'
import { OrgSwitcher } from './OrgSwitcher'

type NavItem = { to: string; label: string; group?: string[]; /** Also active on the pages below it (a gym under Gyms). */ section?: boolean }

const NAV_I18N_KEYS: Record<string, string> = {
  Predict: 'nav.predict',
  Fighters: 'nav.fighters',
  Events: 'nav.events',
  Rankings: 'nav.rankings',
  Gyms: 'nav.gyms',
  Champions: 'nav.champions',
  About: 'nav.about',
}

const ufcNavItems: NavItem[] = [
  { to: '/predictor', label: 'Predict', group: ['/predictor', '/head-to-head', '/matchup-intelligence'] },
  { to: '/fighters', label: 'Fighters' },
  { to: '/events', label: 'Events' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/gyms', label: 'Gyms', section: true },
  { to: '/champions', label: 'Champions', group: ['/champions', '/record-book'] },
  { to: '/about', label: 'About', group: ['/about', '/data', '/model', '/track-record'] },
]

/** Every organization other than the UFC has the same three sections. */
function navItemsFor(org: OrgConfig): NavItem[] {
  if (org.id === 'ufc') return ufcNavItems
  return [
    { to: orgPath(org, 'fighters'), label: 'Fighters' },
    { to: orgPath(org, 'events'), label: 'Events' },
    ...(org.hasRankings ? [{ to: orgPath(org, 'rankings'), label: 'Rankings' }] : []),
    { to: orgPath(org, 'gyms'), label: 'Gyms', section: true },
  ]
}

function isItemActive(item: NavItem, pathname: string) {
  const current = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (item.section && current.startsWith(`${item.to}/`)) return true
  return (item.group ?? [item.to]).includes(current)
}

type ThemeMode = 'dark' | 'light'
const THEME_STORAGE_KEY = 'ufc-predictor:theme'

export function Header() {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const { health, loading } = useModelInfo()
  const { pathname } = useLocation()
  const org = useOrg()
  // On the page that chooses an organization there is no organization yet: no switcher, no section links, no fighter search
  // (the menu button stays: on a phone it holds the light/dark switch).
  const landing = isLandingPath(pathname)
  const navItems = landing ? [] : navItemsFor(org)
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference())
  const [menuOpen, setMenuOpen] = useState(false)
  const apiLabel = loading
    ? t('header.apiWaking', 'Waking up')
    : health?.model_loaded
      ? t('header.apiLive', 'Live')
      : t('header.apiOffline', 'Offline')
  const apiTitle = loading
    ? t('header.apiWakingTitle', 'The API is starting. The first visit after a quiet spell can take up to a minute.')
    : health?.model_loaded
      ? t('header.apiLiveTitle', 'API is live and the model is loaded')
      : t('header.apiOfflineTitle', 'API is unreachable')
  const apiClasses = loading
    ? 'border-[#F2C230] bg-[#F2C230] text-[#0E0E0E]'
    : health?.model_loaded
      ? 'border-[var(--rule)] bg-[#2E7D4F] text-white'
      : 'border-[var(--rule)] bg-[#C8102E] text-white'
  const apiDotClasses = loading ? 'animate-pulse' : health?.model_loaded ? 'animate-pulse' : ''
  const isLight = theme === 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!menuOpen) return
    const handleResize = () => {
      if (window.innerWidth >= 1280) setMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [menuOpen])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return (
    <header>
      {/* Which organization is on screen: its own strip, so the bar below keeps room for the menu. */}
      {landing ? null : (
        <div className="mb-2 flex items-center justify-between gap-3">
          <OrgSwitcher />
          <p className="type-tech hidden truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] xs:block">{org.name}</p>
        </div>
      )}
      <div className="surface-card relative border-b border-white/10 rounded-[18px] px-2.5 py-2.5 sm:px-3.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={LANDING_PATH}
            aria-label={isPt ? 'Fight Intelligence • Início' : 'Fight Intelligence home'}
            className="brand-badge flex shrink-0 items-center gap-2 border-2 border-black bg-[#EFECE6] px-2.5 py-1.5 xs:gap-3 xs:px-3.5 xs:py-2 sm:px-4 text-black"
          >
            <BrandMark className="h-7 w-7 shrink-0 rounded-none xs:h-8 xs:w-8 sm:h-9 sm:w-9" />
            <span className="flex flex-col items-start justify-center leading-none">
              <span className="font-mono text-[9px] xs:text-[10px] font-bold uppercase tracking-wider text-[#A80D26]">
                {t('header.matchupAnalytics', 'Matchup analytics')}
              </span>
              <span className="font-['Anton','Bebas_Neue',Impact,sans-serif] text-[1.1rem] xs:text-[1.3rem] sm:text-[1.5rem] uppercase leading-none tracking-[0.02em] text-black whitespace-nowrap">
                Fight Intelligence
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <div
              title={apiTitle}
              className={`type-tech hidden items-center gap-1.5 border-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] xl:inline-flex ${apiClasses}`}
            >
              <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
              {apiLabel}
            </div>

            {landing ? null : <FighterSearch />}

            <nav className="hidden items-center gap-1 rounded-full border border-white/14 bg-white/[0.04] p-1 xl:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={[
                    'rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] transition 2xl:px-3.5 2xl:py-2 2xl:text-[13px] 2xl:tracking-[0.08em]',
                    isItemActive(item, pathname) ? 'nav-link-active' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]',
                  ].join(' ')}
                >
                  {t(NAV_I18N_KEYS[item.label] ?? item.label, item.label)}
                </NavLink>
              ))}
            </nav>

            <LanguageSwitcher className="hidden xl:inline-flex" />

            <button
              type="button"
              onClick={toggleTheme}
              className="ghost-action theme-text hidden min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] xl:inline-flex"
              aria-label={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
              title={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden 2xl:inline">{isLight ? t('header.themeDark', 'Modo Escuro') : t('header.themeLight', 'Modo Claro')}</span>
            </button>

            <a
              href="https://github.com/larissapavan"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className="ghost-action hidden min-w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8102E] 2xl:inline-flex"
            >
              <FolderGit2 className="h-4 w-4" />
              <span className="hidden 2xl:inline">GitHub</span>
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="ghost-action theme-text inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full xl:hidden"
              aria-label={menuOpen ? t('header.closeMenu', 'Fechar menu') : t('header.openMenu', 'Abrir menu')}
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
              className="overflow-hidden xl:hidden"
            >
              <div className="mt-2.5 flex flex-col gap-2 border-t border-white/8 pt-2.5">
                <div
                  title={apiTitle}
                  className={`type-tech inline-flex w-fit items-center gap-1.5 border-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] xl:hidden ${apiClasses}`}
                >
                  <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
                  {apiLabel}
                </div>

                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={[
                        'rounded-xl px-3 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition',
                        isItemActive(item, pathname) ? 'nav-link-active' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]',
                      ].join(' ')}
                    >
                      {t(NAV_I18N_KEYS[item.label] ?? item.label, item.label)}
                    </NavLink>
                  ))}
                </nav>

                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2.5 px-1">
                  <span className="type-tech text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    {t('language.switch', 'Idioma')}
                  </span>
                  <LanguageSwitcher />
                </div>

                <div className="flex items-center gap-1.5 border-t border-white/8 pt-2.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="ghost-action theme-text inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                  >
                    {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {isLight ? t('header.themeDark', 'Modo Escuro') : t('header.themeLight', 'Modo Claro')}
                  </button>

                  <a
                    href="https://github.com/larissapavan"
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8102E]"
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
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}
