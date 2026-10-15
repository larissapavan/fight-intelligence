import axios from 'axios'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Radio,
  Search,
  Shield,
  Sparkles,
  Weight,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChampionBelt } from '../shared/components/ChampionBelt'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { isKnownActive, isKnownRetired } from '../shared/data/fighterStatusOverrides'
import { useFighters } from '../shared/hooks/useFighters'
import { getFighterImageUrl, useFighterImages, type FighterImageRecord } from '../shared/hooks/useFighterImages'
import { getFighterPerformance, getSimilarFighters } from '../shared/services/api'
import type { FighterPerformance, FighterProfile, FightRecord, SimilarFighter, YearlyTrend } from '../shared/types/api'

type ActiveFilter = 'all' | 'active' | 'retired'

const METHOD_LABELS: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Submission',
  Decision: 'Decision',
  Disqualification: 'DQ',
  Other: 'Other',
}

type DivisionGroup = {
  key: string
  label: string
  shortLabel: string
  limit: string
  tone: 'red' | 'blue' | 'gold'
  match: (fighter: FighterProfile) => boolean
}

const divisionGroups: DivisionGroup[] = [
  { key: 'flyweight', label: 'Flyweight', shortLabel: 'FLW', limit: '125 lb', tone: 'blue', match: byDivision('flyweight') },
  { key: 'bantamweight', label: 'Bantamweight', shortLabel: 'BW', limit: '135 lb', tone: 'red', match: byDivision('bantamweight') },
  { key: 'featherweight', label: 'Featherweight', shortLabel: 'FW', limit: '145 lb', tone: 'gold', match: byDivision('featherweight') },
  { key: 'lightweight', label: 'Lightweight', shortLabel: 'LW', limit: '155 lb', tone: 'red', match: byDivision('lightweight') },
  { key: 'welterweight', label: 'Welterweight', shortLabel: 'WW', limit: '170 lb', tone: 'blue', match: byDivision('welterweight') },
  { key: 'middleweight', label: 'Middleweight', shortLabel: 'MW', limit: '185 lb', tone: 'gold', match: byDivision('middleweight') },
  { key: 'light-heavyweight', label: 'Light Heavyweight', shortLabel: 'LHW', limit: '205 lb', tone: 'red', match: byDivision('light heavyweight') },
  { key: 'heavyweight', label: 'Heavyweight', shortLabel: 'HW', limit: '265 lb', tone: 'blue', match: byDivision('heavyweight') },
  {
    key: 'w-strawweight',
    label: "Women's Strawweight",
    shortLabel: 'WSW',
    limit: '115 lb',
    tone: 'gold',
    match: byDivision("women's strawweight"),
  },
  {
    key: 'w-flyweight',
    label: "Women's Flyweight",
    shortLabel: 'WFLW',
    limit: '125 lb',
    tone: 'blue',
    match: byDivision("women's flyweight"),
  },
  {
    key: 'w-bantamweight',
    label: "Women's Bantamweight",
    shortLabel: 'WBW',
    limit: '135 lb',
    tone: 'red',
    match: byDivision("women's bantamweight"),
  },
  {
    key: 'w-featherweight',
    label: "Women's Featherweight",
    shortLabel: 'WFW',
    limit: '145 lb',
    tone: 'gold',
    match: byDivision("women's featherweight"),
  },
  {
    key: 'open-class',
    label: 'Open Class / Unclassified',
    shortLabel: 'OPEN',
    limit: 'Mixed',
    tone: 'blue',
    match: (fighter) => !divisionGroups.slice(0, -1).some((group) => group.match(fighter)),
  },
]

const toneStyles = {
  red: {
    text: 'text-[#FF6B6B]',
    border: 'border-[#D32F2F]/24',
    bg: 'bg-[#D32F2F]/10',
    bar: 'bg-[#D32F2F]',
    glow: 'shadow-[0_14px_34px_rgba(232,27,35,0.14)]',
  },
  blue: {
    text: 'text-[#8FB3E8]',
    border: 'border-[#2F5FA8]/24',
    bg: 'bg-[#2F5FA8]/10',
    bar: 'bg-[#2F5FA8]',
    glow: 'shadow-[0_14px_34px_rgba(47,95,168,0.14)]',
  },
  gold: {
    text: 'text-[#CCCCCC]',
    border: 'border-white/18',
    bg: 'bg-white/8',
    bar: 'bg-[#CCCCCC]',
    glow: 'shadow-[0_14px_34px_rgba(255,255,255,0.08)]',
  },
}

