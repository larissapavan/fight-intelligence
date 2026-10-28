export const DIVISION_NAMES_PT: Record<string, string> = {
  Flyweight: 'Peso Mosca',
  Bantamweight: 'Peso Galo',
  Featherweight: 'Peso Pena',
  Lightweight: 'Peso Leve',
  Welterweight: 'Peso Meio-Médio',
  Middleweight: 'Peso Médio',
  'Light Heavyweight': 'Peso Meio-Pesado',
  Heavyweight: 'Peso Pesado',
  "Women's Strawweight": 'Peso Palha Feminino',
  "Women's Flyweight": 'Peso Mosca Feminino',
  "Women's Bantamweight": 'Peso Galo Feminino',
  "Women's Featherweight": 'Peso Pena Feminino',
  "Women's Lightweight": 'Peso Leve Feminino',
  "Women's Atomweight": 'Peso Átomo Feminino',
  'Catch Weight': 'Peso Combinado',
  Catchweight: 'Peso Combinado',
  'Open Class': 'Peso Aberto',
  'Open Class / Unclassified': 'Peso Aberto / Outros',
}

export const DIVISION_NAMES_FR: Record<string, string> = {
  Flyweight: 'Poids mouche',
  Bantamweight: 'Poids coq',
  Featherweight: 'Poids plume',
  Lightweight: 'Poids léger',
  Welterweight: 'Poids mi-moyen',
  Middleweight: 'Poids moyen',
  'Light Heavyweight': 'Poids mi-lourd',
  Heavyweight: 'Poids lourd',
  "Women's Strawweight": 'Poids paille féminin',
  "Women's Flyweight": 'Poids mouche féminin',
  "Women's Bantamweight": 'Poids coq féminin',
  "Women's Featherweight": 'Poids plume féminin',
  "Women's Lightweight": 'Poids léger féminin',
  "Women's Atomweight": 'Poids atome féminin',
  'Catch Weight': 'Poids convenu',
  Catchweight: 'Poids convenu',
  'Open Class': 'Poids libre',
  'Open Class / Unclassified': 'Poids libre / autres',
}

export function getDivisionName(division: string | null | undefined, language: string | boolean = false): string {
  if (!division) return ''
  const lang = typeof language === 'string' ? language : language ? 'pt' : 'en'
  if (lang.startsWith('pt') || lang === 'pt') return DIVISION_NAMES_PT[division] ?? division
  if (lang.startsWith('fr')) return DIVISION_NAMES_FR[division] ?? division
  return division
}

/** Official weight limits (lb) and the order the UFC lists its divisions in, lightest first, men then women. */
const LIMITS_LB: Record<string, number> = {
  Flyweight: 125,
  Bantamweight: 135,
  Featherweight: 145,
  Lightweight: 155,
  Welterweight: 170,
  Middleweight: 185,
  'Light Heavyweight': 205,
  Heavyweight: 265,
  "Women's Strawweight": 115,
  "Women's Flyweight": 125,
  "Women's Bantamweight": 135,
  "Women's Featherweight": 145,
}

const ORDER = Object.keys(LIMITS_LB)

export function divisionOrder(division: string) {
  const index = ORDER.indexOf(division)
  return index === -1 ? ORDER.length : index
}

/** "125 lb (56.7 kg)", or null for a division without an official limit. */
export function divisionLimit(division: string): string | null {
  const pounds = LIMITS_LB[division]
  return pounds ? `${pounds} lb (${(pounds * 0.45359237).toFixed(1)} kg)` : null
}
