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
  data_confidence?: DataConfidence | null
}

/** How much a prediction has to go on: fights on record, time since the last one, missing measurements. */
export interface DataConfidence {
  level: 'solid' | 'some_gaps' | 'thin'
  label: string
  reasons: string[]
}

/** What a UFC fighter did in another organization (the PFL or Bellator): the record there and every bout. */
export interface OtherOrganization {
  org_id: string
  short_name: string
  name: string
  /** The spelling that organization uses. */
  fighter_name: string
  org_record: string | null
  fights: FightRecord[]
}

export interface RecentEvaluation {
  /** The deployed model scored again on the newest fights, with each fighter's age and record as of the fight. */
  fights: number
  start: string
  end: string
  accuracy: number
  roc_auc: number
  log_loss: number
  brier?: number | null
  ece?: number | null
  confident_threshold?: number | null
  confident_fights?: number | null
  confident_hit_rate?: number | null
  /** What simple rules get right on the same fights. */
  baselines?: { label: string; accuracy: number }[]
  /** How often a pick was right at each confidence level, on the same fights. */
  calibration?: ConfidenceBand[]
}

export interface ModelInfo {
  model_name: string
  feature_count: number
  metrics: Record<string, number>
  baseline_metrics: Record<string, Record<string, number>>
  features: string[]
  highlights: string[]
  limitations: string[]
  /** What to keep in mind about the metrics above (they could not be reproduced). */
  metrics_note?: string | null
  recent_evaluation?: RecentEvaluation | null
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
  /** Picks saved by the first version of the model, before the two corners were averaged. */
  earlier_model_picks?: number
  earlier_model_note?: string | null
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

/** Organizations served by the generic /orgs/{id} endpoints (everything except the UFC). */
export interface NextFight {
  event: string
  date: string | null
  opponent: string
}

export interface OrgFighter {
  name: string
  nickname: string | null
  is_active: boolean
  age: number | null
  height_cm: number | null
  weight_lbs: number | null
  reach_cm: number | null
  leg_reach_cm: number | null
  wins: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  total_fights: number | null
  win_rate: number | null
  division: string | null
  belt: boolean
  /** "champion" or "interim" for a title holder. */
  title_status: string | null
  /** "#3 Bantamweight" or "Champion · Heavyweight". */
  ranking: string | null
  image_url: string | null
  profile_url: string | null
  hometown: string | null
  country: string | null
  country_code: string | null
  camp: string | null
  fighting_out_of: string | null
  circuit: string | null
  org_record: string | null
  /** The UFC profile of the same person, when they have fought in the UFC too. */
  ufc_name?: string | null
  org_fights: number
  first_fight_date: string | null
  last_fight_date: string | null
  next_fight: NextFight | null
}

export interface OrgFightResult extends FightResult {
  /** "Semifinal", "Championship"... */
  stage?: string | null
}

export interface OrgEvent extends Omit<EventSummary, 'fights'> {
  slug: string | null
  circuit: string | null
  fights: OrgFightResult[]
}

export interface OrgRankingEntry extends RankingEntry {
  /** "champion", "interim" or null for a contender. */
  status: string | null
}

export interface OrgRankingCategory {
  category: string
  is_p4p: boolean
  entries: OrgRankingEntry[]
}

export interface GymSummary {
  slug: string
  name: string
  url: string | null
  /** Fighters FightHub lists for the gym. */
  fighters_count: number
  /** How many of them are in each organization's data here ({ ufc: 12, pfl: 3 }). */
  orgs: Record<string, number>
  champions: number
}

export interface GymFighter {
  name: string
  nickname: string | null
  division: string | null
  country_code: string | null
  record: string | null
  /** Organizations whose profile has this fighter, the one he is active in first. Empty when we have no profile. */
  orgs: string[]
  image_url: string | null
  belt: boolean
  is_active: boolean
}

export interface GymDetail extends GymSummary {
  fighters: GymFighter[]
}

export interface RoundRobinRow {
  fighter: string
  rank: number
  average_win_probability: number
  expected_wins: number
}

/** Every ranked fighter of a division against every other, by the model. */
export interface DivisionMatrix {
  category: string
  /** In ranking order; the rows and columns of `matrix`. */
  fighters: string[]
  /** matrix[i][j] is the chance that fighters[i] beats fighters[j]; null on the diagonal. */
  matrix: (number | null)[][]
  round_robin: RoundRobinRow[]
  skipped: string[]
}
