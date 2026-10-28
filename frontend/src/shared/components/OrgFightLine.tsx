import { useTranslation } from 'react-i18next'
import { L } from '../../i18n/lang'
import { getDivisionName } from '../data/divisions'
import { fightSummary, formatDate } from '../data/orgFormat'
import type { FightRecord } from '../types/api'

/** One bout of a fighter's history in an organization other than the UFC: result, opponent, event and how it ended. */
export function OrgFightLine({ fight, knownOpponent, onSelect }: { fight: FightRecord; knownOpponent: boolean; onSelect: (name: string) => void }) {
  const { i18n } = useTranslation()

  const win = fight.result === 'win'
  const loss = fight.result === 'loss'
  const upcoming = fight.result === null && !fight.method
  const summary = fightSummary(fight, i18n.language)
  const label = win
    ? L(i18n.language, 'Vitória', 'Win', 'Victoire')
    : loss
      ? L(i18n.language, 'Derrota', 'Loss', 'Défaite')
      : upcoming
        ? L(i18n.language, 'Prevista', 'Upcoming', 'À venir')
        : fight.outcome === 'draw'
          ? L(i18n.language, 'Empate', 'Draw', 'Nul')
          : L(i18n.language, 'Sem resultado', 'No result', 'Sans résultat')

  return (
    <li className="metric-tile flex items-center gap-3 rounded-xl px-3 py-2">
      <span
        title={label}
        className={`grid h-7 w-7 shrink-0 place-items-center border-2 text-xs font-bold ${
          win ? 'border-[var(--rule)] bg-[var(--accent-red)] text-white' : loss ? 'border-[var(--rule)] bg-[var(--surface-3)] text-[var(--text-main)]' : 'border-[var(--line-soft)] text-[var(--text-muted)]'
        }`}
      >
        <span aria-hidden="true">{win ? L(i18n.language, 'V', 'W', 'V') : loss ? L(i18n.language, 'D', 'L', 'D') : upcoming ? '·' : '–'}</span>
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
          vs{' '}
          {knownOpponent ? (
            <button
              type="button"
              onClick={() => onSelect(fight.opponent)}
              aria-label={L(i18n.language, `${fight.opponent}. Ver perfil`, `${fight.opponent}. View profile`, `${fight.opponent}. Voir le profil`)}
              className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
            >
              {fight.opponent}
            </button>
          ) : (
            fight.opponent
          )}
          {fight.title_fight ? (
            <span className="ml-1.5 bg-[#F2C230] px-1 text-[10px] font-bold uppercase text-[#0E0E0E]">
              {L(i18n.language, 'Cinturão', 'Title', 'Titre')}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {[
            fight.event_name,
            formatDate(fight.date, true, i18n.language),
            fight.weight_class ? getDivisionName(fight.weight_class, i18n.language) : null,
          ].filter(Boolean).join(' · ')}
        </p>
        {summary ? <p className="truncate text-xs text-[var(--text-muted)]">{summary}</p> : null}
      </div>
    </li>
  )
}
