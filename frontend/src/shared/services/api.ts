import axios from 'axios'
import type {
  EventSummary,
  FighterPerformance,
  FighterProfile,
  HeadToHeadResponse,
  HealthInfo,
  ModelInfo,
  PredictionResponse,
  RankingCategory,
} from '../types/api'

const apiBaseURL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  : '/api'

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000,
})

export const getFighters = async () => {
  const response = await api.get<FighterProfile[]>('/fighters')
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

export const getModelInfo = async () => {
  const response = await api.get<ModelInfo>('/model-info')
  return response.data
}

export const getHealth = async () => {
  const response = await api.get<HealthInfo>('/health')
  return response.data
}

export const predictFight = async (fighter_a_name: string, fighter_b_name: string) => {
  const response = await api.post<PredictionResponse>('/predict', {
    fighter_a: fighter_a_name,
    fighter_b: fighter_b_name,
  })
  return response.data
}
