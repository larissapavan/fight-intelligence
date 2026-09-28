import { useState } from 'react'
import { Crown, Flame, Shield, ThumbsDown, Trophy } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useChampions } from '../shared/hooks/useChampions'
import type { ChampionSummary, RecordCategory, TitleReign } from '../shared/types/api'

type Tab = 'positive' | 'negative'

export function Champions() {
  const { data, loading, error } = useChampions()
  const [tab, setTab] = useState<Tab>('positive')

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Title fight history"
          title="Champions & records"
          description="Every UFC title reign, defense and record book entry — compiled from published UFC title histories."
        />
      </section>

      {error ? (
        <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
      ) : null}

      {loading || !data ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[90px]" />
          ))}
        </section>
      ) : (
        <>
          <CurrentChampionsSection reigns={data.current_champions} />
          <GreatestChampionsSection champions={data.greatest_champions} />

          <section>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Trophy className="h-4 w-4 text-[#E81B23]" />
              <h2 className="broadcast-label text-xs text-[#FFFFFF]">Title fight records</h2>
            </div>

            <div className="mb-3 inline-flex rounded-full border border-white/8 bg-white/[0.035] p-0.5">
              <TabButton active={tab === 'positive'} onClick={() => setTab('positive')}>
                Positive records
              </TabButton>
              <TabButton active={tab === 'negative'} onClick={() => setTab('negative')}>
                Negative records
              </TabButton>
            </div>

            <div className="grid gap-2.5 md:grid-cols-2">
              {data.records
                .filter((category) => category.kind === tab)
                .map((category) => (
                  <RecordCard key={category.key} category={category} />
                ))}
            </div>
          </section>
        </>
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

function CurrentChampionsSection({ reigns }: { reigns: TitleReign[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Crown className="h-4 w-4 text-[#E81B23]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Current champions</h2>
        <span className="theme-muted text-xs">({reigns.length})</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {reigns.map((reign) => (
          <article key={reign.division} className="metric-tile rounded-2xl px-3 py-2.5">
            <p className="broadcast-label text-[10px] text-[#999999]">{reign.division}</p>
            <p className="mt-1 truncate text-sm font-bold text-[#FFFFFF]">{reign.champion}</p>
            <div className="theme-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              <span>{reign.days_held ?? '—'} days as champion</span>
              <span>
                {reign.defenses_count} {reign.defenses_count === 1 ? 'defense' : 'defenses'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function GreatestChampionsSection({ champions }: { champions: ChampionSummary[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-[#E81B23]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Greatest champions</h2>
        <span className="theme-muted text-xs">by total time as champion</span>
      </div>

      <div className="grid gap-1.5">
        {champions.map((champion, index) => (
          <article key={champion.champion} className="surface-card flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                index === 0 ? 'bg-[#E81B23]/12 text-[#E81B23]' : 'bg-white/[0.05] text-[#999999]'
              }`}
            >
              {index === 0 ? <Trophy className="h-4 w-4" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-semibold text-[#FFFFFF]">{champion.champion}</p>
                {champion.is_current_champion ? (
                  <span className="rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E81B23]">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="theme-muted mt-0.5 truncate text-[11px]">{champion.divisions.join(' · ')}</p>
            </div>

            <div className="theme-muted hidden shrink-0 gap-4 text-right text-[11px] sm:flex">
              <Stat label="Days" value={champion.total_days_as_champion.toLocaleString('en-US')} />
              <Stat label="Defenses" value={String(champion.total_defenses)} />
              <Stat label="Reigns" value={String(champion.total_reigns)} />
            </div>
          </article>
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

  return (
    <article className="surface-card rounded-[18px] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${category.kind === 'positive' ? 'text-[#E81B23]' : 'text-[#999999]'}`} />
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{category.label}</h3>
      </div>

      {category.entries.length ? (
        <div className="grid gap-1">
          {category.entries.map((entry) => (
            <div key={`${entry.rank}-${entry.champion}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.03]">
              <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-[#999999]">{entry.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#FFFFFF]">{entry.champion}</p>
                {entry.division ? <p className="theme-muted truncate text-[10px]">{entry.division}</p> : null}
              </div>
              <span className="data-value shrink-0 text-sm font-bold text-[#FFFFFF]">
                {entry.value} <span className="theme-muted text-[10px] font-normal">{category.unit}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#999999]">No entries in this category.</p>
      )}
    </article>
  )
}
