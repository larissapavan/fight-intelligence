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
  last_performances: [
    {
      event_name: 'UFC 900: Alpha vs. Beta',
      date: '2026-06-01',
      opponent: 'Beta Two',
      result: 'win',
      weight_class: 'Lightweight',
      method: 'KO/TKO',
      method_detail: 'Punch',
      round: 2,
      time: '3:10',
    },
    {
      event_name: 'UFC 899: Past Card',
      date: '2026-03-01',
      opponent: 'Gamma Three',
      result: 'win',
      weight_class: 'Lightweight',
      method: 'Decision',
      method_detail: null,
      round: 3,
      time: '5:00',
    },
  ],
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


/** A made-up PFL: a champion, a contender, an inactive veteran, one past card and one upcoming card. */
const orgFighter = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  nickname: null,
  is_active: true,
  age: 31,
  height_cm: 175.3,
  weight_lbs: 155,
  reach_cm: 180.3,
  leg_reach_cm: 95,
  wins: 15,
  losses: 3,
  draws: 0,
  no_contests: 0,
  total_fights: 18,
  win_rate: 0.8333,
  division: 'Lightweight',
  belt: false,
  title_status: null,
  ranking: null,
  image_url: null,
  profile_url: `https://pflmma.com/wt-fighter/${name.replace(/\s/g, '-').toLowerCase()}`,
  hometown: 'Houston, TX',
  country: 'United States',
  country_code: 'us',
  camp: 'Iron Gym',
  fighting_out_of: 'Houston, TX',
  circuit: 'PFL',
  org_record: '3-1-0',
  org_fights: 4,
  first_fight_date: '2023-04-01',
  last_fight_date: '2026-04-11',
  next_fight: null,
  ...extra,
})

export const pflChampion = orgFighter('Riko Stone', {
  nickname: 'The Wall',
  belt: true,
  title_status: 'champion',
  ranking: 'Champion · Lightweight',
  next_fight: { event: 'PFL Future', date: '2030-02-02', opponent: 'Dax Moore' },
})
export const pflContender = orgFighter('Dax Moore', { ranking: '#1 Lightweight', country_code: 'br', country: 'Brazil', hometown: 'Sao Paulo, Brazil' })
export const pflVeteran = orgFighter('Lena Ortiz', { is_active: false, division: 'Heavyweight', ranking: null })

const orgFight = (extra: Record<string, unknown> = {}) => ({
  fighter_1: 'Riko Stone',
  fighter_2: 'Dax Moore',
  winner: null,
  weight_class: 'Lightweight',
  stage: null,
  method: null,
  method_detail: null,
  round: null,
  time: null,
  fight_url: null,
  title_fight: null,
  ...extra,
})

const orgEvent = (name: string, date: string, fights: unknown[], extra: Record<string, unknown> = {}) => ({
  name,
  date,
  location: 'Test Arena, Chicago',
  fight_count: fights.length,
  fights,
  event_url: `https://pflmma.com/event/${name.replace(/\s/g, '-').toLowerCase()}`,
  slug: name.replace(/\s/g, '-').toLowerCase(),
  circuit: 'PFL',
  ...extra,
})

const pflRankings = [
  {
    category: 'Lightweight',
    is_p4p: false,
    entries: [
      { rank: 0, fighter: 'Riko Stone', status: 'champion', win_rate: 0.83, last_fight: '2026-04-11', rank_change: null, athlete_url: null },
      { rank: 1, fighter: 'Dax Moore', status: null, win_rate: 0.8, last_fight: '2026-04-11', rank_change: 'up 2', athlete_url: null },
    ],
  },
  {
    category: "Pound-for-Pound (Men's)",
    is_p4p: true,
    entries: [{ rank: 1, fighter: 'Riko Stone', status: null, win_rate: 0.83, last_fight: '2026-04-11', rank_change: null, athlete_url: null }],
  },
]

const pflFights = [
  { event_name: 'PFL Future', date: '2030-02-02', opponent: 'Dax Moore', result: null, weight_class: 'Lightweight', method: null, method_detail: null, round: null, time: null, winner: null, location: 'Test Arena, Chicago', fight_url: 'https://x/#1', title_fight: true, outcome: null },
  { event_name: 'PFL Chicago', date: '2026-04-11', opponent: 'Dax Moore', result: 'win', weight_class: 'Lightweight', method: 'SUB', method_detail: 'Armbar', round: 2, time: '3:10', winner: 'Riko Stone', location: 'Test Arena, Chicago', fight_url: 'https://x/#2', title_fight: null, outcome: 'win' },
]

export const orgRoutes: Record<string, unknown> = {
  '/orgs/pfl/fighters': [pflChampion, pflContender, pflVeteran],
  '/orgs/pfl/events': [
    orgEvent('PFL Chicago', '2026-04-11', [orgFight({ winner: 'Riko Stone', method: 'SUB', method_detail: 'Armbar', round: 2, time: '3:10', fight_url: 'https://x/#2' })]),
    orgEvent('PFL Old Night', '2024-06-01', [orgFight({ fighter_1: 'Lena Ortiz', fighter_2: 'Dax Moore', winner: 'Dax Moore', method: 'U-DEC', round: 3, time: '5:00', weight_class: 'Heavyweight' })]),
  ],
  '/orgs/pfl/events/upcoming': [orgEvent('PFL Future', '2030-02-02', [orgFight({ title_fight: true, stage: 'Championship', fight_url: 'https://x/#1' })])],
  '/orgs/pfl/rankings': pflRankings,
  '/orgs/pfl/data-info': { last_updated: '2026-10-17', fighters_count: 3, events_count: 2, fights_count: 2, sources: ['pflmma.com'] },
  '/orgs/pfl/fighters/Riko Stone/fights': pflFights,
  // Bellator: an archive, so there is no upcoming card and the fighters are mostly retired.
  '/orgs/bellator/fighters': [pflChampion, pflVeteran],
  '/orgs/bellator/events': [orgEvent('Bellator 301', '2023-11-17', [orgFight({ winner: 'Riko Stone', method: 'U-DEC', round: 3, time: '5:00' })], { circuit: null })],
  '/orgs/bellator/events/upcoming': [],
  '/orgs/bellator/rankings': [{ category: 'Lightweight', is_p4p: false, entries: [{ rank: 0, fighter: 'Riko Stone', status: 'champion', win_rate: 0.83, last_fight: '2023-11-17', rank_change: null, athlete_url: null }] }],
  '/orgs/bellator/data-info': { last_updated: '2026-10-21', fighters_count: 2, events_count: 1, fights_count: 1, sources: ['espn.com'] },
}


