import { getGym, getGyms } from '../services/api'
import type { GymDetail, GymSummary } from '../types/api'
import { useOrgResource } from './useOrgData'

const NO_GYMS: GymSummary[] = []

/** Every gym, the biggest first. Requested once and shared by the pages that need it. */
export function useGyms() {
  const { data, loading, error } = useOrgResource('gyms', getGyms, 'Unable to load gyms from the API.', NO_GYMS)
  return { gyms: data, loading, error }
}

export function useGym(slug: string) {
  const { data, loading, error } = useOrgResource<GymDetail | null>(`gym:${slug}`, () => getGym(slug), 'Unable to load this gym.', null)
  return { gym: data, loading, error }
}
