import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Crown, Sparkles, Trophy } from 'lucide-react'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { badgesForRankings } from '../shared/data/badges'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { getFighterImageUrl, normalizeFighterName, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import { useRankings } from '../shared/hooks/useRankings'
import type { FighterProfile, RankingCategory, RankingEntry } from '../shared/types/api'

type Tab = 'division' | 'p4p'

export function Rankings() {
  const { rankings, loading, error } = useRankings()
  const [tab, setTab] = useState<Tab>('division')

  const divisions = useMemo(() => rankings.filter((category) => !category.is_p4p), [rankings])
  const p4pCategories = useMemo(() => rankings.filter((category) => category.is_p4p), [rankings])

  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const activeDivision = divisions.find((category) => category.category === selectedDivision) ?? divisions[0] ?? null

  const [selectedP4p, setSelectedP4p] = useState<string | null>(null)
  const activeP4p = p4pCategories.find((category) => category.category === selectedP4p) ?? p4pCategories[0] ?? null

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading level={1}
          eyebrow="Official UFC rankings"
          title="Divisional & pound-for-pound rankings"
          description="The official ufc.com rankings, with each fighter's win rate and last fight added from our data."
        />

        <div className="mt-4 inline-flex rounded-full border border-white/14 bg-white/[0.04] p-1">
          <TabButton active={tab === 'division'} onClick={() => setTab('division')}>
            Category Ranking
          </TabButton>
          <TabButton active={tab === 'p4p'} onClick={() => setTab('p4p')}>
            Pound-for-Pound
          </TabButton>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
      ) : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : tab === 'division' ? (
        <DivisionView divisions={divisions} active={activeDivision} onSelect={setSelectedDivision} />
      ) : (
        <P4pView categories={p4pCategories} active={activeP4p} onSelect={setSelectedP4p} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition sm:text-[13px] ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#CCCCCC] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function DivisionView({
  divisions,
  active,
  onSelect,
}: {
  divisions: RankingCategory[]
  active: RankingCategory | null
  onSelect: (category: string) => void
}) {
  if (!active) {
    return (
      <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[#999999]">
        Rankings are not available yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-[18px] border-white/14 p-3.5">
        <label htmlFor="ranking-division" className="broadcast-label mb-2 block text-xs text-[#CCCCCC]">Division</label>
        <select
          id="ranking-division"
          value={active.category}
          onChange={(event) => onSelect(event.target.value)}
          className="soft-input theme-text w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        >
          {divisions.map((division) => (
            <option key={division.category} value={division.category}>
              {division.category}
            </option>
          ))}
        </select>
      </div>

      <RankingList entries={active.entries} />
    </div>
  )
}

function P4pView({
  categories,
  active,
  onSelect,
}: {
  categories: RankingCategory[]
  active: RankingCategory | null
  onSelect: (category: string) => void
}) {
  if (!active) {
    return (
      <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[#999999]">
        Rankings are not available yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap gap-2 rounded-[18px] border-white/14 p-3">
        {categories.map((category) => (
          <button
            key={category.category}
            type="button"
            onClick={() => onSelect(category.category)}
            className={`ghost-action inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              category.category === active.category ? 'ring-1 ring-[#C8102E]/45' : ''
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
            {category.category.replace('Pound-for-Pound ', '')}
          </button>
        ))}
      </div>

      <RankingList entries={active.entries} />
    </div>
  )
}

function RankingList({ entries }: { entries: RankingEntry[] }) {
  const { fighters } = useFighters()
  const [profileName, setProfileName] = useState<string | null>(null)
  const { imageByName } = useFighterImages()
  const profileFor = useMemo(() => {
    const index = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string) => index.get(normalizeFighterName(name))
  }, [fighters])
  const imageUrlFor = useMemo(() => {
    const profileByName = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string) => getFighterImageUrl(name, imageByName, profileByName.get(normalizeFighterName(name))?.image_url)
  }, [fighters, imageByName])

  const champion = entries.find((entry) => entry.rank === 0)
  const contenders = entries.filter((entry) => entry.rank > 0)

  return (
    <section aria-label="Ranked athletes" className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-white/10 px-1 pb-2">
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Ranked athletes</h2>
        <span className="text-xs text-[#CCCCCC]">{contenders.length + (champion ? 1 : 0)} listed</span>
      </div>
      <div className="grid gap-2.5">
      {champion ? (
        <RankingRow
          entry={champion}
          imageUrl={imageUrlFor(champion.fighter)}
          profile={profileFor(champion.fighter)}
          onOpenProfile={setProfileName}
          isChampion
        />
      ) : null}
      {contenders.map((entry) => (
        <RankingRow
          key={entry.fighter}
          entry={entry}
          imageUrl={imageUrlFor(entry.fighter)}
          profile={profileFor(entry.fighter)}
          onOpenProfile={setProfileName}
        />
      ))}
      {!champion && contenders.length === 0 ? (
        <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[#999999]">
          No ranked athletes in this category.
        </div>
      ) : null}
      </div>

      {profileName ? (
        <FighterProfileModal
          key={profileName}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </section>
  )
}

function RankingRow({
  entry,
  imageUrl,
  profile,
  onOpenProfile,
  isChampion = false,
}: {
  entry: RankingEntry
  imageUrl: string | null
  profile?: FighterProfile
  onOpenProfile: (name: string) => void
  isChampion?: boolean
}) {
  const content = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
          isChampion ? 'bg-[#C8102E] text-white' : 'bg-[var(--surface-3)] text-[var(--text-main)]'
        }`}
      >
        {isChampion ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <FighterAvatar name={entry.fighter} imageUrl={imageUrl} highlight={isChampion} className="h-12 w-12" />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-[#FFFFFF]">
          {profile ? <FlagList fighter={profile} /> : null}
          <span className="min-w-0 truncate">{entry.fighter}</span>
        </p>
        {profile ? <FighterBadges badges={badgesForRankings(profile.badges)} className="mt-1" /> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#CCCCCC]">
          {isChampion ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#0E0E0E]">
              <Trophy className="h-3.5 w-3.5" /> Champion
            </span>
          ) : null}
          {entry.win_rate !== null ? <span>Win rate: {(entry.win_rate * 100).toFixed(1)}%</span> : null}
          {entry.last_fight ? <span>Last fight: {formatDate(entry.last_fight)}</span> : null}
        </div>
      </div>

      <RankChangeBadge change={entry.rank_change} />
    </>
  )

  const base = 'metric-tile flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3'

  // Ranked fighters we have a profile for open it on this page; anyone else stays a plain row.
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

function RankChangeBadge({ change }: { change: string | null }) {
  if (!change) return null

  if (change === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
        <ArrowUp className="h-3 w-3" />
      </span>
    )
  }

  if (change === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#C8102E]/20 bg-[#C8102E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C8102E]">
        <ArrowDown className="h-3 w-3" />
      </span>
    )
  }

  return (
    <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-[#999999]">
      {change}
    </span>
  )
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
