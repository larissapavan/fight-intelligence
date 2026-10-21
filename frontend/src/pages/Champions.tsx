import { createContext, useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Crown, Flame, Layers, Shield, ThumbsDown, Trophy } from 'lucide-react'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { badgesForRankings } from '../shared/data/badges'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { ChampionBelt } from '../shared/components/ChampionBelt'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { divisionLimit, divisionOrder } from '../shared/data/divisions'
import { useChampions } from '../shared/hooks/useChampions'
import { useFighterImages, getFighterImageUrl, normalizeFighterName } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import type { ChampionSummary, RecordCategory, RecordEntry, TitleFight, TitleReign } from '../shared/types/api'

type Tab = 'positive' | 'negative' | 'multi'

const MULTI_DIVISION_KEY = 'multi_division_champions'

/** Opens a fighter's profile on top of this page, so closing it leaves the reader exactly where they were. */
const OpenProfileContext = createContext<(name: string) => void>(() => undefined)

const VIEWS = [
  { key: 'current', label: 'Current champions', short: 'Current' },
  { key: 'greatest', label: 'Greatest champions', short: 'Greatest' },
  { key: 'records', label: 'Title fight records', short: 'Records' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

export function Champions() {
  const { data, loading, error } = useChampions()
  const [tab, setTab] = useState<Tab>('positive')
  const multiDivision = data?.records.find((category) => category.key === MULTI_DIVISION_KEY)
  // The chosen section lives in the URL (?view=records), so it can be shared and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('view')
  const view: ViewKey = VIEWS.some((item) => item.key === requested) ? (requested as ViewKey) : 'current'
  const chooseView = (next: ViewKey) => setSearchParams(next === 'current' ? {} : { view: next }, { replace: true })
  const [profileName, setProfileName] = useState<string | null>(null)

  return (
    <OpenProfileContext.Provider value={setProfileName}>
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading level={1}
          eyebrow="Title fight history"
          title="Champions & records"
          description="Every UFC title reign, defense and title record, compiled from published title histories."
        />

        <div
          role="tablist"
          aria-label="Choose what to see"
          className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll"
        >
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`champions-tab-${item.key}`}
              aria-selected={view === item.key}
              aria-controls="champions-panel"
              onClick={() => chooseView(item.key)}
              className={`shrink-0 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] transition sm:px-5 ${
                view === item.key
                  ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                  : 'text-[var(--text-main)] hover:bg-[#F2C230] hover:text-[#0E0E0E]'
              }`}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
      ) : null}

      {loading || !data ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[90px]" />
          ))}
        </section>
      ) : (
        <div id="champions-panel" role="tabpanel" aria-labelledby={`champions-tab-${view}`} className="space-y-3 sm:space-y-4">
          {view === 'current' ? <CurrentChampionsSection reigns={data.current_champions} history={data.reigns ?? []} /> : null}
          {view === 'greatest' ? <GreatestChampionsSection champions={data.greatest_champions} /> : null}
          {view === 'records' ? (
            <section>
              <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-full border border-white/8 bg-white/[0.035] p-0.5 chip-scroll">
                <TabButton active={tab === 'positive'} onClick={() => setTab('positive')}>
                  Positive records
                </TabButton>
                <TabButton active={tab === 'negative'} onClick={() => setTab('negative')}>
                  Negative records
                </TabButton>
                <TabButton active={tab === 'multi'} onClick={() => setTab('multi')}>
                  Multi-division champions
                </TabButton>
              </div>

              {tab === 'multi' ? (
                multiDivision ? <MultiDivisionSection category={multiDivision} current={data.current_champions} /> : null
              ) : (
                <div className="grid gap-2.5">
                  {data.records
                    .filter((category) => category.kind === tab && category.key !== MULTI_DIVISION_KEY)
                    .map((category) => (
                      <RecordCard key={category.key} category={category} />
                    ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}

      {profileName ? (
        <FighterProfileModal
          key={profileName}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </div>
    </OpenProfileContext.Provider>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#999999] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function formatFightDate(date: string | null | undefined) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const RESULT_METHODS: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  SUB: 'submission',
  'U-DEC': 'unanimous decision',
  'S-DEC': 'split decision',
  'M-DEC': 'majority decision',
  DQ: 'disqualification',
}


/** "Win by unanimous decision (R5) · Sep 19, 2026" */
function describeLastFight(fight: NonNullable<TitleReign['last_fight']>) {
  const outcome = fight.result === 'win' ? 'Win' : fight.result === 'loss' ? 'Loss' : 'No result'
  const method = fight.method ? ` by ${RESULT_METHODS[fight.method] ?? fight.method}` : ''
  const round = fight.round ? ` (R${fight.round})` : ''
  const date = formatFightDate(fight.date)
  return `${outcome}${method}${round}${date ? ` · ${date}` : ''}`
}


type CompactStat = { label: string; value: string }

/** The one compact champion row every list on this page uses: avatar with a corner badge, name, subtitle, stats. */
function CompactChampionCard({
  name,
  imageUrl,
  badge,
  subtitle,
  current = false,
  stats,
  onClick,
  ariaLabel,
  expanded,
  controls,
}: {
  name: string
  imageUrl: string | null
  badge?: React.ReactNode
  subtitle: string
  current?: boolean
  stats: CompactStat[]
  onClick: () => void
  ariaLabel: string
  expanded?: boolean
  controls?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      className="surface-card flex w-full min-w-0 cursor-pointer text-left items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-neutral-800/60 focus-visible:bg-neutral-800/60 focus-visible:outline-none"
    >
      <div className="relative shrink-0">
        <FighterAvatar name={name} className="h-12 w-12" imageUrl={imageUrl} />
        {badge}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-semibold text-[#FFFFFF]">{name}</p>
          {current ? (
            <span className="type-tech rounded-full border border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-[11px] font-bold uppercase text-[#0E0E0E]">
              Current
            </span>
          ) : null}
        </div>
        <p className="theme-muted mt-0.5 truncate text-[11px]">{subtitle}</p>
        <p className="theme-muted mt-0.5 truncate text-[11px] sm:hidden">{stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(' · ')}</p>
      </div>

      <div className="theme-muted hidden shrink-0 gap-3 text-right text-[11px] sm:flex lg:gap-3.5">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
      {expanded !== undefined ? (
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-[#FFFFFF] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      ) : null}
    </button>
  )
}

/** Corner badge: the rank. First place is a red trophy, or a gold GOAT seal in the greatest-champions list. */
function RankBadge({ rank, goat = false }: { rank: number; goat?: boolean }) {
  if (goat) {
    return (
      <span className="type-num absolute -bottom-1 -left-1 grid h-5 place-items-center rounded-md border border-[var(--rule)] bg-[#F2C230] px-1 text-[11px] font-bold leading-none tracking-[0.04em] text-[#0E0E0E]">
        GOAT
      </span>
    )
  }
  return (
    <span
      className={`type-num absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-md border px-1 text-[11px] leading-none ${
        rank === 1 ? 'border-[var(--rule)] bg-[#C8102E] text-white' : 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)]'
      }`}
    >
      {rank === 1 ? <Trophy className="h-3 w-3" /> : rank}
    </span>
  )
}

function CurrentChampionsSection({ reigns, history }: { reigns: TitleReign[]; history: TitleReign[] }) {
  const openProfile = useContext(OpenProfileContext)
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])
  const ordered = useMemo(() => [...reigns].sort((a, b) => divisionOrder(a.division) - divisionOrder(b.division)), [reigns])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Crown className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Current champions</h2>
        <span className="theme-muted text-xs">({reigns.length})</span>
      </div>

      <div className="grid gap-2.5">
        {ordered.map((reign) => {
          const profile = profileByName.get(normalizeFighterName(reign.champion))
          const record = profile ? `${profile.wins ?? 0}-${profile.losses ?? 0}-${profile.draws ?? 0}` : null
          const limit = divisionLimit(reign.division)
          const last = reign.last_fight

          return (
            <div key={reign.division}>
            <button
              type="button"
              onClick={() => openProfile(reign.champion)}
              aria-label={`${reign.champion}, ${reign.division} champion. View profile`}
              className="metric-tile group grid w-full min-w-0 cursor-pointer text-left grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[170px_auto_1fr_auto] md:gap-x-6"
            >
              <div className="col-span-2 min-w-0 md:col-span-1">
                <p className="text-base font-bold uppercase leading-tight tracking-wide text-[#FFFFFF]">{reign.division}</p>
                {limit ? <p className="theme-muted mt-0.5 text-xs font-semibold">{limit}</p> : null}
              </div>

              <FighterAvatar
                name={reign.champion}
                imageUrl={getFighterImageUrl(reign.champion, imageByName, profile?.image_url)}
                highlight
                className="h-28 w-24 sm:h-32 sm:w-28"
              />

              <div className="min-w-0">
                {profile?.nickname ? (
                  <p className="broadcast-label truncate text-[11px] text-[#999999]">&ldquo;{profile.nickname}&rdquo;</p>
                ) : null}
                <p className="type-display mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-bold uppercase leading-none text-[#FFFFFF] sm:text-3xl">
                  {profile ? <FlagList fighter={profile} className="h-4 w-6" /> : null}
                  <span className="min-w-0 break-words">{reign.champion}</span>
                </p>
                <FighterBadges badges={badgesForRankings(profile?.badges)} className="mt-1.5" />
                {record ? (
                  <p className="mt-1.5 text-sm text-[#FFFFFF]">
                    <span className="font-bold">{record}</span> <span className="theme-muted">(W-L-D)</span>
                  </p>
                ) : null}
                {last ? (
                  <p className="mt-1 text-[13px] leading-5 text-[#FFFFFF]">
                    <span className="font-bold">Last fight:</span> {reign.champion} vs. {last.opponent}
                    <span className="theme-muted block text-xs sm:inline sm:before:content-['_·_']">{describeLastFight(last)}</span>
                  </p>
                ) : null}
                <p className="theme-muted mt-1 text-xs">
                  Champion for {reign.days_held ?? '—'} days · {reign.defenses_count}{' '}
                  {reign.defenses_count === 1 ? 'defense' : 'defenses'}
                </p>
              </div>

              <span className="ghost-action col-span-2 inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FFFFFF] transition group-hover:!bg-[#F2C230] group-hover:text-[#0E0E0E] md:col-span-1">
                View profile
              </span>
            </button>
            <DivisionHistory division={reign.division} reigns={history} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

const END_LABELS: Record<string, string> = {
  lost_title_fight: 'Lost the belt',
  vacated: 'Vacated',
  stripped: 'Stripped',
  unified: 'Unified with the undisputed belt',
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
  return `${value}${suffix}`
}

/** A collapsed panel under each division: every fighter who has held that belt, newest first. */
function DivisionHistory({ division, reigns }: { division: string; reigns: TitleReign[] }) {
  const [open, setOpen] = useState(false)
  const openProfile = useContext(OpenProfileContext)
  const history = useMemo(
    () => reigns.filter((reign) => reign.division === division).sort((a, b) => (b.date_won ?? '').localeCompare(a.date_won ?? '')),
    [reigns, division],
  )
  if (!history.length) return null

  const panelId = `history-${division.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const holders = new Set(history.map((reign) => reign.champion)).size

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="ghost-action inline-flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#FFFFFF] transition hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        <span>
          {division} title history
          <span className="theme-muted ml-2 font-semibold normal-case tracking-normal">
            {history.length} {history.length === 1 ? 'reign' : 'reigns'} · {holders} {holders === 1 ? 'champion' : 'champions'}
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <section id={panelId} aria-label={`${division}: every champion`} className="fade-up mt-1.5 min-w-0 border-2 border-[var(--rule)] bg-[var(--surface-3)] p-3 sm:p-4">
          <ol>
            {history.map((reign) => (
              <ReignRow key={`${reign.date_won}-${reign.champion}-${reign.title_type}`} reign={reign} onOpen={openProfile} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}

function ReignRow({ reign, onOpen }: { reign: TitleReign; onOpen: (name: string) => void }) {
  const date = formatFightDate(reign.date_won)
  const interim = reign.title_type === 'interim'
  const held = reign.days_held != null ? `${reign.days_held.toLocaleString('en-US')} days` : null
  const defenses = `${reign.defenses_count} ${reign.defenses_count === 1 ? 'defense' : 'defenses'}`
  const ended = reign.is_current ? 'Current champion' : END_LABELS[reign.end_reason] ?? null

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2.5 border-l-2 border-[var(--rule)] py-1.5 pl-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-3.5">
      <div className="pt-0.5">
        <p className="type-display text-lg leading-none text-[#FFFFFF] sm:text-xl">{reign.date_won?.slice(0, 4) ?? '—'}</p>
        <p className="theme-muted mt-0.5 text-[11px] font-semibold uppercase leading-tight">{date?.replace(/,\s*\d{4}$/, '')}</p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onOpen(reign.champion)}
            className="min-w-0 break-words text-left text-sm font-bold text-[#FFFFFF] underline-offset-2 hover:underline"
          >
            {reign.champion}
          </button>
          {reign.is_current ? (
            <span className="bg-[#F2C230] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0E0E0E]">Current</span>
          ) : null}
          {interim ? (
            <span className="border border-[var(--rule)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#FFFFFF]">Interim</span>
          ) : null}
          {reign.fighter_reign_index > 1 ? (
            <span className="theme-muted text-[11px] font-bold uppercase tracking-[0.1em]">{ordinal(reign.fighter_reign_index)} reign</span>
          ) : null}
        </div>
        <p className="theme-muted mt-0.5 text-[11px] leading-4">
          {[reign.won_how, reign.event].filter(Boolean).join(' · ') || 'Title win'}
        </p>
        <p className="theme-muted text-[11px] leading-4">
          {[held, defenses, ended].filter(Boolean).join(' · ')}
        </p>
      </div>
    </li>
  )
}

function GreatestChampionsSection({ champions }: { champions: ChampionSummary[] }) {
  const openProfile = useContext(OpenProfileContext)
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Greatest champions</h2>
        <span className="theme-muted text-xs">by total time as champion</span>
      </div>

      <div className="grid gap-1.5 lg:grid-cols-2 lg:gap-2.5">
        {champions.map((champion, index) => (
          <CompactChampionCard
            key={champion.champion}
            name={champion.champion}
            imageUrl={getFighterImageUrl(champion.champion, imageByName, profileByName.get(normalizeFighterName(champion.champion))?.image_url)}
            badge={<RankBadge rank={index + 1} goat={index === 0} />}
            subtitle={champion.divisions.join(' · ')}
            current={champion.is_current_champion}
            stats={[
              { label: 'Days', value: champion.total_days_as_champion.toLocaleString('en-US') },
              { label: 'Defenses', value: String(champion.total_defenses) },
              { label: 'Reigns', value: String(champion.total_reigns) },
            ]}
            onClick={() => openProfile(champion.champion)}
            ariaLabel={`${champion.champion}, view profile`}
          />
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="data-value text-sm font-bold text-[#FFFFFF]">{value}</p>
      <p className="broadcast-label text-[11px]">{label}</p>
    </div>
  )
}

/** One record list as a full-width row that opens to its top 10, like the card groups on the Events page. */
function RecordCard({ category }: { category: RecordCategory }) {
  const Icon = category.kind === 'positive' ? Flame : ThumbsDown
  const [open, setOpen] = useState(false)
  const panelId = `record-${category.key}`

  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03] sm:px-4"
      >
        <Icon className={`h-4 w-4 shrink-0 ${category.kind === 'positive' ? 'text-[#C8102E]' : 'text-[#999999]'}`} />
        <h3 className="broadcast-label text-xs text-[#FFFFFF]">{category.label}</h3>
        <span className="theme-muted text-xs">({category.entries.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {category.entries.length ? (
            // Two columns on wide screens, read top to bottom: ranks 1-5 on the left, 6-10 on the right.
            <div className="lg:columns-2 lg:gap-x-8">
              {category.entries.map((entry) => (
                <div key={`${entry.rank}-${entry.champion}`} className="break-inside-avoid">
                  <RecordRow entry={entry} unit={category.unit} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#999999]">No entries in this category.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function RecordRow({ entry, unit }: { entry: RecordCategory['entries'][number]; unit: string }) {
  const openProfile = useContext(OpenProfileContext)
  return (
    <button
      type="button"
      onClick={() => openProfile(entry.champion)}
      aria-label={`${entry.champion}, rank ${entry.rank}. View profile`}
      className="flex w-full cursor-pointer items-center text-left gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none"
    >
      <span className="type-num w-4 shrink-0 text-right text-[11px] text-[#999999]">{entry.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[#FFFFFF]">{entry.champion}</p>
        {entry.division ? <p className="theme-muted truncate text-[11px] leading-tight">{entry.division}</p> : null}
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[#FFFFFF]">
        {entry.value} <span className="theme-muted text-[11px] font-normal">{unit}</span>
      </span>
    </button>
  )
}

/** Multi-division champions, laid out like the current champions; a row opens that fighter's full title-fight history. */
function MultiDivisionSection({ category, current }: { category: RecordCategory; current: TitleReign[] }) {
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])
  const [openName, setOpenName] = useState<string | null>(null)

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
        <Layers className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">{category.label}</h2>
        <span className="theme-muted text-xs">({category.entries.length}) · tap a champion to see every title fight</span>
      </div>

      <div className="grid items-start gap-1.5 lg:grid-cols-2 lg:gap-2.5">
        {category.entries.map((entry) => {
          const profile = profileByName.get(normalizeFighterName(entry.champion))
          const divisions = (entry.division ?? '').split(', ').filter(Boolean)
          const fights = entry.title_fights ?? []
          const isOpen = openName === entry.champion
          const holdsBelt = current.some((reign) => normalizeFighterName(reign.champion) === normalizeFighterName(entry.champion))
          const panelId = `title-fights-${entry.rank}`

          return (
            <div key={entry.champion} className="min-w-0">
              <CompactChampionCard
                name={entry.champion}
                imageUrl={getFighterImageUrl(entry.champion, imageByName, profile?.image_url)}
                badge={<RankBadge rank={entry.rank} />}
                subtitle={divisions.join(' · ')}
                current={holdsBelt}
                stats={[
                  { label: 'Title fights', value: String(fights.length) },
                  { label: 'Belts won', value: String(fights.filter((fight) => fight.role === 'won_title').length) },
                  { label: 'Defenses', value: String(fights.filter((fight) => fight.role === 'defense').length) },
                ]}
                onClick={() => setOpenName(isOpen ? null : entry.champion)}
                ariaLabel={`${entry.champion}, ${isOpen ? 'hide' : 'view'} title fights`}
                expanded={isOpen}
                controls={panelId}
              />
              <div id={panelId}>{isOpen ? <ChampionTimeline entry={entry} /> : null}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const ROLE_STYLES: Record<TitleFight['role'], string> = {
  won_title: 'bg-[#F2C230] text-[#0E0E0E]',
  defense: 'bg-[#1F4E9C] text-white',
  lost_title: 'bg-[#C8102E] text-white',
  challenge: 'border border-[var(--rule)] text-[var(--text-main)]',
  other: 'border border-dashed border-[var(--rule)] text-[var(--text-main)]',
}

const RESULT_STYLES: Record<TitleFight['result'], { letter: string; className: string; name: string }> = {
  win: { letter: 'W', className: 'bg-[var(--rule)] text-[var(--card-bg)]', name: 'Win' },
  loss: { letter: 'L', className: 'bg-[#C8102E] text-white', name: 'Loss' },
  draw: { letter: 'D', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Draw' },
  no_contest: { letter: 'NC', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'No contest' },
}

function ChampionTimeline({ entry }: { entry: RecordEntry }) {
  const openProfile = useContext(OpenProfileContext)
  const fights = entry.title_fights ?? []
  const stats = [
    { label: 'Title fights', value: fights.length },
    { label: 'Belts won', value: fights.filter((fight) => fight.role === 'won_title').length },
    { label: 'Defenses', value: fights.filter((fight) => fight.role === 'defense').length },
    { label: 'Losses', value: fights.filter((fight) => fight.result === 'loss').length },
  ]

  return (
    <section aria-label={`${entry.champion}: every title fight`} className="fade-up mt-2 min-w-0 border-2 border-[var(--rule)] bg-[var(--surface-3)] p-3 sm:p-4">
      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="metric-tile px-3 py-2">
            <dd className="type-display text-2xl leading-none text-[#FFFFFF]">{stat.value}</dd>
            <dt className="theme-muted mt-1 text-[11px] font-bold uppercase tracking-[0.14em]">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {fights.length ? (
        <ol className="mt-4">
          {fights.map((fight, index) => (
            <TitleFightRow key={`${fight.date}-${fight.opponent}`} fight={fight} previous={fights[index - 1]} />
          ))}
        </ol>
      ) : (
        <p className="theme-muted mt-4 text-sm">No title fights found in the fight history.</p>
      )}

      <button
        type="button"
        onClick={() => openProfile(entry.champion)}
        className="ghost-action mt-4 inline-flex w-full items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#FFFFFF] transition hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        View full profile
      </button>
    </section>
  )
}

function TitleFightRow({ fight, previous }: { fight: TitleFight; previous: TitleFight | undefined }) {
  const date = formatFightDate(fight.date)
  const outcome = [fight.method, fight.round ? `R${fight.round}` : null].filter(Boolean).join(' · ')
  const result = RESULT_STYLES[fight.result]
  const newDivision = fight.division && fight.division !== previous?.division

  return (
    <>
      {newDivision ? (
        <li aria-hidden className="mb-1.5 mt-3 flex items-center gap-2 first:mt-0">
          <span className="broadcast-label shrink-0 text-[11px] text-[#FFFFFF]">{fight.division}</span>
          <span className="h-0.5 flex-1 bg-[var(--rule)]" />
        </li>
      ) : null}
      <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2.5 border-l-2 border-[var(--rule)] py-1.5 pl-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-3.5">
        <div className="pt-0.5">
          <p className="type-display text-lg leading-none text-[#FFFFFF] sm:text-xl">{fight.date?.slice(0, 4) ?? '—'}</p>
          <p className="theme-muted mt-0.5 text-[11px] font-semibold uppercase leading-tight">{date?.replace(/,\s*\d{4}$/, '')}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] ${ROLE_STYLES[fight.role]}`}>
              {fight.role === 'won_title' ? <ChampionBelt className="h-3 w-6" /> : null}
              {fight.role === 'defense' ? <Shield className="h-3 w-3" /> : null}
              {fight.label}
            </span>
            {fight.title_type === 'interim' && !/interim/i.test(fight.label) ? (
              <span className="border border-[var(--rule)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#FFFFFF]">Interim</span>
            ) : null}
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-bold text-[#FFFFFF]">
            <span className={`type-num grid h-5 min-w-5 shrink-0 place-items-center px-1 text-[11px] leading-none ${result.className}`} title={result.name}>
              <span className="sr-only">{result.name}</span>
              <span aria-hidden>{result.letter}</span>
            </span>
            <span className="min-w-0 break-words">vs. {fight.opponent}</span>
          </p>
          <p className="theme-muted mt-0.5 text-[11px] leading-4">{[outcome, fight.event].filter(Boolean).join(' · ')}</p>
        </div>
      </li>
    </>
  )
}
