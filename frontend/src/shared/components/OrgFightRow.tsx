import { Trophy } from 'lucide-react'

import { fightSummary } from '../data/orgFormat'
import { useOrgFighterLookup } from '../hooks/useOrgFighterLookup'
import type { OrgFightResult } from '../types/api'
import { FighterAvatar } from './FighterAvatar'

/** One bout of an organization's card: both corners, the weight class, the stage and, once fought, how it ended. */
export function OrgFightRow({
  org,
  fight,
  scheduled = false,
  onOpenFighter,
}: {
  org: string
  fight: OrgFightResult
  /** The bout is still to come: without a result that means "scheduled", not "the site has no result". */
  scheduled?: boolean
  onOpenFighter?: (name: string) => void
}) {
  const lookup = useOrgFighterLookup(org)
  const summary = fightSummary(fight)
  const stage = fight.stage && !fight.title_fight ? fight.stage : null

  return (
    <article className="metric-tile rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
        <FighterAvatar name={fight.fighter_1} imageUrl={lookup(fight.fighter_1)?.image_url ?? null} className="h-10 w-9 sm:h-12 sm:w-10" />
        <Corner name={fight.fighter_1} align="right" won={fight.winner === fight.fighter_1} onOpen={onOpenFighter} known={lookup(fight.fighter_1) !== undefined} />
        <span className="broadcast-label px-0.5 text-[11px] text-[var(--text-muted)]">vs</span>
        <Corner name={fight.fighter_2} align="left" won={fight.winner === fight.fighter_2} onOpen={onOpenFighter} known={lookup(fight.fighter_2) !== undefined} />
        <FighterAvatar name={fight.fighter_2} imageUrl={lookup(fight.fighter_2)?.image_url ?? null} className="h-10 w-9 sm:h-12 sm:w-10" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
        {fight.title_fight ? (
          <span className="border-2 border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0E0E0E]">
            {fight.weight_class ? `${fight.weight_class} ` : ''}title fight
          </span>
        ) : null}
        {fight.weight_class && !fight.title_fight ? (
          <span className="selector-chip text-[11px] text-[var(--text-main)]">{fight.weight_class}</span>
        ) : null}
        {stage ? <span className="selector-chip text-[11px] text-[var(--text-main)]">{stage}</span> : null}
      </div>

      <p className="mt-2 text-center text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
        {summary ?? (fight.winner ? 'Result recorded' : scheduled ? 'Scheduled' : 'No result recorded')}
      </p>
    </article>
  )
}

function Corner({
  name,
  align,
  won,
  known,
  onOpen,
}: {
  name: string
  align: 'left' | 'right'
  won: boolean
  known: boolean
  onOpen?: (name: string) => void
}) {
  const side = align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  const label = (
    <>
      {align === 'right' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-label="Winner" /> : null}
      <span className={`text-sm leading-tight text-[var(--text-main)] sm:text-base ${won ? 'font-bold' : 'font-semibold'}`}>{name}</span>
      {align === 'left' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-label="Winner" /> : null}
    </>
  )

  if (known && onOpen) {
    return (
      <button type="button" onClick={() => onOpen(name)} aria-label={`${name}. View profile`} className={`flex min-w-0 items-center gap-1.5 px-1 py-1 ${side}`}>
        {label}
      </button>
    )
  }
  return <span className={`flex min-w-0 items-center gap-1.5 px-1 py-1 ${side}`}>{label}</span>
}
