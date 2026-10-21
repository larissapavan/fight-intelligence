import { useCallback, useMemo } from 'react'

import type { OrgFighter } from '../types/api'
import { normalizeFighterName } from './useFighterImages'
import { useOrgFighters } from './useOrgData'

// Built once per fighter list, not once per component that wants a lookup.
const indexes = new WeakMap<OrgFighter[], Map<string, OrgFighter>>()

function indexFor(fighters: OrgFighter[]) {
  let index = indexes.get(fighters)
  if (!index) {
    index = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    indexes.set(fighters, index)
  }
  return index
}

/** Find a fighter of an organization by name (accent- and case-insensitive), for pages that only have names to show. */
export function useOrgFighterLookup(org: string) {
  const { fighters } = useOrgFighters(org)
  const index = useMemo(() => indexFor(fighters), [fighters])
  return useCallback((name: string): OrgFighter | undefined => index.get(normalizeFighterName(name)), [index])
}
