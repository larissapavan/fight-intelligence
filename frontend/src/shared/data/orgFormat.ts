import type { OrgFighter, OrgFightResult } from '../types/api'

const METHOD_NAMES: Record<string, string> = {
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  DEC: 'Decision',
  'KO/TKO': 'Knockout',
  SUB: 'Submission',
  DQ: 'Disqualification',
  'NO CONTEST': 'No Contest',
  Draw: 'Draw',
  Walkover: 'Walkover',
}

export function formatMethod(method: string | null, detail?: string | null) {
  if (!method) return null
  const label = METHOD_NAMES[method] ?? method
  return detail ? `${label} (${detail})` : label
}

/** "KO/TKO · R2 · 4:07" for a fought bout, null for one that has not happened. */
export function fightSummary(fight: Pick<OrgFightResult, 'method' | 'method_detail' | 'round' | 'time'>) {
  const parts = [formatMethod(fight.method, fight.method_detail), fight.round ? `R${fight.round}` : null, fight.time]
  const text = parts.filter(Boolean).join(' · ')
  return text || null
}

export function formatDate(date: string | null, withYear = true) {
  if (!date) return 'Date unknown'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { year: withYear ? 'numeric' : undefined, month: 'short', day: 'numeric' })
}

export function formatRecord(fighter: Pick<OrgFighter, 'wins' | 'losses' | 'draws' | 'no_contests'>) {
  if (fighter.wins == null || fighter.losses == null) return null
  const base = `${fighter.wins}-${fighter.losses}-${fighter.draws ?? 0}`
  return fighter.no_contests ? `${base} (${fighter.no_contests} NC)` : base
}

/** 167.6 cm -> 5'6" (168 cm) */
export function formatHeight(cm: number | null) {
  if (cm == null) return null
  const inches = Math.round(cm / 2.54)
  return `${Math.floor(inches / 12)}'${inches % 12}" (${Math.round(cm)} cm)`
}

/** 175.3 cm -> 69" (175 cm) */
export function formatReach(cm: number | null) {
  if (cm == null) return null
  return `${Math.round(cm / 2.54)}" (${Math.round(cm)} cm)`
}

export function formatWeight(lbs: number | null) {
  if (lbs == null) return null
  const kilos = Math.round(lbs * 0.45359237)
  return `${Math.round(lbs)} lbs (${kilos} kg)`
}

/** Lightest to heaviest, men's divisions first, then women's. */
const DIVISION_ORDER = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight',
  'Heavyweight', "Women's Atomweight", "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight",
  "Women's Lightweight",
]

export function compareDivisions(a: string, b: string) {
  const rank = (division: string) => {
    const index = DIVISION_ORDER.indexOf(division)
    return index === -1 ? DIVISION_ORDER.length : index
  }
  return rank(a) - rank(b) || a.localeCompare(b)
}

/** Where the fighter lives and trains, without repeating the same place twice. */
export function originLine(fighter: Pick<OrgFighter, 'hometown' | 'fighting_out_of' | 'country'>) {
  const places = [fighter.hometown, fighter.fighting_out_of].filter((place, index, all): place is string => Boolean(place) && all.indexOf(place) === index)
  return places.length ? places.join(' · ') : (fighter.country ?? null)
}
