import { L } from '../../i18n/lang'
import { localizeFeature } from '../utils/localizeFeature'
import { useTranslation } from 'react-i18next'
import type { MainFactor } from '../types/api'

const TOP_FACTORS = 6



export function ShapFactorBars({
  factors,
  fighterAName,
  fighterBName,
}: {
  factors: MainFactor[]
  fighterAName: string
  fighterBName: string
}) {
  const { i18n } = useTranslation()

  const rows = factors.slice(0, TOP_FACTORS)
  if (rows.length === 0) return null

  const max = Math.max(...rows.map((factor) => factor.magnitude), 0.01)

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{L(i18n.language, 'Explicabilidade da IA (SHAP)', 'SHAP explainability', 'Explicabilité de l\'IA (SHAP)')}</p>
          <h2 className="mt-0.5 text-lg font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{L(i18n.language, 'Fatores Decisivos do Combate', 'Key matchup factors', 'Facteurs décisifs du combat')}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em]">
          <span className="inline-flex items-center gap-1.5 text-[#C8102E]">
            <span className="h-2 w-2 rounded-full bg-[#C8102E]" />
            {fighterAName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--accent-blue)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-blue)]" />
            {fighterBName}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {L(
          i18n.language,
          'As barras indicam qual lutador foi favorecido por cada métrica estatística. Barras maiores indicam impacto mais forte.',
          'Bars are colored by the fighter they favored. Longer means a stronger push.',
          'Les barres indiquent quel combattant a été favorisé par chaque métrique. Plus la barre est longue, plus l\'effet est fort.',
        )}
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((factor) => {
          const favorsA = factor.impact === fighterAName
          const favorsB = factor.impact === fighterBName
          const color = favorsA ? 'bg-[#C8102E]' : 'bg-[var(--accent-blue)]'
          const nameColor = favorsA ? 'text-[#C8102E]' : 'text-[var(--accent-blue)]'
          const favoredName = favorsA ? fighterAName : favorsB ? fighterBName : factor.impact
          const width = Math.max((factor.magnitude / max) * 100, 8)
          const featureTitle = localizeFeature(factor.feature, i18n.language)
          const explanation = L(
            i18n.language,
            `${featureTitle} favoreceu a previsão para ${favoredName}.`,
            factor.explanation,
            `${featureTitle} a favorisé la prévision pour ${favoredName}.`,
          )

          return (
            <div key={factor.feature}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-main)]">{featureTitle}</p>
                <p className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] ${nameColor}`}>{favoredName}</p>
              </div>
              <div
                className="mt-1.5 h-3 overflow-hidden rounded-full bg-[#262626]"
                role="img"
                aria-label={L(i18n.language, `${featureTitle} favoreceu ${favoredName}`, `${factor.feature} favored ${favoredName}`, `${featureTitle} a favorisé ${favoredName}`)}
              >
                <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{explanation}</p>
            </div>
          )
        })}
      </div>
    </article>
  )
}
