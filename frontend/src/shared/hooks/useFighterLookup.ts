import { useCallback, useMemo } from 'react'

import type { FighterProfile } from '../types/api'
import { normalizeFighterName } from './useFighterImages'
import { useFighters } from './useFighters'

/** Find a fighter profile by name (accent- and case-insensitive), for pages that only have names to show. */
export function useFighterLookup() {
  const { fighters } = useFighters()
  const index = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])
  return useCallback((name: string): FighterProfile | undefined => index.get(normalizeFighterName(name)), [index])
}
