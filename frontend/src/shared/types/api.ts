export interface FighterProfile {
  name: string
  nickname: string | null
  age: number | null
  height_cm: number | null
  weight_lbs: number | null
  reach_cm: number | null
  wins: number | null
  losses: number | null
  draws: number | null
  total_fights: number | null
  win_rate: number | null
  sig_str_acc: number | null
  takedown_acc: number | null
  sig_strikes_landed_per_min: number | null
  sig_strikes_absorbed_per_min: number | null
  striking_defense: number | null
  takedown_avg_per_15min: number | null
  takedown_defense: number | null
  submission_avg_per_15min: number | null
  stance: string
  division: string | null
  belt: boolean
  is_active?: boolean
  ranking: string | null
  rank_signal: string | null
  image_url: string | null
  fighter_url: string | null
  hometown?: string | null
  country?: string | null
  country_code?: string | null
  ufc_status?: 'active' | 'former' | 'never'
  ufc_debut?: string | null
  ufc_last_fight?: string | null
  roster_url?: string | null
  badges?: string[]
  current_titles?: string[]
  former_titles?: string[]
  /** Divisions where the fighter has ever held the interim title. */
  interim_titles?: string[]
  nationalities?: { name: string; code: string | null }[]
}

export interface DataInfo {
  last_updated: string | null
  fighters_count: number
  events_count: number
  fights_count: number
  sources: string[]
}

export interface MainFactor {
  feature: string
  impact: string
  explanation: string
  magnitude: number
}

export interface PredictionResponse {
  predicted_winner: string
  probability: number
  fighter_a_probability: number
  fighter_b_probability: number
  message: string
  fighter_a_profile: FighterProfile
  fighter_b_profile: FighterProfile
  comparison_stats: {
    fighter_a_win_rate: number | null
    fighter_b_win_rate: number | null
    reach_difference: number
    age_difference: number
  }
  main_factors: MainFactor[]
}

export interface ModelInfo {
  model_name: string
  feature_count: number
  metrics: Record<string, number>
  baseline_metrics: Record<string, Record<string, number>>
  features: string[]
  highlights: string[]
  limitations: string[]
}

export interface HealthInfo {
  status: string
  model_loaded: boolean
  fighters_loaded: number
  fights_tracked: number
  latest_fight_date?: string | null
}

export interface FightResult {
  fighter_1: string
  fighter_2: string
  winner: string | null
  weight_class: string | null
  method: string | null
  method_detail: string | null
  round: number | null
  time: string | null
  fight_url: string | null
  referee?: string | null
  num_rounds?: number | null
  title_fight?: boolean | null
  result?: string | null
  result_details?: string | null
  bmf_title?: boolean
}

export interface EventSummary {
  name: string
  date: string | null
  location: string | null
  fight_count: number
  fights: FightResult[]
  event_url: string | null
}

export interface RankingEntry {
  rank: number
  fighter: string
  rank_change: string | null
  win_rate: number | null
  last_fight: string | null
  athlete_url: string | null
}

export interface RankingCategory {
  category: string
  is_p4p: boolean
  entries: RankingEntry[]
}

export interface FightRecord {
  event_name: string
  date: string | null
  opponent: string
  result: 'win' | 'loss' | null
  weight_class: string | null
  method: string | null
  method_detail: string | null
  round: number | null
  time: string | null
  winner?: string | null
  location?: string | null
  fight_url?: string | null
  referee?: string | null
  num_rounds?: number | null
  title_fight?: boolean | null
  bmf_title?: boolean
  /** The interim belt was at stake (the interim champion won it or defended it). */
  interim_title?: boolean
  /** The fighter won the interim title fight. */
  interim_title_win?: boolean
  outcome?: string | null
  result_details?: string | null
}

export interface CommonOpponent {
  opponent: string
  fighter_a_result: 'win' | 'loss' | null
  fighter_b_result: 'win' | 'loss' | null
}

export interface HeadToHeadResponse {
  fighter_a: string
  fighter_b: string
  fighter_a_wins: number
  fighter_b_wins: number
  no_contests: number
  meetings: FightRecord[]
  common_opponents: CommonOpponent[]
  network_path: string[]
  degrees_of_separation: number | null
}

export interface SimilarFighter {
  name: string
  similarity: number
  division: string | null
  wins: number
  losses: number
  draws: number
  image_url: string | null
}

