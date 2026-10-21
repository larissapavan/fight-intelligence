import { useMemo, useState } from 'react'
import { ArrowLeft, Crown } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { FlagIcon } from '../shared/components/FlagIcon'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { OrgFighterModal } from '../shared/components/OrgFighterModal'
import { SectionHeading } from '../shared/components/SectionHeading'
import { ORGS, orgPath, type OrgId } from '../shared/data/orgs'
import { useGym } from '../shared/hooks/useGyms'
import { useOrg } from '../shared/hooks/useOrg'
import type { GymFighter } from '../shared/types/api'

type Scope = 'org' | 'all'

/** One gym: who trains there. Fighters we have a profile for open it; the others are listed as FightHub has them. */
export function GymDetail() {
  const org = useOrg()
  const { slug = '' } = useParams()
  const { gym, loading, error } = useGym(slug)
  const [scope, setScope] = useState<Scope | null>(null)
  const [open, setOpen] = useState<{ org: OrgId; name: string } | null>(null)

  const inOrg = useMemo(() => (gym ? gym.fighters.filter((fighter) => fighter.orgs.includes(org.id)) : []), [gym, org.id])
  // A gym with fighters of this organization shows them first; one without any shows everybody.
  const activeScope: Scope = scope ?? (inOrg.length > 0 ? 'org' : 'all')
  const fighters = gym ? (activeScope === 'org' ? inOrg : gym.fighters) : []

  const openProfile = (fighter: GymFighter) => {
    const target = (fighter.orgs.includes(org.id) ? org.id : fighter.orgs[0]) as OrgId | undefined
    if (target) setOpen({ org: target, name: fighter.name })
  }

  const back = (
    <Link
      to={orgPath(org, 'gyms')}
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-main)] underline decoration-2 underline-offset-4 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All {org.shortName} gyms
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {back}
        <LoadingSkeleton className="h-[160px]" />
        <LoadingSkeleton className="h-[200px]" />
      </div>
    )
  }

  if (error || !gym) {
    return (
      <div className="space-y-4">
        {back}
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <h1 className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">Gym not found</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">We have no gym with that address.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {back}

      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading level={1} eyebrow="Gym" title={gym.name} description="Fighters whose last fight came out of this gym, as listed by FightHub." />
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile label="Fighters listed" value={gym.fighters_count.toLocaleString('en-US')} />
            <Tile label={`${org.shortName} fighters`} value={(gym.orgs[org.id] ?? 0).toLocaleString('en-US')} />
            <Tile label="Champions" value={gym.champions.toLocaleString('en-US')} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Which fighters" className="inline-flex border-2 border-[var(--rule)] bg-[var(--card-bg)]">
            {(['org', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeScope === value}
                onClick={() => setScope(value)}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  activeScope === value ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
                }`}
              >
                {value === 'org' ? `${org.shortName} (${inOrg.length})` : `Everyone (${gym.fighters.length})`}
              </button>
            ))}
          </div>
          {gym.url ? (
            <a href={gym.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-muted)] underline decoration-2 underline-offset-2">
              Roster source: FightHub
            </a>
          ) : null}
        </div>
      </section>

      {fighters.length ? (
        <ul aria-label="Fighters" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {fighters.map((fighter) => (
            <li key={`${fighter.name}-${fighter.record}`}>
              <FighterCard fighter={fighter} onOpen={openProfile} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[var(--text-muted)]">No fighters listed for this gym.</div>
      )}

      {open && open.org === 'ufc' ? (
        <FighterProfileModal key={open.name} name={open.name} onClose={() => setOpen(null)} onSelectFighter={(name) => setOpen({ org: 'ufc', name })} />
      ) : null}
      {open && open.org !== 'ufc' ? (
        <OrgFighterModal
          key={`${open.org}-${open.name}`}
          org={ORGS[open.org]}
          name={open.name}
          onClose={() => setOpen(null)}
          onSelectFighter={(name) => setOpen({ org: open.org, name })}
        />
      ) : null}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
    </div>
  )
}

function FighterCard({ fighter, onOpen }: { fighter: GymFighter; onOpen: (fighter: GymFighter) => void }) {
  const body = (
    <>
      <FighterAvatar name={fighter.name} imageUrl={fighter.image_url} highlight={fighter.belt} className="h-16 w-14" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          {fighter.country_code ? <FlagIcon code={fighter.country_code} /> : null}
          <span className="truncate text-base font-bold text-[var(--text-main)]">{fighter.name}</span>
        </span>
        {fighter.nickname ? <span className="block truncate text-xs italic text-[var(--text-muted)]">“{fighter.nickname}”</span> : null}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
          {fighter.record ? <span className="font-semibold text-[var(--text-main)]">{fighter.record}</span> : null}
          {fighter.division ? <span>{fighter.division}</span> : null}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          {fighter.belt ? (
            <span className="inline-flex items-center gap-1 border-2 border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[#0E0E0E]">
              <Crown className="h-3 w-3" aria-hidden="true" />
              Champion
            </span>
          ) : null}
          {fighter.orgs.map((orgId) => (
            <span key={orgId} className="border-2 border-[var(--rule)] bg-[var(--surface-3)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--text-main)]">
              {ORGS[orgId as OrgId]?.shortName ?? orgId.toUpperCase()}
            </span>
          ))}
        </span>
      </span>
    </>
  )

  const base = 'metric-tile flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left'
  return fighter.orgs.length ? (
    <button
      type="button"
      onClick={() => onOpen(fighter)}
      aria-label={`${fighter.name}. View profile`}
      className={`${base} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]`}
    >
      {body}
    </button>
  ) : (
    <article className={`${base} opacity-80`}>{body}</article>
  )
}
