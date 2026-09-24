import { useState } from 'react'

import { predictFight } from '../services/api'
import type { PredictionResponse } from '../types/api'

export function usePrediction() {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPrediction = async (fighterA: string, fighterB: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await predictFight(fighterA, fighterB)
      setPrediction(response)
      return response
    } catch {
      setError('Fight analysis failed. Check whether the backend is running correctly.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { prediction, loading, error, runPrediction, setPrediction }
}
