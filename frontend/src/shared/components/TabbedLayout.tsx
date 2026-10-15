import { NavLink, Outlet } from 'react-router-dom'

export interface SectionTab {
  to: string
  label: string
}

/** Tab bar shared by a group of related pages; every tab keeps its own URL, so deep links still work. */
export function TabbedLayout({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <nav aria-label={label} className="flex">
        <ul className="inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)]">
          {tabs.map((tab) => (
            <li key={tab.to} className="shrink-0">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  [
                    'block px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition sm:px-5',
                    isActive
                      ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                      : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]',
                  ].join(' ')
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}
