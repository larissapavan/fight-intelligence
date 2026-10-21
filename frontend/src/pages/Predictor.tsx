import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { ChampionBelt } from '../shared/components/ChampionBelt'
import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterSelect } from '../shared/components/FighterSelect'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { nationalityText } from '../shared/data/badges'
import { getFighterImageUrl, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { usePrediction } from '../shared/hooks/usePrediction'
import type { FighterProfile, MainFactor, PredictionResponse } from '../shared/types/api'

// Palette: ink #0E0E0E, paper #EDE6D6, blood #C8102E, tape #F2C230, corner blue #1F4E9C.
const INK = 'border-[#0E0E0E]'

export function Predictor() {
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const { fighters, loading, error: fightersError } = useFighters()
  const { modelInfo, health } = useModelInfo()
  const { prediction, loading: predicting, error: predictionError, runPrediction } = usePrediction()
  const [error, setError] = useState<string | null>(null)

  const fighterA = useMemo(() => fighters.find((fighter) => fighter.name === nameA) ?? null, [fighters, nameA])
  const fighterB = useMemo(() => fighters.find((fighter) => fighter.name === nameB) ?? null, [fighters, nameB])
  const canScore = Boolean(nameA && nameB && nameA !== nameB)

  const score = async () => {
    if (!canScore) return
    try {
      setError(null)
      await runPrediction(nameA, nameB)
    } catch {
      setError('Prediction failed. Check whether the backend is available and try again.')
    }
  }

  const activeFighters = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])
  const shown = shownMetrics(modelInfo)
  const isOnline = Boolean(health?.model_loaded)
  const problem = error ?? predictionError ?? fightersError

  return (
    <div className={`border-[3px] ${INK} bg-[#EDE6D6] text-[#0E0E0E] shadow-[8px_8px_0_#C8102E]`}>
      <Masthead dataThrough={health?.latest_fight_date ?? null} />

      <header className={`poster-halftone border-b-[3px] ${INK} px-4 py-5 sm:px-8 sm:py-7`}>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#C8102E]">Tonight's question</p>
        <h1 className="poster-display mt-2 text-5xl sm:text-6xl md:text-7xl">
          Who takes <span className="text-[#C8102E]">it?</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm font-medium leading-6 sm:text-base">
          Pick any two fighters. The model gives you the odds and shows which numbers moved them.
        </p>
      </header>

      <Scoreboard
        cells={[
          { label: 'Fights on file', value: health?.fights_tracked ? health.fights_tracked.toLocaleString('en-US') : '—' },
          {
            label: 'Fighters',
            value: (health?.fighters_loaded ?? fighters.length).toLocaleString('en-US'),
            note: activeFighters ? `${activeFighters.toLocaleString('en-US')} active` : undefined,
          },
          {
            label: 'Model accuracy',
            value: shown.accuracy != null ? `${(shown.accuracy * 100).toFixed(1)}%` : '—',
            note: shown.caption || undefined,
          },
          { label: 'Backend', value: isOnline ? 'On air' : 'Offline', note: isOnline ? 'Model loaded' : 'Unreachable', alert: !isOnline },
        ]}
      />

      {problem ? (
        <p className={`border-b-[3px] ${INK} bg-[#F2C230] px-4 py-2 text-sm font-bold sm:px-8`}>{problem}</p>
      ) : null}

      <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]">
          <Corner side="red" fighter={fighterA} loading={loading}>
            <FighterSelect
              label="Red corner"
              corner="red"
              value={nameA}
              fighters={fighters}
              disabledFighterName={nameB}
              placeholder="Search fighter by name..."
              onChange={setNameA}
            />
          </Corner>

          <div className="flex items-center justify-center py-1 lg:py-0">
            <span
              className={`poster-display grid h-16 w-16 -rotate-6 place-items-center rounded-full border-[3px] ${INK} bg-[#F2C230] text-3xl shadow-[3px_3px_0_#0E0E0E]`}
            >
              vs
            </span>
          </div>

          <Corner side="blue" fighter={fighterB} loading={loading}>
            <FighterSelect
              label="Blue corner"
              corner="blue"
              value={nameB}
              fighters={fighters}
              disabledFighterName={nameA}
              placeholder="Search fighter by name..."
              onChange={setNameB}
            />
          </Corner>
        </div>

        <button
          type="button"
          onClick={score}
          disabled={!canScore || predicting || loading}
          className={`poster-display flex w-full items-center justify-center gap-3 border-[3px] px-4 py-4 text-3xl transition sm:text-4xl ${
            canScore && !predicting && !loading
              ? `${INK} bg-[#F2C230] shadow-[6px_6px_0_#0E0E0E] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_#0E0E0E] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none`
              : 'cursor-not-allowed border-dashed border-[#0E0E0E]/40 text-[var(--text-muted)]'
          }`}
        >
          {predicting ? <LoaderCircle className="h-7 w-7 animate-spin" /> : null}
          {predicting ? 'Judges are scoring...' : canScore ? 'Score the fight' : 'Pick both corners first'}
          {canScore && !predicting ? <ArrowRight className="h-7 w-7" /> : null}
        </button>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Scorecard prediction={prediction} fighterA={fighterA} fighterB={fighterB} />
          <Drivers factors={prediction?.main_factors ?? []} />
        </div>

        <TaleOfTape fighterA={fighterA} fighterB={fighterB} />
      </div>
    </div>
  )
}

function Masthead({ dataThrough }: { dataThrough: string | null }) {
  const date = dataThrough ? new Date(`${dataThrough}T00:00:00`) : null
  const label = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-[3px] ${INK} bg-[#0E0E0E] px-4 py-2 text-[#F2C230] sm:px-8`}>
      <span className="text-xs font-bold uppercase tracking-[0.25em]">Fight Intelligence · Matchup desk</span>
      {label ? <span className="text-xs font-bold uppercase tracking-[0.2em]">Results through {label}</span> : null}
    </div>
  )
}

