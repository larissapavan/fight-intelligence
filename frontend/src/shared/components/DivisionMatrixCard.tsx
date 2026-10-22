import { useState } from 'react'
import { Swords } from 'lucide-react'

import { getDivisionMatrix } from '../services/api'
import type { DivisionMatrix } from '../types/api'

const percent = (value: number) => `${Math.round(value * 100)}%`

/**
 * The ranked fighters of a division against each other, by the model. Loaded on request (it runs the model for every
 * pair), and shown as round-robin standings with the full grid underneath.
 */
export function DivisionMatrixCard({ category }: { category: string }) {
  const [matrix, setMatrix] = useState<DivisionMatrix | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  const run = async () => {
    setState('loading')
    try {
      setMatrix(await getDivisionMatrix(category))
      setState('idle')
    } catch (error) {
      console.error(error)
      setState('error')
    }
  }

  return (
    <section aria-label="Division round robin" className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Who does the model like in this division?</h2>
      </div>
      <p className="theme-muted mt-0.5 text-xs leading-5">
        Every fighter in the top 8 against every other, by the model. The average chance of beating the rest is a way to read the whole division at once.
        It is not a tournament forecast: no bracket is simulated.
      </p>

      {!matrix ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={state === 'loading'}
          className="ghost-action mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
        >
          {state === 'loading' ? 'Running the model…' : 'Run the round robin'}
        </button>
      ) : (
        <Standings matrix={matrix} />
      )}
      {state === 'error' ? <p className="mt-2 text-sm text-[#FFFFFF]">Could not run the round robin. Try again in a moment.</p> : null}
    </section>
  )
}

function Standings({ matrix }: { matrix: DivisionMatrix }) {
  return (
    <div className="mt-3 space-y-4">
      <ol className="grid gap-2">
        {matrix.round_robin.map((row, index) => (
          <li key={row.fighter}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[#FFFFFF]">
              <span className="font-bold">
                {index + 1}. {row.fighter}
              </span>
              <span className="type-num font-bold">{percent(row.average_win_probability)}</span>
            </div>
            <div className="mt-1 h-3 border-2 border-[var(--rule)] bg-[var(--surface-3)]">
              <div className="h-full bg-[#C8102E]" style={{ width: `${Math.round(row.average_win_probability * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs text-[#FFFFFF]">
          <caption className="theme-muted pb-1 text-left">Chance that the fighter in the row beats the fighter in the column.</caption>
          <thead>
            <tr>
              <th scope="col" className="p-1.5 text-left font-semibold">Fighter</th>
              {matrix.fighters.map((name) => (
                <th key={name} scope="col" className="p-1.5 text-center font-semibold">{name.split(' ').slice(-1)[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.fighters.map((name, i) => (
              <tr key={name} className="border-t border-[var(--rule)]/40">
                <th scope="row" className="p-1.5 text-left font-semibold">{name}</th>
                {matrix.matrix[i].map((value, j) => (
                  <td
                    key={matrix.fighters[j]}
                    className={`type-num p-1.5 text-center ${value != null && value >= 0.5 ? 'font-bold' : ''}`}
                  >
                    {value == null ? '—' : percent(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matrix.skipped.length ? (
        <p className="theme-muted text-xs">Left out, with no profile yet: {matrix.skipped.join(', ')}.</p>
      ) : null}
    </div>
  )
}
