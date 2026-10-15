import { BADGES } from '../data/badges'
import type { FighterProfile } from '../types/api'
import { FlagIcon } from './FlagIcon'

type FighterBadgesProps = {
  badges: string[] | undefined
  /** "short" shows abbreviations (cards); "full" spells the name out (profile). */
  variant?: 'short' | 'full'
  className?: string
}

export function FighterBadges({ badges, variant = 'short', className = '' }: FighterBadgesProps) {
  const known = (badges ?? []).filter((key) => BADGES[key])
  if (known.length === 0) return null

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Fighter badges">
      {known.map((key) => {
        const info = BADGES[key]
        return (
          <li
            key={key}
            title={info.label}
            className={`border-2 border-[var(--rule)] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-[0.08em] ${
              key === 'bmf_current'
                ? 'bg-[#C8102E] text-white'
                : info.honor
                  ? 'bg-[#F2C230] text-[#0E0E0E]'
                  : 'bg-[var(--surface-3)] text-[var(--text-main)]'
            }`}
          >
            <span aria-hidden={variant === 'short'}>{variant === 'full' ? info.label : info.short}</span>
            {variant === 'short' ? <span className="sr-only">{info.label}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

type FlagListProps = {
  fighter: Pick<FighterProfile, 'nationalities' | 'country_code' | 'country'>
  className?: string
}

/** Every nationality as a flag, the country the fighter represents first. Falls back to the single main flag. */
export function FlagList({ fighter, className = 'h-3.5 w-[21px]' }: FlagListProps) {
  const list = fighter.nationalities?.length
    ? fighter.nationalities
    : fighter.country_code
      ? [{ name: fighter.country ?? '', code: fighter.country_code }]
      : []
  if (list.length === 0) return null

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {list.map((nationality) => (
        <FlagIcon key={`${nationality.code}-${nationality.name}`} code={nationality.code} country={nationality.name} className={className} />
      ))}
    </span>
  )
}

type TitleFightBadgeProps = {
  fight: { title_fight?: boolean | null; bmf_title?: boolean }
  className?: string
}

/** Flags a championship fight ("Title fight") or a BMF belt fight ("BMF title fight"). Renders nothing otherwise. */
export function TitleFightBadge({ fight, className = '' }: TitleFightBadgeProps) {
  if (fight.bmf_title) {
    return (
      <span className={`border-2 border-[var(--rule)] bg-[#C8102E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white ${className}`}>
        BMF title fight
      </span>
    )
  }
  if (!fight.title_fight) return null
  return (
    <span className={`border-2 border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0E0E0E] ${className}`}>
      Title fight
    </span>
  )
}
