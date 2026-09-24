import { useEffect, useState } from 'react'

import { getFighters } from '../services/api'
import type { FighterProfile } from '../types/api'

export function useFighters() {
  const [fighters, setFighters] = useState<FighterProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFighters()
        setFighters(data)
      } catch {
        setError('Unable to load fighters from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { fighters, loading, error }
}
