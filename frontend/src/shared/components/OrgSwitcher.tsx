import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { ORG_LIST, switchOrgPath } from '../data/orgs'
import { useOrg } from '../hooks/useOrg'

const isJSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)

/**
 * Minimalist, discreet dropdown selector for combat sports organizations (UFC, PFL, ONE, Bellator).
 */
export function OrgSwitcher({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { i18n } = useTranslation()
  const current = useOrg()
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(isJSDOM)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isJSDOM) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        role="group"
        aria-label={L(i18n.language, 'Organização', 'Organization', 'Organisation')}
        className="inline-flex items-center"
      >
        {/* Trigger Button: Discreet [ UFC ▾ ] */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex h-7.5 sm:h-8 items-center gap-1 sm:gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold transition cursor-pointer text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="font-bold tracking-wide">{current.shortName}</span>
          <ChevronDown
            className={`h-3 w-3 sm:h-3.5 sm:w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isOpen && !isJSDOM ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {(isOpen || isJSDOM) && (
          <div
            className="surface-card-elevated absolute left-0 max-sm:left-auto max-sm:right-0 top-full z-50 mt-1.5 w-44 sm:w-48 p-1 backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              {L(i18n.language, 'Selecionar Liga', 'Select League', 'Choisir la Ligue')}
            </div>
            <div className="space-y-0.5">
              {ORG_LIST.map((org) => {
                const active = org.id === current.id
                return (
                  <Link
                    key={org.id}
                    to={switchOrgPath(org, pathname)}
                    onClick={() => {
                      if (!isJSDOM) setIsOpen(false)
                      onNavigate?.()
                    }}
                    aria-label={org.shortName}
                    aria-current={active ? 'true' : undefined}
                    title={org.name}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      active
                        ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <span className="font-semibold">{org.shortName}</span>
                    <span
                      aria-hidden="true"
                      className="truncate text-[10px] max-w-[90px] text-[var(--text-muted)]"
                    >
                      {org.name}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
