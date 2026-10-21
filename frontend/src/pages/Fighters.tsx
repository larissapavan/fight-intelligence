import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  Bell,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Flame,
  Footprints,
  HandFist,
  Hammer,
  Medal,
  Radio,
  Ruler,
  Search,
  Shield,
  SlidersHorizontal,
  Swords,
  Target,
  Timer,
  Weight,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChampionBelt } from '../shared/components/ChampionBelt'
import { FighterOrigin } from '../shared/components/FighterOrigin'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { BADGES } from '../shared/data/badges'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { MiniStat } from '../shared/components/MiniStat'
import { SectionHeading } from '../shared/components/SectionHeading'
import { formatPercent } from '../shared/data/fightLabels'
import { isKnownActive, isKnownRetired } from '../shared/data/fighterStatusOverrides'
import { useFighters } from '../shared/hooks/useFighters'
import { getFighterImageUrl, useFighterImages, type FighterImageRecord } from '../shared/hooks/useFighterImages'
import type { FighterProfile } from '../shared/types/api'

type UfcStatus = 'active' | 'former' | 'never'
type ActiveFilter = 'all' | Exclude<UfcStatus, 'never'>

type DivisionGroup = {
  key: string
  label: string
  shortLabel: string
  limit: string
  icon: LucideIcon
  tone: 'red' | 'blue' | 'gold'
  match: (fighter: FighterProfile) => boolean
}

// The UFC runs three women's divisions today. The discontinued Women's Featherweight (a handful of former fighters)
// has no tab of its own: those fighters are listed under Open Class.
const divisionGroups: DivisionGroup[] = [
  { key: 'flyweight', label: 'Flyweight', shortLabel: 'FLW', limit: '125 lb', icon: Zap, tone: 'blue', match: byDivision('flyweight') },
  { key: 'bantamweight', label: 'Bantamweight', shortLabel: 'BW', limit: '135 lb', icon: Footprints, tone: 'red', match: byDivision('bantamweight') },
  { key: 'featherweight', label: 'Featherweight', shortLabel: 'FW', limit: '145 lb', icon: Target, tone: 'gold', match: byDivision('featherweight') },
  { key: 'lightweight', label: 'Lightweight', shortLabel: 'LW', limit: '155 lb', icon: Flame, tone: 'red', match: byDivision('lightweight') },
  { key: 'welterweight', label: 'Welterweight', shortLabel: 'WW', limit: '170 lb', icon: Shield, tone: 'blue', match: byDivision('welterweight') },
  { key: 'middleweight', label: 'Middleweight', shortLabel: 'MW', limit: '185 lb', icon: Swords, tone: 'gold', match: byDivision('middleweight') },
  { key: 'light-heavyweight', label: 'Light Heavyweight', shortLabel: 'LHW', limit: '205 lb', icon: HandFist, tone: 'red', match: byDivision('light heavyweight') },
  { key: 'heavyweight', label: 'Heavyweight', shortLabel: 'HW', limit: '265 lb', icon: Hammer, tone: 'blue', match: byDivision('heavyweight') },
  {
    key: 'w-strawweight',
    label: "Women's Strawweight",
    shortLabel: 'WSW',
    limit: '115 lb',
    icon: Timer,
    tone: 'gold',
    match: byDivision("women's strawweight"),
  },
  {
    key: 'w-flyweight',
    label: "Women's Flyweight",
    shortLabel: 'WFLW',
    limit: '125 lb',
    icon: Bell,
    tone: 'blue',
    match: byDivision("women's flyweight"),
  },
  {
    key: 'w-bantamweight',
    label: "Women's Bantamweight",
    shortLabel: 'WBW',
    limit: '135 lb',
    icon: Medal,
    tone: 'red',
    match: byDivision("women's bantamweight"),
  },
  {
    key: 'open-class',
    label: 'Open Class / Unclassified',
    shortLabel: 'OPEN',
    limit: 'Mixed',
    icon: Dumbbell,
    tone: 'blue',
    match: (fighter) => !divisionGroups.slice(0, -1).some((group) => group.match(fighter)),
  },
]

const toneStyles = {
  red: {
    text: 'text-[var(--accent-red)]',
    border: 'border-[#C8102E]/24',
    bg: 'bg-[#C8102E]/10',
    bar: 'bg-[#C8102E]',
    glow: '',
  },
  blue: {
    text: 'text-[var(--accent-blue)]',
    border: 'border-[#2F5FA8]/24',
    bg: 'bg-[#2F5FA8]/10',
    bar: 'bg-[#2F5FA8]',
    glow: '',
  },
  gold: {
    text: 'text-[var(--text-main)]',
    border: 'border-[var(--rule)]',
    bg: 'bg-[var(--surface-3)]',
    bar: 'bg-[var(--rule)]',
    glow: '',
  },
}

