import { normalizeFighterName } from '../hooks/useFighterImages'

/**
 * Active / Former UFC / No UFC fights comes from the backend (`ufc_status`): the fighter is active when booked,
 * ranked, champion or recently fought and not on roster.watch's former list; former when they fought in the UFC
 * or are on that list; otherwise "never". These manual lists only correct the cases the data lags on.
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
