import { FolderGit2, Moon, Sun } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { isLandingPath, LANDING_PATH, orgPath, type OrgConfig } from '../data/orgs'
import { useModelInfo } from '../hooks/useModelInfo'
import { useOrg } from '../hooks/useOrg'
import { useTheme } from '../context/ThemeContext'
import { BrandMark } from './BrandMark'
import { FighterSearch } from './FighterSearch'
import { SocialLinks } from './SocialLinks'
import { LanguageSwitcher } from './LanguageSwitcher'
import { OrgSwitcher } from './OrgSwitcher'

type NavItem = { to: string; label: string; group?: string[]; section?: boolean }

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
]

function navItemsFor(org: OrgConfig): NavItem[] {
  if (org.id === 'ufc') return ufcNavItems
  return [
    ...(org.hasPredictions ? [{ to: orgPath(org, 'predictor'), label: 'Predict' }] : []),
    { to: orgPath(org, 'fighters'), label: 'Fighters' },
    { to: orgPath(org, 'events'), label: 'Events' },
    ...(org.hasRankings ? [{ to: orgPath(org, 'rankings'), label: 'Rankings' }] : []),
    ...(org.hasChampions ? [{ to: orgPath(org, 'champions'), label: 'Champions' }] : []),
    { to: orgPath(org, 'gyms'), label: 'Gyms', section: true },
  ]
}

function isItemActive(item: NavItem, pathname: string) {
  const current = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (item.section && current.startsWith(`${item.to}/`)) return true
  return (item.group ?? [item.to]).includes(current)
}

/**
 * Modern, Minimalist SaaS Combat Sports Analytics Navbar (Clean Single-Bar Layout).
 */
export function Header() {
  const { t, i18n } = useTranslation()
  const { health, loading } = useModelInfo()
  const { pathname } = useLocation()
  const org = useOrg()
  const landing = isLandingPath(pathname)
  const isAbout = pathname === '/about' || pathname.startsWith('/about/') || pathname === '/data' || pathname === '/model' || pathname === '/track-record'
  const navItems = landing || isAbout ? [] : navItemsFor(org)
  const { isLight, toggleTheme } = useTheme()

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
      ? 'bg-[#22c55e]'
      : 'bg-[#C8102E]'

  return (
    <header className="w-full shrink-0">
      <div className="relative w-full rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/90 backdrop-blur-md transition-colors duration-200 shadow-sm text-[var(--text-primary)]">
        {/* Main Navbar Row */}
        <div className="flex h-12 sm:h-16 w-full items-center justify-between gap-2 sm:gap-6 px-2.5 sm:px-5">
          {/* Left: Native Brand Identity */}
          <div className="flex shrink-0 items-center gap-3 xl:gap-8 min-w-0">
            <Link
              to={LANDING_PATH}
              aria-label={L(i18n.language, 'Vektor MMA • Início', 'Vektor MMA home', 'Vektor MMA • Accueil')}
              className="flex items-center gap-2 sm:gap-2.5 transition opacity-95 hover:opacity-100 min-w-0"
            >
              <BrandMark className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 shrink-0 drop-shadow-sm" />
              <span className="flex flex-col items-start justify-center leading-tight min-w-0">
                <span className="hidden sm:block font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t('header.matchupAnalytics', 'Análise de Combates')}
                </span>
                <span className="text-xs xs:text-sm sm:text-base font-bold tracking-tight whitespace-nowrap text-[var(--text-primary)]">
                  VEKTOR <span className="text-[#FF2E54]">MMA</span>
                </span>
              </span>
            </Link>

            {/* Center-Left: Desktop Single-Bar Navigation */}
            {landing || isAbout ? (
              <nav
                aria-label={L(i18n.language, 'Navegação principal', 'Main navigation', 'Navigation principale')}
                className="flex items-center gap-1.5"
              >
                <NavLink
                  to="/about"
                  style={{
                    color: isAbout ? '#ffffff' : 'var(--text-primary)',
                    backgroundColor: isAbout ? '#C8102E' : undefined,
                  }}
                  className={`rounded-lg px-3 py-1 sm:px-3.5 sm:py-1.5 text-xs xl:text-[13px] font-bold transition duration-150 whitespace-nowrap shadow-xs hover:bg-black/5 dark:hover:bg-white/10 ${
                    isAbout ? 'shadow-xs' : ''
                  }`}
                >
                  {t('nav.about', 'About')}
                </NavLink>
              </nav>
            ) : (
              <nav
                aria-label={L(i18n.language, 'Navegação principal', 'Main navigation', 'Navigation principale')}
                className="hidden lg:flex items-center gap-1.5"
              >
                {navItems.map((item) => {
                  const active = isItemActive(item, pathname)
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      style={{
                        color: active ? '#ffffff' : 'var(--text-primary)',
                        backgroundColor: active ? '#C8102E' : undefined,
                      }}
                      className={`rounded-lg px-3.5 py-1.5 text-xs xl:text-[13px] font-bold transition duration-150 whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/10 ${
                        active ? 'shadow-xs' : ''
                      }`}
                    >
                      {t(NAV_I18N_KEYS[item.label] ?? item.label, item.label)}
                    </NavLink>
                  )
                })}
              </nav>
            )}
          </div>

          {/* Right: Modern SaaS Utility Toolbar */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {!landing && !isAbout && <OrgSwitcher className="shrink-0" />}

            {!landing && !isAbout && <FighterSearch />}

            {/* Minimalist LIVE Status Pill */}
            <div
              title={apiTitle}
              className="hidden sm:inline-flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium cursor-default text-[var(--text-muted)]"
            >
              <span className={`h-2 w-2 rounded-full ${apiDotColor}`} aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {apiLabel}
              </span>
            </div>

            <LanguageSwitcher />

            {/* Theme Toggle & GitHub in subtle outline style */}
            <div className="inline-flex items-center gap-0.5 border-l border-[var(--border-default)] pl-1 sm:pl-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                aria-label={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
                title={t('header.switchTheme', { theme: isLight ? t('header.themeDark') : t('header.themeLight') })}
              >
                {isLight ? <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </button>

              <div className="hidden xl:inline-flex items-center gap-0.5">
                <SocialLinks />
              </div>

              <a
                href="https://github.com/larissapavan"
                target="_blank"
                rel="noreferrer"
                title="GitHub"
                aria-label="GitHub"
                className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg transition text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <FolderGit2 className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Navigation: Seamless integrated sub-bar */}
        {!landing && !isAbout && (
          <div className="lg:hidden border-t border-[var(--border-subtle)] px-2 py-1 overflow-x-auto no-scrollbar">
            <nav
              aria-label={L(i18n.language, 'Navegação móvel', 'Mobile navigation', 'Navigation mobile')}
              className="flex items-center gap-1 w-max"
            >
              {navItems.map((item) => {
                const active = isItemActive(item, pathname)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={{
                      color: active ? '#ffffff' : 'var(--text-primary)',
                      backgroundColor: active ? '#C8102E' : undefined,
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/10 ${
                      active ? 'shadow-xs font-bold' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {t(NAV_I18N_KEYS[item.label] ?? item.label, item.label)}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
