import { useEffect, useState } from 'react'

import { getRankings } from '../services/api'
import type { RankingCategory } from '../types/api'

export function useRankings() {
  const [rankings, setRankings] = useState<RankingCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getRankings()
        setRankings(data)
      } catch (requestError) {
        console.error(requestError)
        setError('Unable to load rankings from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { rankings, loading, error }
}
