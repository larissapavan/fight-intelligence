import axios from 'axios'
import type {
  DivisionMatrix,
  OtherOrganization,
  ChampionsResponse,
  DataInfo,
  EventSummary,
  FighterPerformance,
  FighterProfile,
  HeadToHeadResponse,
  FightRecord,
  GymDetail,
  GymSummary,
  HealthInfo,
  UpcomingPick,
  TrackRecord,
  NewsResponse,
  OpponentsResponse,
  RecordBookResponse,
  ModelInfo,
  OrgEvent,
  OrgFighter,
  OrgRankingCategory,
  PredictionResponse,
  RankingCategory,
  SimilarFighter,
} from '../types/api'

const apiBaseURL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  : '/api'

declare const __BUILD_ID__: string | undefined

// Every request carries the build id, so each deploy starts with fresh answers instead of whatever the browser cached
// from the previous one (the API caches for up to an hour). Without the define (a stray config, tests) it is "dev".
const BUILD_ID = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000,
  params: { v: BUILD_ID },
})

export const getFighters = async () => {
  const response = await api.get<FighterProfile[]>('/fighters', { params: { ufc_only: true } })
  return response.data
}

export const getEvents = async () => {
  const response = await api.get<EventSummary[]>('/events')
  return response.data
}

export const getUpcomingEvents = async () => {
  const response = await api.get<EventSummary[]>('/events/upcoming')
  return response.data
}

export const getRankings = async () => {
  const response = await api.get<RankingCategory[]>('/rankings')
  return response.data
}

export const getDivisionMatrix = async (category: string, top = 8) => {
  const response = await api.get<DivisionMatrix>('/predict/division', { params: { category, top } })
  return response.data
}

export const getUpcomingPicks = async () => {
  const response = await api.get<UpcomingPick[]>('/predict/upcoming')
  return response.data
}

export const getTrackRecord = async () => {
  const response = await api.get<TrackRecord>('/track-record')
  return response.data
}

export const getNews = async (limit = 6) => {
  const response = await api.get<NewsResponse>('/news', { params: { limit } })
  return response.data
}

export const getRecordBook = async () => {
  const response = await api.get<RecordBookResponse>('/record-book')
  return response.data
}

export const getChampions = async () => {
  const response = await api.get<ChampionsResponse>('/champions')
  return response.data
}

export const getOpponents = async (fighter: string) => {
  const response = await api.get<OpponentsResponse>(`/fighters/${encodeURIComponent(fighter)}/opponents`)
  return response.data.opponents
}

export const getHeadToHead = async (fighterA: string, fighterB: string) => {
  const response = await api.get<HeadToHeadResponse>('/head-to-head', {
    params: { fighter_a: fighterA, fighter_b: fighterB },
  })
  return response.data
}

export const getFighterPerformance = async (fighterName: string) => {
  const response = await api.get<FighterPerformance>(`/fighters/${encodeURIComponent(fighterName)}/performance`)
  return response.data
}

export const getOtherOrganizations = async (fighterName: string) => {
  const response = await api.get<OtherOrganization[]>(`/fighters/${encodeURIComponent(fighterName)}/other-organizations`)
  return response.data
}

export const getSimilarFighters = async (fighterName: string, limit = 5) => {
  const response = await api.get<SimilarFighter[]>(`/fighters/${encodeURIComponent(fighterName)}/similar`, {
    params: { limit },
  })
  return response.data
}

export const getModelInfo = async () => {
  const response = await api.get<ModelInfo>('/model-info')
  return response.data
}

export const getHealth = async () => {
  const response = await api.get<HealthInfo>('/health', { timeout: 20000 })
  return response.data
}

/** Free hosts sleep when idle; keep pinging until the process is up. */
export const waitForHealth = async (attempts = 8) => {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await getHealth()
    } catch (requestError) {
      lastError = requestError
      await new Promise((resolve) => setTimeout(resolve, Math.min(3000 * (attempt + 1), 10000)))
    }
  }
  throw lastError
}

export const getDataInfo = async () => {
  const response = await api.get<DataInfo>('/data-info')
  return response.data
}

export const predictFight = async (fighter_a_name: string, fighter_b_name: string) => {
  const response = await api.post<PredictionResponse>('/predict', {
    fighter_a: fighter_a_name,
    fighter_b: fighter_b_name,
  })
  return response.data
}

// Organizations other than the UFC share one set of endpoints, /orgs/{id}/...

export const getOrgFighters = async (org: string) => {
  const response = await api.get<OrgFighter[]>(`/orgs/${org}/fighters`)
  return response.data
}

export const getOrgEvents = async (org: string) => {
  const response = await api.get<OrgEvent[]>(`/orgs/${org}/events`)
  return response.data
}

export const getOrgUpcomingEvents = async (org: string) => {
  const response = await api.get<OrgEvent[]>(`/orgs/${org}/events/upcoming`)
  return response.data
}

export const getOrgRankings = async (org: string) => {
  const response = await api.get<OrgRankingCategory[]>(`/orgs/${org}/rankings`)
  return response.data
}

export const getOrgFighterFights = async (org: string, fighter: string) => {
  const response = await api.get<FightRecord[]>(`/orgs/${org}/fighters/${encodeURIComponent(fighter)}/fights`)
  return response.data
}

export const getOrgDataInfo = async (org: string) => {
  const response = await api.get<DataInfo>(`/orgs/${org}/data-info`)
  return response.data
}

// Gyms are shared by every organization: a gym is matched with the fighters of each one.

export const getGyms = async () => {
  const response = await api.get<GymSummary[]>('/gyms')
  return response.data
}

export const getGym = async (slug: string) => {
  const response = await api.get<GymDetail>(`/gyms/${encodeURIComponent(slug)}`)
  return response.data
}
