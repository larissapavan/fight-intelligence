import { Link, useLocation } from 'react-router-dom'

import { ORG_LIST, switchOrgPath } from '../data/orgs'
import { useOrg } from '../hooks/useOrg'

/** UFC / PFL (and any organization added later): the same section of the other organization when it exists. */
export function OrgSwitcher({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const current = useOrg()
  const { pathname } = useLocation()

  // The wrapper carries the caller's display classes ("hidden xs:block"); the strip inside is always a row.
  return (
    <div className={className}>
      <nav aria-label="Organization" className="inline-flex border-2 border-[var(--rule)] bg-[var(--card-bg)]">
        {ORG_LIST.map((org) => {
          const active = org.id === current.id
          return (
            <Link
              key={org.id}
              to={switchOrgPath(org, pathname)}
              onClick={onNavigate}
              aria-current={active ? 'true' : undefined}
              title={org.name}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
                active ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
              }`}
            >
              {org.shortName}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
