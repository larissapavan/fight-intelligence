import { useEffect, useState } from 'react'

import { getChampions } from '../services/api'
import type { ChampionsResponse } from '../types/api'

export function useChampions() {
  const [data, setData] = useState<ChampionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getChampions()
        setData(response)
      } catch (requestError) {
        console.error(requestError)
        setError('Unable to load champions from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { data, loading, error }
}
