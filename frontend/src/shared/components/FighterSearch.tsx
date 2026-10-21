import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { FighterAvatar } from './FighterAvatar'
import { searchFighters } from '../data/searchFighters'
import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import { useFighters } from '../hooks/useFighters'
import type { FighterProfile } from '../types/api'

function recordOf(fighter: FighterProfile) {
  if (fighter.wins == null || fighter.losses == null) return null
  return `${fighter.wins}-${fighter.losses}${fighter.draws ? `-${fighter.draws}` : ''}`
}

/** A search button for the header: type a name, pick a fighter, land on their profile. Works from every page. */
export function FighterSearch() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  // The box belongs to the page it was opened on: moving to another page closes it.
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

  // "/" opens the box from anywhere that is not a text field.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
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

  const pick = (fighter: FighterProfile) => {
    close()
    navigate(`/fighters?fighter=${encodeURIComponent(fighter.name)}`)
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
    <div ref={rootRef} className="contents">
      <button
        type="button"
        onClick={() => {
          if (!open) setText('')
          setOpen(!open)
        }}
        className="ghost-action theme-text inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        aria-label="Search fighters"
        aria-expanded={open}
        title="Search fighters (press /)"
      >
        <Search className="h-4 w-4" />
      </button>

      {open ? (
        <div className="surface-card absolute inset-x-2.5 top-full z-50 mt-2 border-2 border-[var(--rule)] p-2.5 shadow-[4px_4px_0_var(--rule)] sm:left-auto sm:right-3.5 sm:w-[26rem]">
          <div className="flex items-center gap-2 border-2 border-[var(--rule)] bg-[var(--surface-3)] px-2.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Find a fighter by name"
              aria-label="Find a fighter by name"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="fighter-search-results"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="inline-flex h-8 w-8 items-center justify-center text-[var(--text-muted)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {text.trim() ? (
            results.length > 0 ? (
              <ul id="fighter-search-results" role="listbox" className="mt-2 space-y-1">
                {results.map((fighter, index) => (
                  <li key={fighter.name} role="option" aria-selected={index === active}>
                    <button
                      type="button"
                      onClick={() => pick(fighter)}
                      onMouseEnter={() => setActive(index)}
                      className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition ${index === active ? 'bg-[#F2C230]/30' : ''}`}
                    >
                      <FighterAvatar
                        name={fighter.name}
                        imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)}
                        className="h-9 w-8"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[var(--text-main)]">{fighter.name}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">
                          {[recordOf(fighter), fighter.division, fighter.nickname ? `“${fighter.nickname}”` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">No fighter matches “{text.trim()}”.</p>
            )
          ) : (
            <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">Type a name or nickname. Enter opens the profile.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
