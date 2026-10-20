import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { FighterPerformance, FighterProfile } from '../types/api'
import { LoadingSkeleton } from './LoadingSkeleton'

const RED = '#C8102E'
const BLUE = '#2F5FA8'

const AXES = [
  { key: 'strikingOutput', label: 'Striking Output' },
  { key: 'strikingDefense', label: 'Striking Defense' },
  { key: 'tdOffense', label: 'Takedown Offense' },
  { key: 'tdDefense', label: 'Takedown Defense' },
  { key: 'finishRate', label: 'Finish Rate' },
  { key: 'recentForm', label: 'Recent Form' },
] as const

type AxisKey = (typeof AXES)[number]['key']

function clampPct(value: number | null | undefined, cap = 1) {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, (value / cap) * 100))
}

function finishRate(performance: FighterPerformance | null) {
  if (!performance || performance.wins <= 0) return 0
  const finishes = (performance.method_breakdown['KO/TKO'] ?? 0) + (performance.method_breakdown['Submission'] ?? 0)
  return finishes / performance.wins
}

function recentForm(performance: FighterPerformance | null, fallbackWinRate: number | null) {
  const recent = performance?.last_performances ?? []
  const decided = recent.filter((fight) => fight.result === 'win' || fight.result === 'loss')
  if (decided.length > 0) {
    return decided.filter((fight) => fight.result === 'win').length / decided.length
  }
  return fallbackWinRate ?? 0
}

function scoresFor(profile: FighterProfile, performance: FighterPerformance | null): Record<AxisKey, number> {
  return {
    strikingOutput: clampPct(profile.sig_strikes_landed_per_min, 8),
    strikingDefense: clampPct(profile.striking_defense),
    tdOffense: clampPct(profile.takedown_avg_per_15min, 6),
    tdDefense: clampPct(profile.takedown_defense),
    finishRate: clampPct(finishRate(performance)),
    recentForm: clampPct(recentForm(performance, profile.win_rate)),
  }
}

function AxisTick({
  x = 0,
  y = 0,
  textAnchor = 'middle',
  payload,
}: {
  x?: number | string
  y?: number | string
  textAnchor?: 'inherit' | 'end' | 'start' | 'middle'
  payload?: { value?: unknown }
}) {
  const xPos = Number(x)
  const yPos = Number(y)
  const words = String(payload?.value ?? '').split(' ')
  return (
    <text x={xPos} y={yPos} textAnchor={textAnchor} fill="#999999" fontSize={11}>
      {words.map((word, index) => (
        <tspan key={`${word}-${index}`} x={xPos} dy={index === 0 ? 0 : 12}>
          {word}
        </tspan>
      ))}
    </text>
  )
}

export function MatchupRadarChart({
  fighterA,
  fighterB,
  performanceA,
  performanceB,
  loading = false,
}: {
  fighterA: FighterProfile
  fighterB: FighterProfile
  performanceA: FighterPerformance | null
  performanceB: FighterPerformance | null
  loading?: boolean
}) {
  const scoreA = scoresFor(fighterA, performanceA)
  const scoreB = scoresFor(fighterB, performanceB)
  const data = AXES.map((axis) => ({
    axis: axis.label,
    red: Math.round(scoreA[axis.key]),
    blue: Math.round(scoreB[axis.key]),
  }))

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <p className="broadcast-label text-[10px] text-[#999999]">Style comparison</p>
      <h2 className="mt-0.5 text-lg font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Radar</h2>
      {loading ? (
        <LoadingSkeleton className="mt-3 h-[280px] rounded-2xl sm:h-[320px]" label="Loading style comparison" />
      ) : (
        <div className="mt-1 h-[300px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
              <PolarGrid stroke="rgba(120,110,90,0.45)" />
              <PolarAngleAxis dataKey="axis" tick={AxisTick} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={fighterA.name} dataKey="red" stroke={RED} fill={RED} fillOpacity={0.28} />
              <Radar name={fighterB.name} dataKey="blue" stroke={BLUE} fill={BLUE} fillOpacity={0.22} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-main)' }} />
              <Tooltip
                contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#FFFFFF' }}
                formatter={(value, name) => [`${value ?? 0}`, String(name)]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-1 text-center text-[11px] leading-4 text-[#999999]">
        Output and takedown offense are scaled to typical UFC ranges so both corners sit on the same 0–100 axes.
      </p>
    </article>
  )
}
