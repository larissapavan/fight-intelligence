import { Fragment, useEffect, useState, type ComponentType } from 'react'
import { LoaderCircle, ListOrdered, Ruler, ShieldAlert, Swords, Target } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { FighterSelect } from '../shared/components/FighterSelect'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useFighters } from '../shared/hooks/useFighters'
import { usePrediction } from '../shared/hooks/usePrediction'
import type { FighterProfile, MainFactor } from '../shared/types/api'

export function MatchupIntelligence() {
  const [searchParams] = useSearchParams()
  const presetFighterA = searchParams.get('a')
  const presetFighterB = searchParams.get('b')

  const [fighterAName, setFighterAName] = useState(() => presetFighterA ?? '')
  const [fighterBName, setFighterBName] = useState(() => presetFighterB ?? '')
  const { fighters, loading: fightersLoading, error: fightersError } = useFighters()
  const { prediction, loading: analyzing, error: predictionError, runPrediction } = usePrediction()
  const [error, setError] = useState<string | null>(null)

  const canAnalyze = Boolean(fighterAName && fighterBName && fighterAName !== fighterBName)

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError('Select two different fighters to analyze the matchup.')
      return
    }
    setError(null)
    await runPrediction(fighterAName, fighterBName)
  }

  useEffect(() => {
    if (presetFighterA && presetFighterB && presetFighterA !== presetFighterB) {
      void runPrediction(presetFighterA, presetFighterB)
    }
  }, [presetFighterA, presetFighterB, runPrediction])

  const fighterA = prediction?.fighter_a_profile ?? null
  const fighterB = prediction?.fighter_b_profile ?? null
  const systemError = error ?? predictionError ?? fightersError

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Matchup intelligence"
          title="Why this matchup is interesting"
          description="A category-by-category breakdown of striking, grappling and physical attributes, plus the exact SHAP-derived factors the prediction model weighed most."
        />
      </section>

      <section className="surface-card rounded-[20px] p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FighterSelect
            label="Fighter A"
            corner="red"
            value={fighterAName}
            fighters={fighters}
            disabledFighterName={fighterBName}
            placeholder="Select Fighter A"
            onChange={setFighterAName}
          />
          <FighterSelect
            label="Fighter B"
            corner="blue"
            value={fighterBName}
            fighters={fighters}
            disabledFighterName={fighterAName}
            placeholder="Select Fighter B"
            onChange={setFighterBName}
          />
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze || analyzing || fightersLoading}
            className="primary-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {analyzing ? 'Analyzing...' : 'Analyze matchup'}
          </button>
        </div>
      </section>

      {systemError ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#C8102E]/20 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--accent-red)]" />
          {systemError}
        </p>
      ) : null}

      {fighterA && fighterB ? (
        <>
          <section className="grid gap-3 lg:grid-cols-3">
            <StatComparisonCard
              title="Striking"
              icon={Swords}
              fighterA={fighterA}
              fighterB={fighterB}
              rows={[
                { label: 'Accuracy', key: 'sig_str_acc', format: formatPercent },
                { label: 'Sig. Strikes', key: 'sig_strikes_landed_per_min', format: formatPerMin },
                { label: 'Defense', key: 'striking_defense', format: formatPercent },
              ]}
            />
            <StatComparisonCard
              title="Grappling"
              icon={Target}
              fighterA={fighterA}
              fighterB={fighterB}
              rows={[
                { label: 'TD Accuracy', key: 'takedown_acc', format: formatPercent },
                { label: 'TD Defense', key: 'takedown_defense', format: formatPercent },
                { label: 'Sub Attempts', key: 'submission_avg_per_15min', format: formatPlainNumber },
              ]}
            />
            <StatComparisonCard
              title="Physical"
              icon={Ruler}
              fighterA={fighterA}
              fighterB={fighterB}
              rows={[
                { label: 'Height', key: 'height_cm', format: formatHeightImperial },
                { label: 'Reach', key: 'reach_cm', format: formatReachImperial },
                { label: 'Age', key: 'age', format: formatAge, higherIsBetter: false },
              ]}
            />
          </section>

          <KeyMatchupFactors factors={prediction?.main_factors ?? []} />
        </>
      ) : (
        <section className="surface-card rounded-[20px] px-4 py-8 text-center">
          <p className="text-sm leading-6 text-[#999999]">
            Select two fighters and run the analysis to see the striking, grappling and physical breakdown, plus the
            key factors behind the model's read on this matchup.
          </p>
        </section>
      )}
    </div>
  )
}

