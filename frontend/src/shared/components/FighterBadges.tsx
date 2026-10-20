import { BADGES, CHAMPION_SEALS } from '../data/badges'
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
              CHAMPION_SEALS.has(key)
                ? 'bg-[#C9CDD3] text-[#0E0E0E]'
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

/** "Current Lightweight Champion" seals. Profile only; gold. */
export function CurrentChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Current championships">
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-[#0E0E0E]"
        >
          Current {title} Champion
        </li>
      ))}
    </ul>
  )
}

/** "Former Lightweight Champion" seals. Profile only; red. */
export function FormerChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Former championships">
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#C8102E] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-white"
        >
          Former {title} Champion
        </li>
      ))}
    </ul>
  )
}

/** "Interim Lightweight Champion" seals for anyone who has held an interim belt. Profile only; blue, like title defenses. */
export function InterimChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Interim championships">
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#1F4E9C] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-white"
        >
          Interim {title} Champion
        </li>
      ))}
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
  fight: {
    title_fight?: boolean | null
    bmf_title?: boolean
    interim_title?: boolean
    interim_title_win?: boolean
    weight_class?: string | null
  }
  className?: string
}

/**
 * Flags a championship fight and says which belt: "Featherweight title fight", "Interim Lightweight title fight"
 * ("... title win" when the fighter won it, in a fighter's history) or "BMF title fight". Nothing otherwise.
 */
export function TitleFightBadge({ fight, className = '' }: TitleFightBadgeProps) {
  const division = fight.weight_class && !/catch/i.test(fight.weight_class) ? fight.weight_class : null
  const base = `border-2 border-[var(--rule)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`

  if (fight.interim_title) {
    return (
      <span className={`${base} bg-[#1F4E9C] text-white`}>
        Interim {division ? `${division} ` : ''}title {fight.interim_title_win ? 'win' : 'fight'}
      </span>
    )
  }
  if (fight.bmf_title) {
    return <span className={`${base} bg-[#C9CDD3] text-[#0E0E0E]`}>BMF title fight</span>
  }
  if (!fight.title_fight) return null
  return <span className={`${base} bg-[#F2C230] text-[#0E0E0E]`}>{division ? `${division} title fight` : 'Title fight'}</span>
}
