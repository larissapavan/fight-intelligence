import { useCallback, useMemo } from 'react'

import type { FighterProfile } from '../types/api'
import { normalizeFighterName } from './useFighterImages'
import { useFighters } from './useFighters'

// Built once per catalog, not once per component that wants a lookup.
const indexes = new WeakMap<FighterProfile[], Map<string, FighterProfile>>()

function indexFor(fighters: FighterProfile[]) {
  let index = indexes.get(fighters)
  if (!index) {
    index = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    indexes.set(fighters, index)
  }
  return index
}

/** Find a fighter profile by name (accent- and case-insensitive), for pages that only have names to show. */
export function useFighterLookup() {
  const { fighters } = useFighters()
  const index = useMemo(() => indexFor(fighters), [fighters])
  return useCallback((name: string): FighterProfile | undefined => index.get(normalizeFighterName(name)), [index])
}