const gymFighter = (name: string, extra: Record<string, unknown> = {}) => ({
  name, nickname: null, division: 'Lightweight', country_code: 'br', record: '10-2-0', orgs: [], image_url: null, belt: false, is_active: true, ...extra,
})

const gymSummaries = [
  { slug: 'iron-gym', name: 'Iron Gym', url: 'https://fighthub-app.com/br/gyms/iron-gym/', fighters_count: 4, orgs: { ufc: 2, pfl: 1 }, champions: 1 },
  { slug: 'pfl-only-club', name: 'PFL Only Club', url: null, fighters_count: 2, orgs: { pfl: 2 }, champions: 0 },
  { slug: 'lonely-room', name: 'Lonely Room', url: null, fighters_count: 1, orgs: {}, champions: 0 },
]

export const gymRoutes: Record<string, unknown> = {
  '/gyms': gymSummaries,
  '/gyms/iron-gym': {
    ...gymSummaries[0],
    fighters: [
      gymFighter('Alpha One', { orgs: ['ufc'], belt: true, nickname: 'The First' }),
      gymFighter('Riko Stone', { orgs: ['pfl', 'ufc'], division: 'Welterweight' }),
      gymFighter('Beta Two', { orgs: ['ufc'] }),
      gymFighter('Nobody Known', { record: '1-0-0' }),
    ],
  },
  '/gyms/pfl-only-club': { ...gymSummaries[1], fighters: [gymFighter('Dax Moore', { orgs: ['pfl'] }), gymFighter('Nobody Known', { record: '1-0-0' })] },
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
    metrics_note: 'These numbers could not be reproduced.',
    recent_evaluation: { fights: 1752, start: '2023-06-03', end: '2026-10-17', accuracy: 0.6216, roc_auc: 0.669, log_loss: 0.7084 },
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
    reigns: [
      { ...reign, champion: 'Omega Nine', title_type: 'undisputed', won_how: null, event: 'UFC 100', date_won: '2020-01-01', days_held: 300, is_current: false, defenses_count: 1, end_reason: 'lost_title_fight', last_fight: undefined },
      reign,
    ],
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
  '/track-record': { tracking_since: '2026-10-15', logged: 4, resolved: 0, correct: 0, accuracy: null, average_confidence: null, pending: 4, earlier_model_picks: 1, earlier_model_note: '1 of these picks were saved before 2026-10-20, by an earlier version of the model.', next_event: { name: 'UFC 900: Alpha vs. Beta', date: '2030-01-01' }, bands: [], recent: [], biggest_misses: [] },
  '/head-to-head': { fighter_a: 'Alpha One', fighter_b: 'Beta Two', fighter_a_wins: 1, fighter_b_wins: 0, no_contests: 0, meetings: [], common_opponents: [], network_path: [], degrees_of_separation: 0 },
  '/fighters/Alpha One/opponents': { fighter: 'Alpha One', opponents: [{ name: 'Beta Two', fights: 1, last_date: '2026-06-01' }] },
  '/fighters/Alpha One/performance': performance,
  '/predict': {
    predicted_winner: 'Alpha One',
    probability: 0.58,
    fighter_a_probability: 0.58,
    fighter_b_probability: 0.42,
    message: 'The model gives Alpha One a slight edge in this matchup.',
    fighter_a_profile: alpha,
    fighter_b_profile: beta,
    comparison_stats: { fighter_a_win_rate: 0.857, fighter_b_win_rate: 0.8, reach_difference: 0, age_difference: 0 },
    main_factors: [
      { feature: 'Striking volume', impact: 'Alpha One', explanation: 'Lands more significant strikes per minute.', magnitude: 0.12 },
      { feature: 'Takedown defense', impact: 'Beta Two', explanation: 'Stops a higher share of takedown attempts.', magnitude: 0.08 },
      { feature: 'Recent form', impact: 'Alpha One', explanation: 'Coming in off consecutive wins.', magnitude: 0.06 },
    ],
  },
}

/** Look a URL up in the fake API; unknown fighters reuse the shapes above. */
export function respond(rawUrl: string): unknown {
  const url = decodeURIComponent(rawUrl).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  if (url in routes) return routes[url]
  if (url in orgRoutes) return orgRoutes[url]
  if (url in gymRoutes) return gymRoutes[url]
  if (/^\/orgs\/[a-z]+\/fighters\/.+\/fights$/.test(url)) return []
  if (url.endsWith('/performance')) return { ...performance, fighter: url.split('/')[2] }
  if (url.endsWith('/opponents')) return { fighter: '', opponents: [] }
  if (url.endsWith('/similar')) return []
  throw new Error(`The fake API has no answer for ${url}`)
}
