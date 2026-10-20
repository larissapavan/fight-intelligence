import { Fragment, useEffect, useState, type ComponentType } from 'react'
import { LoaderCircle, Ruler, ShieldAlert, Swords, Target } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { FighterSelect } from '../shared/components/FighterSelect'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { MatchupRadarChart } from '../shared/components/MatchupRadarChart'
import { RecentFightsPanel } from '../shared/components/RecentFightsPanel'
import { SectionHeading } from '../shared/components/SectionHeading'
import { ShapFactorBars } from '../shared/components/ShapFactorBars'
import { WinProbabilityBar } from '../shared/components/WinProbabilityBar'
import { useFighters } from '../shared/hooks/useFighters'
import { usePrediction } from '../shared/hooks/usePrediction'
import { getFighterPerformance } from '../shared/services/api'
import type { FighterPerformance, FighterProfile } from '../shared/types/api'

export function MatchupIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const presetFighterA = searchParams.get('a')
  const presetFighterB = searchParams.get('b')
  const eventName = searchParams.get('event')

  const [fighterAName, setFighterAName] = useState(() => presetFighterA ?? '')
  const [fighterBName, setFighterBName] = useState(() => presetFighterB ?? '')
  const { fighters, loading: fightersLoading, error: fightersError } = useFighters()
  const { prediction, loading: analyzing, error: predictionError, runPrediction } = usePrediction()
  const [error, setError] = useState<string | null>(null)
  const [performanceBundle, setPerformanceBundle] = useState<{
    key: string
    a: FighterPerformance | null
    b: FighterPerformance | null
    status: 'ready' | 'error'
  } | null>(null)

  const canAnalyze = Boolean(fighterAName && fighterBName && fighterAName !== fighterBName)

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError('Select two different fighters to analyze the matchup.')
      return
    }
    setError(null)
    await runPrediction(fighterAName, fighterBName)
  }

  // A shared link can change the pair without remounting the page: follow it while rendering (no effect needed).
  const [syncedPreset, setSyncedPreset] = useState({ a: presetFighterA, b: presetFighterB })
  if (syncedPreset.a !== presetFighterA || syncedPreset.b !== presetFighterB) {
    setSyncedPreset({ a: presetFighterA, b: presetFighterB })
    if (presetFighterA) setFighterAName(presetFighterA)
    if (presetFighterB) setFighterBName(presetFighterB)
  }

  // Either corner changing reloads the whole read: probability, radar, factors, stats, and recent fights.
  useEffect(() => {
    if (!fighterAName || !fighterBName || fighterAName === fighterBName) return
    void runPrediction(fighterAName, fighterBName)
  }, [fighterAName, fighterBName, runPrediction])

  const chooseFighter = (side: 'a' | 'b', name: string) => {
    const nextA = side === 'a' ? name : fighterAName
    const nextB = side === 'b' ? name : fighterBName
    if (side === 'a') setFighterAName(name)
    else setFighterBName(name)
    const params = new URLSearchParams(searchParams)
    params.set(side, name)
    setSearchParams(params, { replace: true })
    if (nextA && nextB && nextA === nextB) {
      setError('Select two different fighters to analyze the matchup.')
    }
  }

  const fighterA = prediction?.fighter_a_profile ?? null
  const fighterB = prediction?.fighter_b_profile ?? null
  const performanceKey = fighterA && fighterB ? `${fighterA.name}|${fighterB.name}` : ''

  useEffect(() => {
    if (!performanceKey) return
    const [nameA, nameB] = performanceKey.split('|')

    let cancelled = false
    Promise.all([getFighterPerformance(nameA), getFighterPerformance(nameB)])
      .then(([nextA, nextB]) => {
        if (cancelled) return
        setPerformanceBundle({ key: performanceKey, a: nextA, b: nextB, status: 'ready' })
      })
      .catch((requestError) => {
        console.error(requestError)
        if (cancelled) return
        setPerformanceBundle({ key: performanceKey, a: null, b: null, status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [performanceKey])

  const performancesReady = performanceBundle?.key === performanceKey ? performanceBundle : null
  const performancesLoading = Boolean(performanceKey) && performancesReady == null
  const performanceA = performancesReady?.status === 'ready' ? performancesReady.a : null
  const performanceB = performancesReady?.status === 'ready' ? performancesReady.b : null
  // The pick-two-fighters message goes away on its own once the pair is valid.
  const systemError = (canAnalyze ? null : error) ?? predictionError ?? fightersError
  const showResults = Boolean(fighterA && fighterB && prediction && !analyzing)

  return (
    <div className="space-y-6 sm:space-y-8">
      {eventName && fighterAName && fighterBName ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            <li>
              <Link to={`/events?q=${encodeURIComponent(eventName)}`} className="text-[var(--accent-red)] underline decoration-[var(--accent-red)] underline-offset-4">
                {eventName}
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--text-muted)]">/</li>
            <li className="text-[var(--text-main)]">
              {fighterAName} vs {fighterBName}
            </li>
          </ol>
        </nav>
      ) : null}
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Matchup"
          title="Why this matchup is interesting"
          description="Striking, grappling and physical numbers for both fighters, plus the factors the model weighed most."
        />
      </section>

      <section id="matchup-fighters" className="surface-card scroll-mt-4 rounded-[20px] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FighterSelect
            label="Fighter A"
            corner="red"
            value={fighterAName}
            fighters={fighters}
            disabledFighterName={fighterBName}
            placeholder="Select Fighter A"
            onChange={(name) => chooseFighter('a', name)}
          />
          <FighterSelect
            label="Fighter B"
            corner="blue"
            value={fighterBName}
            fighters={fighters}
            disabledFighterName={fighterAName}
            placeholder="Select Fighter B"
            onChange={(name) => chooseFighter('b', name)}
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

      {canAnalyze ? (
        <>
          <section className="surface-card rounded-[20px] p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="broadcast-label text-[10px] text-[var(--text-muted)]">Model odds</p>
                <h2 className="mt-0.5 text-xl font-black uppercase tracking-[0.03em] text-[var(--text-main)] sm:text-2xl">Win probability</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
              <FighterSelect
                label="Fighter A"
                corner="red"
                value={fighterAName}
                fighters={fighters}
                disabledFighterName={fighterBName}
                placeholder="Select Fighter A"
                onChange={(name) => chooseFighter('a', name)}
              />
              <span className="broadcast-label pb-4 text-center text-[10px] text-[var(--text-muted)]">vs</span>
              <FighterSelect
                label="Fighter B"
                corner="blue"
                value={fighterBName}
                fighters={fighters}
                disabledFighterName={fighterAName}
                placeholder="Select Fighter B"
                onChange={(name) => chooseFighter('b', name)}
              />
            </div>
            <div className="mt-4">
              {analyzing || !showResults || !fighterA || !fighterB || !prediction ? (
                <LoadingSkeleton className="h-[120px]" label="Loading win probability" />
              ) : (
                <WinProbabilityBar
                  showNames={false}
                  nameA={fighterA.name}
                  nameB={fighterB.name}
                  probabilityA={prediction.fighter_a_probability}
                  probabilityB={prediction.fighter_b_probability}
                  predictedWinner={prediction.predicted_winner}
                />
              )}
            </div>
            {!analyzing && prediction?.message ? <p className="mt-3 text-sm leading-6 text-[#999999]">{prediction.message}</p> : null}
          </section>

          {showResults && fighterA && fighterB && prediction ? (
            <>
              <MatchupRadarChart
                fighterA={fighterA}
                fighterB={fighterB}
                performanceA={performanceA}
                performanceB={performanceB}
                loading={performancesLoading}
              />

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

              <ShapFactorBars
                factors={prediction.main_factors}
                fighterAName={fighterA.name}
                fighterBName={fighterB.name}
              />

              <RecentFightsPanel
                nameA={fighterA.name}
                nameB={fighterB.name}
                performanceA={performanceA}
                performanceB={performanceB}
                loading={performancesLoading}
              />
            </>
          ) : (
            <MatchupAnalysisSkeleton includeOdds={false} />
          )}
        </>
      ) : null}

      {!canAnalyze ? (
        <section className="surface-card rounded-[20px] px-4 py-8 text-center">
          <p className="text-sm leading-6 text-[#999999]">
            Select two fighters and run the analysis to see the striking, grappling and physical breakdown, plus the
            key factors behind the model's read on this matchup.
          </p>
        </section>
      ) : null}
    </div>
  )
}

function MatchupAnalysisSkeleton({ includeOdds = true }: { includeOdds?: boolean }) {
  return (
    <div className="space-y-3" role="status" aria-label="Analyzing matchup">
      {includeOdds ? <LoadingSkeleton className="h-[180px] rounded-[20px]" label="Loading win probability" /> : null}
      <LoadingSkeleton className="h-[340px] rounded-[20px]" label="Loading radar chart" />
      <div className="grid gap-3 lg:grid-cols-3">
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
      </div>
      <LoadingSkeleton className="h-[220px] rounded-[20px]" label="Loading matchup factors" />
      <LoadingSkeleton className="h-[260px] rounded-[20px]" label="Loading recent fights" />
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
