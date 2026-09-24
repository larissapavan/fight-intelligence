import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Crown, Sparkles, Trophy } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useRankings } from '../shared/hooks/useRankings'
import type { RankingCategory, RankingEntry } from '../shared/types/api'

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
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Official UFC rankings"
          title="Divisional & pound-for-pound rankings"
          description="Sourced live from ufc.com's media panel rankings, cross-referenced with our own win rate and last-fight data."
        />

        <div className="mt-3 inline-flex rounded-full border border-white/8 bg-white/[0.035] p-0.5">
          <TabButton active={tab === 'division'} onClick={() => setTab('division')}>
            Category Ranking
          </TabButton>
          <TabButton active={tab === 'p4p'} onClick={() => setTab('p4p')}>
            Pound-for-Pound
          </TabButton>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
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
      className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#999999] hover:text-white'
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
    <div className="space-y-3">
      <div className="surface-card rounded-[18px] p-3">
        <label className="broadcast-label mb-1.5 block text-[10px] text-[#999999]">Division</label>
        <select
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.category}
            type="button"
            onClick={() => onSelect(category.category)}
            className={`ghost-action inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              category.category === active.category ? 'ring-1 ring-[#E81B23]/45' : ''
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E81B23]" />
            {category.category.replace('Pound-for-Pound ', '')}
          </button>
        ))}
      </div>

      <RankingList entries={active.entries} />
    </div>
  )
}

function RankingList({ entries }: { entries: RankingEntry[] }) {
  const champion = entries.find((entry) => entry.rank === 0)
  const contenders = entries.filter((entry) => entry.rank > 0)

  return (
    <div className="grid gap-2">
      {champion ? <RankingRow entry={champion} isChampion /> : null}
      {contenders.map((entry) => (
        <RankingRow key={entry.fighter} entry={entry} />
      ))}
      {!champion && contenders.length === 0 ? (
        <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[#999999]">
          No ranked athletes in this category.
        </div>
      ) : null}
    </div>
  )
}

function RankingRow({ entry, isChampion = false }: { entry: RankingEntry; isChampion?: boolean }) {
  return (
    <article className="metric-tile flex items-center gap-3 rounded-2xl px-3 py-2.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
          isChampion ? 'bg-[#E81B23]/12 text-[#E81B23]' : 'bg-white/[0.05] text-[#999999]'
        }`}
      >
        {isChampion ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#FFFFFF]">{entry.fighter}</p>
        <div className="theme-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          {isChampion ? (
            <span className="inline-flex items-center gap-1 text-[#E81B23]">
              <Trophy className="h-3 w-3" /> Champion
            </span>
          ) : null}
          {entry.win_rate !== null ? <span>Win rate: {(entry.win_rate * 100).toFixed(1)}%</span> : null}
          {entry.last_fight ? <span>Last fight: {formatDate(entry.last_fight)}</span> : null}
        </div>
      </div>

      <RankChangeBadge change={entry.rank_change} />
    </article>
  )
}

function RankChangeBadge({ change }: { change: string | null }) {
  if (!change) return null

  if (change === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        <ArrowUp className="h-3 w-3" />
      </span>
    )
  }

  if (change === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#E81B23]/20 bg-[#E81B23]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E81B23]">
        <ArrowDown className="h-3 w-3" />
      </span>
    )
  }

  return (
    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#999999]">
      {change}
    </span>
  )
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
