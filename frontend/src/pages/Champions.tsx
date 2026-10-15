import { createContext, useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Crown, Flame, Layers, Shield, ThumbsDown, Trophy } from 'lucide-react'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
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

const COLLAPSED_ROWS = 5
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
        <SectionHeading
          eyebrow="Title fight history"
          title="Champions & records"
          description="Every UFC title reign, defense and record book entry — compiled from published UFC title histories."
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
          {view === 'current' ? <CurrentChampionsSection reigns={data.current_champions} /> : null}
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
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

const RESULT_METHODS: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  SUB: 'submission',
  'U-DEC': 'unanimous decision',
  'S-DEC': 'split decision',
  'M-DEC': 'majority decision',
  DQ: 'disqualification',
}

function formatFightDate(date: string | null | undefined) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** "Win by unanimous decision (R5) · Sep 19, 2026" */
function describeLastFight(fight: NonNullable<TitleReign['last_fight']>) {
  const outcome = fight.result === 'win' ? 'Win' : fight.result === 'loss' ? 'Loss' : 'No result'
  const method = fight.method ? ` by ${RESULT_METHODS[fight.method] ?? fight.method}` : ''
  const round = fight.round ? ` (R${fight.round})` : ''
  const date = formatFightDate(fight.date)
  return `${outcome}${method}${round}${date ? ` · ${date}` : ''}`
}

