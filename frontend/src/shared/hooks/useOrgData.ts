import { useEffect, useState } from 'react'

import {
  getOrgEvents,
  getOrgFighterFights,
  getOrgFighters,
  getOrgRankings,
  getOrgUpcomingEvents,
} from '../services/api'
import type { FightRecord, OrgEvent, OrgFighter, OrgRankingCategory } from '../types/api'

/**
 * Data of the organizations other than the UFC. Every answer is requested once per organization and shared by all the
 * components that ask for it (the home page and the header search both need the fighter list).
 */
const requests = new Map<string, Promise<unknown>>()
const answers = new Map<string, unknown>()

function load<T>(key: string, loader: () => Promise<T>): Promise<T> {
  let request = requests.get(key) as Promise<T> | undefined
  if (!request) {
    request = loader().then(
      (data) => {
        answers.set(key, data)
        return data
      },
      (error) => {
        requests.delete(key) // let the next mount try again
        throw error
      },
    )
    requests.set(key, request)
  }
  return request
}

/** Forget everything (tests start every case from an empty cache). */
export function resetOrgData() {
  requests.clear()
  answers.clear()
}

export function useOrgResource<T>(key: string | null, loader: () => Promise<T>, errorMessage: string, empty: T) {
  const [state, setState] = useState<{ key: string | null; data: T; error: string | null }>(() => ({
    key,
    data: key && answers.has(key) ? (answers.get(key) as T) : empty,
    error: null,
  }))

  useEffect(() => {
    if (!key) return
    let active = true
    load(key, loader)
      .then((data) => active && setState({ key, data, error: null }))
      .catch((error) => {
        console.error(error)
        if (active) setState({ key, data: empty, error: errorMessage })
      })
    return () => {
      active = false
    }
    // The loader and the empty value are recreated on every render; the key says everything that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // The state belongs to the key it was loaded for: a new key (another fighter, another organization) starts loading.
  const current = state.key === key
  const cached = key !== null && answers.has(key)
  const data = cached ? (answers.get(key as string) as T) : current ? state.data : empty
  const failed = current && state.error !== null
  return { data, loading: key !== null && !cached && !failed, error: failed ? state.error : null }
}

const NO_FIGHTERS: OrgFighter[] = []
const NO_EVENTS: OrgEvent[] = []
const NO_RANKINGS: OrgRankingCategory[] = []
const NO_FIGHTS: FightRecord[] = []

/** Pass null to skip the request (the header search runs on every page, including the UFC ones). */
export function useOrgFighters(org: string | null) {
  const { data, loading, error } = useOrgResource(
    org && `${org}:fighters`,
    () => getOrgFighters(org as string),
    'Unable to load fighters from the API.',
    NO_FIGHTERS,
  )
  return { fighters: data, loading, error }
}

export function useOrgEvents(org: string) {
  const { data, loading, error } = useOrgResource(
    `${org}:events`,
    () => getOrgEvents(org),
    'Unable to load events from the API.',
    NO_EVENTS,
  )
  return { events: data, loading, error }
}

export function useOrgUpcomingEvents(org: string) {
  const { data, loading, error } = useOrgResource(
    `${org}:upcoming`,
    () => getOrgUpcomingEvents(org),
    'Unable to load upcoming events from the API.',
    NO_EVENTS,
  )
  return { events: data, loading, error }
}

export function useOrgRankings(org: string) {
  const { data, loading, error } = useOrgResource(
    `${org}:rankings`,
    () => getOrgRankings(org),
    'Unable to load rankings from the API.',
    NO_RANKINGS,
  )
  return { rankings: data, loading, error }
}

export function useOrgFighterFights(org: string, fighter: string) {
  const { data, loading, error } = useOrgResource(
    `${org}:fights:${fighter}`,
    () => getOrgFighterFights(org, fighter),
    'Unable to load this fighter’s fights.',
    NO_FIGHTS,
  )
  return { fights: data, loading, error }
}
