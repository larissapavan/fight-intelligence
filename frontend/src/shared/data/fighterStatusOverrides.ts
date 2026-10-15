import { normalizeFighterName } from '../hooks/useFighterImages'

/**
 * Active vs. Retired / Released comes from the backend (`is_active`: fought in the last two years, booked on
 * an upcoming card, or ranked). "Retired / Released" means no longer on the UFC roster: the fighter may have
 * retired, been cut, or moved to another organization. That inference lags real-world changes, so confirmed
 * ones are listed here to override it.
 */
const KNOWN_ACTIVE_FIGHTERS = new Set(
  [
    'Amanda Nunes', // Out of retirement; fights Kayla Harrison for the title at UFC 334 (Nov 14, 2026).
  ].map(normalizeFighterName),
)

const KNOWN_RETIRED_FIGHTERS = new Set(
  [
    'Dustin Poirier', // Retired after UFC 318 (Jul 19, 2025), trilogy loss to Max Holloway.
    'Henry Cejudo', // Retired after UFC 323 (Dec 6, 2025), in-cage announcement following loss to Payton Talbott.
    'Tecia Pennington', // Parted ways with the UFC / removed from roster (Jan 23, 2026).
    'Gilbert Burns', // Retired in-cage at UFC Fight Night 273 (Apr 18, 2026).
    'Colby Covington', // Notified the UFC of his retirement (May 18, 2026).
    'Irene Aldana', // Retired via social media confirmation (Jul 17, 2026).
    'Farid Basharat', // Released by the UFC (Oct 2026); undefeated at 15-0, no fight booked.
  ].map(normalizeFighterName),
)

export function isKnownRetired(name: string) {
  return KNOWN_RETIRED_FIGHTERS.has(normalizeFighterName(name))
}

export function isKnownActive(name: string) {
  return KNOWN_ACTIVE_FIGHTERS.has(normalizeFighterName(name))
}
