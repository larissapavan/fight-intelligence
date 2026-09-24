import { useMemo, useState } from 'react'
import { CalendarClock, CalendarDays, ChevronDown, Hash, MapPin, Search, Swords, Trophy } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useEvents } from '../shared/hooks/useEvents'
import { useUpcomingEvents } from '../shared/hooks/useUpcomingEvents'
import type { EventSummary, FightResult } from '../shared/types/api'

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

export function Events() {
  const { events, loading, error } = useEvents()
  const upcoming = useUpcomingEvents()
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState(ALL_YEARS)
  const [monthFilter, setMonthFilter] = useState(ALL_MONTHS)
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set())

  const years = useMemo(() => {
    const found = new Set<string>()
    for (const event of events) {
      if (event.date) found.add(event.date.slice(0, 4))
    }
    return [ALL_YEARS, ...Array.from(found).sort((a, b) => Number(b) - Number(a))]
  }, [events])

  const visibleEvents = useMemo(() => {
    const term = query.trim().toLowerCase()
    return events.filter((event) => {
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
    })
  }, [events, query, yearFilter, monthFilter])

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

  return (
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
            <Search className="h-4 w-4 text-[#E81B23]" />
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

      <UpcomingEventsSection
        events={upcoming.events}
        loading={upcoming.loading}
        error={upcoming.error}
        openEvents={openEvents}
        onToggle={toggleEvent}
      />

      {error ? (
        <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
      ) : null}

      {loading ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[110px]" />
          ))}
        </section>
      ) : visibleEvents.length ? (
        <div className="space-y-3 sm:space-y-4">
          <EventGroup
            title="UFC Numbered Events"
            icon={Hash}
            events={numberedEvents}
            openEvents={openEvents}
            onToggle={toggleEvent}
          />
          <EventGroup
            title="UFC Fight Night"
            icon={Swords}
            events={fightNightEvents}
            openEvents={openEvents}
            onToggle={toggleEvent}
          />
        </div>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">No events found</p>
          <p className="mt-2 text-sm text-[#999999]">Adjust the search to find another card.</p>
        </div>
      )}
    </div>
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
  if (loading) {
    return <LoadingSkeleton className="h-[80px]" />
  }

  if (error || events.length === 0) {
    return null
  }

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#E81B23]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Upcoming Confirmed Events</h2>
        <span className="theme-muted text-xs">({events.length})</span>
      </div>
      <div className="grid gap-2.5">
        {events.map((event) => {
          const key = event.event_url ?? event.name
          return <EventCard key={key} event={event} isOpen={openEvents.has(key)} onToggle={() => onToggle(key)} />
        })}
      </div>
    </section>
  )
}

function EventGroup({
  title,
  icon: Icon,
  events,
  openEvents,
  onToggle,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  events: EventSummary[]
  openEvents: Set<string>
  onToggle: (key: string) => void
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-[#E81B23]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">{title}</h2>
        <span className="theme-muted text-xs">({events.length})</span>
      </div>

      {events.length ? (
        <div className="grid gap-2.5">
          {events.map((event) => {
            const key = event.event_url ?? event.name
            return (
              <EventCard key={key} event={event} isOpen={openEvents.has(key)} onToggle={() => onToggle(key)} />
            )
          })}
        </div>
      ) : (
        <div className="surface-card rounded-[16px] px-4 py-4 text-center text-sm text-[#999999]">
          No matches in this section.
        </div>
      )}
    </section>
  )
}

function EventCard({ event, isOpen, onToggle }: { event: EventSummary; isOpen: boolean; onToggle: () => void }) {
  return (
    <article className="surface-card overflow-hidden rounded-[18px]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 px-3 py-3 text-left transition duration-150 hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-4"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold uppercase tracking-[0.02em] text-[#FFFFFF] sm:text-xl">
            {event.name}
          </h2>
          <div className="theme-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatEventDate(event.date)}
            </span>
            {event.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5" />
              {event.fight_count} {event.fight_count === 1 ? 'fight' : 'fights'}
            </span>
          </div>
        </div>
        <ChevronDown className={`theme-muted h-5 w-5 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {event.fights.length ? (
            <div className="grid gap-2">
              {event.fights.map((fight, index) => (
                <FightRow key={fight.fight_url ?? index} fight={fight} />
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

function FightRow({ fight }: { fight: FightResult }) {
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
        {fight.weight_class ? <span className="selector-chip">{fight.weight_class}</span> : null}
        <span>{formatMethod(fight)}</span>
        {fight.round ? <span>R{fight.round}</span> : null}
        {fight.time ? <span>{fight.time}</span> : null}
      </div>
    </div>
  )
}

function FighterName({ name, won, align }: { name: string; won: boolean; align: 'left' | 'right' }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>
      {align === 'right' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[#E81B23]" /> : null}
      <span className={`truncate text-sm ${won ? 'font-bold text-[#FFFFFF]' : 'text-[#999999]'}`}>{name}</span>
      {align === 'left' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[#E81B23]" /> : null}
    </span>
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
