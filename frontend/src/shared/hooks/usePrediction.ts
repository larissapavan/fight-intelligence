import { useCallback, useRef, useState } from 'react'

import { predictFight } from '../services/api'
import type { PredictionResponse } from '../types/api'

export function usePrediction() {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestId = useRef(0)

  const runPrediction = useCallback(async (fighterA: string, fighterB: string) => {
    const id = ++requestId.current
    try {
      setLoading(true)
      setError(null)
      const response = await predictFight(fighterA, fighterB)
      if (id !== requestId.current) return response
      setPrediction(response)
      return response
    } catch {
      if (id === requestId.current) {
        setError('Fight analysis failed. Check whether the backend is running correctly.')
      }
      return null
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  return { prediction, loading, error, runPrediction, setPrediction }
}
