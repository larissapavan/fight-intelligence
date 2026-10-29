import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export interface SectionTab {
  to: string
  label: string
  labelKey?: string
}

const MATCHUP_PATHS = new Set(['/predictor', '/head-to-head', '/matchup-intelligence'])

/** Tab bar shared by a group of related pages; every tab keeps its own URL, so deep links still work. */
export function TabbedLayout({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const { t } = useTranslation()
  const { search } = useLocation()

  const getTabHref = (to: string) => {
    if (!search || !MATCHUP_PATHS.has(to)) return to
    const currentParams = new URLSearchParams(search)
    const carried = new URLSearchParams()
    const a = currentParams.get('a') || currentParams.get('fighter_a')
    const b = currentParams.get('b') || currentParams.get('fighter_b')
    const event = currentParams.get('event')
    if (a) carried.set('a', a)
    if (b) carried.set('b', b)
    if (event) carried.set('event', event)
    const qs = carried.toString()
    return qs ? `${to}?${qs}` : to
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <nav aria-label={label} className="flex">
        <ul className="inline-flex max-w-full overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-xs gap-1">
          {tabs.map((tab) => (
            <li key={tab.to} className="shrink-0">
              <NavLink
                to={getTabHref(tab.to)}
                className={({ isActive }) =>
                  [
                    'block rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition sm:px-5',
                    isActive
                      ? 'bg-[var(--accent-red)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]',
                  ].join(' ')
                }
              >
                {tab.labelKey ? t(tab.labelKey) : tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}
