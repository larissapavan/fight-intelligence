import { useEffect, useState } from 'react'

import { getDataInfo } from '../services/api'
import type { DataInfo } from '../types/api'

export function useDataInfo() {
  const [dataInfo, setDataInfo] = useState<DataInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getDataInfo()
        setDataInfo(data)
      } catch {
        setError('Unable to load data pipeline information from the backend.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { dataInfo, loading, error }
}
