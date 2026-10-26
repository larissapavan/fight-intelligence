import { useTranslation } from 'react-i18next'
import { getDivisionName } from '../data/divisions'
import { fightSummary, formatDate } from '../data/orgFormat'
import type { FightRecord } from '../types/api'

/** One bout of a fighter's history in an organization other than the UFC: result, opponent, event and how it ended. */
export function OrgFightLine({ fight, knownOpponent, onSelect }: { fight: FightRecord; knownOpponent: boolean; onSelect: (name: string) => void }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const win = fight.result === 'win'
  const loss = fight.result === 'loss'
  const upcoming = fight.result === null && !fight.method
  const summary = fightSummary(fight, isPt)
  const label = win
    ? isPt ? 'Vitória' : 'Win'
    : loss
      ? isPt ? 'Derrota' : 'Loss'
      : upcoming
        ? isPt ? 'Prevista' : 'Upcoming'
        : fight.outcome === 'draw'
          ? isPt ? 'Empate' : 'Draw'
          : isPt ? 'Sem resultado' : 'No result'

  return (
    <li className="metric-tile flex items-center gap-3 rounded-xl px-3 py-2">
      <span
        title={label}
        className={`grid h-7 w-7 shrink-0 place-items-center border-2 text-xs font-bold ${
          win ? 'border-[var(--rule)] bg-[var(--accent-red)] text-white' : loss ? 'border-[var(--rule)] bg-[var(--surface-3)] text-[var(--text-main)]' : 'border-[var(--line-soft)] text-[var(--text-muted)]'
        }`}
      >
        <span aria-hidden="true">{win ? (isPt ? 'V' : 'W') : loss ? (isPt ? 'D' : 'L') : upcoming ? '·' : '–'}</span>
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
          vs{' '}
          {knownOpponent ? (
            <button
              type="button"
              onClick={() => onSelect(fight.opponent)}
              aria-label={isPt ? `${fight.opponent}. Ver perfil` : `${fight.opponent}. View profile`}
              className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
            >
              {fight.opponent}
            </button>
          ) : (
            fight.opponent
          )}
          {fight.title_fight ? (
            <span className="ml-1.5 bg-[#F2C230] px-1 text-[10px] font-bold uppercase text-[#0E0E0E]">
              {isPt ? 'Cinturão' : 'Title'}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {[
            fight.event_name,
            formatDate(fight.date, true, isPt),
            fight.weight_class ? getDivisionName(fight.weight_class, isPt) : null,
          ].filter(Boolean).join(' · ')}
        </p>
        {summary ? <p className="truncate text-xs text-[var(--text-muted)]">{summary}</p> : null}
      </div>
    </li>
  )
}
