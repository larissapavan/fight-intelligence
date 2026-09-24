import { motion } from 'framer-motion'
import { Flame, Gauge, ShieldCheck } from 'lucide-react'

import type { PredictionResponse } from '../types/api'

interface PredictionResultProps {
  result: PredictionResponse | null
}

export function PredictionResult({ result }: PredictionResultProps) {
  if (!result) {
    return (
      <section className="surface-card rounded-[20px] p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-[#E81B23]/10 p-2 text-[#E81B23]">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <p className="broadcast-label text-[10px] text-[#999999]">Prediction result</p>
            <h2 className="mt-0.5 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Awaiting matchup</h2>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-6 text-center">
          <p className="text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">No model output yet</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#999999]">
            Select two fighters to generate matchup analysis, projected winner and confidence breakdown.
          </p>
        </div>
      </section>
    )
  }

  const confidenceLabel =
    result.probability >= 0.72 ? 'High confidence' : result.probability >= 0.6 ? 'Competitive edge' : 'Tight matchup'

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="broadcast-label text-[10px] text-[#999999]">Projected winner</p>
            <h2 className="mt-1 text-3xl font-bold uppercase leading-none tracking-[0.02em] text-[#FFFFFF] md:text-4xl">
              {result.predicted_winner}
            </h2>
          </div>
          <span className="w-fit rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E81B23]">
            {confidenceLabel}
          </span>
        </div>

        <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(232,27,35,0.14),rgba(0,0,0,0)_65%)] p-3.5">
          <div className="flex items-center gap-2 text-[#E81B23]">
            <Flame className="h-4 w-4" />
            <p className="broadcast-label text-[10px]">Model probability</p>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <p className="data-value text-5xl font-bold leading-none text-[#FFFFFF] md:text-6xl">
              {(result.probability * 100).toFixed(0)}%
            </p>
            <div className="sm:text-right">
              <p className="broadcast-label text-[10px] text-[#999999]">Analysis note</p>
              <p className="mt-1 max-w-[260px] text-xs leading-5 text-[#FFFFFF]">{result.message}</p>
            </div>
          </div>
          <div className="progress-track mt-3 h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#A5151C] to-[#E81B23] transition-all duration-700"
              style={{ width: `${result.probability * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <ProbabilityRow fighter={result.fighter_a_profile.name} value={result.fighter_a_probability} color="bg-[#E81B23]" />
          <ProbabilityRow fighter={result.fighter_b_profile.name} value={result.fighter_b_probability} color="bg-[#2F5FA8]" />
        </div>

        <div className="rounded-2xl border border-[#E81B23]/18 bg-[#E81B23]/8 p-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[#E81B23]" />
            <div>
              <p className="broadcast-label text-[10px] text-[#E81B23]">Quick read</p>
              <p className="mt-1 text-xs leading-5 text-[#FFFFFF]">
                The model is leaning on the stronger overall profile across efficiency, physical edge and career results.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function ProbabilityRow({
  fighter,
  value,
  color,
}: {
  fighter: string
  value: number
  color: string
}) {
  return (
    <div className="metric-tile rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[#FFFFFF]">{fighter}</p>
        <span className="text-base font-bold text-[#FFFFFF]">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="progress-track mt-2 h-2 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}
