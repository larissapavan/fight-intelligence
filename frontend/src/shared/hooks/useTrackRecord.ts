import { useEffect, useState } from 'react'

import { getTrackRecord } from '../services/api'
import type { TrackRecord } from '../types/api'

export function useTrackRecord() {
  const [data, setData] = useState<TrackRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTrackRecord()
      .then(setData)
      .catch((requestError) => {
        console.error(requestError)
        setError('Unable to load the track record from the API.')
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
