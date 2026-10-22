import { Database } from 'lucide-react'

import type { DataConfidence } from '../types/api'

/** Says how much the prediction had to go on. Silent when the data is solid, so it only appears when it matters. */
export function DataConfidenceNote({ confidence }: { confidence: DataConfidence | null | undefined }) {
  if (!confidence || confidence.level === 'solid') return null
  return (
    <aside aria-label="Data behind this prediction" className="metric-tile flex items-start gap-2.5 px-3 py-2.5">
      <Database aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]" />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{confidence.label}</p>
        <ul className="mt-1 space-y-0.5 text-xs leading-5">
          {confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="theme-muted mt-1 text-xs leading-5">Read the percentage with extra caution.</p>
      </div>
    </aside>
  )
}
