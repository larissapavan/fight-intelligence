import { useEffect, useState } from 'react'

import { getFighterPerformance } from '../services/api'
import type { FighterPerformance, FighterProfile, PredictionResponse } from '../types/api'

interface StatsComparisonProps {
  fighterA: FighterProfile | null
  fighterB: FighterProfile | null
  result: PredictionResponse | null
}

function useFighterPerformance(name: string | undefined) {
  const [state, setState] = useState<{ name: string; data: FighterPerformance } | null>(null)

  useEffect(() => {
    if (!name) return undefined
    let cancelled = false
    getFighterPerformance(name)
      .then((data) => {
        if (!cancelled) setState({ name, data })
      })
      .catch((error) => {
        console.error(error)
      })
    return () => {
      cancelled = true
    }
  }, [name])

  // Filters out stale data from a previously selected fighter: if `name`
  // changed since the last successful fetch, treat it as "not loaded yet"
  // rather than synchronously resetting state inside the effect above.
  return state && state.name === name ? state.data : null
}

const statRows = [
  { label: 'Age', key: 'age' },
  { label: 'Height', key: 'height_cm' },
  { label: 'Reach', key: 'reach_cm' },
  { label: 'Wins', key: 'wins' },
  { label: 'Losses', key: 'losses' },
  { label: 'Win rate', key: 'win_rate' },
] as const

export function StatsComparison({ fighterA, fighterB, result }: StatsComparisonProps) {
  const performanceA = useFighterPerformance(fighterA?.name)
  const performanceB = useFighterPerformance(fighterB?.name)

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3">
        <p className="broadcast-label text-[10px] text-[#999999]">Tale of the tape</p>
        <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Head-to-head matchup analysis</h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[#999999]">
          A side-by-side breakdown of both fighters, highlighting physical advantages, performance metrics and key statistical edges.
        </p>
      </div>

      {fighterA && fighterB ? (
        <div className="space-y-2.5">
          {statRows.map((row) => (
            <ComparisonRow
              key={row.key}
              label={row.label}
              rawA={fighterA[row.key]}
              rawB={fighterB[row.key]}
              fighterAValue={formatValue(fighterA[row.key])}
              fighterBValue={formatValue(fighterB[row.key])}
            />
          ))}

          <div className="grid gap-2.5 md:grid-cols-2">
            <DeltaCard
              title="Reach difference"
              value={result?.comparison_stats.reach_difference ?? 0}
              positiveLabel={fighterA.name}
              negativeLabel={fighterB.name}
              unit="cm"
            />
            <DeltaCard
              title="Age difference"
              value={result?.comparison_stats.age_difference ?? 0}
              positiveLabel={fighterA.name}
              negativeLabel={fighterB.name}
              unit="years"
            />
          </div>

          <FinishingTendencies fighterA={fighterA} fighterB={fighterB} performanceA={performanceA} performanceB={performanceB} />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-[#999999]">
          Select two fighters to reveal the complete matchup analysis.
        </p>
      )}
    </section>
  )
}

function ComparisonRow({
  label,
  rawA,
  rawB,
  fighterAValue,
  fighterBValue,
}: {
  label: string
  rawA: number | null | undefined
  rawB: number | null | undefined
  fighterAValue: string
  fighterBValue: string
}) {
  const left = rawA ?? 0
  const right = rawB ?? 0
  const total = Math.max(left + right, 1)
  const leftPct = label === 'Losses' ? (1 - left / total) * 100 : (left / total) * 100
  const rightPct = label === 'Losses' ? (1 - right / total) * 100 : (right / total) * 100

  return (
    <div className="metric-tile rounded-2xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-12 text-sm font-semibold text-[#FFFFFF]">{fighterAValue}</span>
        <span className="broadcast-label text-center text-[10px] text-[#999999]">{label}</span>
        <span className="min-w-12 text-right text-sm font-semibold text-[#FFFFFF]">{fighterBValue}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="progress-track h-2 overflow-hidden rounded-full">
          <div className="h-full rounded-full bg-[#E81B23] transition-all duration-500" style={{ width: `${Math.max(Math.min(leftPct, 100), 8)}%` }} />
        </div>
        <div className="h-2 w-2 rounded-full bg-[#E81B23]" />
        <div className="progress-track h-2 overflow-hidden rounded-full">
          <div className="ml-auto h-full rounded-full bg-[#2F5FA8] transition-all duration-500" style={{ width: `${Math.max(Math.min(rightPct, 100), 8)}%` }} />
        </div>
      </div>
    </div>
  )
}

function DeltaCard({
  title,
  value,
  positiveLabel,
  negativeLabel,
  unit,
}: {
  title: string
  value: number
  positiveLabel: string
  negativeLabel: string
  unit: string
}) {
  const leader = value >= 0 ? positiveLabel : negativeLabel

  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[10px] text-[#999999]">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="data-value text-2xl font-bold text-[#FFFFFF]">{Math.abs(value).toFixed(1)} {unit}</p>
        <span className="rounded-full border border-[#E81B23]/20 bg-[#E81B23]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E81B23]">
          Edge: {leader}
        </span>
      </div>
    </div>
  )
}

function FinishingTendencies({
  fighterA,
  fighterB,
  performanceA,
  performanceB,
}: {
  fighterA: FighterProfile
  fighterB: FighterProfile
  performanceA: FighterPerformance | null
  performanceB: FighterPerformance | null
}) {
  if (!performanceA && !performanceB) return null

  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[10px] text-[#999999]">Finishing tendencies</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <FighterTendencyColumn name={fighterA.name} performance={performanceA} />
        <FighterTendencyColumn name={fighterB.name} performance={performanceB} align="right" />
      </div>
    </div>
  )
}

function FighterTendencyColumn({
  name,
  performance,
  align = 'left',
}: {
  name: string
  performance: FighterPerformance | null
  align?: 'left' | 'right'
}) {
  const alignClass = align === 'right' ? 'items-end text-right' : 'items-start text-left'
  const maxRoundCount = performance ? Math.max(...Object.values(performance.round_distribution), 1) : 1

  return (
    <div className={`flex flex-col gap-1.5 ${alignClass}`}>
      <span className="truncate text-xs font-semibold text-[#FFFFFF]">{name}</span>
      <span className="theme-muted text-[11px]">
        Avg. win time: {performance?.avg_win_time_seconds ? formatSeconds(performance.avg_win_time_seconds) : '—'}
      </span>
      {performance && Object.keys(performance.round_distribution).length > 0 ? (
        <div className={`flex w-full flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
          {[1, 2, 3, 4, 5].map((round) => {
            const count = performance.round_distribution[String(round)] ?? 0
            if (count === 0) return null
            return (
              <div key={round} className={`flex w-full items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                <span className="theme-muted w-6 shrink-0 text-[10px]">R{round}</span>
                <div className="progress-track h-1.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full bg-[#E81B23] ${align === 'right' ? 'ml-auto' : ''}`}
                    style={{ width: `${Math.max((count / maxRoundCount) * 100, 10)}%` }}
                  />
                </div>
                <span className="w-3 shrink-0 text-[10px] text-[#FFFFFF]">{count}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatValue(value: number | null | undefined) {
  if (value == null) return '—'
  if (value <= 1 && value >= 0) return `${(value * 100).toFixed(1)}%`
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(1)
}