function Scoreboard({ cells }: { cells: { label: string; value: string; note?: string; alert?: boolean }[] }) {
  return (
    <div className={`grid grid-cols-2 border-l-0 lg:grid-cols-4`}>
      {cells.map((cell) => (
        <div key={cell.label} className={`min-w-0 border-b-[3px] border-r-[3px] ${INK} px-4 py-3 last:border-r-0 sm:px-6 lg:border-r-[3px] lg:last:border-r-0 [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r-[3px]`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]">{cell.label}</p>
          <p className={`poster-display mt-1 flex items-center gap-2 text-3xl sm:text-4xl ${cell.alert ? 'text-[#C8102E]' : ''}`}>
            {cell.label === 'Backend' && !cell.alert ? (
              <span className={`h-3 w-3 shrink-0 border-2 ${INK} bg-[#2E9E5B]`} aria-hidden="true" />
            ) : null}
            <span className="min-w-0 truncate">{cell.value}</span>
          </p>
          {cell.note ? <p className="mt-1 truncate text-xs font-semibold opacity-70">{cell.note}</p> : null}
        </div>
      ))}
    </div>
  )
}

function Corner({
  side,
  fighter,
  loading,
  children,
}: {
  side: 'red' | 'blue'
  fighter: FighterProfile | null
  loading: boolean
  children: ReactNode
}) {
  const { imageByName } = useFighterImages()
  const block = side === 'red' ? 'bg-[#C8102E]' : 'bg-[#1F4E9C]'

  return (
    <section className={`flex min-w-0 flex-col border-[3px] ${INK} bg-white`}>
      <div className={`${block} flex items-center justify-between gap-3 px-3 py-2 text-white`}>
        <span className="poster-display text-2xl sm:text-3xl">{side === 'red' ? 'Red corner' : 'Blue corner'}</span>
        {fighter ? <span className="truncate text-xs font-bold uppercase tracking-widest">{fighter.division ?? fighter.stance}</span> : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4">
        {children}

        {fighter ? (
          <FighterSheet fighter={fighter} imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)} />
        ) : (
          <div className={`poster-hatch flex flex-1 flex-col items-center justify-center border-2 border-dashed ${INK}/50 px-4 py-10 text-center`}>
            <p className="poster-display text-5xl text-[var(--text-muted)] sm:text-6xl">{loading ? '...' : 'TBA'}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-[#0E0E0E]/60">To be announced</p>
          </div>
        )}
      </div>
    </section>
  )
}

