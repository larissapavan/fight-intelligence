import { ArrowDown } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useDataInfo } from '../shared/hooks/useDataInfo'

export function DataIntelligence() {
  const { dataInfo, loading, error } = useDataInfo()

  const formattedDate = dataInfo?.last_updated
    ? new Date(`${dataInfo.last_updated}T00:00:00`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Data intelligence"
          title="From raw scrapes to a prediction"
          description="A technical look at how real UFC data becomes the dataset this platform predicts from — no synthetic or placeholder records anywhere in the pipeline."
        />
      </section>

      {error ? <p className="rounded-xl border border-[#D32F2F]/25 bg-[#D32F2F]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading || !dataInfo ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[96px]" />
          ))}
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Last data update" value={formattedDate} />
            <StatCard label="Fighters" value={dataInfo.fighters_count.toLocaleString('en-US')} />
            <StatCard label="Events" value={dataInfo.events_count.toLocaleString('en-US')} />
            <StatCard label="Fights" value={dataInfo.fights_count.toLocaleString('en-US')} />
          </section>

          <section className="surface-card rounded-[20px] p-3 sm:p-4">
            <SectionHeading
              eyebrow="Architecture"
              title="Data pipeline"
              description="Every prediction traces back to real historical fight data — scraped, cleaned and engineered into features before it ever reaches the model."
            />
            <DataPipelineDiagram sources={dataInfo.sources} />
          </section>
        </>
      )}
    </div>
  )
}

function DataPipelineDiagram({ sources }: { sources: string[] }) {
  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="grid w-full max-w-sm grid-cols-2 gap-2.5">
        {sources.map((source) => (
          <PipelineNode key={source} label={formatSourceLabel(source)} tone="source" />
        ))}
      </div>

      <PipelineMergeConnector />

      <PipelineNode label="Raw Data" tone="highlight" />
      <PipelineArrow />
      <PipelineNode label="Cleaning" description="Parsing, normalization and deduplication across sources" />
      <PipelineArrow />
      <PipelineNode label="Feature Engineering" description="Matchup deltas: reach, age, win rate, striking, takedown accuracy" />
      <PipelineArrow />
      <PipelineNode label="ML Dataset" tone="highlight" />
      <PipelineArrow />
      <PipelineNode label="Prediction" tone="accent" description="HistGradientBoostingClassifier + SHAP explainability" />
    </div>
  )
}

function formatSourceLabel(source: string) {
  if (source === 'ufcstats.com') return 'UFCStats.com'
  if (source === 'ufc.com') return 'UFC.com'
  return source
}

const PIPELINE_TONE_CLASSES: Record<string, string> = {
  default: 'border-white/10 bg-white/[0.03] text-[#FFFFFF]',
  source: 'border-[#2F5FA8]/25 bg-[#2F5FA8]/10 text-[#8FB3E8]',
  highlight: 'border-white/18 bg-white/[0.06] text-[#FFFFFF]',
  accent: 'border-[#D32F2F]/30 bg-[#D32F2F]/10 text-[#FF6B6B]',
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
      {description ? <p className="mt-1 text-[11px] leading-4 text-[#999999]">{description}</p> : null}
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
      <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
      <p className="data-value mt-1.5 text-2xl font-bold text-[#FFFFFF]">{value}</p>
    </article>
  )
}
