import { useMemo, useState } from 'react'
import { Activity, LoaderCircle, Radio, ShieldAlert, Swords, Target, TrendingUp, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { FighterCard } from '../shared/components/FighterCard'
import { FighterSelect } from '../shared/components/FighterSelect'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { ModelExplanation } from '../shared/components/ModelExplanation'
import { PredictionResult } from '../shared/components/PredictionResult'
import { StatsComparison } from '../shared/components/StatsComparison'
import { useFighters } from '../shared/hooks/useFighters'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { usePrediction } from '../shared/hooks/usePrediction'

export function Predictor() {
  const [fighterAName, setFighterAName] = useState('')
  const [fighterBName, setFighterBName] = useState('')
  const { fighters, loading, error: fightersError } = useFighters()
  const { modelInfo, health } = useModelInfo()
  const { prediction, loading: predicting, error: predictionError, runPrediction } = usePrediction()
  const [error, setError] = useState<string | null>(null)

  const fighterA = useMemo(() => fighters.find((fighter) => fighter.name === fighterAName) ?? null, [fighters, fighterAName])
  const fighterB = useMemo(() => fighters.find((fighter) => fighter.name === fighterBName) ?? null, [fighters, fighterBName])

  const canPredict = Boolean(fighterAName && fighterBName && fighterAName !== fighterBName)

  const handlePredict = async () => {
    if (!canPredict) {
      setError('Select two different fighters to generate the matchup analysis.')
      return
    }

    try {
      setError(null)
      await runPrediction(fighterAName, fighterBName)
    } catch {
      setError('Prediction failed. Check whether the backend is available and try again.')
    }
  }

  const taleOfTapeData = useMemo(() => {
    if (!fighterA || !fighterB) return []
    return [
      { stat: 'Age', fighterA: fighterA.age ?? 0, fighterB: fighterB.age ?? 0 },
      { stat: 'Height', fighterA: fighterA.height_cm ?? 0, fighterB: fighterB.height_cm ?? 0 },
      { stat: 'Reach', fighterA: fighterA.reach_cm ?? 0, fighterB: fighterB.reach_cm ?? 0 },
      { stat: 'Wins', fighterA: fighterA.wins ?? 0, fighterB: fighterB.wins ?? 0 },
      { stat: 'Losses', fighterA: fighterA.losses ?? 0, fighterB: fighterB.losses ?? 0 },
      { stat: 'Win Rate', fighterA: (fighterA.win_rate ?? 0) * 100, fighterB: (fighterB.win_rate ?? 0) * 100 },
    ]
  }, [fighterA, fighterB])

  const overviewStats = [
    { label: 'Fights analyzed', value: health?.fights_tracked ? health.fights_tracked.toLocaleString('en-US') : '—', icon: Activity },
    { label: 'Fighters', value: `${health?.fighters_loaded ?? fighters.length}`, icon: Target },
    { label: 'Accuracy', value: modelInfo ? `${(modelInfo.metrics.accuracy * 100).toFixed(1)}%` : '74.7%', icon: TrendingUp },
    { label: 'API status', value: health?.model_loaded ? 'Online' : 'Offline', icon: Zap },
  ]

  const systemError = error ?? predictionError ?? fightersError

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero overflow-hidden rounded-[20px] p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E81B23]/20 bg-[#E81B23]/10 px-3 py-1.5 text-[#E81B23]">
              <Radio className="h-3.5 w-3.5" />
              <span className="broadcast-label text-[10px]">Matchup workspace</span>
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-bold uppercase leading-[0.92] tracking-[0.02em] text-[#FFFFFF] md:text-4xl">
              Build a cleaner read on the matchup
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#E5E5E5] sm:text-sm">
              Compare athlete profiles, inspect measurable edges and generate an AI-powered prediction with confidence and explainability.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {overviewStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="metric-tile rounded-xl px-2.5 py-2">
                <div className="flex items-center gap-2 text-[#E81B23]">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="broadcast-label text-[10px] text-[#999999]">{label}</span>
                </div>
                <p className="data-value mt-1 text-xl font-bold text-[#FFFFFF]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {systemError ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-[#E81B23]/20 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">
            <ShieldAlert className="h-4 w-4 text-[#FF6B6B]" />
            {systemError}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.48fr_0.52fr]">
        <div className="space-y-2.5">
          <div className="flex flex-col gap-2 rounded-[18px] border border-white/8 bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="broadcast-label text-[11px] text-[#999999]">Matchup controls</p>
              <h2 className="mt-0.5 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
                Select both corners
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#999999]">Choose two different fighters before running the model.</p>
            </div>

            <button
              type="button"
              onClick={handlePredict}
              disabled={!canPredict || predicting || loading}
              className="primary-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
            >
              {predicting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              {predicting ? 'Analyzing matchup...' : 'Run analysis'}
            </button>
          </div>

          {loading ? (
            <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
              <LoadingSkeleton className="h-[250px] sm:h-[290px]" />
              <div />
              <LoadingSkeleton className="h-[250px] sm:h-[290px]" />
            </section>
          ) : (
            <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] lg:items-stretch">
              <FighterCard title="Red side" accent="red" fighter={fighterA}>
                <FighterSelect
                  label="Red Corner"
                  corner="red"
                  value={fighterAName}
                  fighters={fighters}
                  disabledFighterName={fighterBName}
                  placeholder="Select Red Corner Fighter"
                  onChange={setFighterAName}
                />
              </FighterCard>

              <div className="flex flex-col items-center justify-center gap-1.5 self-center">
                <div className="rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-2.5 py-1.5 text-xl font-bold uppercase tracking-[0.12em] text-[#E81B23] shadow-[0_0_18px_rgba(232,27,35,0.16)]">
                  VS
                </div>
                <div className="w-full rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-center lg:hidden">
                  <p className="broadcast-label text-[10px] text-[#999999]">Quick read</p>
                  <p className="mt-1 text-xs leading-5 text-[#FFFFFF]">
                    Build the matchup, then run the model to reveal the projected winner.
                  </p>
                </div>
              </div>

              <FighterCard title="Blue side" accent="blue" fighter={fighterB}>
                <FighterSelect
                  label="Blue Corner"
                  corner="blue"
                  value={fighterBName}
                  fighters={fighters}
                  disabledFighterName={fighterAName}
                  placeholder="Select Blue Corner Fighter"
                  onChange={setFighterBName}
                />
              </FighterCard>
            </section>
          )}
        </div>

        <PredictionResult result={prediction} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <StatsComparison fighterA={fighterA} fighterB={fighterB} result={prediction} />
        <ModelExplanation factors={prediction?.main_factors ?? []} />
      </section>

      <motion.section
        className="surface-card rounded-[20px] p-3 sm:p-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="broadcast-label text-[11px] text-[#999999]">Historical performance</p>
            <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Metric comparison</h2>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-[#999999]">
            Compare physical and career signals side by side for a fast read before reviewing the model explanation.
          </p>
        </div>

        {fighterA && fighterB ? (
          <div className="mt-3 h-[220px] min-w-0 sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={280}>
              <BarChart data={taleOfTapeData} barGap={10}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="stat" tick={{ fill: '#999999', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#999999', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111111',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '14px',
                    color: '#FFFFFF',
                  }}
                />
                <Bar dataKey="fighterA" fill="#E81B23" radius={[6, 6, 0, 0]} />
                <Bar dataKey="fighterB" fill="#2F5FA8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-7 text-center">
            <p className="text-sm leading-6 text-[#999999]">
              Select two fighters to generate AI-powered matchup analysis, projected winner and confidence breakdown.
            </p>
          </div>
        )}
      </motion.section>
    </div>
  )
}