type ComparisonRow = {
  label: string
  key: keyof FighterProfile
  format: (value: number | null) => string
  higherIsBetter?: boolean
}

function StatComparisonCard({
  title,
  icon: Icon,
  fighterA,
  fighterB,
  rows,
}: {
  title: string
  icon: ComponentType<{ className?: string }>
  fighterA: FighterProfile
  fighterB: FighterProfile
  rows: ComparisonRow[]
}) {
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-xl bg-[#C8102E]/12 p-2 text-[#C8102E]">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{title}</h2>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1">
        <span />
        <span className="type-tech truncate text-right text-xs font-bold uppercase tracking-[0.1em] text-[var(--accent-red)]">
          {firstName(fighterA.name)}
        </span>
        <span className="type-tech truncate text-right text-xs font-bold uppercase tracking-[0.1em] text-[var(--accent-blue)]">
          {firstName(fighterB.name)}
        </span>

        {rows.map((row) => {
          const valueA = fighterA[row.key] as number | null
          const valueB = fighterB[row.key] as number | null
          const comparable = row.higherIsBetter !== false && valueA != null && valueB != null && valueA !== valueB
          const aWins = comparable && (valueA as number) > (valueB as number)
          const bWins = comparable && (valueB as number) > (valueA as number)

          return (
            <Fragment key={row.label}>
              <span className="py-2 text-base font-semibold text-[#FFFFFF]">{row.label}</span>
              <span className={`py-2 text-right text-lg font-bold ${aWins ? 'text-[#C8102E]' : 'text-[#FFFFFF]'}`}>
                {row.format(valueA)}
              </span>
              <span className={`py-2 text-right text-lg font-bold ${bWins ? 'text-[var(--accent-blue)]' : 'text-[#FFFFFF]'}`}>
                {row.format(valueB)}
              </span>
            </Fragment>
          )
        })}
      </div>
    </article>
  )
}

function KeyMatchupFactors({ factors }: { factors: MainFactor[] }) {
  if (factors.length === 0) return null

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-xl bg-[#C8102E]/12 p-2 text-[#C8102E]">
          <ListOrdered className="h-5 w-5" />
        </div>
        <div>
          <p className="broadcast-label text-xs text-[#FFFFFF]">SHAP explainability</p>
          <h2 className="mt-0.5 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Key matchup factors</h2>
        </div>
      </div>

      <div className="grid gap-2">
        {factors.map((factor, index) => (
          <div key={factor.feature} className="metric-tile flex items-center gap-3.5 rounded-xl px-3.5 py-3.5">
            <span className="data-value w-10 shrink-0 text-2xl font-bold text-[#C8102E]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug text-[#FFFFFF]">
                {factor.feature} <span className="font-normal text-[#FFFFFF]">favored</span>{' '}
                <span className="text-[#C8102E]">{factor.impact}</span>
              </p>
              <p className="mt-1 text-[15px] leading-6 text-[#FFFFFF]">{factor.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function firstName(fullName: string) {
  return fullName.split(' ').slice(-1)[0] ?? fullName
}

function formatPercent(value: number | null) {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function formatPerMin(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(1)}/min`
}

function formatPlainNumber(value: number | null) {
  if (value == null) return '—'
  return value.toFixed(1)
}

function formatHeightImperial(cm: number | null) {
  if (cm == null) return '—'
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}"`
}

function formatReachImperial(cm: number | null) {
  if (cm == null) return '—'
  return `${Math.round(cm / 2.54)}"`
}

function formatAge(age: number | null) {
  if (age == null) return '—'
  return `${Math.round(age)}`
}
