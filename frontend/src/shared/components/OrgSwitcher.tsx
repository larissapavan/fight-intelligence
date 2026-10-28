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
  return (
    <div className={className}>
      <div
        role="group"
        aria-label={L(i18n.language, 'Organização', 'Organization', 'Organisation')}
        className="inline-flex h-8 items-center border border-[var(--line-soft)] bg-[var(--surface-3)] p-0.5"
      >
        {ORG_LIST.map((org) => {
          const active = org.id === current.id
          return (
            <Link
              key={org.id}
              to={switchOrgPath(org, pathname)}
              onClick={onNavigate}
              aria-current={active ? 'true' : undefined}
              title={org.name}
              className={`type-tech inline-flex h-full items-center px-2 xs:px-2.5 text-[10px] xs:text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                active
                  ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--action-hover-bg)] hover:text-[var(--text-main)]'
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
