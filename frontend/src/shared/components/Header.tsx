import { useEffect, useState } from 'react'
import { CircleDot, FolderGit2, Moon, Sun } from 'lucide-react'
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
  const landing = isLandingPath(pathname)
  const navItems = landing ? [] : navItemsFor(org)
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference())
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

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return (
    <header>

      <div className="surface-card relative border-b border-white/10 rounded-[18px] px-2.5 py-2 sm:px-4 sm:py-2.5">
        {/* Tier 1: Logo and Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to={LANDING_PATH}
            aria-label={isPt ? 'Fight Intelligence • Início' : 'Fight Intelligence home'}
            className="brand-badge flex shrink-0 items-center gap-2 border-2 border-black bg-[#EFECE6] px-2 py-1 xs:gap-2.5 xs:px-3 xs:py-1.5 sm:px-4 sm:py-2 text-black"
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

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {landing ? null : <OrgSwitcher className="shrink-0" />}

            {/* API status: badge on sm+ */}
            <div
              title={apiTitle}
              className={`type-tech hidden sm:inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${apiClasses}`}
            >
              <CircleDot className={`h-3.5 w-3.5 fill-current ${apiDotClasses}`} />
              {apiLabel}
            </div>


            {landing ? null : <FighterSearch />}

            <LanguageSwitcher className="hidden sm:inline-flex" />

            <button
              type="button"
              onClick={toggleTheme}
              className="ghost-action theme-text inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition"
              aria-label={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
              title={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <a
              href="https://github.com/larissapavan"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              aria-label="GitHub"
              className="ghost-action hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full text-[#C8102E] transition"
            >
              <FolderGit2 className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Tier 2: Dedicated Navigation Row - always visible, smoothly scrollable on mobile */}
        {landing ? null : (
          <div className="mt-2 border-t border-white/10 pt-2 sm:mt-2.5 sm:pt-2">
            <nav
              aria-label={isPt ? 'Navegação principal' : 'Main navigation'}
              className="chip-scroll flex w-fit max-w-full items-center gap-1 sm:gap-1.5 overflow-x-auto rounded-xl sm:rounded-full border border-white/10 bg-white/[0.03] p-1 scroll-smooth"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={[
                    'rounded-lg sm:rounded-full px-2.5 py-1.5 sm:px-3 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] transition whitespace-nowrap shrink-0',
                    isItemActive(item, pathname)
                      ? 'nav-link-active'
                      : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]',
                  ].join(' ')}
                >
                  {t(NAV_I18N_KEYS[item.label] ?? item.label, item.label)}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
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
