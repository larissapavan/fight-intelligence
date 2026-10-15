import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Crown, Flame, Layers, Shield, Swords, ThumbsDown, Trophy } from 'lucide-react'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { ChampionBelt } from '../shared/components/ChampionBelt'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useChampions } from '../shared/hooks/useChampions'
import { useFighterImages, getFighterImageUrl, normalizeFighterName } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import type { ChampionSummary, RecordCategory, TitleReign, TitleWin } from '../shared/types/api'

type Tab = 'positive' | 'negative'

const COLLAPSED_ROWS = 5
const MULTI_DIVISION_KEY = 'multi_division_champions'

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
        <p className="rounded-xl border border-[#D32F2F]/25 bg-[#D32F2F]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
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
              <Trophy className="h-4 w-4 text-[#D32F2F]" />
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.records
                .filter((category) => category.kind === tab)
                .map((category) =>
                  category.key === MULTI_DIVISION_KEY ? (
                    <MultiDivisionCard key={category.key} category={category} />
                  ) : (
                    <RecordCard key={category.key} category={category} />
                  ),
                )}
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

function fighterProfilePath(name: string) {
  return `/fighters?fighter=${encodeURIComponent(name)}`
}

function CurrentChampionsSection({ reigns }: { reigns: TitleReign[] }) {
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Crown className="h-4 w-4 text-[#D32F2F]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Current champions</h2>
        <span className="theme-muted text-xs">({reigns.length})</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {reigns.map((reign) => (
          <Link
            key={reign.division}
            to={fighterProfilePath(reign.champion)}
            aria-label={`${reign.champion}, ${reign.division} champion — view profile`}
            className="metric-tile flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-all hover:scale-[1.01] hover:border-[#D32F2F]/50 focus-visible:border-[#D32F2F] focus-visible:outline-none"
          >
            <FighterAvatar
              name={reign.champion}
              imageUrl={getFighterImageUrl(reign.champion, imageByName, profileByName.get(normalizeFighterName(reign.champion))?.image_url)}
            />
            <div className="min-w-0 flex-1">
              <p className="broadcast-label text-[10px] text-[#999999]">{reign.division}</p>
              <p className="mt-1 truncate text-sm font-bold text-[#FFFFFF]">{reign.champion}</p>
              <div className="theme-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <span>{reign.days_held ?? '—'} days as champion</span>
                <span>
                  {reign.defenses_count} {reign.defenses_count === 1 ? 'defense' : 'defenses'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function GreatestChampionsSection({ champions }: { champions: ChampionSummary[] }) {
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-[#D32F2F]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Greatest champions</h2>
        <span className="theme-muted text-xs">by total time as champion</span>
      </div>

      <div className="grid gap-1.5">
        {champions.map((champion, index) => (
          <Link
            key={champion.champion}
            to={fighterProfilePath(champion.champion)}
            aria-label={`${champion.champion} — view profile`}
            className="surface-card flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-neutral-800/60 focus-visible:bg-neutral-800/60 focus-visible:outline-none"
          >
            <div className="relative shrink-0">
              <FighterAvatar
                name={champion.champion}
                className="h-12 w-12"
                imageUrl={getFighterImageUrl(
                  champion.champion,
                  imageByName,
                  profileByName.get(normalizeFighterName(champion.champion))?.image_url,
                )}
              />
              <span
                className={`type-num absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-md border px-1 text-[10px] leading-none ${
                  index === 0
                    ? 'border-[#D32F2F]/60 bg-[#D32F2F] text-white'
                    : 'border-white/12 bg-[#141414] text-[#CCCCCC]'
                }`}
              >
                {index === 0 ? <Trophy className="h-3 w-3" /> : index + 1}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-semibold text-[#FFFFFF]">{champion.champion}</p>
                {champion.is_current_champion ? (
                  <span className="type-tech rounded-full border border-[#D32F2F]/25 bg-[#D32F2F]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#D32F2F]">
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
          </Link>
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
  const [expanded, setExpanded] = useState(false)
  const visible = category.entries.slice(0, COLLAPSED_ROWS)
  const extra = category.entries.slice(COLLAPSED_ROWS)

  return (
    <article className="surface-card flex flex-col rounded-[18px] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${category.kind === 'positive' ? 'text-[#D32F2F]' : 'text-[#999999]'}`} />
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{category.label}</h3>
      </div>

      {category.entries.length ? (
        <>
          <div className="grid">
            {visible.map((entry) => (
              <RecordRow key={`${entry.rank}-${entry.champion}`} entry={entry} unit={category.unit} />
            ))}
          </div>

          {extra.length ? (
            <>
              {/* grid-rows 0fr -> 1fr animates the height without measuring it */}
              <div
                id={`record-extra-${category.key}`}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden" inert={!expanded}>
                  {extra.map((entry) => (
                    <RecordRow key={`${entry.rank}-${entry.champion}`} entry={entry} unit={category.unit} />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls={`record-extra-${category.key}`}
                className="type-tech mt-auto flex items-center justify-center gap-1 border-t border-white/8 pt-2 text-[10px] text-[#999999] transition hover:text-[#E50914]"
              >
                {expanded ? 'Show less' : `View top ${category.entries.length}`}
                <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[#999999]">No entries in this category.</p>
      )}
    </article>
  )
}

function RecordRow({ entry, unit }: { entry: RecordCategory['entries'][number]; unit: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
      <span className="type-num w-4 shrink-0 text-right text-[11px] text-[#999999]">{entry.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[#FFFFFF]">{entry.champion}</p>
        {entry.division ? <p className="theme-muted truncate text-[9.5px] leading-tight">{entry.division}</p> : null}
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[#FFFFFF]">
        {entry.value} <span className="theme-muted text-[10px] font-normal">{unit}</span>
      </span>
    </div>
  )
}

/** Multi-division champions: chips that open a per-division breakdown of how each belt was won. */
function MultiDivisionCard({ category }: { category: RecordCategory }) {
  const [openName, setOpenName] = useState<string | null>(null)
  const open = category.entries.find((entry) => entry.champion === openName) ?? null
  const panelId = `multi-division-${category.key}`

  return (
    <article className="surface-card rounded-[18px] border-[#D32F2F]/20 p-3 md:col-span-2">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Layers className="h-4 w-4 shrink-0 text-[#D32F2F]" />
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{category.label}</h3>
        <span className="theme-muted text-[11px]">tap a champion to see how each belt was won</span>
      </div>

      {category.entries.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {category.entries.map((entry) => {
            const isOpen = entry.champion === openName
            return (
              <li key={`${entry.rank}-${entry.champion}`}>
                <button
                  type="button"
                  onClick={() => setOpenName(isOpen ? null : entry.champion)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  title={`${entry.champion}: ${entry.division ?? ''}`}
                  className={`flex items-center gap-2 rounded-lg border py-1 pl-2.5 pr-1.5 text-left transition ${
                    isOpen
                      ? 'border-[#E50914]/60 bg-[#E50914]/10 shadow-[0_0_14px_rgba(229,9,20,0.18)]'
                      : 'border-white/8 bg-white/[0.035] hover:border-white/20'
                  }`}
                >
                  <span className="text-[13px] font-semibold leading-tight text-[#FFFFFF]">{entry.champion}</span>
                  {entry.division ? (
                    <span className="theme-muted hidden text-[9.5px] leading-tight sm:inline">{entry.division.replace(/, /g, ' + ')}</span>
                  ) : null}
                  <span className="type-num rounded-md bg-[#D32F2F]/14 px-1.5 py-0.5 text-[10px] text-[#E50914]">
                    {entry.value}
                    {category.unit === 'divisions' ? '×' : ''}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-[#999999] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#E50914]' : ''}`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-[#999999]">No entries in this category.</p>
      )}

      <div id={panelId} aria-live="polite">
        {open?.title_wins?.length ? (
          <div key={open.champion} className="fade-up mt-3 border-t border-white/8 pt-3">
            <p className="broadcast-label mb-2 flex items-center gap-1.5 text-[10px] text-[#999999]">
              <ChampionBelt className="h-4 w-4" />
              {open.champion} · belt wins by division
            </p>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {open.title_wins.map((win) => (
                <TitleWinCard key={win.division} win={win} />
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function formatTitleDate(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TitleWinCard({ win }: { win: TitleWin }) {
  const date = formatTitleDate(win.date)
  const outcome = [win.method, win.round ? `R${win.round}` : null].filter(Boolean).join(' · ')
  const defenses = `Title won + ${win.defenses} ${win.defenses === 1 ? 'defense' : 'defenses'}`

  return (
    <li className="rounded-xl border border-white/8 bg-black/20 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="type-tech rounded-full border border-[#E5A93C]/40 bg-[#E5A93C]/10 px-2 py-0.5 text-[10px] text-[#E5A93C]">
          {win.division}
        </span>
        {win.title_type === 'interim' ? (
          <span className="type-tech rounded-full border border-white/12 px-2 py-0.5 text-[9px] text-[#999999]">Interim</span>
        ) : null}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#FFFFFF]">
        <Swords className="h-3.5 w-3.5 shrink-0 text-[#E50914]" />
        {win.opponent ? `vs. ${win.opponent}` : win.won_how ?? 'Fight details unavailable'}
      </p>
      <p className="theme-muted mt-0.5 text-[11px]">
        {[win.event, date].filter(Boolean).join(' · ') || '—'}
      </p>
      {outcome ? <p className="type-num mt-0.5 text-[11px] text-[#CCCCCC]">{outcome}</p> : null}

      <p
        className={`type-tech mt-2 inline-flex rounded-md border px-1.5 py-0.5 text-[9.5px] ${
          win.defenses > 0
            ? 'border-[#E50914]/35 bg-[#E50914]/10 text-[#E50914]'
            : 'border-white/10 bg-white/[0.04] text-[#999999]'
        }`}
      >
        {defenses}
      </p>
    </li>
  )
}