export function Fighters() {
  const { fighters, loading, error } = useFighters()
  const { imageByName } = useFighterImages()
  const [query, setQuery] = useState('')
  const [stanceFilter, setStanceFilter] = useState('All stances')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [activeDivision, setActiveDivision] = useState('lightweight')
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep link from other pages (e.g. Champions): /fighters?fighter=<name> opens that profile.
  const [selectedFighter, setSelectedFighter] = useState<string | null>(() => searchParams.get('fighter'))

  const isActiveFighter = useCallback(
    (fighter: FighterProfile) =>
      (fighter.is_active || isKnownActive(fighter.name)) && !isKnownRetired(fighter.name),
    [],
  )

  const stances = useMemo(
    () => ['All stances', ...Array.from(new Set(fighters.map((fighter) => fighter.stance).filter(Boolean))).sort()],
    [fighters],
  )

  const activeCount = useMemo(() => fighters.filter(isActiveFighter).length, [fighters, isActiveFighter])

  const visibleFighters = useMemo(() => {
    const term = query.trim().toLowerCase()
    return fighters.filter((fighter) => {
      const matchesName =
        !term ||
        fighter.name.toLowerCase().includes(term) ||
        (fighter.nickname?.toLowerCase().includes(term) ?? false)
      const matchesStance = stanceFilter === 'All stances' || fighter.stance === stanceFilter
      const isActive = isActiveFighter(fighter)
      const matchesActive =
        activeFilter === 'all' || (activeFilter === 'active' ? isActive : !isActive)
      return matchesName && matchesStance && matchesActive
    })
  }, [fighters, query, stanceFilter, activeFilter, isActiveFighter])

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

  const featuredGroup = divisionGroups.find((group) => group.key === activeDivision) ?? divisionGroups[0]
  const featuredFighters = groupedFighters.get(featuredGroup.key) ?? []
  const hasAnyResults = visibleFighters.length > 0

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 xs:px-4 xs:py-3.5 md:px-5 md:py-5 lg:px-6 lg:py-6">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            eyebrow="Fighter database"
            title="Weight classes"
            description="Browse athletes by UFC weight class, inspect scouting profiles and jump quickly to source data."
          />

          <div className="grid gap-2 xs:grid-cols-2">
            <SummaryTile label="Fighters" value={`${visibleFighters.length}`} />
            <SummaryTile label="Divisions" value={`${divisionGroups.length}`} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-[1fr_220px]">
          <div className="soft-input flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[#D32F2F]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fighter or nickname"
              className="theme-text w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] md:min-w-[300px]"
            />
          </div>
          <select
            value={stanceFilter}
            onChange={(event) => setStanceFilter(event.target.value)}
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            {stances.map((stance) => (
              <option key={stance} value={stance}>
                {stance}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/8 pt-2.5">
          <div role="group" aria-label="Fighter status" className="inline-flex max-w-full overflow-x-auto rounded-md border border-white/8 bg-white/[0.035] p-0.5 chip-scroll">
            <ActiveTabButton active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} count={fighters.length}>
              All
            </ActiveTabButton>
            <ActiveTabButton active={activeFilter === 'active'} onClick={() => setActiveFilter('active')} count={activeCount}>
              <Radio className="h-3 w-3" /> Active
            </ActiveTabButton>
            <ActiveTabButton active={activeFilter === 'retired'} onClick={() => setActiveFilter('retired')} count={fighters.length - activeCount}>
              Retired / Released
            </ActiveTabButton>
          </div>
          <p className="broadcast-label text-[10px] text-[#999999]">
            <span className="tabular-nums text-[#FFFFFF]">{visibleFighters.length}</span> shown
          </p>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#D32F2F]/25 bg-[#D32F2F]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

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
            activeKey={activeDivision}
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
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? 'bg-[#E50914]/14 text-[#E50914] shadow-[inset_0_0_0_1px_rgba(229,9,20,0.45)]'
          : 'text-[#999999] hover:text-white'
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
      className={`inline-flex min-w-[1.6em] items-center justify-center rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums tracking-normal ${
        active ? 'bg-[#E50914]/20 text-[#E50914]' : 'bg-white/8 text-[#999999]'
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
      className={`absolute top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-neutral-900/80 text-[#CCCCCC] backdrop-blur-sm transition hover:text-[#FF1E27] focus-visible:text-[#FF1E27] focus-visible:outline-none ${
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
  const styles = toneStyles[group.tone]

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
          <div className={`rounded-xl border p-2 ${styles.border} ${styles.bg} ${styles.text}`}>
            <Weight className="h-4 w-4" />
          </div>
          <div>
            <p className="broadcast-label text-[10px] text-[#999999]">Active division</p>
            <h2 className="mt-0.5 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF] sm:text-2xl">
              {group.label}
            </h2>
            <p className="mt-1 text-xs text-[#999999]">
              {fighters.length} athletes • {group.limit} limit
            </p>
          </div>
        </div>
        <span className={`type-tech w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${styles.border} ${styles.bg} ${styles.text}`}>
          {group.shortLabel}
        </span>
      </div>

      <div className="max-h-[72vh] overflow-y-auto border-t border-white/8 px-3 py-3 pr-2 xs:px-4 md:px-5 xl:max-h-[calc(100vh-240px)]">
        {fighters.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {fighters.map((fighter, index) => (
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
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition duration-200 md:px-3 md:text-xs',
        isActive
          ? 'border-[#E50914]/60 bg-[#E50914]/10 text-[#E50914] shadow-[0_0_14px_rgba(229,9,20,0.22)]'
          : 'border-white/8 bg-white/[0.03] text-[#999999] hover:border-white/16 hover:text-white',
      ].join(' ')}
    >
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
      className="surface-card group overflow-hidden rounded-[18px] transition duration-300 hover:-translate-y-0.5 hover:border-white/16"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.012, 0.18) }}
    >
      <div className={`h-1 w-full ${styles.bar}`} />
      <div className="p-3">
        <div className="grid grid-cols-[70px_1fr] gap-3">
          <FighterPortrait fighter={fighter} imageUrl={imageUrl ?? undefined} tone={group.tone} />
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`broadcast-label text-[10px] ${styles.text}`}>{fighter.division ?? group.shortLabel}</p>
                <h3 className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xl font-bold uppercase leading-none tracking-[0.03em] text-[#FFFFFF]">
                  <span className="min-w-0">{fighter.name}</span>
                  {fighter.belt ? <ChampionBelt /> : null}
                </h3>
              </div>
            </div>

            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#999999]">
              {formatRecord(fighter)}
              {fighter.nickname ? ` • "${fighter.nickname}"` : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat icon={Shield} label="Win rate" value={formatPercent(fighter.win_rate)} />
          <MiniStat icon={Weight} label="Weight" value={fighter.weight_lbs ? `${fighter.weight_lbs.toFixed(0)} lb` : '—'} />
          <MiniStat label="Reach" value={fighter.reach_cm ? `${fighter.reach_cm.toFixed(0)} cm` : '—'} />
          <MiniStat label="Style" value={fighter.stance || 'Unknown'} />
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
              className="ghost-action inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#D32F2F]"
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
      ? 'from-[#D32F2F]/34 to-[var(--avatar-bg)]'
      : tone === 'blue'
        ? 'from-[#2F5FA8]/34 to-[var(--avatar-bg)]'
        : 'from-white/12 to-[var(--avatar-bg)]'

  const showImage = Boolean(imageUrl && !imageFailed)

  return (
    <div className={`relative h-[86px] overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-gradient-to-br ${toneClass}`}>
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

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="metric-tile rounded-xl px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[#999999]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span className="type-tech text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="type-num mt-1 truncate text-xs font-semibold text-[#FFFFFF]">{value}</p>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[#FFFFFF]">{value}</p>
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

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function FighterProfileModal({
  name,
  onClose,
  onSelectFighter,
}: {
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [similarFighters, setSimilarFighters] = useState<SimilarFighter[]>([])
  const [similarLoading, setSimilarLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getFighterPerformance(name)
      .then((data) => {
        if (!cancelled) setPerformance(data)
      })
      .catch((requestError) => {
        console.error(requestError)
        if (cancelled) return
        const status = axios.isAxiosError(requestError) ? requestError.response?.status : undefined
        if (status === 404) {
          setError('No performance history found for this fighter.')
        } else if (status) {
          setError(`Unable to load performance history (server returned ${status}).`)
        } else {
          setError('Unable to load performance history. Check your connection and try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [name])

  useEffect(() => {
    let cancelled = false

    getSimilarFighters(name)
      .then((data) => {
        if (!cancelled) setSimilarFighters(data)
      })
      .catch((requestError) => {
        console.error(requestError)
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [name])

  return createPortal(
    <motion.div
      className="selector-backdrop fixed inset-0 z-[95] flex items-center justify-center overflow-hidden px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.section
        className="surface-card flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] border-white/14"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="broadcast-label text-[10px] text-[#999999]">Performance profile</p>
            <h2 className="truncate text-xl font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost-action grid h-9 w-9 shrink-0 place-items-center rounded-full"
            aria-label="Close performance profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-2.5">
              <LoadingSkeleton className="h-[60px]" />
              <LoadingSkeleton className="h-[100px]" />
              <LoadingSkeleton className="h-[140px]" />
            </div>
          ) : error ? (
            <p className="rounded-xl border border-[#D32F2F]/25 bg-[#D32F2F]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
          ) : performance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Fights" value={`${performance.total_fights}`} />
                <MiniStat label="Wins" value={`${performance.wins}`} />
                <MiniStat label="Losses" value={`${performance.losses}`} />
              </div>

              <CareerTimeline fights={performance.career_timeline} />

              <FighterTrends trends={performance.yearly_trends} />

              {performance.weight_class_history.length > 0 ? (
                <div className="metric-tile rounded-2xl p-3">
                  <p className="broadcast-label text-[10px] text-[#999999]">Weight class history</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#FFFFFF]">
                    {performance.weight_class_history.map((weightClass, index) => (
                      <span key={`${weightClass}-${index}`} className="inline-flex items-center gap-1.5">
                        {index > 0 ? <span className="text-[#999999]">→</span> : null}
                        {weightClass}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {Object.keys(performance.method_breakdown).length > 0 ? (
                <div className="metric-tile rounded-2xl p-3">
                  <p className="broadcast-label text-[10px] text-[#999999]">Favorite finishing methods</p>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(performance.method_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, count]) => (
                        <div key={method} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-[#999999]">{METHOD_LABELS[method] ?? method}</span>
                          <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-[#D32F2F]"
                              style={{ width: `${(count / performance.wins) * 100}%` }}
                            />
                          </div>
                          <span className="type-num w-5 shrink-0 text-right text-xs font-semibold text-[#FFFFFF]">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {performance.last_performances.length > 0 ? (
                <div>
                  <p className="broadcast-label mb-1.5 text-[10px] text-[#999999]">Last performances</p>
                  <div className="grid gap-1.5">
                    {performance.last_performances.map((fight, index) => (
                      <div key={index} className="metric-tile rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[#FFFFFF]">vs {fight.opponent}</span>
                          <ResultBadge result={fight.result} />
                        </div>
                        <p className="theme-muted mt-0.5 flex items-center gap-1.5 text-[11px]">
                          {fight.date ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {fight.date}
                            </span>
                          ) : null}
                          <span>{fight.method ? METHOD_LABELS[fight.method] ?? fight.method : 'Result pending'}</span>
                          {fight.round ? <span>R{fight.round}</span> : null}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {similarLoading ? (
            <LoadingSkeleton className="mt-3 h-[180px]" />
          ) : similarFighters.length > 0 ? (
            <div className="metric-tile mt-3 rounded-2xl p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[#999999]">
                <Sparkles className="h-3.5 w-3.5 text-[#D32F2F]" />
                <p className="broadcast-label text-[10px]">Similar fighters</p>
              </div>
              <div className="grid gap-1.5">
                {similarFighters.map((fighter, index) => (
                  <button
                    key={fighter.name}
                    type="button"
                    onClick={() => onSelectFighter(fighter.name)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="broadcast-label w-4 shrink-0 text-[10px] text-[#666666]">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#FFFFFF]">{fighter.name}</span>
                    {fighter.division ? (
                      <span className="type-tech hidden shrink-0 text-[10px] uppercase tracking-[0.1em] text-[#999999] sm:inline">
                        {fighter.division}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs text-[#999999]">
                      {fighter.wins}-{fighter.losses}
                      {fighter.draws ? `-${fighter.draws}` : ''}
                    </span>
                    <span className="shrink-0 rounded-full border border-[#D32F2F]/25 bg-[#D32F2F]/10 px-2 py-0.5 text-xs font-bold text-[#D32F2F]">
                      {Math.round(fighter.similarity * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

function CareerTimeline({ fights }: { fights: FightRecord[] | undefined }) {
  if (!fights || fights.length === 0) return null

  const entries = fights.reduce<{
    items: Array<{ fight: FightRecord; year: string | null; showYear: boolean }>
    lastYear: string
  }>(
    (acc, fight) => {
      const year = fight.date ? fight.date.slice(0, 4) : null
      const showYear = year !== null && year !== acc.lastYear
      return {
        items: [...acc.items, { fight, year, showYear }],
        lastYear: showYear ? (year as string) : acc.lastYear,
      }
    },
    { items: [], lastYear: '' },
  ).items

  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[10px] text-[#999999]">Career timeline</p>
      <div className="pill-scroll mt-3 overflow-x-auto pb-1">
        <div className="relative flex min-w-max items-end gap-3 px-1">
          <div className="pointer-events-none absolute inset-x-1 top-[26px] h-px bg-white/12" />
          {entries.map(({ fight, year, showYear }, index) => {
            const isWin = fight.result === 'win'
            const isLoss = fight.result === 'loss'

            return (
              <div key={index} className="relative z-10 flex shrink-0 flex-col items-center gap-1">
                <span className="h-3 whitespace-nowrap text-[9px] font-semibold text-[#666666]">{showYear ? year : ''}</span>
                <span
                  title={`${fight.opponent} — ${fight.date ?? 'Date unknown'}`}
                  className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] font-bold ${
                    isWin
                      ? 'border-[#D32F2F] bg-[#D32F2F] text-white'
                      : isLoss
                        ? 'border-white/25 bg-[#1a1a1a] text-[#999999]'
                        : 'border-white/15 bg-[#1a1a1a] text-[#666666]'
                  }`}
                >
                  {isWin ? 'W' : isLoss ? 'L' : '–'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ROUND_COLORS = ['#D32F2F', '#2F5FA8', '#CCCCCC', '#9c7a25', '#666666']

const chartTooltipStyle = {
  background: '#141414',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  fontSize: '11px',
}

function formatWinTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function FighterTrends({ trends }: { trends: YearlyTrend[] | undefined }) {
  if (!trends || trends.length < 2) return null

  const rateData = trends.map((trend) => ({
    year: `${trend.year}`,
    winRate: trend.win_rate != null ? Math.round(trend.win_rate * 1000) / 10 : null,
    finishRate: trend.finish_rate != null ? Math.round(trend.finish_rate * 1000) / 10 : null,
  }))

  const timeData = trends
    .filter((trend) => trend.avg_win_time_seconds != null)
    .map((trend) => ({ year: `${trend.year}`, seconds: trend.avg_win_time_seconds as number }))

  const rounds = Array.from(new Set(trends.flatMap((trend) => Object.keys(trend.round_distribution).map(Number)))).sort(
    (a, b) => a - b,
  )
  const roundData = trends.map((trend) => {
    const row: Record<string, number | string> = { year: `${trend.year}` }
    for (const round of rounds) {
      row[`R${round}`] = trend.round_distribution[round] ?? 0
    }
    return row
  })

  return (
    <div className="space-y-3">
      <div className="metric-tile rounded-2xl p-3">
        <p className="broadcast-label text-[10px] text-[#999999]">Win rate &amp; finish rate over time</p>
        <div className="mt-2 h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#999999', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [`${Number(value ?? 0)}%`, String(name ?? '')]}
              />
              <Line type="monotone" dataKey="winRate" name="Win rate" stroke="#D32F2F" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line
                type="monotone"
                dataKey="finishRate"
                name="Finish rate"
                stroke="#8FB3E8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-[#999999]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D32F2F]" />
            Win rate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FB3E8]" />
            Finish rate
          </span>
        </div>
      </div>

      {roundData.length > 0 && rounds.length > 0 ? (
        <div className="metric-tile rounded-2xl p-3">
          <p className="broadcast-label text-[10px] text-[#999999]">Round distribution by year (wins)</p>
          <div className="mt-2 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roundData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={chartTooltipStyle} />
                {rounds.map((round, index) => (
                  <Bar
                    key={round}
                    dataKey={`R${round}`}
                    name={`Round ${round}`}
                    stackId="rounds"
                    fill={ROUND_COLORS[index % ROUND_COLORS.length]}
                    radius={index === rounds.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[#999999]">
            {rounds.map((round, index) => (
              <span key={round} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ROUND_COLORS[index % ROUND_COLORS.length] }} />
                R{round}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {timeData.length > 1 ? (
        <div className="metric-tile rounded-2xl p-3">
          <p className="broadcast-label text-[10px] text-[#999999]">Average win time over time</p>
          <div className="mt-2 h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#999999', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={formatWinTime}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [formatWinTime(Number(value ?? 0)), 'Avg win time']}
                />
                <Line type="monotone" dataKey="seconds" stroke="#CCCCCC" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ResultBadge({ result }: { result: 'win' | 'loss' | null }) {
  if (result === 'win') {
    return (
      <span className="type-tech rounded-full border border-[#D32F2F]/25 bg-[#D32F2F]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#D32F2F]">
        Win
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
        Loss
      </span>
    )
  }
  return (
    <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
      NC
    </span>
  )
}
