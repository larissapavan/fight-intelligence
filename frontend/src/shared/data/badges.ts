import type { FighterProfile } from '../types/api'

type BadgeInfo = { short: string; label: string; honor: boolean }

/** Origin and honor badges from roster.watch. Honors (belt, hall of fame) are highlighted; origins are outlined. */
export const BADGES: Record<string, BadgeInfo> = {
  bmf_current: { short: 'BMF ★', label: 'Current BMF Champion', honor: true },
  goat: { short: 'GOAT', label: 'Greatest of all time', honor: true },
  bmf: { short: 'BMF', label: 'Former BMF Champion', honor: true },
  hof: { short: 'HoF', label: 'UFC Hall of Fame', honor: true },
  dwcs: { short: 'DWCS', label: "Dana White's Contender Series", honor: false },
  tuf: { short: 'TUF', label: 'The Ultimate Fighter', honor: false },
  r2u: { short: 'R2U', label: 'Road to UFC', honor: false },
  sf: { short: 'SF', label: 'Strikeforce', honor: false },
  wec: { short: 'WEC', label: 'World Extreme Cagefighting', honor: false },
  pride: { short: 'PRIDE', label: 'Pride FC', honor: false },
}

/** The champion seals: shown on the profile, left off ranking and champion lists, and drawn in silver. */
export const CHAMPION_SEALS = new Set(['bmf', 'bmf_current'])

/** Ranking lists keep origin badges and leave champion seals for the profile. */
export function badgesForRankings(badges: string[] | undefined) {
  return (badges ?? []).filter((key) => !CHAMPION_SEALS.has(key))
}

/** "Georgia · Spain": the nationalities as text, only when there is more than one to explain. */
export function nationalityText(fighter: Pick<FighterProfile, 'nationalities'>): string | null {
  const names = (fighter.nationalities ?? []).map((nationality) => nationality.name)
  return names.length > 1 ? names.join(' · ') : null
}
