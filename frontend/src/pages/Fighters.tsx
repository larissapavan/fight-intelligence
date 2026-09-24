import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Folder,
  Radio,
  Search,
  Shield,
  Trophy,
  Users,
  Weight,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useFighters } from '../shared/hooks/useFighters'
import { getFighterImageUrl, normalizeFighterName, useFighterImages, type FighterImageRecord } from '../shared/hooks/useFighterImages'
import { getFighterPerformance } from '../shared/services/api'
import type { FighterPerformance, FighterProfile } from '../shared/types/api'

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
    border: 'border-[#E81B23]/24',
    bg: 'bg-[#E81B23]/10',
    bar: 'bg-[#E81B23]',
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
  const [openDivision, setOpenDivision] = useState('lightweight')
  const [selectedFighter, setSelectedFighter] = useState<string | null>(null)

  const isActiveFighter = useCallback(
    (fighter: FighterProfile) => imageByName.has(normalizeFighterName(fighter.name)),
    [imageByName],
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

  const featuredGroup = divisionGroups.find((group) => group.key === openDivision) ?? divisionGroups[0]
  const featuredFighters = groupedFighters.get(featuredGroup.key) ?? []
  const hasAnyResults = visibleFighters.length > 0

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            eyebrow="Fighter database"
            title="Division folders"
            description="Browse athletes by UFC weight class, inspect scouting profiles and jump quickly to source data."
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryTile label="Fighters" value={`${visibleFighters.length}`} />
            <SummaryTile label="Folders" value={`${divisionGroups.length}`} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_220px]">
          <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-[#E81B23]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fighter or nickname"
              className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
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

        <div className="mt-2.5 inline-flex rounded-full border border-white/8 bg-white/[0.035] p-0.5">
          <ActiveTabButton active={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>
            All ({fighters.length})
          </ActiveTabButton>
          <ActiveTabButton active={activeFilter === 'active'} onClick={() => setActiveFilter('active')}>
            <Radio className="h-3 w-3" /> Active ({activeCount})
          </ActiveTabButton>
          <ActiveTabButton active={activeFilter === 'retired'} onClick={() => setActiveFilter('retired')}>
            Retired ({fighters.length - activeCount})
          </ActiveTabButton>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[210px]" />
          ))}
        </section>
      ) : hasAnyResults ? (
        <section className="grid gap-3 xl:grid-cols-[300px_1fr]">
          <aside className="surface-card h-fit rounded-[20px] p-2.5 sm:p-3 xl:sticky xl:top-24">
            <div className="mb-2 flex items-center justify-between gap-3 px-1.5">
              <div>
                <p className="broadcast-label text-[10px] text-[#999999]">Folders</p>
                <h2 className="mt-0.5 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
                  Divisions
                </h2>
              </div>
              <Users className="h-4 w-4 text-[#E81B23]" />
            </div>

            <div className="grid gap-1.5">
              {divisionGroups.map((group) => (
                <DivisionFolderButton
                  key={group.key}
                  group={group}
                  count={groupedFighters.get(group.key)?.length ?? 0}
                  isOpen={openDivision === group.key}
                  onClick={() => setOpenDivision((current) => (current === group.key ? 'open-class' : group.key))}
                />
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            <DivisionPanel
              group={featuredGroup}
              fighters={featuredFighters}
              imageByName={imageByName}
              onSelectFighter={setSelectedFighter}
            />
          </main>
        </section>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">No fighters found</p>
          <p className="mt-2 text-sm text-[#999999]">Adjust the search or filter to explore another fighter profile in the database.</p>
        </div>
      )}

      {selectedFighter ? (
        <FighterProfileModal key={selectedFighter} name={selectedFighter} onClose={() => setSelectedFighter(null)} />
      ) : null}
    </div>
  )
}

function ActiveTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#999999] hover:text-white'
      }`}
    >
      {children}
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
      key={group.key}
      className="surface-card overflow-hidden rounded-[20px]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex w-full flex-col gap-3 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-2 ${styles.border} ${styles.bg} ${styles.text}`}>
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <p className="broadcast-label text-[10px] text-[#999999]">Active division</p>
            <h2 className="mt-0.5 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
              {group.label}
            </h2>
            <p className="mt-1 text-xs text-[#999999]">
              {fighters.length} athletes • {group.limit} limit
            </p>
          </div>
        </div>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${styles.border} ${styles.bg} ${styles.text}`}>
          {group.shortLabel}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${group.key}-content`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="max-h-[72vh] overflow-y-auto border-t border-white/8 px-3 py-3 pr-2 sm:px-4 xl:max-h-[calc(100vh-240px)]">
            {fighters.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                <p className="text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
                  No athletes in this folder
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#999999]">
                  The current search or stance filter has no matching fighters in {group.label}.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  )
}

function DivisionFolderButton({
  group,
  count,
  isOpen,
  onClick,
}: {
  group: DivisionGroup
  count: number
  isOpen: boolean
  onClick: () => void
}) {
  const styles = toneStyles[group.tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition duration-200',
        isOpen ? `${styles.border} ${styles.bg} ${styles.glow}` : 'border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.055]',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={`shrink-0 rounded-xl border p-1.5 ${isOpen ? `${styles.border} ${styles.text}` : 'border-white/8 text-[#999999]'}`}>
          <Folder className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#FFFFFF]">{group.label}</span>
          <span className="mt-0.5 block text-xs text-[#999999]">{group.limit} • {count} fighters</span>
        </span>
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#999999] transition ${isOpen ? 'rotate-180' : ''}`} />
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
                <h3 className="mt-1 text-xl font-bold uppercase leading-none tracking-[0.03em] text-[#FFFFFF]">
                  {fighter.name}
                </h3>
              </div>
              {fighter.belt ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#E81B23]">
                  <Trophy className="h-3 w-3" />
                  Champ
                </span>
              ) : null}
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
              className="ghost-action inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#E81B23]"
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
      ? 'from-[#E81B23]/34 to-[var(--avatar-bg)]'
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
            <span className="text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{initials}</span>
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
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-[#FFFFFF]">{value}</p>
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

function FighterProfileModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getFighterPerformance(name)
      .then((data) => {
        if (!cancelled) setPerformance(data)
      })
      .catch((requestError) => {
        console.error(requestError)
        if (!cancelled) setError('Unable to load performance history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
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
            <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
          ) : performance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Fights" value={`${performance.total_fights}`} />
                <MiniStat label="Wins" value={`${performance.wins}`} />
                <MiniStat label="Losses" value={`${performance.losses}`} />
              </div>

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
                              className="h-full rounded-full bg-[#E81B23]"
                              style={{ width: `${(count / performance.wins) * 100}%` }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right text-xs font-semibold text-[#FFFFFF]">{count}</span>
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
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

function ResultBadge({ result }: { result: 'win' | 'loss' | null }) {
  if (result === 'win') {
    return (
      <span className="rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#E81B23]">
        Win
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
        Loss
      </span>
    )
  }
  return (
    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
      NC
    </span>
  )
}
