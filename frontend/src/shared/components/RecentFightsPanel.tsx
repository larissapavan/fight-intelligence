import { METHOD_LABELS } from '../data/fightLabels'
import type { FightRecord, FighterPerformance } from '../types/api'
import { LoadingSkeleton } from './LoadingSkeleton'

function ResultChip({ result }: { result: FightRecord['result'] }) {
  if (result === 'win') {
    return (
      <span className="type-tech rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#C8102E]">
        Win
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
        Loss
      </span>
    )
  }
  return (
    <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
      N/C
    </span>
  )
}

function formatMethod(fight: FightRecord) {
  const method = fight.method ? (METHOD_LABELS[fight.method] ?? fight.method) : null
  if (method && fight.method_detail) return `${method} · ${fight.method_detail}`
  return method ?? fight.outcome ?? 'Result pending'
}

function formatDate(date: string | null) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FightRow({ fight }: { fight: FightRecord }) {
  const date = formatDate(fight.date)
  return (
    <li className="flex items-start justify-between gap-2 rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#FFFFFF]">vs {fight.opponent}</p>
        <p className="mt-0.5 truncate text-[11px] text-[#999999]">
          {formatMethod(fight)}
          {date ? ` · ${date}` : ''}
        </p>
      </div>
      <ResultChip result={fight.result} />
    </li>
  )
}

function Column({
  name,
  fights,
  loading,
  tone,
}: {
  name: string
  fights: FightRecord[]
  loading: boolean
  tone: 'red' | 'blue'
}) {
  return (
    <div>
      <h3 className={`truncate text-sm font-bold uppercase tracking-[0.04em] ${tone === 'red' ? 'text-[#C8102E]' : 'text-[var(--accent-blue)]'}`}>
        {name}
      </h3>
      {loading ? (
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[52px] rounded-xl" label="Loading recent fight" />
          ))}
        </div>
      ) : fights.length ? (
        <ul className="mt-2 space-y-1.5">
          {fights.slice(0, 5).map((fight) => (
            <FightRow key={`${fight.event_name}|${fight.date ?? ''}|${fight.opponent}`} fight={fight} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[#999999]">No recent UFC fights on file.</p>
      )}
    </div>
  )
}

export function RecentFightsPanel({
  nameA,
  nameB,
  performanceA,
  performanceB,
  loading = false,
}: {
  nameA: string
  nameB: string
  performanceA: FighterPerformance | null
  performanceB: FighterPerformance | null
  loading?: boolean
}) {
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <p className="broadcast-label text-[10px] text-[#999999]">Last five</p>
      <h2 className="mt-0.5 text-lg font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Recent fights</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Column name={nameA} fights={performanceA?.last_performances ?? []} loading={loading} tone="red" />
        <Column name={nameB} fights={performanceB?.last_performances ?? []} loading={loading} tone="blue" />
      </div>
    </article>
  )
}
