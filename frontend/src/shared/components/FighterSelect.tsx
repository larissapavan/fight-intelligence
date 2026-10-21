import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Clock3, Lock, Search, Swords, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { FighterAvatar } from './FighterAvatar'
import { getFighterImageUrl, normalizeFighterName, useFighterImages } from '../hooks/useFighterImages'
import type { FighterProfile, Opponent } from '../types/api'

interface FighterSelectProps {
  label: string
  corner: 'red' | 'blue'
  value: string
  fighters: FighterProfile[]
  disabledFighterName?: string
  placeholder: string
  /** Fighters who have already faced `label`'s fighter: listed first so the matchup can be picked straight away. */
  suggestions?: { label: string; opponents: Opponent[] }
  onChange: (value: string) => void
}

const RECENT_FIGHTERS_KEY = 'ufc-predictor:recent-fighters:v2'
const RESULT_LIMIT = 48

const cornerStyles = {
  red: {
    accent: 'text-[var(--accent-red)]',
    border: 'border-[#C8102E]/24',
    bar: 'bg-[#C8102E]',
  },
  blue: {
    accent: 'text-[var(--accent-blue)]',
    border: 'border-[#2F5FA8]/24',
    bar: 'bg-[#2F5FA8]',
  },
}

export function FighterSelect({
  label,
  corner,
  value,
  fighters,
  disabledFighterName,
  placeholder,
  suggestions,
  onChange,
}: FighterSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [onlyOpponents, setOnlyOpponents] = useState(true)
  const [recentNames, setRecentNames] = useState<string[]>(() => readRecentFighters())
  const searchRef = useRef<HTMLInputElement>(null)
  const componentId = useMemo(() => label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), [label])
  const styles = cornerStyles[corner]
  const { imageByName } = useFighterImages()

  const selectedFighter = useMemo(() => fighters.find((fighter) => fighter.name === value) ?? null, [fighters, value])
  const normalizedQuery = normalizeFighterName(query)
  const showRecent = !normalizedQuery

  const recentFighters = useMemo(() => {
    const fighterMap = new Map(fighters.map((fighter) => [fighter.name, fighter]))
    return recentNames.map((name) => fighterMap.get(name)).filter(Boolean) as FighterProfile[]
  }, [fighters, recentNames])

  // Opponents of the other corner's fighter, in the order of their meetings (most recent first).
  const opponentFighters = useMemo(() => {
    if (!suggestions) return []
    const byName = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return suggestions.opponents
      .map((opponent) => byName.get(normalizeFighterName(opponent.name)))
      .filter((fighter): fighter is FighterProfile => Boolean(fighter))
  }, [fighters, suggestions])
  const opponentView = opponentFighters.length > 0 && onlyOpponents

  const results = useMemo(() => {
    if (opponentView && !normalizedQuery) return opponentFighters
    const source = opponentView ? opponentFighters : showRecent && recentFighters.length ? recentFighters : fighters
    return source
      .filter((fighter) => {
        if (!normalizedQuery) return true
        const haystack = [
          fighter.name,
          fighter.nickname,
          fighter.division,
          fighter.stance,
          formatRecord(fighter),
          getRankingLabel(fighter),
          fighter.rank_signal,
        ]
          .filter(Boolean)
          .map((part) => normalizeFighterName(String(part)))

        return haystack.some((part) => part.includes(normalizedQuery))
      })
      .sort((first, second) => {
        const firstDisabled = isFighterDisabled(first, disabledFighterName) ? 100 : 0
        const secondDisabled = isFighterDisabled(second, disabledFighterName) ? 100 : 0
        return firstDisabled + scoreMatch(first, normalizedQuery) - (secondDisabled + scoreMatch(second, normalizedQuery))
      })
      .slice(0, RESULT_LIMIT)
  }, [disabledFighterName, fighters, normalizedQuery, opponentFighters, opponentView, recentFighters, showRecent])

  const openSearch = () => {
    setOnlyOpponents(true)
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    window.setTimeout(() => searchRef.current?.focus(), 60)
  }, [open])

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  const selectFighter = (fighter: FighterProfile) => {
    if (isFighterDisabled(fighter, disabledFighterName)) return
    onChange(fighter.name)
    setOpen(false)
    setRecentNames((current) => {
      const next = [fighter.name, ...current.filter((name) => name !== fighter.name)].slice(0, 8)
      writeRecentFighters(next)
      return next
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const exactMatch = results.find((fighter) => normalizeFighterName(fighter.name) === normalizedQuery)
      const fighter = exactMatch ?? results[activeIndex]
      if (fighter) selectFighter(fighter)
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative z-30 flex flex-col gap-1.5">
      <span className={`broadcast-label text-[11px] ${styles.accent}`}>{label}</span>
      <button
        type="button"
        onClick={openSearch}
        aria-label={selectedFighter ? `${label}: ${selectedFighter.name}. Change fighter` : `${label}: search fighter`}
        className="flex min-h-[60px] w-full items-center gap-3 border-[3px] border-[var(--rule)] bg-[var(--card-bg)] px-3 py-2 text-left text-[var(--text-main)] shadow-[4px_4px_0_var(--hard)] outline-none transition hover:border-[var(--accent-red)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-red)]"
      >
        {selectedFighter ? (
          <FighterAvatar
            name={selectedFighter.name}
            imageUrl={getFighterImageUrl(selectedFighter.name, imageByName, selectedFighter.image_url)}
            className="h-10 w-9"
          />
        ) : (
          <Search className={`h-5 w-5 shrink-0 ${styles.accent}`} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide sm:text-base">
          {selectedFighter?.name ?? placeholder}
        </span>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-[var(--accent-red)]">{selectedFighter ? 'Change' : 'Search'}</span>
      </button>

      {createPortal(
        <AnimatePresence>
        {open ? (
          <motion.div
            className="selector-backdrop fixed inset-0 z-[90] flex items-center justify-center overflow-hidden px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <motion.section
              className={`surface-card flex h-[min(720px,calc(100vh-1.5rem))] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] border-white/14 sm:h-[min(760px,calc(100vh-2.5rem))] sm:rounded-[24px] ${corner === 'blue' ? 'picker-blue' : ''}`}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className={`h-1 w-full ${styles.bar}`} />
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className={`broadcast-label text-[11px] ${styles.accent}`}>{label}</p>
                  <h2 className="theme-text mt-1 text-[clamp(1.35rem,5vw,2rem)] font-bold uppercase leading-tight tracking-[0.03em]">
                    {placeholder}
                  </h2>
                  <p className="theme-muted mt-1 hidden text-sm leading-6 sm:block">
                    Search by name, nickname, weight class, record, or ranking. A fighter selected in the opposite corner is locked.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ghost-action theme-text grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  aria-label="Close fighter search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="shrink-0 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
                <div className={`${corner === 'blue' ? 'soft-input-blue' : 'soft-input'} flex items-center gap-3 rounded-2xl px-4 py-3`}>
                  <Search className={`h-4 w-4 shrink-0 ${styles.accent}`} />
                  <input
                    ref={searchRef}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={`${componentId}-fighter-results`}
                    aria-activedescendant={results[activeIndex] ? `${componentId}-option-${activeIndex}` : undefined}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setActiveIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search fighter, nickname, or weight class"
                    className="theme-text min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div className="theme-muted flex min-w-0 items-center gap-2">
                  {opponentView ? (
                    <Swords className="h-3.5 w-3.5 shrink-0" />
                  ) : showRecent && recentFighters.length ? (
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Search className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="broadcast-label truncate text-[11px]">
                    {opponentView
                      ? `${results.length} ${results.length === 1 ? 'opponent' : 'opponents'} of ${suggestions?.label}`
                      : showRecent && recentFighters.length
                        ? 'Recent fighters'
                        : `${results.length} results`}
                  </span>
                </div>
                {opponentFighters.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyOpponents((value) => !value)
                      setActiveIndex(0)
                    }}
                    className="type-tech ghost-action theme-text shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] hover:!bg-[#F2C230] hover:!text-[#0E0E0E]"
                  >
                    {onlyOpponents ? 'Show all fighters' : 'Only opponents'}
                  </button>
                ) : null}
                {selectedFighter ? (
                  <span className={`type-tech rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${styles.border} ${corner === 'blue' ? 'bg-[#2F5FA8]/10' : 'bg-[#C8102E]/10'} ${styles.accent}`}>
                    Selected: {selectedFighter.name}
                  </span>
                ) : null}
              </div>

              <div
                id={`${componentId}-fighter-results`}
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5"
              >
                {results.length ? (
                  <div className="grid gap-2">
                    {results.map((fighter, index) => {
                      const isSelected = fighter.name === value
                      const isDisabled = isFighterDisabled(fighter, disabledFighterName)
                      const isActive = index === activeIndex
                      const ranking = getRankingLabel(fighter)

                      return (
                        <button
                          id={`${componentId}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={isDisabled}
                          key={fighter.name}
                          type="button"
                          disabled={isDisabled}
                          onPointerEnter={() => setActiveIndex(index)}
                          onClick={() => selectFighter(fighter)}
                          className={`selector-option group grid w-full grid-cols-[56px_1fr] gap-3 rounded-2xl border px-3 py-3 text-left transition duration-150 sm:grid-cols-[64px_1fr_auto] ${
                            isActive ? 'selector-option-active' : ''
                          } ${isSelected ? (corner === 'blue' ? 'ring-1 ring-[#2F5FA8]/45' : 'ring-1 ring-[#C8102E]/45') : ''} ${isDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                        >
                          <PickerAvatar
                            fighter={fighter}
                            corner={corner}
                            imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)}
                            large
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="type-display theme-text truncate text-xl font-bold uppercase leading-none tracking-[0.03em]">
                                {fighter.name}
                              </span>
                              {isSelected ? (
                                <span className={`type-tech rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${styles.border} ${corner === 'blue' ? 'bg-[#2F5FA8]/10' : 'bg-[#C8102E]/10'} ${styles.accent}`}>
                                  Selected
                                </span>
                              ) : null}
                            </span>
                            <span className="theme-soft-text mt-1 block text-sm leading-5">
                              {[fighter.nickname ? `"${fighter.nickname}"` : null, getDivision(fighter)].filter(Boolean).join(' • ')}
                            </span>
                            <span className="theme-muted mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="selector-chip">Record: {formatRecord(fighter)}</span>
                              <span className="selector-chip">{fighter.stance || 'Style unavailable'}</span>
                              {ranking ? (
                                <span className={`rounded-full border px-2.5 py-1 ${styles.border} ${corner === 'blue' ? 'bg-[#2F5FA8]/10' : 'bg-[#C8102E]/10'} ${styles.accent}`}>
                                  {ranking}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="hidden items-center justify-end sm:flex">
                            {isDisabled ? (
                              <span className="type-tech theme-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                                <Lock className="h-3 w-3" />
                                Other corner
                              </span>
                            ) : isSelected ? (
                              <Check className={`h-5 w-5 ${styles.accent}`} />
                            ) : (
                              <ChevronDown className="theme-muted h-4 w-4 -rotate-90 transition group-hover:text-[var(--text-main)]" />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-10 text-center">
                    <p className="type-display theme-text text-2xl font-bold uppercase tracking-[0.03em]">No fighters found</p>
                    <p className="theme-muted mx-auto mt-2 max-w-md text-sm leading-6">
                      Adjust the search to find another name, nickname, weight class, or record.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function PickerAvatar({
  fighter,
  corner,
  imageUrl,
  large = false,
}: {
  fighter?: FighterProfile | null
  corner: 'red' | 'blue'
  imageUrl?: string | null
  large?: boolean
}) {
  const imageKey = `${fighter?.name ?? ''}:${imageUrl ?? ''}`
  const [imageState, setImageState] = useState({ key: '', failed: false, loaded: false })
  const failed = imageState.key === imageKey && imageState.failed
  const loaded = imageState.key === imageKey && imageState.loaded
  const imgUrl = fighter && !failed ? imageUrl : null
  const sizeClass = large ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-10 w-10'
  const toneClass = corner === 'red' ? 'from-[#C8102E]/30' : 'from-[#2F5FA8]/30'

  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-gradient-to-br ${toneClass} to-[var(--avatar-bg)] ${sizeClass}`}>
      {imgUrl && !failed ? (
        <img
          src={imgUrl}
          alt={fighter?.name ?? 'Fighter avatar'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageState({ key: imageKey, failed: false, loaded: true })}
          onError={() => setImageState({ key: imageKey, failed: true, loaded: false })}
          className={`absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
      {fighter && (!imgUrl || !loaded || failed) ? (
        <span className={`type-display text-lg font-bold uppercase ${corner === 'red' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-blue)]'}`}>
          {getInitials(fighter.name)}
        </span>
      ) : null}
      {!fighter ? (
        <UserRound className={`${large ? 'h-6 w-6' : 'h-5 w-5'} text-[#999999]`} />
      ) : null}
    </span>
  )
}

function isFighterDisabled(fighter: FighterProfile, disabledFighterName?: string) {
  return Boolean(disabledFighterName && fighter.name === disabledFighterName)
}

function getDivision(fighter: FighterProfile) {
  return fighter.division ?? formatWeight(fighter.weight_lbs)
}

function getRankingLabel(fighter: FighterProfile) {
  if (fighter.ranking) return fighter.ranking.startsWith('#') ? fighter.ranking : `#${fighter.ranking}`
  if (fighter.rank_signal) return fighter.rank_signal
  if (fighter.belt) return 'Champion'
  return null
}

function scoreMatch(fighter: FighterProfile, query: string) {
  if (!query) return fighter.name.length

  const name = normalizeFighterName(fighter.name)
  const nickname = normalizeFighterName(fighter.nickname ?? '')
  const division = normalizeFighterName(getDivision(fighter))

  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (nickname === query) return 2
  if (nickname.startsWith(query)) return 3
  if (name.includes(query)) return 4
  if (nickname.includes(query)) return 5
  if (division.includes(query)) return 6
  return 7
}

function formatRecord(fighter: FighterProfile) {
  return `${fighter.wins ?? 0}-${fighter.losses ?? 0}${fighter.draws ? `-${fighter.draws}` : ''}`
}

function formatWeight(weight: number | null | undefined) {
  return weight ? `${weight.toFixed(0)} lb` : 'Weight class pending'
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

function readRecentFighters() {
  try {
    const raw = window.localStorage.getItem(RECENT_FIGHTERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : []
  } catch {
    return []
  }
}

function writeRecentFighters(names: string[]) {
  try {
    window.localStorage.setItem(RECENT_FIGHTERS_KEY, JSON.stringify(names))
  } catch {
    // Recent suggestions are progressive enhancement only.
  }
}
