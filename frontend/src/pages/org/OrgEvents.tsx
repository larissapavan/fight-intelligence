import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, CalendarDays, ChevronDown, MapPin, Search, Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFightRow } from '../../shared/components/OrgFightRow'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, localeTag } from '../../i18n/lang'
import { formatDate } from '../../shared/data/orgFormat'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgEvents, useOrgUpcomingEvents } from '../../shared/hooks/useOrgData'
import type { OrgEvent } from '../../shared/types/api'

/** Today's card still counts as to come until its results are in. */
function isUpcoming(date: string | null) {
  return date !== null && date >= new Date().toISOString().slice(0, 10)
}

function eventKey(event: OrgEvent) {
  return event.slug ?? event.event_url ?? event.name
}

export function OrgEvents() {
  const { i18n } = useTranslation()
  const allYearsLabel = L(i18n.language, 'Todos os anos', 'All years', 'Toutes les années')

  const org = useOrg()
  const { events, loading, error } = useOrgEvents(org.id)
  const upcoming = useOrgUpcomingEvents(org.id)
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const [profileName, setProfileName] = useState<string | null>(null)

  const years = useMemo(() => {
    const found = new Set<string>()
    for (const event of events) if (event.date) found.add(event.date.slice(0, 4))
    return Array.from(found).sort((a, b) => Number(b) - Number(a))
  }, [events])

  const isSearching = query.trim() !== '' || yearFilter !== 'ALL'

  const matchesFilters = useCallback(
    (event: OrgEvent) => {
      const term = query.trim().toLowerCase()
      const matchesQuery =
        !term ||
        event.name.toLowerCase().includes(term) ||
        (event.circuit ?? '').toLowerCase().includes(term) ||
        formatDate(event.date, true, i18n.language).toLowerCase().includes(term) ||
        (event.date ?? '').includes(term) ||
        (event.location ?? '').toLowerCase().includes(term) ||
        event.fights.some((fight) => fight.fighter_1.toLowerCase().includes(term) || fight.fighter_2.toLowerCase().includes(term))
      return matchesQuery && (yearFilter === 'ALL' || event.date?.slice(0, 4) === yearFilter)
    },
    [query, yearFilter, i18n.language],
  )

  const visibleEvents = useMemo(() => events.filter(matchesFilters), [events, matchesFilters])
  const visibleUpcoming = useMemo(() => (isSearching ? upcoming.events.filter(matchesFilters) : upcoming.events), [isSearching, upcoming.events, matchesFilters])
  const totalFights = useMemo(() => events.reduce((sum, event) => sum + event.fight_count, 0), [events])

  const byYear = useMemo(() => {
    const groups = new Map<string, OrgEvent[]>()
    for (const event of visibleEvents) {
      const year = event.date?.slice(0, 4) ?? L(i18n.language, 'Sem data', 'Unknown', 'Date inconnue')
      groups.set(year, [...(groups.get(year) ?? []), event])
    }
    return Array.from(groups.entries()).sort(([a], [b]) => Number(b) - Number(a))
  }, [visibleEvents, i18n.language])

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  const latestYear = byYear[0]?.[0]

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            level={1}
            eyebrow={L(i18n.language, 'Histórico de Eventos', 'Event archive', 'Historique des événements')}
            title={L(i18n.language, `Cards e Lutas do ${org.shortName}`, `${org.shortName} fight cards`, `Cartes et combats ${org.shortName}`)}
            description={L(
              i18n.language,
              'Histórico completo de eventos. Abra o card para ver todos os confrontos, vencedores, método e round.',
              'Search the full event history and open a card to see every fight, the winner, method and round.',
              'Historique complet des événements. Ouvrez une carte pour voir chaque combat, le vainqueur, la méthode et le round.',
            )}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryTile label={L(i18n.language, 'Eventos', 'Events', 'Événements')} value={`${visibleEvents.length}`} />
            <SummaryTile label={L(i18n.language, 'Lutas Catalogadas', 'Fights tracked', 'Combats suivis')} value={totalFights.toLocaleString(localeTag(i18n.language))} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_180px]">
          <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-[var(--accent-red)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={L(i18n.language, 'Buscar por evento, lutador, data ou local...', 'Search event, fighter, date or location', 'Chercher un événement, un combattant, une date ou un lieu...')}
              aria-label={L(i18n.language, 'Buscar eventos', 'Search events', 'Chercher des événements')}
              className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            aria-label={L(i18n.language, 'Filtrar por ano', 'Filter by year', 'Filtrer par année')}
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="ALL">{allYearsLabel}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </section>

      {upcoming.loading ? (
        <LoadingSkeleton className="h-[80px]" />
      ) : visibleUpcoming.length ? (
        <section className="surface-card rounded-[20px] p-3 sm:p-4" aria-label="Upcoming events">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[var(--accent-red)]" />
            <h2 className="broadcast-label text-xs text-[var(--text-main)]">
              {L(i18n.language, 'Próximos Cards & Eventos', 'Upcoming events', 'Prochains cards et événements')}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">({visibleUpcoming.length})</span>
          </div>
          <div className="grid gap-3">
            {visibleUpcoming.map((event, index) => {
              const key = eventKey(event)
              return (
                <EventCard
                  key={key}
                  org={org.id}
                  event={event}
                  isOpen={openEvents.has(key) !== (index === 0 && !isSearching)}
                  onToggle={() => setOpenEvents((current) => toggle(current, key))}
                  onOpenFighter={setProfileName}
                />
              )
            })}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[110px]" />
          ))}
        </section>
      ) : byYear.length ? (
        <div className="space-y-3 sm:space-y-4">
          {byYear.map(([year, yearEvents]) => {
            const isOpen = openYears.has(year) !== (isSearching || year === latestYear)
            return (
              <section key={year} className="surface-card overflow-hidden rounded-[20px]">
                <button
                  type="button"
                  onClick={() => setOpenYears((current) => toggle(current, year))}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03] sm:px-4"
                  aria-expanded={isOpen}
                >
                  <Swords className="h-4 w-4 text-[var(--accent-red)]" />
                  <h2 className="broadcast-label text-xs text-[var(--text-main)]">{year}</h2>
                  <span className="text-xs text-[var(--text-muted)]">({yearEvents.length})</span>
                  <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-[var(--text-muted)] transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen ? (
                  <div className="grid gap-3 border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
                    {yearEvents.map((event) => {
                      const key = eventKey(event)
                      return (
                        <EventCard
                          key={key}
                          org={org.id}
                          event={event}
                          isOpen={openEvents.has(key)}
                          onToggle={() => setOpenEvents((current) => toggle(current, key))}
                          onOpenFighter={setProfileName}
                        />
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">
            {L(i18n.language, 'Nenhum evento encontrado', 'No events found', 'Aucun événement trouvé')}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {L(i18n.language, 'Ajuste os filtros para encontrar outro card.', 'Adjust the search to find another card.', 'Ajustez les filtres pour trouver une autre carte.')}
          </p>
        </div>
      )}

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={() => setProfileName(null)} onSelectFighter={setProfileName} /> : null}
    </div>
  )
}

function EventCard({
  org,
  event,
  isOpen,
  onToggle,
  onOpenFighter,
}: {
  org: string
  event: OrgEvent
  isOpen: boolean
  onToggle: () => void
  onOpenFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()
  return (
    <article className="surface-card overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition duration-150 hover:bg-white/[0.03]"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">{event.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(event.date, true, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Swords className="h-3 w-3" />
              {event.fight_count} {event.fight_count === 1 ? L(i18n.language, 'luta', 'fight', 'combat') : L(i18n.language, 'lutas', 'fights', 'combats')}
            </span>
            {event.circuit && event.circuit !== 'PFL' ? <span className="selector-chip !px-1.5 !py-0 text-[11px] text-[var(--text-main)]">{event.circuit}</span> : null}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line-soft)] px-3 py-3">
          {event.location ? (
            <p className="mb-2.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          ) : null}
          {event.fights.length ? (
            <div className="grid gap-3">
              {event.fights.map((fight, index) => (
                <OrgFightRow key={fight.fight_url ?? index} org={org} fight={fight} scheduled={isUpcoming(event.date)} onOpenFighter={onOpenFighter} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              {L(i18n.language, 'Nenhuma luta detalhada disponível para este card ainda.', 'No fight data available for this card yet.', 'Aucun combat détaillé n\'est encore disponible pour cette carte.')}
            </p>
          )}
        </div>
      ) : null}
    </article>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
    </div>
  )
}
