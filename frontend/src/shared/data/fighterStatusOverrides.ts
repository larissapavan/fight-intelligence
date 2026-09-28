import { normalizeFighterName } from '../hooks/useFighterImages'

/**
 * Active/Retired is inferred from whether a fighter has a headshot in the live
 * api.octagon-api.com roster feed. That feed lags real-world retirements, so
 * confirmed retirements are listed here to override it until the upstream
 * feed catches up.
 */
const KNOWN_RETIRED_FIGHTERS = new Set(
  [
    'Dustin Poirier', // Retired after UFC 318 (Jul 19, 2025), trilogy loss to Max Holloway.
    'Henry Cejudo', // Retired after UFC 323 (Dec 6, 2025), in-cage announcement following loss to Payton Talbott.
    'Tecia Pennington', // Parted ways with the UFC / removed from roster (Jan 23, 2026).
    'Gilbert Burns', // Retired in-cage at UFC Fight Night 273 (Apr 18, 2026).
    'Colby Covington', // Notified the UFC of his retirement (May 18, 2026).
    'Irene Aldana', // Retired via social media confirmation (Jul 17, 2026).
  ].map(normalizeFighterName),
)

export function isKnownRetired(name: string) {
  return KNOWN_RETIRED_FIGHTERS.has(normalizeFighterName(name))
}
