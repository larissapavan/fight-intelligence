import { Info } from 'lucide-react'

/** A short note under the model's headline metrics: where they come from and how far to trust them. */
export function MetricsNote({ note }: { note: string | null | undefined }) {
  if (!note) return null
  return (
    <aside aria-label="About these metrics" className="surface-card flex items-start gap-2.5 rounded-[20px] px-3 py-2.5 sm:px-4">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]" />
      <p className="text-xs leading-5 text-[#FFFFFF]">{note}</p>
    </aside>
  )
}