/** Cards rendered per page in a division; the biggest divisions hold several hundred fighters. A phone gets fewer: each card is tall. */
const PAGE_SIZE = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 12 : 24

export function Fighters() {
  const { fighters, loading, error } = useFighters()
  const { imageByName } = useFighterImages()
  const [query, setQuery] = useState('')
  const [stanceFilter, setStanceFilter] = useState('All stances')
  const [badgeFilter, setBadgeFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeDivision, setActiveDivision] = useState('lightweight')
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep link from other pages (e.g. Champions): /fighters?fighter=<name> opens that profile.
  const [selectedFighter, setSelectedFighter] = useState<string | null>(() => searchParams.get('fighter'))

  const statusOf = useCallback((fighter: FighterProfile): UfcStatus => {
    if (isKnownActive(fighter.name)) return 'active'
    const status = fighter.ufc_status ?? 'never'
    // A fighter on the manual retirement list did fight in the UFC, so they are former, not unknown.
    return isKnownRetired(fighter.name) ? 'former' : status
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<UfcStatus, number> = { active: 0, former: 0, never: 0 }
    for (const fighter of fighters) counts[statusOf(fighter)] += 1
    return counts
  }, [fighters, statusOf])

  const stances = useMemo(
    () => ['All stances', ...Array.from(new Set(fighters.map((fighter) => fighter.stance).filter(Boolean))).sort()],
    [fighters],
  )

  const visibleFighters = useMemo(() => {
    const term = query.trim().toLowerCase()
    return fighters.filter((fighter) => {
      const matchesName =
        !term ||
        fighter.name.toLowerCase().includes(term) ||
        (fighter.nickname?.toLowerCase().includes(term) ?? false)
      const matchesStance = stanceFilter === 'All stances' || fighter.stance === stanceFilter
      const matchesBadge = !badgeFilter || (fighter.badges ?? []).includes(badgeFilter)
      const matchesStatus = activeFilter === 'all' || statusOf(fighter) === activeFilter
      return matchesName && matchesStance && matchesBadge && matchesStatus
    })
  }, [fighters, query, stanceFilter, badgeFilter, activeFilter, statusOf])

  const groupedFighters = useMemo(() => {
    const groups = new Map<string, FighterProfile[]>()
    for (const group of divisionGroups) {
      groups.set(
        group.key,
        visibleFighters
          .filter((fighter) => group.match(fighter))
          .sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0) || a.name.localeCompare(b.name)),
      )
    }
    return groups
  }, [visibleFighters])

  const hasAnyResults = visibleFighters.length > 0
  const isSearching = query.trim() !== '' || stanceFilter !== 'All stances' || badgeFilter !== ''
  // Searching must show what it found: when the chosen division has no match, open the first one that does.
  const shownDivision =
    isSearching && (groupedFighters.get(activeDivision)?.length ?? 0) === 0
      ? (divisionGroups.find((group) => (groupedFighters.get(group.key)?.length ?? 0) > 0)?.key ?? activeDivision)
      : activeDivision
  const featuredGroup = divisionGroups.find((group) => group.key === shownDivision) ?? divisionGroups[0]
  const featuredFighters = groupedFighters.get(featuredGroup.key) ?? []

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 xs:px-4 xs:py-3.5 md:px-5 md:py-5 lg:px-6 lg:py-6">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading level={1}
            eyebrow="Fighters"
            title="Weight classes"
            description="Browse fighters by weight class and open a profile for their record, career timeline and stats."
          />

          <div className="grid grid-cols-2 gap-2">
            <SummaryTile label="Fighters" value={visibleFighters.length.toLocaleString('en-US')} />
            <SummaryTile label="Divisions" value={`${divisionGroups.length}`} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-[1fr_220px_240px]">
          <div className="flex gap-2">
            <div className="soft-input flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-[#C8102E]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search fighter or nickname"
                aria-label="Search fighter or nickname"
                className="theme-text w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] md:min-w-[300px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
              aria-controls="fighter-extra-filters"
              className="ghost-action theme-text inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.1em] md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {stanceFilter !== 'All stances' || badgeFilter !== '' ? (
                <span className="grid h-5 min-w-5 place-items-center bg-[var(--accent-red)] px-1 text-[11px] text-white">
                  {(stanceFilter !== 'All stances' ? 1 : 0) + (badgeFilter !== '' ? 1 : 0)}
                </span>
              ) : null}
            </button>
          </div>
          <div id="fighter-extra-filters" className={`${filtersOpen ? 'grid' : 'hidden'} gap-2.5 md:contents`}>
          <select
            value={stanceFilter}
            onChange={(event) => setStanceFilter(event.target.value)}
            aria-label="Filter by stance"
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            {stances.map((stance) => (
              <option key={stance} value={stance}>
                {stance}
              </option>
            ))}
          </select>
          <select
            value={badgeFilter}
            onChange={(event) => setBadgeFilter(event.target.value)}
            aria-label="Filter by badge or origin"
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="">All badges and origins</option>
            {Object.entries(BADGES).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/8 pt-2.5">
          <div role="group" aria-label="Fighter status" className="inline-flex max-w-full overflow-x-auto rounded-md border border-white/8 bg-white/[0.035] p-0.5 chip-scroll">
            <ActiveTabButton active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} count={fighters.length}>
              All
            </ActiveTabButton>
            <ActiveTabButton active={activeFilter === 'active'} onClick={() => setActiveFilter('active')} count={statusCounts.active}>
              <Radio className="h-3 w-3" /> Active
            </ActiveTabButton>
            <ActiveTabButton active={activeFilter === 'former'} onClick={() => setActiveFilter('former')} count={statusCounts.former}>
              Former UFC
            </ActiveTabButton>
          </div>
          <p className="broadcast-label text-[11px] text-[#999999]">
            <span className="tabular-nums text-[#FFFFFF]">{visibleFighters.length}</span> shown
          </p>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[210px]" />
          ))}
        </section>
      ) : hasAnyResults ? (
        <div className="space-y-3">
          <WeightClassBar
            groups={divisionGroups}
            counts={groupedFighters}
            activeKey={shownDivision}
            onSelect={setActiveDivision}
          />

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <DivisionPanel
                key={featuredGroup.key}
                group={featuredGroup}
                fighters={featuredFighters}
                imageByName={imageByName}
                onSelectFighter={setSelectedFighter}
              />
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">No fighters found</p>
          <p className="mt-2 text-sm text-[#999999]">Adjust the search or filter to explore another fighter profile in the database.</p>
        </div>
      )}

      {selectedFighter ? (
        <FighterProfileModal
          key={selectedFighter}
          name={selectedFighter}
          onClose={() => {
            setSelectedFighter(null)
            if (searchParams.has('fighter')) setSearchParams({}, { replace: true })
          }}
          onSelectFighter={setSelectedFighter}
        />
      ) : null}
    </div>
  )
}

function ActiveTabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? 'bg-[var(--rule)] text-[var(--card-bg)]'
          : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
      }`}
    >
      {children}
      <CountPill active={active}>{count}</CountPill>
    </button>
  )
}

function CountPill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex min-w-[1.6em] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums tracking-normal ${
        active ? 'bg-[var(--tape)] text-[#0E0E0E]' : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
      }`}
    >
      {children}
    </span>
  )
}

/** Single-line weight class chips: men | women | other, horizontal scroll with edge fades that appear only when there is more to see. */
function WeightClassBar({
  groups,
  counts,
  activeKey,
  onSelect,
}: {
  groups: DivisionGroup[]
  counts: Map<string, FighterProfile[]>
  activeKey: string
  onSelect: (key: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    updateEdges()
    window.addEventListener('resize', updateEdges)
    return () => window.removeEventListener('resize', updateEdges)
  }, [updateEdges])

  // Keep the selected chip in view (e.g. after the list re-renders on narrow screens).
  useEffect(() => {
    const chip = scrollRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeKey])

  const scrollByStep = (direction: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: direction * 250, behavior: 'smooth' })

  const fade = 44
  const mask = `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 ${fade}px, #000 calc(100% - ${fade}px), ${edges.right ? 'transparent' : '#000'} 100%)`
  const sectionOf = (key: string) => (key === 'open-class' ? 2 : key.startsWith('w-') ? 1 : 0)

  return (
    <nav aria-label="Weight class filter" className="relative rounded-xl border border-white/8 bg-black/20 py-1.5">
      <ScrollArrow direction="left" visible={edges.left} onClick={() => scrollByStep(-1)} />
      <ScrollArrow direction="right" visible={edges.right} onClick={() => scrollByStep(1)} />
      <div
        ref={scrollRef}
        onScroll={updateEdges}
        className="chip-scroll flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-1.5"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {groups.map((group, index) => (
          <div key={group.key} className="flex shrink-0 items-center gap-1.5">
            {index > 0 && sectionOf(group.key) !== sectionOf(groups[index - 1].key) ? (
              <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-white/14" />
            ) : null}
            <DivisionPill
              group={group}
              count={counts.get(group.key)?.length ?? 0}
              isActive={activeKey === group.key}
              onClick={() => onSelect(group.key)}
            />
          </div>
        ))}
      </div>
    </nav>
  )
}

