import { motion } from 'framer-motion'
import { Flame, ListChecks } from 'lucide-react'

import type { MainFactor } from '../types/api'

interface ModelExplanationProps {
  factors: MainFactor[]
}

export function ModelExplanation({ factors }: ModelExplanationProps) {
  const topFactors = factors.slice(0, 3)
  const maxMagnitude = Math.max(...factors.map((factor) => factor.magnitude), 0.01)

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-xl bg-[#E81B23]/12 p-2 text-[#E81B23]">
          <ListChecks className="h-4 w-4" />
        </div>
        <div>
          <p className="broadcast-label text-[10px] text-[#999999]">SHAP explainability</p>
          <h2 className="mt-0.5 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Why the model leaned that way</h2>
        </div>
      </div>

      {factors.length ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#E81B23]/18 bg-[#E81B23]/8 p-3">
            <div className="flex items-center gap-2 text-[#E81B23]">
              <Flame className="h-4 w-4" />
              <span className="broadcast-label text-[10px]">Primary drivers</span>
            </div>
            <div className="mt-2.5 grid gap-2">
              {topFactors.map((factor) => (
                <div key={factor.feature} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
                  <p className="text-xs font-semibold text-[#FFFFFF]">
                    {factor.feature} favored <span className="text-[#E81B23]">{factor.impact}</span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#E5E5E5]">{factor.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5">
            {factors.map((factor, index) => (
              <motion.article
                key={factor.feature}
                className="metric-tile rounded-2xl p-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.18) }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-[#FFFFFF]">{factor.feature}</h3>
                  <span className="w-fit rounded-full border border-[#E81B23]/18 bg-[#E81B23]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FF6B6B]">
                    {factor.impact}
                  </span>
                </div>
                <div className="progress-track mt-2.5 h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-[#E81B23] transition-all duration-500"
                    style={{ width: `${Math.max((factor.magnitude / maxMagnitude) * 100, 8)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-[#999999]">{factor.explanation}</p>
              </motion.article>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-[#999999]">
          Run a prediction to reveal the strongest model drivers and contribution magnitudes.
        </div>
      )}
    </section>
  )
}
