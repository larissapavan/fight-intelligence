import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarDays, ChevronDown, Gamepad2, Hash, MapPin, Search, Swords } from 'lucide-react'

import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { CardSimulatorModal } from '../shared/components/CardSimulatorModal'
import { LatestNewsCard } from '../shared/components/LatestNewsCard'
import { FightMatchupCard } from '../shared/components/FightMatchupCard'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useEvents } from '../shared/hooks/useEvents'
import { useUpcomingEvents } from '../shared/hooks/useUpcomingEvents'
import { useUpcomingPicks } from '../shared/hooks/useUpcomingPicks'
import type { EventSummary, FightResult, UpcomingPick } from '../shared/types/api'

const NUMBERED_EVENT_PATTERN = /^UFC \d+/

const METHOD_LABELS_EN: Record<string, string> = {
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  'KO/TKO': 'Knockout',
  SUB: 'Submission',
  DQ: 'Disqualification',
  'NO CONTEST': 'No Contest',
}

const METHOD_LABELS_PT: Record<string, string> = {
  'U-DEC': 'Decisão Unânime',
  'S-DEC': 'Decisão Dividida',
  'M-DEC': 'Decisão Majoritária',
  'KO/TKO': 'Nocaute (KO/TKO)',
  SUB: 'Finalização',
  DQ: 'Desqualificação',
  'NO CONTEST': 'Sem Resultado (NC)',
}

const MONTH_KEYS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12'
]

/** Opens a fighter's profile on top of the page, so closing it leaves the reader on the same card. */
const OpenProfileContext = createContext<(name: string) => void>(() => undefined)