function CurrentChampionsSection({ reigns }: { reigns: TitleReign[] }) {
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
            <button
              key={reign.division}
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
                <FighterBadges badges={profile?.badges} className="mt-1.5" />
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
          )
        })}
      </div>
    </section>
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
          <button
            key={champion.champion}
            type="button"
            onClick={() => openProfile(champion.champion)}
            aria-label={`${champion.champion} — view profile`}
            className="surface-card flex w-full min-w-0 cursor-pointer text-left items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-neutral-800/60 focus-visible:bg-neutral-800/60 focus-visible:outline-none"
          >
            <div className="relative shrink-0">
              <FighterAvatar
                name={champion.champion}
                className="h-12 w-12"
                imageUrl={getFighterImageUrl(
                  champion.champion,
                  imageByName,
                  profileByName.get(normalizeFighterName(champion.champion))?.image_url,
                )}
              />
              <span
                className={`type-num absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-md border px-1 text-[10px] leading-none ${
                  index === 0
                    ? 'border-[var(--rule)] bg-[#C8102E] text-white'
                    : 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)]'
                }`}
              >
                {index === 0 ? <Trophy className="h-3 w-3" /> : index + 1}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-semibold text-[#FFFFFF]">{champion.champion}</p>
                {champion.is_current_champion ? (
                  <span className="type-tech rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#C8102E]">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="theme-muted mt-0.5 truncate text-[11px]">{champion.divisions.join(' · ')}</p>
            </div>

            <div className="theme-muted hidden shrink-0 gap-3 text-right text-[11px] sm:flex lg:gap-3.5">
              <Stat label="Days" value={champion.total_days_as_champion.toLocaleString('en-US')} />
              <Stat label="Defenses" value={String(champion.total_defenses)} />
              <Stat label="Reigns" value={String(champion.total_reigns)} />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="data-value text-sm font-bold text-[#FFFFFF]">{value}</p>
      <p className="broadcast-label text-[9px]">{label}</p>
    </div>
  )
}

function RecordCard({ category }: { category: RecordCategory }) {
  const Icon = category.kind === 'positive' ? Flame : ThumbsDown
  const [expanded, setExpanded] = useState(false)
  const visible = category.entries.slice(0, COLLAPSED_ROWS)
  const extra = category.entries.slice(COLLAPSED_ROWS)

  return (
    <article className="surface-card flex flex-col rounded-[18px] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${category.kind === 'positive' ? 'text-[#C8102E]' : 'text-[#999999]'}`} />
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{category.label}</h3>
      </div>

      {category.entries.length ? (
        <>
          <div className="grid">
            {visible.map((entry) => (
              <RecordRow key={`${entry.rank}-${entry.champion}`} entry={entry} unit={category.unit} />
            ))}
          </div>

          {extra.length ? (
            <>
              {/* grid-rows 0fr -> 1fr animates the height without measuring it */}
              <div
                id={`record-extra-${category.key}`}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden" inert={!expanded}>
                  {extra.map((entry) => (
                    <RecordRow key={`${entry.rank}-${entry.champion}`} entry={entry} unit={category.unit} />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls={`record-extra-${category.key}`}
                className="type-tech mt-auto flex items-center justify-center gap-1 border-t border-white/8 pt-2 text-[10px] text-[#999999] transition hover:text-[var(--accent-red)]"
              >
                {expanded ? 'Show less' : `View top ${category.entries.length}`}
                <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[#999999]">No entries in this category.</p>
      )}
    </article>
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
        {entry.division ? <p className="theme-muted truncate text-[9.5px] leading-tight">{entry.division}</p> : null}
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[#FFFFFF]">
        {entry.value} <span className="theme-muted text-[10px] font-normal">{unit}</span>
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

      <div className="grid gap-2.5">
        {category.entries.map((entry) => {
          const profile = profileByName.get(normalizeFighterName(entry.champion))
          const record = profile ? `${profile.wins ?? 0}-${profile.losses ?? 0}-${profile.draws ?? 0}` : null
          const divisions = (entry.division ?? '').split(', ').filter(Boolean)
          const fights = entry.title_fights ?? []
          const isOpen = openName === entry.champion
          const heldBelts = current.filter((reign) => normalizeFighterName(reign.champion) === normalizeFighterName(entry.champion))
          const panelId = `title-fights-${entry.rank}`
          const summary = [
            `${fights.length} title ${fights.length === 1 ? 'fight' : 'fights'}`,
            `${fights.filter((fight) => fight.role === 'won_title').length} belts won`,
            `${fights.filter((fight) => fight.role === 'defense').length} defenses`,
          ].join(' · ')

          return (
            <div key={entry.champion}>
              <button
                type="button"
                onClick={() => setOpenName(isOpen ? null : entry.champion)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="metric-tile group grid w-full min-w-0 cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-3 py-3 text-left sm:px-4 md:grid-cols-[170px_auto_1fr_auto] md:gap-x-6"
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  {divisions.map((division) => (
                    <p key={division} className="text-base font-bold uppercase leading-tight tracking-wide text-[#FFFFFF]">
                      {division}
                    </p>
                  ))}
                  <p className="theme-muted mt-0.5 text-xs font-semibold">{entry.value} divisions</p>
                </div>

                <FighterAvatar
                  name={entry.champion}
                  imageUrl={getFighterImageUrl(entry.champion, imageByName, profile?.image_url)}
                  highlight
                  className="h-28 w-24 sm:h-32 sm:w-28"
                />

                <div className="min-w-0">
                  {profile?.nickname ? (
                    <p className="broadcast-label truncate text-[11px] text-[#999999]">&ldquo;{profile.nickname}&rdquo;</p>
                  ) : null}
                  <p className="type-display mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-bold uppercase leading-none text-[#FFFFFF] sm:text-3xl">
                    {profile ? <FlagList fighter={profile} className="h-4 w-6" /> : null}
                    <span className="min-w-0 break-words">{entry.champion}</span>
                  </p>
                  <FighterBadges badges={profile?.badges} className="mt-1.5" />
                  {heldBelts.length ? (
                    <ul aria-label="Current titles" className="mt-1.5 flex flex-wrap gap-1">
                      {heldBelts.map((reign) => (
                        <li
                          key={reign.division}
                          className="inline-flex items-center gap-1 border-2 border-[#0E0E0E] bg-[#F2C230] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0E0E0E]"
                        >
                          <ChampionBelt className="h-3 w-3" />
                          Current {reign.title_type === 'interim' ? 'interim ' : ''}
                          {reign.division} champion
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {record ? (
                    <p className="mt-1.5 text-sm text-[#FFFFFF]">
                      <span className="font-bold">{record}</span> <span className="theme-muted">(W-L-D)</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-[13px] leading-5 text-[#FFFFFF]">
                    <span className="font-bold">Title history:</span> {summary}
                  </p>
                </div>

                <span
                  className={`ghost-action col-span-2 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition group-hover:!bg-[#F2C230] group-hover:text-[#0E0E0E] md:col-span-1 ${
                    isOpen ? '!bg-[var(--rule)] !text-[var(--card-bg)]' : 'text-[#FFFFFF]'
                  }`}
                >
                  {isOpen ? 'Hide title fights' : 'View title fights'}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

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
            <dt className="theme-muted mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">{stat.label}</dt>
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
          <p className="theme-muted mt-0.5 text-[10px] font-semibold uppercase leading-tight">{date?.replace(/,\s*\d{4}$/, '')}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${ROLE_STYLES[fight.role]}`}>
              {fight.role === 'won_title' ? <ChampionBelt className="h-3 w-3" /> : null}
              {fight.role === 'defense' ? <Shield className="h-3 w-3" /> : null}
              {fight.label}
            </span>
            {fight.title_type === 'interim' && !/interim/i.test(fight.label) ? (
              <span className="border border-[var(--rule)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFFFFF]">Interim</span>
            ) : null}
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-bold text-[#FFFFFF]">
            <span className={`type-num grid h-5 min-w-5 shrink-0 place-items-center px-1 text-[10px] leading-none ${result.className}`} title={result.name}>
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