function ScrollArrow({ direction, visible, onClick }: { direction: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={direction === 'left' ? 'Scroll weight classes left' : 'Scroll weight classes right'}
      className={`absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-neutral-900/80 text-[#CCCCCC] backdrop-blur-sm transition hover:text-[#FF1E27] focus-visible:text-[#FF1E27] focus-visible:outline-none ${
        direction === 'left' ? 'left-1' : 'right-1'
      } ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function DivisionPanel({
  group,
  fighters,
  imageByName,
  onSelectFighter,
}: {
  group: DivisionGroup
  fighters: FighterProfile[]
  imageByName: Map<string, FighterImageRecord>
  onSelectFighter: (name: string) => void
}) {
  // Show a page at a time; the list starts over whenever the filters hand it a different set of fighters.
  const [paging, setPaging] = useState({ source: fighters, limit: PAGE_SIZE })
  if (paging.source !== fighters) setPaging({ source: fighters, limit: PAGE_SIZE })
  const limit = paging.source === fighters ? paging.limit : PAGE_SIZE
  const shown = fighters.slice(0, limit)
  const remaining = fighters.length - shown.length

  return (
    <motion.section
      className="surface-card overflow-hidden rounded-[20px]"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="flex w-full flex-col gap-3 px-3 py-3 text-left xs:px-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[var(--rule)] bg-[var(--card-bg)] text-[var(--text-main)]">
            <group.icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="broadcast-label text-[11px] text-[#999999]">Active division</p>
            <h2 className="mt-0.5 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF] sm:text-2xl">
              {group.label}
            </h2>
            <p className="mt-1 text-xs text-[#999999]">
              {fighters.length} athletes • {group.limit} limit
            </p>
          </div>
        </div>
        <span className="type-tech w-fit border-2 border-[var(--rule)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-main)]">
          {group.shortLabel}
        </span>
      </div>

      <div className="border-t border-white/8 px-3 py-3 xs:px-4 md:px-5">
        {fighters.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((fighter, index) => (
              <FighterDivisionCard
                key={fighter.name}
                fighter={fighter}
                group={group}
                index={index}
                imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)}
                onSelect={() => onSelectFighter(fighter.name)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-7 text-center">
            <p className="type-display text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
              No athletes in this division
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#999999]">
              The current search or stance filter has no matching fighters in {group.label}.
            </p>
          </div>
        )}
        {remaining > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPaging({ source: fighters, limit: limit + PAGE_SIZE })}
              className="primary-action inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
            </button>
            <button
              type="button"
              onClick={() => setPaging({ source: fighters, limit: fighters.length })}
              className="ghost-action theme-text inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em]"
            >
              Show all {fighters.length.toLocaleString('en-US')}
            </button>
          </div>
        ) : null}
        {fighters.length > PAGE_SIZE ? (
          <p className="mt-2 text-center text-[11px] text-[#999999]" aria-live="polite">
            Showing {shown.length.toLocaleString('en-US')} of {fighters.length.toLocaleString('en-US')}
          </p>
        ) : null}
      </div>
    </motion.section>
  )
}

function DivisionPill({
  group,
  count,
  isActive,
  onClick,
}: {
  group: DivisionGroup
  count: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition duration-200 md:px-3 md:text-xs',
        isActive
          ? 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)]'
          : 'border-[var(--rule)] bg-[var(--card-bg)] text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]',
      ].join(' ')}
    >
      <group.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{group.label}</span>
      <span className="sm:hidden">{group.shortLabel}</span>
      <CountPill active={isActive}>{count}</CountPill>
    </button>
  )
}

function FighterDivisionCard({
  fighter,
  group,
  index,
  imageUrl,
  onSelect,
}: {
  fighter: FighterProfile
  group: DivisionGroup
  index: number
  imageUrl?: string | null
  onSelect: () => void
}) {
  const styles = toneStyles[group.tone]

  return (
    <motion.article
      className="surface-card group flex h-full flex-col overflow-hidden rounded-[18px] transition duration-300 hover:-translate-y-0.5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.012, 0.18) }}
    >
      <div className={`h-1 w-full ${styles.bar}`} />
      <div className="flex flex-1 flex-col p-3">
        {/* On a phone the card is centred and stacked, so a long name such as "Khabib Nurmagomedov" wraps inside it. */}
        <div className="grid grid-cols-1 content-start justify-items-center gap-3 text-center sm:min-h-[176px] sm:grid-cols-[70px_1fr] sm:justify-items-stretch sm:text-left">
          <FighterPortrait fighter={fighter} imageUrl={imageUrl ?? undefined} tone={group.tone} />
          <div className="min-w-0 max-sm:w-full">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 max-sm:w-full">
                <p className={`broadcast-label text-[11px] ${styles.text}`}>{fighter.division ?? group.shortLabel}</p>
                <h3 className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xl font-bold uppercase leading-none tracking-[0.03em] text-[#FFFFFF] sm:justify-start">
                  <FlagList fighter={fighter} />
                  <span className="min-w-0 break-words">{fighter.name}</span>
                  {fighter.belt ? <ChampionBelt /> : null}
                </h3>
              </div>
            </div>

            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#999999]">
              {formatRecord(fighter)}
              {fighter.nickname ? ` • "${fighter.nickname}"` : ''}
            </p>
            <FighterOrigin fighter={fighter} className="mt-1.5 max-sm:[&>li]:justify-center" />
            <FighterBadges badges={fighter.badges} className="mt-1.5 max-sm:justify-center" />
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <MiniStat icon={Shield} label="Win rate" value={formatPercent(fighter.win_rate)} />
          <MiniStat icon={Weight} label="Weight" value={fighter.weight_lbs ? `${fighter.weight_lbs.toFixed(0)} lb` : '—'} />
          <MiniStat icon={Ruler} label="Reach" value={fighter.reach_cm ? `${fighter.reach_cm.toFixed(0)} cm` : '—'} />
          <MiniStat icon={Swords} label="Style" value={fighter.stance || 'Unknown'} />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="primary-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            <Award className="h-3.5 w-3.5" />
            Performance
          </button>
          {fighter.fighter_url ? (
            <a
              href={fighter.fighter_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label={`${fighter.name} on UFCStats (opens in a new tab)`}
              title="Open on UFCStats"
              className="ghost-action inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8102E]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}

function FighterPortrait({
  fighter,
  imageUrl,
  tone,
}: {
  fighter: FighterProfile
  imageUrl?: string
  tone: DivisionGroup['tone']
}) {
  const imageKey = `${fighter.name}:${imageUrl ?? ''}`
  const [imageState, setImageState] = useState({ key: '', failed: false, loaded: false })
  const imageFailed = imageState.key === imageKey && imageState.failed
  const imageLoaded = imageState.key === imageKey && imageState.loaded
  const initials = fighter.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const toneClass =
    tone === 'red'
      ? 'from-[#C8102E]/34 to-[var(--avatar-bg)]'
      : tone === 'blue'
        ? 'from-[#2F5FA8]/34 to-[var(--avatar-bg)]'
        : 'from-white/12 to-[var(--avatar-bg)]'

  const showImage = Boolean(imageUrl && !imageFailed)

  return (
    <div className={`relative h-[86px] w-[70px] overflow-hidden rounded-2xl border max-sm:h-[118px] max-sm:w-24 border-[var(--line-soft)] bg-gradient-to-br ${toneClass}`}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={`${fighter.name} profile`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageState({ key: imageKey, failed: false, loaded: true })}
          onError={() => setImageState({ key: imageKey, failed: true, loaded: false })}
          className={`absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
      {(!showImage || !imageLoaded) ? (
        <>
          <div className="absolute inset-x-2 bottom-0 h-14 rounded-t-full bg-black/24" />
          <div className="absolute left-1/2 top-4 h-7 w-7 -translate-x-1/2 rounded-full bg-white/16" />
          <div className="absolute left-1/2 top-10 h-12 w-11 -translate-x-1/2 rounded-t-[24px] bg-white/12" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{initials}</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2 sm:py-2.5">
      <p className="broadcast-label text-[11px] text-[#999999]">{label}</p>
      <p className="data-value mt-0.5 text-xl font-bold text-[#FFFFFF] sm:mt-1 sm:text-2xl">{value}</p>
    </div>
  )
}

function byDivision(target: string) {
  return (fighter: FighterProfile) => {
    const division = getDivisionLabel(fighter)
    if (target === 'heavyweight' && division.includes('light heavyweight')) {
      return false
    }
    return division.includes(target) && (target.startsWith("women's") || !division.includes("women's"))
  }
}

function getDivisionLabel(fighter: FighterProfile) {
  return (fighter.division ?? '').toLowerCase()
}

function formatRecord(fighter: FighterProfile) {
  return `${fighter.wins ?? 0}-${fighter.losses ?? 0}${fighter.draws ? `-${fighter.draws}` : ''} record`
}
