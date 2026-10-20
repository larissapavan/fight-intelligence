/** Win-method buckets used by the performance charts, as shown to the user. */
export const METHOD_LABELS: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Submission',
  Decision: 'Decision',
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  Disqualification: 'DQ',
  DQ: 'Disqualification',
  Other: 'Other',
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
