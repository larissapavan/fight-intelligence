import { useEffect, useState } from 'react'

import { getUpcomingEvents } from '../services/api'
import type { EventSummary } from '../types/api'

export function useUpcomingEvents() {
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getUpcomingEvents()
        setEvents(data)
      } catch (requestError) {
        console.error(requestError)
        setError('Unable to load upcoming events from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { events, loading, error }
}
