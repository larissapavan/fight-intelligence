/** A tiny, fake API: two fighters, one past card, one upcoming card. Every page is rendered against these. */

const fighter = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  nickname: null,
  age: 30,
  height_cm: 180,
  weight_lbs: 155,
  reach_cm: 183,
  wins: 12,
  losses: 2,
  draws: 0,
  total_fights: 14,
  win_rate: 0.857,
  sig_str_acc: 0.5,
  takedown_acc: 0.4,
  sig_strikes_landed_per_min: 4,
  sig_strikes_absorbed_per_min: 3,
  striking_defense: 0.55,
  takedown_avg_per_15min: 1.5,
  takedown_defense: 0.7,
  submission_avg_per_15min: 0.5,
  stance: 'Orthodox',
  division: 'Lightweight',
  belt: false,
  is_active: true,
  ranking: null,
  rank_signal: null,
  image_url: null,
  fighter_url: `http://ufcstats.com/fighter-details/${name.replace(/\s/g, '')}`,
  hometown: 'Rio de Janeiro, Brazil',
  country: 'Brazil',
  country_code: 'br',
  ufc_status: 'active',
  ufc_debut: '2019-01-01',
  ufc_last_fight: '2026-06-01',
  roster_url: null,
  badges: [],
  nationalities: [{ name: 'Brazil', code: 'br' }],
  ...extra,
})

export const alpha = fighter('Alpha One', { nickname: 'The First' })
export const beta = fighter('Beta Two')

const fight = (extra: Record<string, unknown> = {}) => ({
  event_name: 'UFC 900: Alpha vs. Beta',
  fighter_1: 'Alpha One',
  fighter_2: 'Beta Two',
  winner: null,
  weight_class: 'Lightweight',
  method: null,
  method_detail: null,
  round: null,
  time: null,
  fight_url: null,
  referee: null,
  num_rounds: 5,
  title_fight: false,
  bmf_title: false,
  result: null,
  result_details: null,
  ...extra,
})

const event = (name: string, date: string, fights: unknown[]) => ({
  name,
  date,
  location: 'Las Vegas, Nevada, USA',
  fight_count: fights.length,
  fights,
  event_url: `http://ufcstats.com/event-details/${name.replace(/\W/g, '')}`,
})

const performance = {
  fighter: 'Alpha One',
  total_fights: 2,
  wins: 2,
  losses: 0,
  method_breakdown: { 'KO/TKO': 1, Submission: 0, Decision: 1 },
  round_distribution: { '1': 1, '3': 1 },
  avg_win_time_seconds: 420,
  weight_class_history: ['Lightweight'],
  last_performances: [],
  career_timeline: [],
  yearly_trends: [],
}

const reign = {
  division: 'Lightweight',
  title_type: 'undisputed',
  champion: 'Alpha One',
  fighter_url: null,
  fighter_reign_index: 1,
  won_how: 'def. Beta Two',
  opponent_beaten: 'Beta Two',
  event: 'UFC 900',
  location: 'Las Vegas, Nevada, USA',
  date_won: '2025-01-01',
  days_held: 400,
  is_current: true,
  defenses_count: 2,
  defenses_detail: null,
  end_reason: 'current',
  last_fight: { event: 'UFC 900', date: '2026-06-01', opponent: 'Beta Two', result: 'win', method: 'KO/TKO', round: 2, time: '3:10' },
}

const titleFight = {
  date: '2025-01-01',
  event: 'UFC 900',
  division: 'Lightweight',
  opponent: 'Beta Two',
  result: 'win',
  role: 'won_title',
  label: 'Won title',
  title_type: 'undisputed',
  method: 'KO/TKO',
  round: 2,
}

