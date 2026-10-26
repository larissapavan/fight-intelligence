import { useTranslation } from 'react-i18next'

import { BADGES, CHAMPION_SEALS, getBadgeLabel } from '../data/badges'
import { DIVISION_NAMES_PT } from '../data/divisions'
import type { FighterProfile } from '../types/api'
import { FlagIcon } from './FlagIcon'

export { DIVISION_NAMES_PT }

type FighterBadgesProps = {
  badges: string[] | undefined
  /** "short" shows abbreviations (cards); "full" spells the name out (profile). */
  variant?: 'short' | 'full'
  className?: string
}

export function FighterBadges({ badges, variant = 'short', className = '' }: FighterBadgesProps) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const known = (badges ?? []).filter((key) => BADGES[key])
  if (known.length === 0) return null

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label={isPt ? 'Selos do lutador' : 'Fighter badges'}>
      {known.map((key) => {
        const info = BADGES[key]
        const label = getBadgeLabel(key, isPt)
        return (
          <li
            key={key}
            title={label}
            className={`border-2 border-[var(--rule)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] ${
              CHAMPION_SEALS.has(key)
                ? 'bg-[#C9CDD3] text-[#0E0E0E]'
                : info.honor
                  ? 'bg-[#F2C230] text-[#0E0E0E]'
                  : 'bg-[var(--surface-3)] text-[var(--text-main)]'
            }`}
          >
            <span aria-hidden={variant === 'short'}>{variant === 'full' ? label : info.short}</span>
            {variant === 'short' ? <span className="sr-only">{label}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** "Current Lightweight Champion" seals. Profile only; gold. */
export function CurrentChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label={isPt ? 'Cinturões atuais' : 'Current championships'}>
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[#0E0E0E]"
        >
          {isPt ? `Campeão Atual (${DIVISION_NAMES_PT[title] ?? title})` : `Current ${title} Champion`}
        </li>
      ))}
    </ul>
  )
}

/** "Former Lightweight Champion" seals. Profile only; red. */
export function FormerChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label={isPt ? 'Cinturões anteriores' : 'Former championships'}>
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#C8102E] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-white"
        >
          {isPt ? `Ex-Campeão (${DIVISION_NAMES_PT[title] ?? title})` : `Former ${title} Champion`}
        </li>
      ))}
    </ul>
  )
}

/** "Interim Lightweight Champion" seals for anyone who has held an interim belt. Profile only; blue, like title defenses. */
export function InterimChampionSeals({ titles, className = '' }: { titles: string[] | undefined; className?: string }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  if (!titles?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label={isPt ? 'Cinturões interinos' : 'Interim championships'}>
      {titles.map((title) => (
        <li
          key={title}
          className="border-2 border-[var(--rule)] bg-[#1F4E9C] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-white"
        >
          {isPt ? `Campeão Interino (${DIVISION_NAMES_PT[title] ?? title})` : `Interim ${title} Champion`}
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
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const division = fight.weight_class && !/catch/i.test(fight.weight_class) ? fight.weight_class : null
  const divPt = division ? (DIVISION_NAMES_PT[division] ?? division) : ''
  const base = `border-2 border-[var(--rule)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${className}`

  if (fight.interim_title) {
    const label = isPt
      ? divPt
        ? (fight.interim_title_win ? `Cinturão Interino • ${divPt}` : `Disputa de Cinturão Interino • ${divPt}`)
        : (fight.interim_title_win ? 'Conquista de Cinturão Interino' : 'Disputa de Cinturão Interino')
      : `Interim ${division ? `${division} ` : ''}title ${fight.interim_title_win ? 'win' : 'fight'}`

    return (
      <span className={`${base} bg-[#1F4E9C] text-white`}>
        {label}
      </span>
    )
  }
  if (fight.bmf_title) {
    return (
      <span className={`${base} bg-[#C9CDD3] text-[#0E0E0E]`}>
        {isPt ? 'Disputa de Cinturão BMF' : 'BMF title fight'}
      </span>
    )
  }
  if (!fight.title_fight) return null

  const label = isPt
    ? divPt ? `Disputa de Cinturão • ${divPt}` : 'Disputa de Cinturão'
    : division ? `${division} title fight` : 'Title fight'

  return <span className={`${base} bg-[#F2C230] text-[#0E0E0E]`}>{label}</span>
}
