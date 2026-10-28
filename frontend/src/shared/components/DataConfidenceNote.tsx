import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { L, uiLang } from '../../i18n/lang'
import type { DataConfidence } from '../types/api'

const LABELS_PT: Record<string, string> = {
  'Limited data': 'Volume limitado de dados',
  'Moderate data': 'Volume moderado de dados',
  'Solid data': 'Base de dados sólida',
}

const REASONS_PT: Record<string, string> = {
  'UFC debut: no UFC bouts on record': 'Estreia no UFC: sem combates anteriores na organização',
  'Only 1 UFC fight on record': 'Apenas 1 luta registrada no UFC',
  'Fewer than 3 UFC fights on record': 'Menos de 3 lutas registradas no UFC',
  'Over 2 years since last UFC bout': 'Mais de 2 anos de inatividade no UFC',
}

const LABELS_FR: Record<string, string> = {
  'Limited data': 'Données limitées',
  'Moderate data': 'Données modérées',
  'Solid data': 'Données solides',
}

const REASONS_FR: Record<string, string> = {
  'UFC debut: no UFC bouts on record': 'Début à l\'UFC : aucun combat UFC enregistré',
  'Only 1 UFC fight on record': 'Un seul combat UFC enregistré',
  'Fewer than 3 UFC fights on record': 'Moins de 3 combats UFC enregistrés',
  'Over 2 years since last UFC bout': 'Plus de 2 ans sans combat à l\'UFC',
}

/** Says how much the prediction had to go on. Silent when the data is solid, so it only appears when it matters. */
export function DataConfidenceNote({ confidence }: { confidence: DataConfidence | null | undefined }) {
  const { i18n } = useTranslation()
  const lang = uiLang(i18n.language)

  if (!confidence || confidence.level === 'solid') return null

  const label = lang === 'pt'
    ? (LABELS_PT[confidence.label] ?? confidence.label)
    : lang === 'fr'
      ? (LABELS_FR[confidence.label] ?? confidence.label)
      : confidence.label

  return (
    <aside aria-label={L(i18n.language, 'Base de dados da previsão', 'Data behind this prediction', 'Données derrière cette prévision')} className="metric-tile flex items-start gap-2.5 px-3 py-2.5">
      <Database aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]" />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{label}</p>
        <ul className="mt-1 space-y-0.5 text-xs leading-5">
          {confidence.reasons.map((reason) => (
            <li key={reason}>
              {lang === 'pt' ? (REASONS_PT[reason] ?? reason) : lang === 'fr' ? (REASONS_FR[reason] ?? reason) : reason}
            </li>
          ))}
        </ul>
        <p className="theme-muted mt-1 text-xs leading-5">
          {L(i18n.language, 'Analise as porcentagens com cautela adicional.', 'Read the percentage with extra caution.', 'Lisez le pourcentage avec une prudence supplémentaire.')}
        </p>
      </div>
    </aside>
  )
}
