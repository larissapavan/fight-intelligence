import { useState, type ComponentType } from 'react'
import { AlertTriangle, Binary, ChartNoAxesCombined, FolderGit2, Globe2, ShieldAlert, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'

import { SectionHeading } from '../shared/components/SectionHeading'
import { useModelInfo } from '../shared/hooks/useModelInfo'

const contactLinks = [
  {
    label: 'GitHub Repository',
    href: 'https://github.com/lacpavan/ufcpredictor',
    icon: FolderGit2,
  },
  {
    label: 'GitHub Profile',
    href: 'https://github.com/lacpavan',
    icon: Globe2,
  },
  {
    label: 'LinkedIn Profile',
    href: 'https://www.linkedin.com/in/larissacpavan/',
    icon: Globe2,
  },
]

export function AboutModel() {
  const { modelInfo, error } = useModelInfo()
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const handleCopyLink = async (href: string) => {
    try {
      await navigator.clipboard.writeText(href)
      setCopiedLink(href)
      window.setTimeout(() => setCopiedLink(null), 1800)
    } catch {
      setCopiedLink(null)
    }
  }

  const handleOpenExternal = (href: string) => {
    window.location.assign(href)
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="About"
          title="A full stack portfolio platform for applied AI"
          description="Built to demonstrate applied AI, sports analytics and full stack product thinking in one production-styled platform."
        />
      </section>

      {error ? <p className="rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      <section className="grid gap-3 lg:grid-cols-4">
        <InfoCard
          icon={Trophy}
          title="Professional portfolio project"
          description="Designed to showcase applied AI, sports intelligence thinking and production-minded engineering rather than a notebook-only prototype."
        />
        <InfoCard
          icon={Binary}
          title="Machine Learning in production context"
          description="The predictive engine compares pre-fight statistics, builds matchup features and serves responses through a FastAPI backend."
        />
        <InfoCard
          icon={ChartNoAxesCombined}
          title="Historical fight data"
          description="Real UFC records, fighter attributes and derived performance metrics feed the analytical and predictive layers of the platform."
        />
        <InfoCard
          icon={ShieldAlert}
          title="Responsible use"
          description="Predictions are estimates based on historical data and should not be interpreted as betting advice or financial guidance."
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <article className="surface-card rounded-[20px] p-3 sm:p-4">
          <p className="broadcast-label text-[10px] text-[#999999]">Core stack</p>
          <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">React, FastAPI and applied machine learning</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              'FastAPI',
              'React + Vite + TypeScript',
              'Machine Learning',
              'Feature Engineering',
              'Data Visualization',
              'REST APIs',
              'Full Stack Architecture',
              'Explainable AI',
            ].map((item) => (
              <div key={item} className="metric-tile rounded-xl px-3 py-2.5 text-xs font-medium text-[#FFFFFF]">
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card rounded-[20px] p-3 sm:p-4">
          <p className="broadcast-label text-[10px] text-[#999999]">Links & contact</p>
          <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Where to explore the project</h2>
          <div className="mt-3 grid gap-2">
            {contactLinks.map(({ label, href, icon: Icon }) => {
              const isLinkedIn = label === 'LinkedIn Profile'

              return (
                <div
                  key={label}
                  className="metric-tile rounded-xl px-3 py-2.5 text-sm text-[#FFFFFF]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-xl bg-[#E81B23]/10 p-1.5 text-[#FF6B6B]">
                        <Icon className="h-4 w-4" />
                      </span>
                      {label}
                    </span>
                    {!isLinkedIn ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs uppercase tracking-[0.14em] text-[#999999] transition hover:text-[#FFFFFF]"
                      >
                        Open in browser
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(href)}
                        className="text-xs uppercase tracking-[0.14em] text-[#999999] transition hover:text-[#FFFFFF]"
                      >
                        Open LinkedIn
                      </button>
                    )}
                  </div>

                  {isLinkedIn ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-xs text-[#999999]">{href}</p>
                      <button
                        type="button"
                        onClick={() => void handleCopyLink(href)}
                        className="ghost-action inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#E81B23]"
                      >
                        {copiedLink === href ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </article>
      </section>

      {modelInfo ? (
        <section className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="surface-card rounded-[20px] p-3 sm:p-4">
            <p className="broadcast-label text-[10px] text-[#999999]">Technical snapshot</p>
            <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{modelInfo.model_name}</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <Metric label="Features" value={`${modelInfo.feature_count}`} />
              <Metric label="Accuracy" value={`${(modelInfo.metrics.accuracy * 100).toFixed(1)}%`} />
              <Metric label="ROC AUC" value={modelInfo.metrics.roc_auc.toFixed(3)} />
              <Metric label="Log loss" value={modelInfo.metrics.log_loss.toFixed(3)} />
            </div>
          </article>

          <article className="surface-card rounded-[20px] p-3 sm:p-4">
            <p className="broadcast-label text-[10px] text-[#999999]">Important note</p>
            <div className="mt-3 rounded-2xl border border-[#E81B23]/20 bg-[#E81B23]/8 p-3">
              <div className="mb-2 flex items-center gap-2 text-[#E81B23]">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Use disclaimer</span>
              </div>
              <p className="text-xs leading-5 text-[#FFFFFF]">
                The platform offers informed estimates generated from historical data and modeling logic. It does not replace expert judgment and should not be used for betting decisions.
              </p>
            </div>
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
        </section>
      ) : null}
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <article className="surface-card rounded-[20px] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-white/16">
      <div className="inline-flex rounded-xl bg-[#E81B23]/10 p-2.5 text-[#FF6B6B]">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="mt-3 text-lg font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{title}</h2>
      <p className="mt-1.5 text-xs leading-5 text-[#999999]">{description}</p>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
      <p className="data-value mt-1 text-xl font-semibold text-[#FFFFFF]">{value}</p>
    </div>
  )
}
