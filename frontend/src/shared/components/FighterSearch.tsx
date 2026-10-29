import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from './FighterAvatar'
import { searchFighters, type SearchableFighter } from '../data/searchFighters'
import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import { useFighters } from '../hooks/useFighters'
import { useOrg } from '../hooks/useOrg'
import { useOrgFighters } from '../hooks/useOrgData'
import { L } from '../../i18n/lang'
import { orgPath } from '../data/orgs'
import { getDivisionName } from '../data/divisions'

function recordOf(fighter: SearchableFighter) {
  if (fighter.wins == null || fighter.losses == null) return null
  return `${fighter.wins}-${fighter.losses}${fighter.draws ? `-${fighter.draws}` : ''}`
}

/** Minimalist SaaS command-style fighter search. */
export function FighterSearch() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const org = useOrg()
  const isUfc = org.id === 'ufc'
  const { fighters: ufcFighters } = useFighters(isUfc)
  const { fighters: orgFighters } = useOrgFighters(isUfc ? null : org.id)
  const fighters: SearchableFighter[] = isUfc ? ufcFighters : orgFighters
  const { imageByName } = useFighterImages()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const setOpen = (value: boolean | ((current: boolean) => boolean)) =>
    setOpenAt((current) => ((typeof value === 'function' ? value(current === pathname) : value) ? pathname : null))
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchFighters(fighters, text), [fighters, text])

  const close = useCallback(() => {
    setOpenAt(null)
    setText('')
    setActive(0)
  }, [])

  // "/" or Cmd+K opens the search box
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (((event.key === '/' && !event.metaKey && !event.ctrlKey) || ((event.metaKey || event.ctrlKey) && event.key === 'k')) && !typing) {
        event.preventDefault()
        setOpenAt(pathname)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open, close])

  const pick = (fighter: SearchableFighter) => {
    close()
    navigate(`${orgPath(org, 'fighters')}?fighter=${encodeURIComponent(fighter.name)}`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault()
      pick(results[active])
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) setText('')
          setOpen(!open)
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 text-xs transition cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
        aria-label={L(i18n.language, 'Buscar lutadores', 'Search fighters', 'Chercher des combattants')}
        aria-expanded={open}
        title={L(i18n.language, 'Buscar lutadores (pressione / ou ⌘K)', 'Search fighters (press / or ⌘K)', 'Chercher des combattants (appuyez sur / ou ⌘K)')}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden xl:inline text-[11px] font-normal text-[var(--text-muted)]">
          {L(i18n.language, 'Buscar...', 'Search...', 'Chercher...')}
        </span>
        <kbd className="hidden md:inline-block rounded px-1 py-0.2 font-mono text-[9px] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="surface-card-elevated absolute right-0 top-full z-50 mt-2 w-[22rem] sm:w-[26rem] p-2 backdrop-blur-xl animate-in fade-in-0 zoom-in-95">
          <div className="soft-input flex items-center gap-2 rounded-lg px-2.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={L(i18n.language, 'Buscar lutador por nome...', 'Find a fighter by name', 'Chercher un combattant par nom...')}
              aria-label={L(i18n.language, 'Buscar lutador por nome', 'Find a fighter by name', 'Chercher un combattant par nom')}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="fighter-search-results"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={close}
              aria-label={L(i18n.language, 'Fechar busca', 'Close search', 'Fermer la recherche')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md transition text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {text.trim() ? (
            results.length > 0 ? (
              <ul id="fighter-search-results" role="listbox" className="mt-2 max-h-72 overflow-y-auto space-y-1">
                {results.map((fighter, index) => (
                  <li key={fighter.name} role="option" aria-selected={index === active}>
                    <button
                      type="button"
                      onClick={() => pick(fighter)}
                      onMouseEnter={() => setActive(index)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition cursor-pointer ${
                        index === active
                          ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-medium shadow-xs'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      <FighterAvatar
                        name={fighter.name}
                        imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)}
                        className="h-9 w-8 rounded-md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{fighter.name}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">
                          {[
                            recordOf(fighter),
                            fighter.division ? getDivisionName(fighter.division, i18n.language) : fighter.division,
                            fighter.nickname ? `“${fighter.nickname}”` : null
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 px-2 py-3 text-center text-xs text-[var(--text-muted)]">
                {L(i18n.language, `Nenhum atleta encontrado para “${text.trim()}”.`, `No fighter matches “${text.trim()}”.`, `Aucun athlète trouvé pour « ${text.trim()} ».`)}
              </p>
            )
          ) : (
            <p className="mt-2 px-2 py-3 text-center text-xs text-[var(--text-muted)]">
              {L(i18n.language, 'Digite o nome do lutador...', 'Start typing a fighter name...', 'Tapez le nom du combattant...')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
