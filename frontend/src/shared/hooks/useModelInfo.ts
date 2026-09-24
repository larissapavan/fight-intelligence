import { useEffect, useState } from 'react'

import { getHealth, getModelInfo } from '../services/api'
import type { HealthInfo, ModelInfo } from '../types/api'

export function useModelInfo() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [info, healthData] = await Promise.all([getModelInfo(), getHealth()])
        setModelInfo(info)
        setHealth(healthData)
      } catch {
        setError('Unable to load system information from the backend.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { modelInfo, health, loading, error }
}