export interface YearlyTrend {
  year: number
  fights: number
  wins: number
  losses: number
  win_rate: number | null
  finish_rate: number | null
  avg_win_time_seconds: number | null
  round_distribution: Record<string, number>
}

export interface TitleReign {
  division: string
  title_type: 'undisputed' | 'interim'
  champion: string
  fighter_url: string | null
  fighter_reign_index: number
  won_how: string | null
  opponent_beaten: string | null
  event: string | null
  location: string | null
  date_won: string | null
  days_held: number | null
  is_current: boolean
  defenses_count: number
  defenses_detail: string | null
  end_reason: string
  last_fight?: {
    event: string | null
    date: string | null
    opponent: string
    result: 'win' | 'loss' | null
    method: string | null
    round: number | null
    time: string | null
  } | null
}

export interface ChampionSummary {
  champion: string
  fighter_url: string | null
  divisions: string[]
  total_reigns: number
  total_defenses: number
  total_days_as_champion: number
  longest_reign_days: number
  is_current_champion: boolean
}

export interface TitleWin {
  division: string
  title_type: 'undisputed' | 'interim'
  opponent: string | null
  event: string | null
  date: string | null
  method: string | null
  round: number | null
  won_how: string | null
  defenses: number
  reigns_in_division: number
}

export interface TitleFight {
  date: string | null
  event: string | null
  division: string | null
  opponent: string
  result: 'win' | 'loss' | 'draw' | 'no_contest'
  role: 'won_title' | 'defense' | 'lost_title' | 'challenge' | 'other'
  label: string
  title_type: 'undisputed' | 'interim' | null
  method: string | null
  round: number | null
}

export interface RecordEntry {
  rank: number
  champion: string
  fighter_url: string | null
  division: string | null
  value: number
  detail: string | null
  title_wins?: TitleWin[] | null
  title_fights?: TitleFight[] | null
}

export interface RecordCategory {
  key: string
  label: string
  kind: 'positive' | 'negative'
  unit: string
  entries: RecordEntry[]
}

export interface ChampionsResponse {
  current_champions: TitleReign[]
  /** Every reign of every belt, oldest first within each division. */
  reigns: TitleReign[]
  greatest_champions: ChampionSummary[]
  records: RecordCategory[]
}

export interface FighterPerformance {
  fighter: string
  total_fights: number
  wins: number
  losses: number
  method_breakdown: Record<string, number>
  round_distribution: Record<string, number>
  avg_win_time_seconds: number | null
  weight_class_history: string[]
  last_performances: FightRecord[]
  career_timeline: FightRecord[]
  yearly_trends: YearlyTrend[]
}

export interface RecordBookLeader {
  rank: number
  fighter: string
  value: string
  profile_name: string | null
  ufc_url: string | null
}

export interface RecordBookStat {
  key: string
  title: string
  note: string | null
  unit: string
  leaders: RecordBookLeader[]
}

export interface RecordBookCategory {
  name: string
  stats: RecordBookStat[]
}

export interface RecordBookResponse {
  updated: string | null
  source_name: string
  source_url: string
  categories: RecordBookCategory[]
}

export interface Opponent {
  name: string
  fights: number
  last_date: string | null
}

export interface OpponentsResponse {
  fighter: string
  opponents: Opponent[]
}

export interface NewsItem {
  title: string
  summary: string | null
  url: string
  image_url: string | null
  published: string | null
  kind: 'story' | 'video'
}

export interface NewsResponse {
  source_name: string
  source_url: string
  items: NewsItem[]
}

export interface TrackedFight {
  event_name: string
  event_date: string
  fighter_1: string
  fighter_2: string
  predicted_winner: string
  confidence: number
  winner: string | null
  correct: boolean
}

export interface ConfidenceBand {
  label: string
  fights: number
  average_confidence: number
  accuracy: number
}

export interface TrackRecord {
  tracking_since: string | null
  logged: number
  resolved: number
  correct: number
  accuracy: number | null
  average_confidence: number | null
  pending: number
  next_event: { name: string; date: string } | null
  bands: ConfidenceBand[]
  recent: TrackedFight[]
  biggest_misses: TrackedFight[]
}

export interface UpcomingPick {
  event_name: string
  event_date: string | null
  fighter_1: string
  fighter_2: string
  predicted_winner: string
  probability: number
  fighter_1_probability: number
}
