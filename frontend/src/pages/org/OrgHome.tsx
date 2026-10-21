import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Crown, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFightRow } from '../../shared/components/OrgFightRow'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { compareDivisions, formatDate } from '../../shared/data/orgFormat'
import { orgPath, type OrgConfig } from '../../shared/data/orgs'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgEvents, useOrgFighters, useOrgRankings, useOrgUpcomingEvents } from '../../shared/hooks/useOrgData'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import type { OrgEvent } from '../../shared/types/api'

const LATEST_RESULTS = 4

export function OrgHome() {
  const org = useOrg()
  const { fighters } = useOrgFighters(org.id)
  const past = useOrgEvents(org.id)
  const upcoming = useOrgUpcomingEvents(org.id)
  const { rankings, loading: rankingsLoading } = useOrgRankings(org.id)
  const lookup = useOrgFighterLookup(org.id)
  const [profileName, setProfileName] = useState<string | null>(null)

  const nextEvent = upcoming.events[0] ?? null
  const latestEvent = past.events[0] ?? null
  const fightCount = useMemo(() => past.events.reduce((sum, event) => sum + event.fight_count, 0), [past.events])
  const activeCount = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])

  const champions = useMemo(
    () =>
      rankings
        .filter((category) => !category.is_p4p)
        .map((category) => ({
          division: category.category,
          holders: category.entries.filter((entry) => entry.rank === 0),
        }))
        .sort((a, b) => compareDivisions(a.division, b.division)),
    [rankings],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="page-hero rounded-[20px] px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <SectionHeading level={1} eyebrow={org.name} title={`${org.shortName} fight intelligence`} description={org.tagline} />
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroLink to={orgPath(org, 'events')}>Fight cards</HeroLink>
              <HeroLink to={orgPath(org, 'fighters')}>Fighters</HeroLink>
              <HeroLink to={orgPath(org, 'rankings')}>Rankings</HeroLink>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile label="Fighters" value={fighters.length.toLocaleString('en-US')} note={`${activeCount.toLocaleString('en-US')} active`} />
            <Tile label="Events" value={past.events.length.toLocaleString('en-US')} />
            <Tile label="Fights" value={fightCount.toLocaleString('en-US')} />
          </div>
        </div>
      </section>

      {org.archived && !nextEvent ? (
        <p role="note" className="surface-card rounded-[20px] px-4 py-4 text-sm leading-6 text-[var(--text-main)]">
          {org.archived}
        </p>
      ) : (
        <section aria-label="Next event" className="space-y-3">
          <SectionHeading eyebrow="Next card" title={nextEvent ? nextEvent.name : 'No event announced'} />
          {upcoming.loading ? (
            <LoadingSkeleton className="h-[150px]" />
          ) : nextEvent ? (
            <EventPanel org={org} event={nextEvent} limit={3} scheduled onOpenFighter={setProfileName} />
          ) : (
            <p className="surface-card rounded-[20px] px-4 py-5 text-sm text-[var(--text-muted)]">
              The next {org.shortName} card has not been announced yet.
            </p>
          )}
        </section>
      )}

      <section aria-label="Champions" className="space-y-3">
        <SectionHeading eyebrow={org.archived ? 'Final champions' : 'Titles'} title={`${org.shortName} champions`} />
        {rankingsLoading ? (
          <LoadingSkeleton className="h-[120px]" />
        ) : champions.length ? (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {champions.map(({ division, holders }) => (
              <li key={division}>
                <ChampionTile division={division} holders={holders} lookup={lookup} onOpen={setProfileName} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Champions are not available yet.</p>
        )}
      </section>

      {latestEvent ? (
        <section aria-label="Latest results" className="space-y-3">
          <SectionHeading eyebrow="Latest results" title={latestEvent.name} />
          <EventPanel org={org} event={latestEvent} limit={LATEST_RESULTS} onOpenFighter={setProfileName} />
        </section>
      ) : null}

      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {org.archived ? `Archive built from ${org.sourceName}.` : `Data from ${org.sourceName}, refreshed daily.`} Predictions, head-to-head and the track record are UFC-only for now: the model is
        trained on UFC fights.{' '}
        <Link to="/predictor" className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]">
          Try the UFC predictor
        </Link>
      </p>

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={() => setProfileName(null)} onSelectFighter={setProfileName} /> : null}
    </div>
  )
}

function HeroLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="primary-action inline-flex items-center gap-1.5 px-4 py-2.5 text-xs uppercase">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
      {note ? <p className="text-[11px] text-[var(--text-muted)]">{note}</p> : null}
    </div>
  )
}

function EventPanel({ org, event, limit, scheduled = false, onOpenFighter }: { org: OrgConfig; event: OrgEvent; limit: number; scheduled?: boolean; onOpenFighter: (name: string) => void }) {
  const fights = event.fights.slice(0, limit)
  return (
    <div className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(event.date)}
        </span>
        {event.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3">
        {fights.map((fight, index) => (
          <OrgFightRow key={fight.fight_url ?? index} org={org.id} fight={fight} scheduled={scheduled} onOpenFighter={onOpenFighter} />
        ))}
      </div>
      <Link
        to={`${orgPath(org, 'events')}?q=${encodeURIComponent(event.name)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-main)] underline decoration-2 underline-offset-4 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        {event.fight_count > fights.length ? `Full card (${event.fight_count} fights)` : 'Open the card'}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function ChampionTile({
  division,
  holders,
  lookup,
  onOpen,
}: {
  division: string
  holders: { fighter: string; status: string | null }[]
  lookup: (name: string) => { image_url: string | null } | undefined
  onOpen: (name: string) => void
}) {
  const champion = holders.find((entry) => entry.status !== 'interim') ?? null
  const interim = holders.find((entry) => entry.status === 'interim') ?? null
  return (
    <div className="metric-tile flex h-full items-center gap-3 rounded-2xl px-3 py-3">
      <FighterAvatar name={champion?.fighter ?? division} imageUrl={champion ? (lookup(champion.fighter)?.image_url ?? null) : null} highlight={Boolean(champion)} className="h-14 w-12" />
      <div className="min-w-0 flex-1">
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{division}</p>
        {champion ? (
          <button type="button" onClick={() => onOpen(champion.fighter)} className="flex max-w-full items-center gap-1.5 text-left text-base font-bold text-[var(--text-main)]">
            <Crown className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-hidden="true" />
            <span className="truncate">{champion.fighter}</span>
          </button>
        ) : (
          <p className="text-base font-bold text-[var(--text-muted)]">Vacant</p>
        )}
        {interim ? (
          <button type="button" onClick={() => onOpen(interim.fighter)} className="block max-w-full truncate text-left text-xs text-[var(--text-muted)] underline decoration-2 underline-offset-2">
            Interim: {interim.fighter}
          </button>
        ) : null}
      </div>
    </div>
  )
}
