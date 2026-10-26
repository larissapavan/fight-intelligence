import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

import { edgeLabel, formatProbability } from '../data/probability'
import type { UpcomingPick } from '../types/api'

export function PickChip({ pick, className = '' }: { pick: UpcomingPick | undefined; className?: string }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  if (!pick) return null
  const percent = Math.round(pick.probability * 100)
  const shown = formatProbability(pick.probability)

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 border border-[var(--accent-red)] bg-[var(--card-bg)] px-1.5 py-1 text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-[var(--text-main)] sm:text-xs sm:tracking-[0.08em] ${className}`}
      title={isPt ? `Palpite do modelo baseado em dados estatísticos. Não é recomendação de aposta.` : `The model's pick (${edgeLabel(pick.probability).toLowerCase()}), based on each fighter's current stats. Not betting advice.`}
    >
      <Sparkles className="h-3 w-3 shrink-0 text-[var(--accent-red)]" aria-hidden="true" />
      <span>
        {isPt ? 'Modelo' : 'Model'}: {pick.predicted_winner} {shown}
      </span>
      <span className="h-2 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--rule)]" aria-hidden="true">
        <span className="block h-full bg-[var(--accent-red)]" style={{ width: `${percent}%` }} />
      </span>
    </span>
  )
}