export const routes: Record<string, unknown> = {
  '/health': { status: 'ok', model_loaded: true, fighters_loaded: 2, fights_tracked: 10, latest_fight_date: '2026-10-10' },
  '/model-info': {
    model_name: 'HistGradientBoostingClassifier',
    feature_count: 46,
    metrics: { accuracy: 0.75, roc_auc: 0.82, log_loss: 0.51 },
    baseline_metrics: { dummy_most_frequent: { accuracy: 0.56, roc_auc: 0.5, log_loss: 6 } },
    features: ['age_diff'],
    highlights: ['Temporal validation'],
    limitations: ['Estimates only'],
  },
  '/data-info': { last_updated: '2026-10-10', fighters_count: 2, events_count: 2, fights_count: 10, sources: ['ESPN'] },
  '/fighters': [alpha, beta],
  '/events': [event('UFC 899: Past Card', '2026-09-01', [fight({ event_name: 'UFC 899: Past Card', winner: 'Alpha One', method: 'KO/TKO', round: 2, result: 'KO/TKO' })])],
  '/events/upcoming': [event('UFC 900: Alpha vs. Beta', '2030-01-01', [fight(), fight({ fighter_1: 'Gamma Three', fighter_2: 'Delta Four' })])],
  '/predict/upcoming': [
    { event_name: 'UFC 900: Alpha vs. Beta', event_date: '2030-01-01', fighter_1: 'Gamma Three', fighter_2: 'Delta Four', predicted_winner: 'Gamma Three', probability: 0.72, fighter_1_probability: 0.72 },
  ],
  '/rankings': [
    { category: 'Lightweight', is_p4p: false, entries: [{ rank: 0, fighter: 'Alpha One', win_rate: 0.857, last_fight: '2026-06-01', rank_change: null, athlete_url: null }, { rank: 1, fighter: 'Beta Two', win_rate: 0.8, last_fight: '2026-05-01', rank_change: null, athlete_url: null }] },
    { category: "Pound-for-Pound (Men's)", is_p4p: true, entries: [{ rank: 1, fighter: 'Alpha One', win_rate: 0.857, last_fight: '2026-06-01', rank_change: null, athlete_url: null }] },
  ],
  '/champions': {
    current_champions: [reign],
    greatest_champions: [{ champion: 'Alpha One', fighter_url: null, divisions: ['Lightweight'], total_reigns: 1, total_defenses: 2, total_days_as_champion: 400, longest_reign_days: 400, is_current_champion: true }],
    records: [
      { key: 'most_defenses', label: 'Most defenses in a single reign', kind: 'positive', unit: 'defenses', entries: [{ rank: 1, champion: 'Alpha One', fighter_url: null, division: 'Lightweight', value: 2, detail: null }] },
      { key: 'multi_division_champions', label: 'Multi-division champions', kind: 'positive', unit: 'divisions', entries: [{ rank: 1, champion: 'Alpha One', fighter_url: null, division: 'Featherweight, Lightweight', value: 2, detail: null, title_wins: [], title_fights: [titleFight] }] },
    ],
  },
  '/record-book': {
    updated: '2026-10-15',
    source_name: 'UFC Stats Leaders',
    source_url: 'https://statleaders.ufc.com/en/career',
    categories: [{ name: 'Fights', stats: [{ key: 'TotalFights', title: 'Total Fights', note: null, unit: 'Fights', leaders: [{ rank: 1, fighter: 'Alpha One', value: '30', profile_name: 'Alpha One', ufc_url: null }] }] }],
  },
  '/news': { source_name: 'ESPN', source_url: 'https://www.espn.com/mma/', items: [{ title: 'Alpha One retains the title', summary: null, url: 'https://www.espn.com/ufc/story/1', image_url: null, published: '2026-10-15T10:00:00Z', kind: 'story' }] },
  '/track-record': { tracking_since: '2026-10-15', logged: 4, resolved: 0, correct: 0, accuracy: null, average_confidence: null, pending: 4, next_event: { name: 'UFC 900: Alpha vs. Beta', date: '2030-01-01' }, bands: [], recent: [], biggest_misses: [] },
  '/head-to-head': { fighter_a: 'Alpha One', fighter_b: 'Beta Two', fighter_a_wins: 1, fighter_b_wins: 0, no_contests: 0, meetings: [], common_opponents: [], network_path: [], degrees_of_separation: 0 },
  '/fighters/Alpha One/opponents': { fighter: 'Alpha One', opponents: [{ name: 'Beta Two', fights: 1, last_date: '2026-06-01' }] },
  '/fighters/Alpha One/performance': performance,
}

/** Look a URL up in the fake API; unknown fighters reuse the shapes above. */
export function respond(rawUrl: string): unknown {
  const url = decodeURIComponent(rawUrl)
  if (url in routes) return routes[url]
  if (url.endsWith('/performance')) return { ...performance, fighter: url.split('/')[2] }
  if (url.endsWith('/opponents')) return { fighter: '', opponents: [] }
  if (url.endsWith('/similar')) return []
  throw new Error(`The fake API has no answer for ${url}`)
}
