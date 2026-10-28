import { useEffect, useState } from 'react'
import { FolderGit2, Moon, Sun } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
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
  const apiDotColor = loading
    ? 'bg-[#F2C230] animate-pulse'
    : health?.model_loaded
      ? 'bg-[#3FB27F]'
      : 'bg-[#C8102E]'
  const isLight = theme === 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return (
    <header>
      <div className="surface-card relative border-b border-white/10 rounded-[18px] px-2.5 py-2 sm:px-4 sm:py-2.5">
        {/* Tier 1: Logo and Unified Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to={LANDING_PATH}
            aria-label={L(i18n.language, 'Fight Intelligence • Início', 'Fight Intelligence home', 'Fight Intelligence • Accueil')}
            className="brand-badge flex shrink-0 items-center gap-2 border-2 border-black bg-[#EFECE6] px-2 py-1 xs:gap-2.5 xs:px-3 xs:py-1.5 sm:px-3.5 sm:py-1.5 text-black"
          >
            <BrandMark className="h-7 w-7 shrink-0 rounded-none xs:h-8 xs:w-8" />
            <span className="flex flex-col items-start justify-center leading-none">
              <span className="font-mono text-[9px] xs:text-[10px] font-bold uppercase tracking-wider text-[#A80D26]">
                {t('header.matchupAnalytics', 'Matchup analytics')}
              </span>
              <span className="font-['Anton','Bebas_Neue',Impact,sans-serif] text-[1.1rem] xs:text-[1.25rem] sm:text-[1.4rem] uppercase leading-none tracking-[0.02em] text-black whitespace-nowrap">
                Fight Intelligence
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {landing ? null : <OrgSwitcher className="shrink-0" />}

            {/* Minimalist API status pill */}
            <div
              title={apiTitle}
              className="type-tech hidden md:inline-flex h-8 items-center gap-2 border border-[var(--line-soft)] bg-[var(--surface-3)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]"
            >
              <span className={`keep-round h-2 w-2 shrink-0 ${apiDotColor}`} aria-hidden="true" />
              <span>{apiLabel}</span>
            </div>

            <LanguageSwitcher className="hidden sm:inline-flex" />

            {/* Unified Action Dock: Search + Theme + GitHub */}
            <div className="inline-flex h-8 items-center divide-x divide-[var(--line-soft)] border border-[var(--line-soft)] bg-[var(--surface-3)]">
              {landing ? null : <FighterSearch />}

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-full w-8 items-center justify-center text-[var(--text-muted)] transition cursor-pointer hover:bg-[var(--action-hover-bg)] hover:text-[var(--text-main)]"
                aria-label={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
                title={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
              >
                {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </button>

              <a
                href="https://github.com/larissapavan"
                target="_blank"
                rel="noreferrer"
                title="GitHub"
                aria-label="GitHub"
                className="hidden sm:inline-flex h-full w-8 items-center justify-center text-[var(--text-muted)] transition hover:bg-[var(--action-hover-bg)] hover:text-[var(--text-main)]"
              >
                <FolderGit2 className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Tier 2: Dedicated Navigation Row - always visible, smoothly scrollable on mobile */}
        {landing ? null : (
          <div className="mt-2 border-t border-white/10 pt-2 sm:mt-2.5 sm:pt-2">
            <nav
              aria-label={L(i18n.language, 'Navegação principal', 'Main navigation', 'Navigation principale')}
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
