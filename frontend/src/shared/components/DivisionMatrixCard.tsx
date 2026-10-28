import { useState } from 'react'
import { Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { getDivisionMatrix } from '../services/api'
import type { DivisionMatrix } from '../types/api'

const percent = (value: number) => `${Math.round(value * 100)}%`

/**
 * The ranked fighters of a division against each other, by the model. Loaded on request (it runs the model for every
 * pair), and shown as round-robin standings with the full grid underneath.
 */
export function DivisionMatrixCard({ category }: { category: string }) {
  const { i18n } = useTranslation()

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
    <section aria-label={L(i18n.language, 'Todos contra todos na categoria', 'Division round robin', 'Tous contre tous dans la catégorie')} className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">
          {L(i18n.language, 'Quem o modelo favorece nesta categoria?', 'Who does the model like in this division?', 'Qui le modèle favorise-t-il dans cette catégorie ?')}
        </h2>
      </div>
      <p className="theme-muted mt-0.5 text-xs leading-5">
        {L(
          i18n.language,
          'Cada lutador do top 8 contra todos os outros, segundo o modelo. A probabilidade média de vitória sobre os demais permite avaliar toda a categoria de uma vez. Não é uma previsão de torneio: nenhuma chave é simulada.',
          'Every fighter in the top 8 against every other, by the model. The average chance of beating the rest is a way to read the whole division at once. It is not a tournament forecast: no bracket is simulated.',
          'Chaque combattant du top 8 contre tous les autres, selon le modèle. La probabilité moyenne de battre le reste permet de lire toute la catégorie d\'un coup. Ce n\'est pas une prévision de tournoi : aucun tableau n\'est simulé.',
        )}
      </p>

      {!matrix ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={state === 'loading'}
          className="ghost-action mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
        >
          {state === 'loading'
            ? L(i18n.language, 'Executando simulação…', 'Running the model…', 'Simulation en cours…')
            : L(i18n.language, 'Simular confrontos da categoria', 'Run the round robin', 'Simuler les confrontations de la catégorie')}
        </button>
      ) : (
        <Standings matrix={matrix} />
      )}
      {state === 'error' ? (
        <p className="mt-2 text-sm text-[var(--text-main)]">
          {L(i18n.language, 'Não foi possível simular os confrontos. Tente novamente em instantes.', 'Could not run the round robin. Try again in a moment.', 'Impossible de simuler les confrontations. Réessayez dans un instant.')}
        </p>
      ) : null}
    </section>
  )
}

function Standings({ matrix }: { matrix: DivisionMatrix }) {
  const { i18n } = useTranslation()
  return (
    <div className="mt-3 space-y-4">
      <ol className="grid gap-2">
        {matrix.round_robin.map((row, index) => (
          <li key={row.fighter}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--text-main)]">
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
        <table className="w-full min-w-[480px] border-collapse text-xs text-[var(--text-main)]">
          <caption className="theme-muted pb-1 text-left">
            {L(
              i18n.language,
              'Probabilidade de o atleta na linha vencer o atleta na coluna.',
              'Chance that the fighter in the row beats the fighter in the column.',
              'Probabilité que le combattant de la ligne batte celui de la colonne.',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-1.5 text-left font-semibold">{L(i18n.language, 'Lutador', 'Fighter', 'Combattant')}</th>
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
        <p className="theme-muted text-xs">{L(i18n.language, `De fora, ainda sem perfil: ${matrix.skipped.join(', ')}.`, `Left out, with no profile yet: ${matrix.skipped.join(', ')}.`, `Absents, encore sans profil : ${matrix.skipped.join(', ')}.`)}</p>
      ) : null}
    </div>
  )
}
