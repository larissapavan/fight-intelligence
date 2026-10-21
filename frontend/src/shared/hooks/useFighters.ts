import { useEffect, useState } from 'react'

import { getFighters } from '../services/api'
import type { FighterProfile } from '../types/api'

/**
 * One request for the whole catalog, shared by every component that asks for it. The home page alone mounts the hook a
 * dozen times, and each mount used to download the full list again.
 */
let catalog: Promise<FighterProfile[]> | null = null
let loaded: FighterProfile[] | null = null

function loadCatalog() {
  catalog ??= getFighters().then(
    (data) => (loaded = data),
    (error) => {
      catalog = null // let the next mount try again
      throw error
    },
  )
  return catalog
}

/** Forget the shared catalog (tests start every case from an empty cache). */
export function resetFightersCache() {
  catalog = null
  loaded = null
}

/** Pass false to skip the request (pages of another organization do not need the UFC catalog). */
export function useFighters(enabled = true) {
  const [fighters, setFighters] = useState<FighterProfile[]>(loaded ?? [])
  const [loading, setLoading] = useState(enabled && loaded === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || loaded) return
    let active = true
    loadCatalog()
      .then((data) => active && setFighters(data))
      .catch(() => active && setError('Unable to load fighters from the API.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [enabled])

  return { fighters, loading, error }
}
