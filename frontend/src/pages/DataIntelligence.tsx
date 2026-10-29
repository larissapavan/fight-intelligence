import { useTranslation } from 'react-i18next'
import { ArrowDown } from 'lucide-react'

import { L, localeTag } from '../i18n/lang'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useDataInfo } from '../shared/hooks/useDataInfo'

export function DataIntelligence() {
  const { t, i18n } = useTranslation()
  const { dataInfo, loading, error } = useDataInfo()

  const formattedDate = dataInfo?.last_updated
    ? new Date(`${dataInfo.last_updated}T00:00:00`).toLocaleDateString(localeTag(i18n.language), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={t('dataIntelligence.eyebrow')}
          title={t('dataIntelligence.title')}
          description={t('dataIntelligence.description')}
        />
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading || !dataInfo ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[96px]" />
          ))}
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('dataIntelligence.lastUpdate')} value={formattedDate} />
            <StatCard label={t('dataIntelligence.fighters')} value={dataInfo.fighters_count.toLocaleString(localeTag(i18n.language))} />
            <StatCard label={t('dataIntelligence.events')} value={dataInfo.events_count.toLocaleString(localeTag(i18n.language))} />
            <StatCard label={t('dataIntelligence.fights')} value={dataInfo.fights_count.toLocaleString(localeTag(i18n.language))} />
          </section>

          <section className="surface-card rounded-[20px] p-3 sm:p-4">
            <SectionHeading
              eyebrow={L(i18n.language, 'Arquitetura', 'Architecture', 'Architecture')}
              title={t('dataIntelligence.pipelineTitle')}
              description={t('dataIntelligence.pipelineDesc')}
            />
            <DataPipelineDiagram sources={dataInfo.sources} />
          </section>
        </>
      )}
    </div>
  )
}

function DataPipelineDiagram({ sources }: { sources: string[] }) {
  const { i18n } = useTranslation()
  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="grid w-full max-w-sm grid-cols-2 gap-2.5">
        {sources.map((source) => (
          <PipelineNode key={source} label={formatSourceLabel(source)} tone="source" />
        ))}
      </div>

      <PipelineMergeConnector />

      <PipelineNode label={L(i18n.language, 'Dados Brutos', 'Raw Data', 'Données brutes')} tone="highlight" />
      <PipelineArrow />
      <PipelineNode
        label={L(i18n.language, 'Tratamento & Limpeza', 'Cleaning', 'Nettoyage')}
        description={L(i18n.language, 'Padronização de formatos e remoção de duplicatas entre fontes', 'Fixing formats and removing duplicates across sources', 'Correction des formats et suppression des doublons entre les sources')}
      />
      <PipelineArrow />
      <PipelineNode
        label={L(i18n.language, 'Engenharia de Atributos', 'Feature Engineering', 'Ingénierie des variables')}
        description={L(i18n.language, 'Diferenças de envergadura, idade, taxa de vitória, precisão de golpes e quedas', 'The difference between the two fighters in reach, age, win rate, striking and takedown accuracy', "L'écart entre les deux lutteurs en allonge, âge, taux de victoire, précision des coups et des amenées au sol")}
      />
      <PipelineArrow />
      <PipelineNode label={L(i18n.language, 'Conjunto de Treinamento (ML)', 'ML Dataset', "Jeu d'entraînement (ML)")} tone="highlight" />
      <PipelineArrow />
      <PipelineNode
        label={L(i18n.language, 'Previsão & Explicabilidade', 'Prediction', 'Pronostic')}
        tone="accent"
        description={L(i18n.language, 'Modelo de Gradient Boosting com SHAP para explicar cada palpite', 'A gradient boosting model, with SHAP to explain each pick', 'Un modèle de gradient boosting, avec SHAP pour expliquer chaque choix')}
      />
    </div>
  )
}

function formatSourceLabel(source: string) {
  if (source === 'ufcstats.com') return 'UFCStats.com'
  if (source === 'ufc.com') return 'UFC.com'
  return source
}

const PIPELINE_TONE_CLASSES: Record<string, string> = {
  default: 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[#FFFFFF]',
  source: 'border-[#2F5FA8]/25 bg-[#2F5FA8]/10 text-[var(--accent-blue)]',
  highlight: 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[#FFFFFF]',
  accent: 'border-[#C8102E]/30 bg-[#C8102E]/10 text-[var(--accent-red)]',
}

function PipelineNode({
  label,
  description,
  tone = 'default',
}: {
  label: string
  description?: string
  tone?: 'default' | 'source' | 'highlight' | 'accent'
}) {
  return (
    <div className={`w-full max-w-sm rounded-2xl border px-4 py-2.5 text-center ${PIPELINE_TONE_CLASSES[tone]}`}>
      <p className="type-display text-sm font-bold uppercase tracking-[0.06em]">{label}</p>
      {description ? <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{description}</p> : null}
    </div>
  )
}

function PipelineArrow() {
  return (
    <div className="flex h-8 items-center justify-center">
      <ArrowDown className="h-4 w-4 text-[#666666]" />
    </div>
  )
}

function PipelineMergeConnector() {
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-8 w-full max-w-sm text-[#666666]">
      <path d="M 50 0 V 14 L 100 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 150 0 V 14 L 100 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="32" x2="100" y2="40" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1.5 text-2xl font-bold text-[#FFFFFF]">{value}</p>
    </article>
  )
}