function FighterSheet({ fighter, imageUrl }: { fighter: FighterProfile; imageUrl: string | null }) {
  const record = `${fighter.wins ?? 0}-${fighter.losses ?? 0}${fighter.draws ? `-${fighter.draws}` : ''}`
  const place = fighter.hometown ?? fighter.country
  const rows: [string, string][] = [
    ['Age', fighter.age ? `${fighter.age.toFixed(0)}` : '—'],
    ['Height', fighter.height_cm ? `${fighter.height_cm.toFixed(0)} cm` : '—'],
    ['Reach', fighter.reach_cm ? `${fighter.reach_cm.toFixed(0)} cm` : '—'],
    ['Weight', fighter.weight_lbs ? `${fighter.weight_lbs.toFixed(0)} lb` : '—'],
    ['Stance', fighter.stance || '—'],
    ['Win rate', fighter.win_rate != null ? `${(fighter.win_rate * 100).toFixed(1)}%` : '—'],
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <FighterAvatar name={fighter.name} imageUrl={imageUrl} className="h-24 w-24 sm:h-28 sm:w-28" />
        <div className="min-w-0">
          <h3 className="poster-display flex flex-wrap items-center gap-2 text-4xl leading-none sm:text-5xl">
            <span className="min-w-0 break-words">{fighter.name}</span>
            {fighter.belt ? <ChampionBelt /> : null}
          </h3>
          {fighter.nickname ? <p className="mt-1 text-sm font-semibold italic">"{fighter.nickname}"</p> : null}
          <FighterBadges badges={fighter.badges} className="mt-2" />
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <FlagList fighter={fighter} />
            <span className="min-w-0 truncate">{place ?? 'Origin unknown'}</span>
          </p>
          {nationalityText(fighter) ? <p className="truncate text-xs font-medium opacity-70">Nationalities: {nationalityText(fighter)}</p> : null}
        </div>
      </div>

      <div className={`flex items-end justify-between border-y-[3px] ${INK} py-2`}>
        <span className="text-xs font-bold uppercase tracking-[0.2em]">Record</span>
        <span className="poster-display text-5xl">{record}</span>
      </div>

      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-end">
            <dt className="font-bold uppercase tracking-wide">{label}</dt>
            <span className="poster-leader" aria-hidden="true" />
            <dd className="font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Scorecard({
  prediction,
  fighterA,
  fighterB,
}: {
  prediction: PredictionResponse | null
  fighterA: FighterProfile | null
  fighterB: FighterProfile | null
}) {
  const rows = prediction
    ? [
        { name: prediction.fighter_a_profile.name, value: prediction.fighter_a_probability, color: 'bg-[#C8102E]' },
        { name: prediction.fighter_b_profile.name, value: prediction.fighter_b_probability, color: 'bg-[#1F4E9C]' },
      ]
    : [
        { name: fighterA?.name ?? 'Red corner', value: null, color: 'bg-[#C8102E]' },
        { name: fighterB?.name ?? 'Blue corner', value: null, color: 'bg-[#1F4E9C]' },
      ]

  return (
    <section className={`border-[3px] ${INK} bg-white`}>
      <div className="flex items-center justify-between bg-[#0E0E0E] px-3 py-2 text-[#F2C230]">
        <span className="poster-display text-xl">Official scorecard</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Model odds</span>
      </div>

      <div className="relative space-y-4 p-4 sm:p-5">
        {prediction ? (
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-[#0E0E0E] pb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8102E]">Projected winner</p>
              <p className="poster-display mt-1 break-words text-3xl leading-none sm:text-4xl">{prediction.predicted_winner}</p>
            </div>
            <p className="poster-display text-5xl leading-none text-[#C8102E] sm:text-6xl">{(prediction.probability * 100).toFixed(0)}%</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex items-end">
                <span className="min-w-0 truncate text-sm font-bold uppercase tracking-wide">{row.name}</span>
                <span className="poster-leader" aria-hidden="true" />
                <span className="poster-display text-xl">{row.value != null ? `${(row.value * 100).toFixed(1)}%` : '--'}</span>
              </div>
              <div className={`mt-1 h-4 border-2 ${INK} bg-[#EDE6D6]`}>
                {row.value != null ? <div className={`h-full ${row.color}`} style={{ width: `${row.value * 100}%` }} /> : null}
              </div>
            </div>
          ))}
        </div>

        {prediction ? (
          <p className="text-sm font-medium leading-6">{prediction.message}</p>
        ) : (
          <div className="flex justify-end pt-2 text-[#C8102E]">
            <span className="poster-display poster-stamp text-3xl">Awaiting bout</span>
          </div>
        )}
      </div>
    </section>
  )
}

