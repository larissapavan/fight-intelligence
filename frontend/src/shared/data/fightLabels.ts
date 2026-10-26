/** Win-method buckets used by the performance charts, as shown to the user. */
export const METHOD_LABELS_EN: Record<string, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Submission',
  Decision: 'Decision',
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  Disqualification: 'Disqualification',
  DQ: 'Disqualification',
  Overturned: 'No Contest (NC)',
  Other: 'Other',
}

export const METHOD_LABELS_PT: Record<string, string> = {
  'KO/TKO': 'Nocaute (KO/TKO)',
  Submission: 'Finalização',
  Decision: 'Decisão',
  'U-DEC': 'Decisão Unânime',
  'S-DEC': 'Decisão Dividida',
  'M-DEC': 'Decisão Majoritária',
  Disqualification: 'Desqualificação (DQ)',
  DQ: 'Desqualificação (DQ)',
  Overturned: 'Sem Resultado (NC)',
  Other: 'Outro',
}

export const METHOD_LABELS = METHOD_LABELS_EN

export function getMethodLabel(method: string | null | undefined, isPt = false): string {
  if (!method) return isPt ? 'A definir' : 'Pending'
  const map = isPt ? METHOD_LABELS_PT : METHOD_LABELS_EN
  return map[method] ?? method
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
