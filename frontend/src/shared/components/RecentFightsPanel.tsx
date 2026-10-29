import { useTranslation } from 'react-i18next'
import { L, localeTag } from '../../i18n/lang'
import { getMethodLabel } from '../data/fightLabels'
import type { FightRecord, FighterPerformance } from '../types/api'
import { LoadingSkeleton } from './LoadingSkeleton'

function ResultChip({ result }: { result: FightRecord['result'] }) {
  const { i18n } = useTranslation()

  if (result === 'win') {
    return (
      <span className="type-tech rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[11px] font-bold uppercase text-[#C8102E]">
        {L(i18n.language, 'Vitória', 'Win', 'Victoire')}
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
        {L(i18n.language, 'Derrota', 'Loss', 'Défaite')}
      </span>
    )
  }
  return (
    <span className="type-tech rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
      N/C
    </span>
  )
}

function formatMethod(fight: FightRecord, language: string | boolean = false) {
  const method = fight.method ? getMethodLabel(fight.method, language) : null
  if (method && fight.method_detail) return `${method} · ${fight.method_detail}`
  return method ?? fight.outcome ?? L(language, 'Resultado a definir', 'Result pending', 'Résultat à venir')
}

function formatDate(date: string | null, lang = 'en-US') {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(localeTag(lang), { month: 'short', day: 'numeric', year: 'numeric' })
}

function FightRow({ fight }: { fight: FightRecord }) {
  const { i18n } = useTranslation()
  const date = formatDate(fight.date, i18n.language)
  return (
    <li className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-main)]">vs {fight.opponent}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
          {formatMethod(fight, i18n.language)}
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
  const { i18n } = useTranslation()
  const dotColor = tone === 'red' ? 'bg-[#C8102E]' : 'bg-[var(--accent-blue)]'
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <h3 className="type-tech truncate text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-main)]">{name}</h3>
      </div>
      {loading ? (
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[46px]" />
          ))}
        </div>
      ) : fights.length ? (
        <ul className="mt-2 space-y-1.5">
          {fights.slice(0, 5).map((fight) => (
            <FightRow key={`${fight.event_name}|${fight.date ?? ''}|${fight.opponent}`} fight={fight} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{L(i18n.language, 'Nenhuma luta recente registrada no UFC.', 'No recent UFC fights on file.', 'Aucun combat UFC récent enregistré.')}</p>
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
  const { i18n } = useTranslation()
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{L(i18n.language, 'Últimos 5 combates', 'Last five', 'Cinq derniers combats')}</p>
      <h2 className="mt-0.5 text-lg font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{L(i18n.language, 'Histórico Recente', 'Recent fights', 'Combats récents')}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Column name={nameA} fights={performanceA?.last_performances ?? []} loading={loading} tone="red" />
        <Column name={nameB} fights={performanceB?.last_performances ?? []} loading={loading} tone="blue" />
      </div>
    </article>
  )
}
