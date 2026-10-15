import { useEffect, useState } from 'react'

import { getRecordBook } from '../services/api'
import type { RecordBookResponse } from '../types/api'

export function useRecordBook() {
  const [data, setData] = useState<RecordBookResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setData(await getRecordBook())
      } catch (requestError) {
        console.error(requestError)
        setError('Unable to load the record book from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { data, loading, error }
}
