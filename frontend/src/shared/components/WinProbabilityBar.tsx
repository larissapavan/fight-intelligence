import { useTranslation } from 'react-i18next'
import { edgeLabel, formatProbability } from '../data/probability'

interface WinProbabilityBarProps {
  nameA: string
  nameB: string
  probabilityA: number
  probabilityB: number
  predictedWinner?: string | null
  compact?: boolean
  showNames?: boolean
}

export function WinProbabilityBar({
  nameA,
  nameB,
  probabilityA,
  probabilityB,
  predictedWinner,
  compact = false,
  showNames = true,
}: WinProbabilityBarProps) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const pctA = Math.round(probabilityA * 100)
  const pctB = Math.round(probabilityB * 100)
  const winnerIsA = predictedWinner ? predictedWinner === nameA : pctA >= pctB

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {showNames ? (
            <p className={`truncate font-bold text-[var(--text-main)] ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
              {nameA}
            </p>
          ) : null}
          <p className={`data-value font-bold leading-none ${winnerIsA ? 'text-[var(--accent-red)]' : 'text-[var(--text-main)]'} ${compact ? 'text-3xl' : 'text-5xl sm:text-6xl'}`}>
            {formatProbability(probabilityA)}
          </p>
        </div>
        {showNames ? <p className="mb-1 shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">vs</p> : null}
        <div className="min-w-0 text-right">
          {showNames ? (
            <p className={`truncate font-bold text-[var(--text-main)] ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
              {nameB}
            </p>
          ) : null}
          <p className={`data-value font-bold leading-none ${!winnerIsA ? 'text-[var(--accent-red)]' : 'text-[var(--text-main)]'} ${compact ? 'text-3xl' : 'text-5xl sm:text-6xl'}`}>
            {formatProbability(probabilityB)}
          </p>
        </div>
      </div>

      <div
        className={`mt-3 flex overflow-hidden rounded-full bg-[var(--rule)] ${compact ? 'h-3' : 'h-4'}`}
        role="img"
        aria-label={
          isPt
            ? `Probabilidade de vitória: ${pctA}% ${nameA}, ${pctB}% ${nameB}`
            : `Win probability ${pctA} percent ${nameA}, ${pctB} percent ${nameB}`
        }
      >
        <div className={`h-full ${winnerIsA ? 'bg-[var(--accent-red)]' : 'bg-[var(--text-muted)]'}`} style={{ width: `${pctA}%` }} />
        <div className={`h-full ${winnerIsA ? 'bg-[var(--text-muted)]' : 'bg-[var(--accent-red)]'}`} style={{ width: `${pctB}%` }} />
      </div>

      {predictedWinner ? (
        <p className={`mt-2 text-center text-[var(--text-muted)] ${compact ? 'text-xs' : 'text-sm'}`}>
          {isPt ? 'Modelo favorece ' : 'Model favors '}
          <span className="font-semibold text-[var(--text-main)]">{predictedWinner}</span>
          <span> · {edgeLabel(Math.max(probabilityA, probabilityB), isPt).toLowerCase()}</span>
        </p>
      ) : null}
    </div>
  )
}
