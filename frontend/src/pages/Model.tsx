import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { MetricsNote } from '../shared/components/MetricsNote'
import { SectionHeading } from '../shared/components/SectionHeading'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { useModelInfo } from '../shared/hooks/useModelInfo'

export function Model() {
  const { modelInfo, health, loading, error } = useModelInfo()
  const shown = shownMetrics(modelInfo)

  const baselineChart =
    modelInfo == null
      ? []
      : Object.entries(modelInfo.baseline_metrics).map(([key, value]) => ({
          name: key.replaceAll('_', ' '),
          accuracy: Number(value.accuracy.toFixed(3)),
          rocAuc: Number(value.roc_auc.toFixed(3)),
        }))

  const featurePreview =
    modelInfo?.features.slice(0, 10).map((feature, index) => ({
      feature,
      score: 10 - index,
    })) ?? []

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading level={1}
          eyebrow="The model"
          title="How the model works"
          description="The model, how it compares with simpler ones, and what goes into each prediction."
        />
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading || !modelInfo ? (
        <section className="grid gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[96px]" />
          ))}
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Model" value={modelInfo.model_name} />
            <MetricCard label={`Accuracy (${shown.caption})`} value={shown.accuracy != null ? `${(shown.accuracy * 100).toFixed(1)}%` : '—'} />
            <MetricCard label="ROC AUC" value={shown.rocAuc != null ? shown.rocAuc.toFixed(3) : '—'} />
            <MetricCard label="Log Loss" value={shown.logLoss != null ? shown.logLoss.toFixed(3) : '—'} />
          </section>

          <MetricsNote note={modelInfo.metrics_note} />

          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <article className="surface-card rounded-[20px] p-3 sm:p-4">
              <SectionHeading
                eyebrow="Baseline comparison"
                title="Why this model"
                description="As reported in the model's file, it was tested against simpler models, and gradient boosting had the best accuracy and log loss."
              />
              <div className="mt-3 h-[210px] min-w-0 sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                  <BarChart data={baselineChart}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#999999', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#999999', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                          background: '#111111',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '14px',
                          color: '#FFFFFF',
                        }}
                      />
                    <Bar dataKey="accuracy" fill="#C8102E" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="rocAuc" fill="#999999" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="surface-card rounded-[20px] p-3 sm:p-4">
              <SectionHeading
                eyebrow="Feature design"
                title="What the model looks at"
                description="Mostly the difference between the two fighters: age, reach, record, striking and takedown accuracy."
              />
              <div className="mt-3 h-[210px] min-w-0 sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                  <BarChart data={featurePreview} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="feature" type="category" tick={{ fill: '#999999', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      contentStyle={{
                        background: '#111111',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px',
                        color: '#FFFFFF',
                      }}
                    />
                    <Bar dataKey="score" fill="#C8102E" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="surface-card rounded-[20px] p-3 sm:p-4">
              <SectionHeading
                eyebrow="System design"
                title="From data to this site"
                description="Fight data is cleaned, turned into features and served by the API to this site."
              />
              <div className="mt-3 space-y-2">
                {modelInfo.highlights.map((item) => (
                  <motion.div
                    key={item}
                    className="metric-tile rounded-xl px-3 py-2.5 text-xs leading-5 text-[#FFFFFF]"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    {item}
                  </motion.div>
                ))}
              </div>
            </article>

            <article className="surface-card rounded-[20px] p-3 sm:p-4">
              <SectionHeading
                eyebrow="Limitations"
                title="What it can't do"
                description="Where the model falls short."
              />
              <div className="mt-3 rounded-2xl border border-[#C8102E]/18 bg-[#C8102E]/8 p-3">
                <ul className="space-y-2 text-xs leading-5 text-[#FFFFFF]">
                  {modelInfo.limitations.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <MetricCard label="API status" value={health?.model_loaded ? 'Online' : 'Offline'} compact />
                <MetricCard label="Fighters loaded" value={`${health?.fighters_loaded ?? 0}`} compact />
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <article className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[11px] text-[#999999]">{label}</p>
      <p className={`data-value mt-1.5 font-bold text-[#FFFFFF] ${compact ? 'text-xl' : 'text-2xl'}`}>
        {value}
      </p>
    </article>
  )
}
