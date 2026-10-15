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
