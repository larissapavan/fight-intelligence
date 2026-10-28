import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { ORG_LIST, switchOrgPath } from '../data/orgs'
import { useOrg } from '../hooks/useOrg'

/** UFC / PFL / Bellator (and any organization added later): the same section of the other organization when it exists. */
export function OrgSwitcher({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { i18n } = useTranslation()
  const current = useOrg()
  const { pathname } = useLocation()

  // A group, not a <nav>: the header's own rule strips the border and background of every nav inside it.
  // The wrapper carries the caller's display classes ("hidden xs:block"); the strip inside is always a row.
  return (
    <div className={className}>
      <div role="group" aria-label={L(i18n.language, 'Organização', 'Organization', 'Organisation')} className="inline-flex border-2 border-[var(--rule)] bg-[var(--card-bg)]">
        {ORG_LIST.map((org, index) => {
          const active = org.id === current.id
          return (
            <Link
              key={org.id}
              to={switchOrgPath(org, pathname)}
              onClick={onNavigate}
              aria-current={active ? 'true' : undefined}
              title={org.name}
              className={`type-tech px-2 py-1 xs:px-2.5 xs:py-1 text-[10px] xs:text-[11px] font-bold uppercase tracking-[0.1em] xs:tracking-[0.12em] transition ${index > 0 ? 'border-l-2 border-[var(--rule)]' : ''} ${
                active ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
              }`}
            >
              {org.shortName}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
