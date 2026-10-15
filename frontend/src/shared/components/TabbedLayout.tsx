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
        <ul className="inline-flex max-w-full overflow-x-auto rounded-full border border-white/8 bg-white/[0.035] p-0.5">
          {tabs.map((tab) => (
            <li key={tab.to} className="shrink-0">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  [
                    'block rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition sm:px-4',
                    isActive
                      ? 'border-[#D32F2F]/45 bg-[#D32F2F]/14 text-[#FFFFFF]'
                      : 'border-transparent text-[#999999] hover:text-white',
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