export function Events() {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const { events, loading, error } = useEvents()
  const upcoming = useUpcomingEvents()
  const pickFor = useUpcomingPicks()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [profileName, setProfileName] = useState<string | null>(null)
  const [simulatingEvent, setSimulatingEvent] = useState<EventSummary | null>(null)

  const years = useMemo(() => {
    const found = new Set<string>()
    for (const event of events) {
      if (event.date) found.add(event.date.slice(0, 4))
    }
    return Array.from(found).sort((a, b) => Number(b) - Number(a))
  }, [events])

  const isSearching = query.trim() !== '' || yearFilter !== 'ALL' || monthFilter !== 'ALL'

  const matchesFilters = useCallback(
    (event: EventSummary) => {
      const term = query.trim().toLowerCase()
      const formattedDate = formatEventDate(event.date, i18n.language).toLowerCase()
      const matchesQuery =
        !term ||
        event.name.toLowerCase().includes(term) ||
        formattedDate.includes(term) ||
        (event.date ?? '').includes(term) ||
        (event.location ?? '').toLowerCase().includes(term)

      const matchesYear = yearFilter === 'ALL' || event.date?.slice(0, 4) === yearFilter
      const matchesMonth =
        monthFilter === 'ALL' || event.date?.slice(5, 7) === monthFilter

      return matchesQuery && matchesYear && matchesMonth
    },
    [query, yearFilter, monthFilter, i18n.language],
  )

  const visibleEvents = useMemo(() => events.filter(matchesFilters), [events, matchesFilters])
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

  const results = (
    <>
      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p>
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
              title={t('events.numberedEvents')}
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
              title={t('events.fightNight')}
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
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">
            {t('events.noEventsFound')}
          </p>
          <p className="mt-2 text-sm text-[#999999]">{t('events.noEventsSub')}</p>
        </div>
      )}
    </>
  )

  const getMonthLabel = (m: string) => {
    const d = new Date(2024, Number(m) - 1, 15)
    return d.toLocaleString(i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'long' })
  }

  return (
    <OpenProfileContext.Provider value={setProfileName}>
      <div className="space-y-6 sm:space-y-8">
        <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
            <SectionHeading
              level={1}
              eyebrow={t('events.eyebrow')}
              title={t('events.title')}
              description={t('events.description')}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <SummaryTile label={t('events.eventsCount')} value={`${visibleEvents.length}`} />
              <SummaryTile label={t('events.fightsTracked')} value={totalFights.toLocaleString(i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US')} />
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_180px_180px]">
            <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
              <Search className="h-4 w-4 text-[#C8102E]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('events.searchPlaceholder')}
                className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              aria-label={isPt ? 'Filtrar por ano' : 'Filter by year'}
              className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
            >
              <option value="ALL">{t('events.allYears')}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              aria-label={isPt ? 'Filtrar por mês' : 'Filter by month'}
              className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
            >
              <option value="ALL">{t('events.allMonths')}</option>
              {MONTH_KEYS.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {isSearching ? <div className="space-y-6">{results}</div> : null}

        <UpcomingEventsSection
          events={visibleUpcoming}
          loading={upcoming.loading}
          error={upcoming.error}
          openEvents={openEvents}
          onToggle={toggleEvent}
          onSimulate={setSimulatingEvent}
        />

        {isSearching ? null : results}

        {isSearching ? null : <LatestNewsCard quiet />}

        {profileName ? (
          <FighterProfileModal
            key={profileName}
            name={profileName}
            onClose={() => setProfileName(null)}
            onSelectFighter={setProfileName}
          />
        ) : null}

        {simulatingEvent ? (
          <CardSimulatorModal
            event={simulatingEvent}
            pickFor={pickFor}
            onClose={() => setSimulatingEvent(null)}
            onOpenFighter={setProfileName}
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
  onSimulate,
}: {
  events: EventSummary[]
  loading: boolean
  error: string | null
  openEvents: Set<string>
  onToggle: (key: string) => void
  onSimulate?: (event: EventSummary) => void
}) {
  const { t } = useTranslation()
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
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{t('events.upcomingSection')}</h2>
        <span className="theme-muted text-xs">({events.length})</span>
      </div>
      <div className="grid gap-3">
        {events.map((event) => {
          const key = event.event_url ?? event.name
          return (
            <EventCard
              key={key}
              event={event}
              isOpen={openEvents.has(key)}
              onToggle={() => onToggle(key)}
              pickFor={pickFor}
              onSimulate={onSimulate}
            />
          )
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
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{title}</h2>
        <span className="theme-muted text-xs">({events.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {events.length ? (
            <div className="grid gap-3">
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
  onSimulate,
}: {
  event: EventSummary
  isOpen: boolean
  onToggle: () => void
  pickFor?: (event: string, fighterA: string, fighterB: string) => UpcomingPick | undefined
  onSimulate?: (event: EventSummary) => void
}) {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <article className="surface-card overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition duration-150 hover:bg-white/[0.03]"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">{event.name}</h2>
          <div className="theme-muted mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatEventDate(event.date, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Swords className="h-3 w-3" />
              {event.fight_count} {t('events.fights')}
            </span>
          </div>
        </div>
        <ChevronDown className={`theme-muted h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {event.location ? (
              <p className="theme-muted flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </p>
            ) : <span />}

            {pickFor && event.fights.length && onSimulate ? (
              <button
                type="button"
                onClick={() => onSimulate(event)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#C8102E]/40 bg-[#C8102E]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#C8102E]"
              >
                <Gamepad2 className="h-3.5 w-3.5 text-[#F2C230]" />
                {isPt ? 'Simular Card (Você vs IA)' : 'Simulate Card (You vs AI)'}
              </button>
            ) : null}
          </div>

          {event.fights.length ? (
            <div className="grid gap-3">
              {event.fights.map((fight, index) => (
                <FightRow key={fight.fight_url ?? index} eventName={event.name} fight={fight} pick={pickFor?.(event.name, fight.fighter_1, fight.fighter_2)} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#999999]">{t('common.noResults')}</p>
          )}
        </div>
      ) : null}
    </article>
  )
}

function FightRow({ eventName, fight, pick }: { eventName: string; fight: FightResult; pick?: UpcomingPick }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const openProfile = useContext(OpenProfileContext)
  const details = [
    [formatMethod(fight, isPt), fight.round ? `R${fight.round}` : null, fight.time, fight.num_rounds ? `${fight.num_rounds} rounds` : null]
      .filter(Boolean)
      .join(' · '),
    fight.referee ? (isPt ? `Árbitro: ${fight.referee}` : `Referee: ${fight.referee}`) : null,
    fight.result?.startsWith('Decision') && fight.result_details ? `${fight.result} · ${fight.result_details}` : null,
  ].filter((line): line is string => Boolean(line))

  return <FightMatchupCard fight={fight} pick={pick} eventName={eventName} onOpenFighter={openProfile} details={details} />
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[#999999]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
    </div>
  )
}

function formatEventDate(date: string | null, lang: string = 'en-US'): string {
  if (!date) return lang === 'pt-BR' ? 'Data a confirmar' : 'Date unknown'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(lang === 'pt-BR' ? 'pt-BR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMethod(fight: FightResult, isPt = false): string {
  if (!fight.method) return isPt ? 'Resultado a definir' : 'Result pending'
  const labels = isPt ? METHOD_LABELS_PT : METHOD_LABELS_EN
  const label = labels[fight.method] ?? fight.method
  return fight.method_detail ? `${label} (${fight.method_detail})` : label
}
