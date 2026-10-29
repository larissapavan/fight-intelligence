import { useCallback, useEffect, useMemo, useState } from 'react'

import { getOrgUpcomingPicks, getUpcomingPicks } from '../services/api'
import type { UpcomingPick } from '../types/api'

const keyOf = (event: string, fighterA: string, fighterB: string) => `${event}|${fighterA}|${fighterB}`

/** The model's pick for each announced fight. A failed request just means no picks are shown. */
export function useUpcomingPicks(orgId?: string, enabled: boolean = true) {
  const [picks, setPicks] = useState<UpcomingPick[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const fetcher = orgId && orgId !== 'ufc' ? getOrgUpcomingPicks(orgId) : getUpcomingPicks()
    fetcher
      .then((data) => {
        if (!cancelled) setPicks(data)
      })
      .catch((requestError) => console.error(requestError))
    return () => {
      cancelled = true
    }
  }, [orgId, enabled])

  const index = useMemo(() => new Map(picks.map((pick) => [keyOf(pick.event_name, pick.fighter_1, pick.fighter_2), pick])), [picks])
  return useCallback((event: string, fighterA: string, fighterB: string) => index.get(keyOf(event, fighterA, fighterB)), [index])
}
