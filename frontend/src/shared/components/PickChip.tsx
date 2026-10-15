import { Sparkles } from 'lucide-react'

import type { UpcomingPick } from '../types/api'

/** "Model: Fighter 62%": the model's pick for a fight that has not happened yet. */
export function PickChip({ pick, className = '' }: { pick: UpcomingPick | undefined; className?: string }) {
  if (!pick) return null
  const percent = Math.round(pick.probability * 100)
  const tone = percent >= 70 ? 'bg-[#F2C230] text-[#0E0E0E]' : 'border border-[var(--rule)] text-[var(--text-main)]'

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${tone} ${className}`}
      title="The model's pick, based on each fighter's current stats. Not betting advice."
    >
      <Sparkles className="h-3 w-3 shrink-0" />
      <span className="truncate">
        Model: {pick.predicted_winner} {percent}%
      </span>
    </span>
  )
}
