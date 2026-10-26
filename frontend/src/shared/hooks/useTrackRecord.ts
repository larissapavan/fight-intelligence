import { useCallback, useEffect, useState } from 'react'

import { getTrackRecord } from '../services/api'
import type { TrackRecord } from '../types/api'

export function useTrackRecord() {
  const [data, setData] = useState<TrackRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getTrackRecord()
      setData(result)
      setError(null)
    } catch (requestError) {
      console.error(requestError)
      setError('Unable to load the track record from the API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    getTrackRecord()
      .then((result) => {
        if (!ignore) {
          setData(result)
          setError(null)
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          console.error(requestError)
          setError('Unable to load the track record from the API.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [])

  return { data, loading, error, reload }
}
