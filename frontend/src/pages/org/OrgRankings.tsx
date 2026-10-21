import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Crown, Sparkles, Trophy } from 'lucide-react'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { formatDate } from '../../shared/data/orgFormat'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import { useOrgRankings } from '../../shared/hooks/useOrgData'
import type { OrgRankingCategory, OrgRankingEntry } from '../../shared/types/api'

type Tab = 'division' | 'p4p'

export function OrgRankings() {
  const org = useOrg()
  const { rankings, loading, error } = useOrgRankings(org.id)
  const [tab, setTab] = useState<Tab>('division')
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)

  const divisions = useMemo(() => rankings.filter((category) => !category.is_p4p), [rankings])
  const p4p = useMemo(() => rankings.filter((category) => category.is_p4p), [rankings])
  const activeDivision = divisions.find((category) => category.category === selectedDivision) ?? divisions[0] ?? null
  const activeP4p = p4p[0] ?? null
  const active = tab === 'division' ? activeDivision : activeP4p

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={org.rankingsNote ? `${org.shortName} champions` : `Official ${org.shortName} rankings`}
          title="Divisional & pound-for-pound rankings"
          description={org.rankingsNote ?? `The official ${org.sourceName} rankings, with each fighter's win rate and last fight added from our data.`}
        />
        {p4p.length ? (
          <div className="mt-4 inline-flex rounded-full border border-white/14 bg-white/[0.04] p-1">
            <TabButton active={tab === 'division'} onClick={() => setTab('division')}>
              Category Ranking
            </TabButton>
            <TabButton active={tab === 'p4p'} onClick={() => setTab('p4p')}>
              Pound-for-Pound
            </TabButton>
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : !active ? (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[var(--text-muted)]">Rankings are not available yet.</div>
      ) : (
        <div className="space-y-4">
          {tab === 'division' ? (
            <div className="surface-card rounded-[18px] p-3.5">
              <label htmlFor="ranking-division" className="broadcast-label mb-2 block text-xs text-[var(--text-main)]">
                Division
              </label>
              <select
                id="ranking-division"
                value={active.category}
                onChange={(event) => setSelectedDivision(event.target.value)}
                className="soft-input theme-text w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {divisions.map((division) => (
                  <option key={division.category} value={division.category}>
                    {division.category}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="surface-card flex flex-wrap gap-2 rounded-[18px] p-3">
              {p4p.map((category) => (
                <span key={category.category} className="ghost-action inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-red)]" />
                  {category.category.replace('Pound-for-Pound ', '')}
                </span>
              ))}
            </div>
          )}

          <RankingList org={org.id} category={active} vacantLabel={tab === 'division'} onOpenProfile={setProfileName} />
        </div>
      )}

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={() => setProfileName(null)} onSelectFighter={setProfileName} /> : null}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition sm:text-[13px] ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#CCCCCC] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function RankingList({
  org,
  category,
  vacantLabel,
  onOpenProfile,
}: {
  org: string
  category: OrgRankingCategory
  vacantLabel: boolean
  onOpenProfile: (name: string) => void
}) {
  // Champion and interim champion both sit at rank 0; the champion goes first.
  const titleHolders = category.entries.filter((entry) => entry.rank === 0)
  const contenders = category.entries.filter((entry) => entry.rank > 0)
  const vacant = vacantLabel && !titleHolders.some((entry) => entry.status === 'champion')

  return (
    <section aria-label="Ranked athletes" className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-white/10 px-1 pb-2">
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">Ranked athletes</h2>
        <span className="text-xs text-[var(--text-muted)]">{contenders.length + titleHolders.length} listed</span>
      </div>
      <div className="grid gap-2.5">
        {vacant ? (
          <article className="metric-tile flex items-center gap-3.5 rounded-2xl px-3.5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-red)] text-white">
              <Crown className="h-4 w-4" />
            </span>
            <p className="text-base font-semibold text-[var(--text-main)]">Championship vacant</p>
          </article>
        ) : null}
        {titleHolders.map((entry) => (
          <RankingRow key={`${entry.status}-${entry.fighter}`} org={org} entry={entry} onOpenProfile={onOpenProfile} />
        ))}
        {contenders.map((entry) => (
          <RankingRow key={entry.fighter} org={org} entry={entry} onOpenProfile={onOpenProfile} />
        ))}
        {!titleHolders.length && !contenders.length ? (
          <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[var(--text-muted)]">No ranked athletes in this category.</div>
        ) : null}
      </div>
    </section>
  )
}

function RankingRow({ org, entry, onOpenProfile }: { org: string; entry: OrgRankingEntry; onOpenProfile: (name: string) => void }) {
  const lookup = useOrgFighterLookup(org)
  const profile = lookup(entry.fighter)
  const holder = entry.rank === 0
  const interim = entry.status === 'interim'

  const content = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
          holder ? (interim ? 'bg-[#1F4E9C] text-white' : 'bg-[var(--accent-red)] text-white') : 'bg-[var(--surface-3)] text-[var(--text-main)]'
        }`}
      >
        {holder ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <FighterAvatar name={entry.fighter} imageUrl={profile?.image_url ?? null} highlight={holder} className="h-12 w-12" />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--text-main)]">
          {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
          <span className="min-w-0 truncate">{entry.fighter}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-muted)]">
          {holder ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#0E0E0E]">
              <Trophy className="h-3.5 w-3.5" /> {interim ? 'Interim champion' : 'Champion'}
            </span>
          ) : null}
          {entry.win_rate !== null ? <span>Win rate: {(entry.win_rate * 100).toFixed(1)}%</span> : null}
          {entry.last_fight ? <span>Last fight: {formatDate(entry.last_fight)}</span> : null}
        </div>
      </div>

      <RankChange change={entry.rank_change} />
    </>
  )

  const base = 'metric-tile flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3'
  return profile ? (
    <button
      type="button"
      onClick={() => onOpenProfile(profile.name)}
      aria-label={`${entry.fighter}, rank ${entry.rank || 'champion'}. View profile`}
      className={`${base} cursor-pointer text-left transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]`}
    >
      {content}
    </button>
  ) : (
    <article className={base}>{content}</article>
  )
}

/** "up 2", "down 1" or "new", as written by the scraper. */
function RankChange({ change }: { change: string | null }) {
  if (!change) return null
  const [direction, amount] = change.split(' ')
  if (direction === 'up' || direction === 'down') {
    const Arrow = direction === 'up' ? ArrowUp : ArrowDown
    return (
      <span
        title={`${direction === 'up' ? 'Up' : 'Down'} ${amount} place${amount === '1' ? '' : 's'}`}
        className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          direction === 'up' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-[#C8102E]/30 bg-[#C8102E]/10 text-[#C8102E]'
        }`}
      >
        <Arrow className="h-3 w-3" />
        {amount}
      </span>
    )
  }
  return <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--text-muted)]">{change}</span>
}
