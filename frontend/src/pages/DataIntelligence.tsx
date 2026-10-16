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
          eyebrow="The data"
          title="From raw data to a prediction"
          description="How public UFC data becomes the dataset the model learns from. Every record in it is real."
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
            <StatCard label="Last data update" value={formattedDate} />
            <StatCard label="Fighters" value={dataInfo.fighters_count.toLocaleString('en-US')} />
            <StatCard label="Events" value={dataInfo.events_count.toLocaleString('en-US')} />
            <StatCard label="Fights" value={dataInfo.fights_count.toLocaleString('en-US')} />
          </section>

          <section className="surface-card rounded-[20px] p-3 sm:p-4">
            <SectionHeading
              eyebrow="Architecture"
              title="Data pipeline"
              description="Every prediction starts from real fight data that is collected, cleaned and turned into features before the model sees it."
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
      <PipelineNode label="Cleaning" description="Fixing formats and removing duplicates across sources" />
      <PipelineArrow />
      <PipelineNode label="Feature Engineering" description="The difference between the two fighters in reach, age, win rate, striking and takedown accuracy" />
      <PipelineArrow />
      <PipelineNode label="ML Dataset" tone="highlight" />
      <PipelineArrow />
      <PipelineNode label="Prediction" tone="accent" description="A gradient boosting model, with SHAP to explain each pick" />
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
  source: 'border-[#2F5FA8]/25 bg-[#2F5FA8]/10 text-[var(--accent-blue)]',
  highlight: 'border-white/18 bg-white/[0.06] text-[#FFFFFF]',
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
