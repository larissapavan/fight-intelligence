import { useState } from 'react'
import { ChevronDown, Trophy } from 'lucide-react'

import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useRecordBook } from '../shared/hooks/useRecordBook'
import type { RecordBookCategory, RecordBookStat } from '../shared/types/api'

const CATEGORY_BLURBS: Record<string, string> = {
  Fights: 'Wins, finishes, streaks and title wins across a whole career.',
  Time: 'How long fights last and how much of that time a fighter spends in control.',
  Striking: 'Significant strikes, accuracy, defense and knockdowns.',
  Grappling: 'Takedowns, takedown defense and submission attempts.',
}

export function RecordBook() {
  const { data, loading, error } = useRecordBook()
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)

  const categories = data?.categories ?? []
  const active: RecordBookCategory | undefined = categories.find((category) => category.name === categoryName) ?? categories[0]

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading level={1}
          eyebrow="Career leaders"
          title="Record book"
          description="The UFC's all-time career leaders in 32 stats, counting every fight since UFC 28, the first event under the Unified Rules of MMA."
        />

        {categories.length ? (
          <div role="group" aria-label="Record categories" className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll">
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                aria-pressed={category.name === active?.name}
                onClick={() => setCategoryName(category.name)}
                className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition sm:px-5 ${
                  category.name === active?.name
                    ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                    : 'text-[var(--text-main)] hover:bg-[#F2C230] hover:text-[#0E0E0E]'
                }`}
              >
                {category.name}
                <span className="ml-1.5 opacity-70">{category.stats.length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {active ? <p className="mt-2 text-sm text-[#999999]">{CATEGORY_BLURBS[active.name] ?? ''}</p> : null}
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[48px]" />
          ))}
        </section>
      ) : active ? (
        <section className="grid gap-2.5">
          {active.stats.map((stat) => (
            <StatCard key={stat.key} stat={stat} onOpenProfile={setProfileName} />
          ))}
        </section>
      ) : null}

      {profileName ? (
        <FighterProfileModal
          key={profileName}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </div>
  )
}

/** One stat as a full-width row that opens to its leaders, like the card groups on the Events page. */
function StatCard({ stat, onOpenProfile }: { stat: RecordBookStat; onOpenProfile: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const panelId = `stat-${stat.key}`

  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03] sm:px-4"
      >
        <Trophy className="h-4 w-4 shrink-0 text-[#C8102E]" />
        <h3 className="broadcast-label text-xs text-[#FFFFFF]">{stat.title}</h3>
        <span className="theme-muted text-xs">({stat.leaders.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {stat.note ? <p className="theme-muted mb-2 text-[11px] leading-4">{stat.note}</p> : null}
          {/* Two columns on wide screens, read top to bottom: the top half on the left, the rest on the right. */}
          <ol className="lg:columns-2 lg:gap-x-8">
            {stat.leaders.map((leader, index) => (
              <li key={`${leader.rank}-${leader.fighter}-${index}`} className="break-inside-avoid">
                <LeaderRow leader={leader} onOpenProfile={onOpenProfile} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

function LeaderRow({
  leader,
  onOpenProfile,
}: {
  leader: RecordBookStat['leaders'][number]
  onOpenProfile: (name: string) => void
}) {
  const content = (
    <>
      <span className="type-num w-5 shrink-0 text-right text-[11px] text-[#999999]">{leader.rank}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-[#FFFFFF]">{leader.fighter}</span>
      <span className="data-value shrink-0 text-sm font-bold text-[#FFFFFF]">{leader.value}</span>
    </>
  )

  // Fighters with a profile in our database open it on this page; the rest are plain rows.
  return leader.profile_name ? (
    <button
      type="button"
      onClick={() => onOpenProfile(leader.profile_name as string)}
      aria-label={`${leader.fighter}, rank ${leader.rank}, ${leader.value}. View profile`}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none"
    >
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-2.5 px-2 py-1.5">{content}</div>
  )
}
