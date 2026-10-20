import { Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import { useFighterLookup } from '../hooks/useFighterLookup'
import type { FightResult, UpcomingPick } from '../types/api'
import { FighterAvatar } from './FighterAvatar'
import { TitleFightBadge } from './FighterBadges'
import { PickChip } from './PickChip'

function matchupPath(fight: FightResult, eventName?: string) {
  const params = new URLSearchParams({ a: fight.fighter_1, b: fight.fighter_2 })
  if (eventName) params.set('event', eventName)
  return `/matchup-intelligence?${params.toString()}`
}

/** Shared fight row: names and photos on the corners, model reading centered underneath. */
export function FightMatchupCard({
  fight,
  pick,
  eventName,
  onOpenFighter,
  details,
}: {
  fight: FightResult
  pick?: UpcomingPick
  eventName?: string
  onOpenFighter?: (name: string) => void
  details?: string[]
}) {
  const to = matchupPath(fight, eventName)
  const fighter1Won = fight.winner != null && fight.winner === fight.fighter_1
  const fighter2Won = fight.winner != null && fight.winner === fight.fighter_2

  return (
    <article className="metric-tile relative rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5">
      <Link to={to} aria-label={`${fight.fighter_1} vs ${fight.fighter_2}`} className="absolute inset-0 z-0 rounded-2xl" />
      <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 pointer-events-none">
        <CornerPhoto name={fight.fighter_1} />
        <CornerName name={fight.fighter_1} align="right" won={fighter1Won} onOpenFighter={onOpenFighter} />
        <span className="broadcast-label px-0.5 text-[10px] text-[var(--text-muted)]">vs</span>
        <CornerName name={fight.fighter_2} align="left" won={fighter2Won} onOpenFighter={onOpenFighter} />
        <CornerPhoto name={fight.fighter_2} />
      </div>

      <div className="relative z-10 mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 pointer-events-none">
        <TitleFightBadge fight={fight} />
        <span className="pointer-events-auto">
          <PickChip pick={pick} />
        </span>
        {fight.weight_class ? <span className="selector-chip text-[10px] text-[var(--text-main)]">{fight.weight_class}</span> : null}
      </div>

      {details?.length ? (
        <div className="relative z-10 mt-2 space-y-0.5 text-center text-[11px] leading-4 text-[var(--text-muted)] pointer-events-none sm:text-xs">
          {details.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function CornerPhoto({ name }: { name: string }) {
  const lookup = useFighterLookup()
  const { imageByName } = useFighterImages()
  const fighter = lookup(name)

  return (
    <FighterAvatar
      name={name}
      imageUrl={getFighterImageUrl(name, imageByName, fighter?.image_url)}
      className="h-10 w-9 sm:h-12 sm:w-10"
    />
  )
}

function CornerName({
  name,
  align,
  won,
  onOpenFighter,
}: {
  name: string
  align: 'left' | 'right'
  won: boolean
  onOpenFighter?: (name: string) => void
}) {
  const profile = useFighterLookup()(name)
  const side = align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  const label = (
    <>
      {align === 'right' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" /> : null}
      <span className={`text-sm font-bold leading-tight text-[var(--text-main)] sm:text-base ${won ? '' : 'font-semibold'}`}>{name}</span>
      {align === 'left' && won ? <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" /> : null}
    </>
  )

  if (profile && onOpenFighter) {
    return (
      <button
        type="button"
        onClick={() => onOpenFighter(profile.name)}
        aria-label={`${name}. View profile`}
        className={`pointer-events-auto flex min-w-0 items-center gap-1.5 px-1 py-1 ${side}`}
      >
        {label}
      </button>
    )
  }

  return <span className={`flex min-w-0 items-center gap-1.5 px-1 py-1 ${side}`}>{label}</span>
}
