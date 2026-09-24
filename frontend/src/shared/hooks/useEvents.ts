import { useEffect, useState } from 'react'

import { getEvents } from '../services/api'
import type { EventSummary } from '../types/api'

export function useEvents() {
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getEvents()
        setEvents(data)
      } catch (requestError) {
        console.error(requestError)
        setError('Unable to load events from the API.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { events, loading, error }
}