function Drivers({ factors }: { factors: MainFactor[] }) {
  const max = Math.max(...factors.map((factor) => factor.magnitude), 0.01)
  const rows = factors.slice(0, 6)

  return (
    <section className={`border-[3px] ${INK} bg-white`}>
      <div className="flex items-center justify-between bg-[#0E0E0E] px-3 py-2 text-[#F2C230]">
        <span className="poster-display text-xl">Why the model leans</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">SHAP</span>
      </div>

      <div className="space-y-3 p-4">
        {rows.length ? (
          rows.map((factor, index) => (
            <div key={factor.feature}>
              <div className="flex items-end gap-2">
                <span className="poster-display w-5 shrink-0 text-xl text-[#C8102E]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide sm:text-sm">{factor.feature}</span>
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest">favors {factor.impact}</span>
              </div>
              <div className={`mt-1 h-2.5 border-2 ${INK} bg-[#EDE6D6]`}>
                <div className="h-full bg-[#0E0E0E]" style={{ width: `${Math.max((factor.magnitude / max) * 100, 6)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] font-medium leading-4 opacity-80">{factor.explanation}</p>
            </div>
          ))
        ) : (
          <>
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-end gap-2">
                <span className="poster-display w-6 shrink-0 text-2xl text-[var(--text-muted)]">{n}</span>
                <span className="poster-leader" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">--</span>
              </div>
            ))}
            <p className="text-sm font-medium leading-6 text-[#0E0E0E]/70">
              Score the fight to see the three numbers that pushed the odds, ranked.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

type TapeRow = { label: string; a: number | null; b: number | null; unit?: string; better: 'high' | 'low' | 'none'; pct?: boolean }

function TaleOfTape({ fighterA, fighterB }: { fighterA: FighterProfile | null; fighterB: FighterProfile | null }) {
  const rows: TapeRow[] = [
    { label: 'Age', a: fighterA?.age ?? null, b: fighterB?.age ?? null, better: 'none' },
    { label: 'Height (cm)', a: fighterA?.height_cm ?? null, b: fighterB?.height_cm ?? null, better: 'high' },
    { label: 'Reach (cm)', a: fighterA?.reach_cm ?? null, b: fighterB?.reach_cm ?? null, better: 'high' },
    { label: 'Wins', a: fighterA?.wins ?? null, b: fighterB?.wins ?? null, better: 'high' },
    { label: 'Losses', a: fighterA?.losses ?? null, b: fighterB?.losses ?? null, better: 'low' },
    { label: 'Win rate', a: fighterA?.win_rate ?? null, b: fighterB?.win_rate ?? null, better: 'high', pct: true },
    { label: 'Striking accuracy', a: fighterA?.sig_str_acc ?? null, b: fighterB?.sig_str_acc ?? null, better: 'high', pct: true },
    { label: 'Takedown accuracy', a: fighterA?.takedown_acc ?? null, b: fighterB?.takedown_acc ?? null, better: 'high', pct: true },
  ]
  const ready = Boolean(fighterA && fighterB)

  return (
    <section className={`border-[3px] ${INK} bg-white`}>
      <div className="flex items-center justify-between bg-[#0E0E0E] px-3 py-2 text-[#F2C230]">
        <span className="poster-display text-xl">Tale of the tape</span>
        <span className="hidden text-[11px] font-bold uppercase tracking-[0.2em] sm:inline">Highlight = edge</span>
      </div>

      <div className={`grid grid-cols-[1fr_auto_1fr] border-b-[3px] ${INK} text-center`}>
        <span className="poster-display truncate bg-[#C8102E] px-2 py-1.5 text-base text-white sm:text-lg">{fighterA?.name ?? 'Red corner'}</span>
        <span className="w-24 shrink-0 sm:w-40" />
        <span className="poster-display truncate bg-[#1F4E9C] px-2 py-1.5 text-base text-white sm:text-lg">{fighterB?.name ?? 'Blue corner'}</span>
      </div>

      <div>
        {rows.map((row) => {
          const edge = ready ? edgeOf(row) : null
          return (
            <div key={row.label} className={`grid grid-cols-[1fr_auto_1fr] items-center border-b-2 ${INK}/25 last:border-b-0`}>
              <Cell value={row.a} row={row} winning={edge === 'a'} ready={ready} />
              <span className="w-24 shrink-0 px-1 text-center text-[11px] font-bold uppercase leading-tight tracking-wider sm:w-40 sm:text-xs">{row.label}</span>
              <Cell value={row.b} row={row} winning={edge === 'b'} ready={ready} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Cell({ value, row, winning, ready }: { value: number | null; row: TapeRow; winning: boolean; ready: boolean }) {
  const text = !ready || value == null ? '--' : row.pct ? `${(value * 100).toFixed(1)}%` : Number.isInteger(value) ? `${value}` : value.toFixed(1)
  return (
    <span className="px-2 py-1.5 text-center">
      <span className={`poster-display inline-block px-2 text-xl sm:text-2xl ${winning ? 'bg-[#F2C230]' : ready ? '' : 'text-[var(--text-muted)]'}`}>{text}</span>
    </span>
  )
}

function edgeOf(row: TapeRow): 'a' | 'b' | null {
  if (row.better === 'none' || row.a == null || row.b == null || row.a === row.b) return null
  const aWins = row.better === 'high' ? row.a > row.b : row.a < row.b
  return aWins ? 'a' : 'b'
}
