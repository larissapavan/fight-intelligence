import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CalendarClock, CalendarDays, ChevronDown, Hash, MapPin, Search, Swords, Trophy } from 'lucide-react'

import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { LatestNewsCard } from '../shared/components/LatestNewsCard'
import { PickChip } from '../shared/components/PickChip'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { TitleFightBadge } from '../shared/components/FighterBadges'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useEvents } from '../shared/hooks/useEvents'
import { useFighterLookup } from '../shared/hooks/useFighterLookup'
import { useUpcomingEvents } from '../shared/hooks/useUpcomingEvents'
import { useUpcomingPicks } from '../shared/hooks/useUpcomingPicks'
import type { EventSummary, FightResult, UpcomingPick } from '../shared/types/api'

const NUMBERED_EVENT_PATTERN = /^UFC \d+/

const METHOD_LABELS: Record<string, string> = {
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  'KO/TKO': 'Knockout',
  SUB: 'Submission',
  DQ: 'Disqualification',
  'NO CONTEST': 'No Contest',
}

const ALL_YEARS = 'All years'
const ALL_MONTHS = 'All months'
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Opens a fighter's profile on top of the page, so closing it leaves the reader on the same card. */
const OpenProfileContext = createContext<(name: string) => void>(() => undefined)

export function Events() {
  const { events, loading, error } = useEvents()
  const upcoming = useUpcomingEvents()
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState(ALL_YEARS)
  const [monthFilter, setMonthFilter] = useState(ALL_MONTHS)
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [profileName, setProfileName] = useState<string | null>(null)

  const years = useMemo(() => {
    const found = new Set<string>()
    for (const event of events) {
      if (event.date) found.add(event.date.slice(0, 4))
    }
    return [ALL_YEARS, ...Array.from(found).sort((a, b) => Number(b) - Number(a))]
  }, [events])

  const isSearching = query.trim() !== '' || yearFilter !== ALL_YEARS || monthFilter !== ALL_MONTHS

  const matchesFilters = useCallback(
    (event: EventSummary) => {
      const term = query.trim().toLowerCase()
      const formattedDate = formatEventDate(event.date).toLowerCase()
      const matchesQuery =
        !term ||
        event.name.toLowerCase().includes(term) ||
        formattedDate.includes(term) ||
        (event.date ?? '').includes(term) ||
        (event.location ?? '').toLowerCase().includes(term)

      const matchesYear = yearFilter === ALL_YEARS || event.date?.slice(0, 4) === yearFilter
      const matchesMonth =
        monthFilter === ALL_MONTHS || MONTH_NAMES[Number(event.date?.slice(5, 7)) - 1] === monthFilter

      return matchesQuery && matchesYear && matchesMonth
    },
    [query, yearFilter, monthFilter],
  )

  const visibleEvents = useMemo(() => events.filter(matchesFilters), [events, matchesFilters])
  // While searching, the upcoming cards are filtered by the same search instead of always showing all of them.
  const visibleUpcoming = useMemo(
    () => (isSearching ? upcoming.events.filter(matchesFilters) : upcoming.events),
    [isSearching, upcoming.events, matchesFilters],
  )

  const totalFights = useMemo(() => events.reduce((sum, event) => sum + event.fight_count, 0), [events])

  const numberedEvents = useMemo(
    () => visibleEvents.filter((event) => NUMBERED_EVENT_PATTERN.test(event.name)),
    [visibleEvents],
  )
  const fightNightEvents = useMemo(
    () => visibleEvents.filter((event) => !NUMBERED_EVENT_PATTERN.test(event.name)),
    [visibleEvents],
  )

  const toggleEvent = (key: string) => {
    setOpenEvents((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // The archive results (or the empty state). While searching they go right under the filters, above the upcoming
  // cards and the news, so a match is never buried at the bottom of the page.
  const results = (
    <>
      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
      ) : null}

      {loading ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[110px]" />
          ))}
        </section>
      ) : visibleEvents.length ? (
        <div className="space-y-3 sm:space-y-4">
          {isSearching && numberedEvents.length === 0 ? null : (
            <EventGroup
              groupKey="numbered"
              title="UFC Numbered Events"
              icon={Hash}
              events={numberedEvents}
              isOpen={openGroups.has('numbered') || isSearching}
              onToggleGroup={toggleGroup}
              openEvents={openEvents}
              onToggle={toggleEvent}
            />
          )}
          {isSearching && fightNightEvents.length === 0 ? null : (
            <EventGroup
              groupKey="fight-night"
              title="UFC Fight Night"
              icon={Swords}
              events={fightNightEvents}
              isOpen={openGroups.has('fight-night') || isSearching}
              onToggleGroup={toggleGroup}
              openEvents={openEvents}
              onToggle={toggleEvent}
            />
          )}
        </div>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">No events found</p>
          <p className="mt-2 text-sm text-[#999999]">Adjust the search to find another card.</p>
        </div>
      )}
    </>
  )

  return (
    <OpenProfileContext.Provider value={setProfileName}>
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            eyebrow="Event archive"
            title="UFC fight cards"
            description="Search the full event history and open a card to see every fight, the winner, method and round."
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryTile label="Events" value={`${visibleEvents.length}`} />
            <SummaryTile label="Fights tracked" value={totalFights.toLocaleString('en-US')} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_180px_180px]">
          <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-[#C8102E]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search event, date, or location (e.g. "UFC 295" or "Nov 2023")'
              className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            aria-label="Filter by year"
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            aria-label="Filter by month"
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            {[ALL_MONTHS, ...MONTH_NAMES].map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </section>

      {isSearching ? results : null}

      <UpcomingEventsSection
        events={visibleUpcoming}
        loading={upcoming.loading}
        error={upcoming.error}
        openEvents={openEvents}
        onToggle={toggleEvent}
      />

      {isSearching ? null : <LatestNewsCard />}

      {isSearching ? null : results}

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

function UpcomingEventsSection({
  events,
  loading,
  error,
  openEvents,
  onToggle,
}: {
  events: EventSummary[]
  loading: boolean
  error: string | null
  openEvents: Set<string>
  onToggle: (key: string) => void
}) {
  const pickFor = useUpcomingPicks()

  if (loading) {
    return <LoadingSkeleton className="h-[80px]" />
  }

  if (error || events.length === 0) {
    return null
  }

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Upcoming Confirmed Events</h2>
        <span className="theme-muted text-xs">({events.length})</span>
      </div>
      <div className="grid gap-1.5">
        {events.map((event) => {
          const key = event.event_url ?? event.name
          return <EventCard key={key} event={event} isOpen={openEvents.has(key)} onToggle={() => onToggle(key)} pickFor={pickFor} />
        })}
      </div>
    </section>
  )
}

function EventGroup({
  groupKey,
  title,
  icon: Icon,
  events,
  isOpen,
  onToggleGroup,
  openEvents,
  onToggle,
}: {
  groupKey: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  events: EventSummary[]
  isOpen: boolean
  onToggleGroup: (key: string) => void
  openEvents: Set<string>
  onToggle: (key: string) => void
}) {
  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => onToggleGroup(groupKey)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03] sm:px-4"
        aria-expanded={isOpen}
      >
        <Icon className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">{title}</h2>
        <span className="theme-muted text-xs">({events.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {events.length ? (
            <div className="grid gap-1.5">
              {events.map((event) => {
                const key = event.event_url ?? event.name
                return (
                  <EventCard key={key} event={event} isOpen={openEvents.has(key)} onToggle={() => onToggle(key)} />
                )
              })}
            </div>
          ) : (
            <div className="rounded-[16px] px-4 py-4 text-center text-sm text-[#999999]">
              No matches in this section.
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function EventCard({
  event,
  isOpen,
  onToggle,
  pickFor,
}: {
  event: EventSummary
  isOpen: boolean
  onToggle: () => void
  pickFor?: (event: string, fighterA: string, fighterB: string) => UpcomingPick | undefined
}) {
  return (
    <article className="surface-card overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition duration-150 hover:bg-white/[0.03]"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{event.name}</h2>
          <div className="theme-muted mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatEventDate(event.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Swords className="h-3 w-3" />
              {event.fight_count} {event.fight_count === 1 ? 'fight' : 'fights'}
            </span>
          </div>
        </div>
        <ChevronDown className={`theme-muted h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3">
          {event.location ? (
            <p className="theme-muted mb-2.5 flex items-center gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          ) : null}
          {event.fights.length ? (
            <div className="grid gap-2">
              {event.fights.map((fight, index) => (
                <FightRow key={fight.fight_url ?? index} fight={fight} pick={pickFor?.(event.name, fight.fighter_1, fight.fighter_2)} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#999999]">No fight data available for this card yet.</p>
          )}
        </div>
      ) : null}
    </article>
  )
}

function FightRow({ fight, pick }: { fight: FightResult; pick?: UpcomingPick }) {
  const fighter1Won = fight.winner !== null && fight.winner === fight.fighter_1
  const fighter2Won = fight.winner !== null && fight.winner === fight.fighter_2

  return (
    <div className="metric-tile rounded-2xl px-3 py-2.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <FighterName name={fight.fighter_1} won={fighter1Won} align="right" />
        <span className="broadcast-label px-1 text-[10px] text-[#999999]">vs</span>
        <FighterName name={fight.fighter_2} won={fighter2Won} align="left" />
      </div>
      <div className="theme-muted mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
        <TitleFightBadge fight={fight} />
        <PickChip pick={pick} />
        {fight.weight_class ? <span className="selector-chip">{fight.weight_class}</span> : null}
        <span>{formatMethod(fight)}</span>
        {fight.round ? <span>R{fight.round}</span> : null}
        {fight.time ? <span>{fight.time}</span> : null}
        {fight.num_rounds ? <span>{fight.num_rounds} rounds</span> : null}
      </div>
      {fight.referee || fight.result_details ? (
        <div className="theme-muted mt-1.5 space-y-0.5 text-center text-[11px] leading-4">
          {fight.referee ? <p>Referee: {fight.referee}</p> : null}
          {fight.result?.startsWith('Decision') && fight.result_details ? <p>{fight.result} · {fight.result_details}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function FighterName({ name, won, align }: { name: string; won: boolean; align: 'left' | 'right' }) {
  const openProfile = useContext(OpenProfileContext)
  const profile = useFighterLookup()(name)
  const side = align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  const label = (
    <>
      {align === 'right' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[#C8102E]" /> : null}
      <span className={`truncate text-sm ${won ? 'font-bold text-[#FFFFFF]' : 'text-[#999999]'}`}>{name}</span>
      {align === 'left' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[#C8102E]" /> : null}
    </>
  )

  // Fighters we have a profile for open it on this page; anyone else stays plain text.
  return profile ? (
    <button
      type="button"
      onClick={() => openProfile(profile.name)}
      aria-label={`${name}. View profile`}
      className={`flex min-w-0 cursor-pointer items-center gap-1.5 px-1.5 py-1 transition hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none ${side}`}
    >
      {label}
    </button>
  ) : (
    <span className={`flex min-w-0 items-center gap-1.5 px-1.5 py-1 ${side}`}>{label}</span>
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

function formatEventDate(date: string | null): string {
  if (!date) return 'Date unknown'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMethod(fight: FightResult): string {
  if (!fight.method) return 'Result pending'
  const label = METHOD_LABELS[fight.method] ?? fight.method
  return fight.method_detail ? `${label} (${fight.method_detail})` : label
}
