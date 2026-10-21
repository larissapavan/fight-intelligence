import { normalizeFighterName } from '../hooks/useFighterImages'
import type { FighterProfile } from '../types/api'

const RESULT_LIMIT = 8

/** Fighters whose name (or nickname) matches: names that start with the text first, then the ones with more fights. */
export function searchFighters(fighters: FighterProfile[], text: string, limit = RESULT_LIMIT) {
  const term = normalizeFighterName(text)
  if (!term) return []
  const scored: { fighter: FighterProfile; rank: number }[] = []
  for (const fighter of fighters) {
    const name = normalizeFighterName(fighter.name)
    const nickname = fighter.nickname ? normalizeFighterName(fighter.nickname) : ''
    let rank = -1
    if (name.startsWith(term)) rank = 0
    else if (name.split(' ').some((part) => part.startsWith(term))) rank = 1
    else if (name.includes(term)) rank = 2
    else if (nickname.includes(term)) rank = 3
    if (rank >= 0) scored.push({ fighter, rank })
  }
  return scored
    .sort((a, b) => a.rank - b.rank || (b.fighter.total_fights ?? 0) - (a.fighter.total_fights ?? 0) || a.fighter.name.localeCompare(b.fighter.name))
    .slice(0, limit)
    .map((entry) => entry.fighter)
}
