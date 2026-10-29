import { localeTag, uiLang } from '../../i18n/lang'
import type { OrgFighter, OrgFightResult } from '../types/api'

const METHOD_NAMES_EN: Record<string, string> = {
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

const METHOD_NAMES_PT: Record<string, string> = {
  'U-DEC': 'Decisão Unânime',
  'S-DEC': 'Decisão Dividida',
  'M-DEC': 'Decisão Majoritária',
  DEC: 'Decisão',
  'KO/TKO': 'Nocaute (KO/TKO)',
  SUB: 'Finalização',
  DQ: 'Desqualificação (DQ)',
  'NO CONTEST': 'Sem Resultado (NC)',
  Draw: 'Empate',
  Walkover: 'W.O.',
}

const METHOD_NAMES_FR: Record<string, string> = {
  'U-DEC': 'Décision unanime',
  'S-DEC': 'Décision partagée',
  'M-DEC': 'Décision majoritaire',
  DEC: 'Décision',
  'KO/TKO': 'KO/TKO',
  SUB: 'Soumission',
  DQ: 'Disqualification',
  'NO CONTEST': 'Sans résultat (NC)',
  Draw: 'Nul',
  Walkover: 'Forfait',
}

export function formatMethod(method: string | null, detail?: string | null, language: string | boolean = false) {
  if (!method) return null
  const lang = uiLang(language)
  const map = lang === 'pt' ? METHOD_NAMES_PT : lang === 'fr' ? METHOD_NAMES_FR : METHOD_NAMES_EN
  const label = map[method] ?? method
  return detail ? `${label} (${detail})` : label
}

/** "KO/TKO · R2 · 4:07" for a fought bout, null for one that has not happened. */
export function fightSummary(fight: Pick<OrgFightResult, 'method' | 'method_detail' | 'round' | 'time'>, language: string | boolean = false) {
  const parts = [formatMethod(fight.method, fight.method_detail, language), fight.round ? `R${fight.round}` : null, fight.time]
  const text = parts.filter(Boolean).join(' · ')
  return text || null
}

export function formatDate(date: string | null, withYear = true, language: string | boolean = false) {
  const lang = uiLang(language)
  if (!date) return lang === 'pt' ? 'Data a definir' : lang === 'fr' ? 'Date à confirmer' : 'Date unknown'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(localeTag(language), { year: withYear ? 'numeric' : undefined, month: 'short', day: 'numeric' })
}

export function formatRecord(fighter: Pick<OrgFighter, 'wins' | 'losses' | 'draws' | 'no_contests'>) {
  if (fighter.wins == null || fighter.losses == null) return null
  const base = `${fighter.wins}-${fighter.losses}-${fighter.draws ?? 0}`
  return fighter.no_contests ? `${base} (${fighter.no_contests} NC)` : base
}

/** 167.6 cm -> 5'6" (168 cm) or 168 cm (5'6") in PT */
export function formatHeight(cm: number | null, language: string | boolean = false) {
  if (cm == null) return null
  const inches = Math.round(cm / 2.54)
  const imperial = `${Math.floor(inches / 12)}'${inches % 12}"`
  const metric = `${Math.round(cm)} cm`
  return uiLang(language) === 'en' ? `${imperial} (${metric})` : `${metric} (${imperial})`
}

/** 175.3 cm -> 69" (175 cm) or 175 cm (69") in PT */
export function formatReach(cm: number | null, language: string | boolean = false) {
  if (cm == null) return null
  const imperial = `${Math.round(cm / 2.54)}"`
  const metric = `${Math.round(cm)} cm`
  return uiLang(language) === 'en' ? `${imperial} (${metric})` : `${metric} (${imperial})`
}

export function formatWeight(lbs: number | null, language: string | boolean = false) {
  if (lbs == null) return null
  const kilos = Math.round(lbs * 0.45359237)
  const imperial = `${Math.round(lbs)} lbs`
  const metric = `${kilos} kg`
  return uiLang(language) === 'en' ? `${imperial} (${metric})` : `${metric} (${imperial})`
}

/** Lightest to heaviest, men's divisions first, then women's. */
const DIVISION_ORDER = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Super Middleweight',
  'Light Heavyweight', 'Cruiserweight', 'Heavyweight', "Women's Atomweight", "Women's Strawweight", "Women's Flyweight",
  "Women's Bantamweight", "Women's Featherweight", "Women's Lightweight",
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
