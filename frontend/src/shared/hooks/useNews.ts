import { useEffect, useState } from 'react'

import { getNews } from '../services/api'
import type { NewsResponse } from '../types/api'

/** Latest UFC headlines. A failed request just leaves `data` empty: news is a bonus, never an error on the page. */
export function useNews(limit = 6) {
  const [data, setData] = useState<NewsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getNews(limit)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((requestError) => console.error(requestError))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  return { data, loading }
}
