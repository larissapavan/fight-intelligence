import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, LoaderCircle, Sparkles, Swords, Zap } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { ChampionBelt } from '../../shared/components/ChampionBelt'
import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgFighters } from '../../shared/hooks/useOrgData'
import { formatProbability, localizePredictionMessage } from '../../shared/data/probability'
import { DataConfidenceNote } from '../../shared/components/DataConfidenceNote'
import { localizeFeature } from '../../shared/utils/localizeFeature'
import { usePrediction } from '../../shared/hooks/usePrediction'
import type { FighterProfile, MainFactor, OrgFighter, PredictionResponse } from '../../shared/types/api'

export function OrgPredictor() {
  const { i18n } = useTranslation()
  const org = useOrg()
  const [searchParams, setSearchParams] = useSearchParams()
  const presetA = searchParams.get('a') || searchParams.get('fighter_a') || ''
  const presetB = searchParams.get('b') || searchParams.get('fighter_b') || ''
  const [nameA, setNameA] = useState(() => presetA)
  const [nameB, setNameB] = useState(() => presetB)
  const [profileName, setProfileName] = useState<string | null>(null)
  const { fighters, loading: fightersLoading, error: fightersError } = useOrgFighters(org.id)
  const { prediction, loading: predicting, error: predictionError, runPrediction } = usePrediction()
  const [error, setError] = useState<string | null>(null)

  const chooseCorner = (side: 'a' | 'b', value: string) => {
    if (side === 'a') setNameA(value)
    else setNameB(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set(side, value)
    else next.delete(side)
    setSearchParams(next, { replace: true })
  }

  const swapCorners = () => {
    if (!nameA && !nameB) return
    const nextA = nameB
    const nextB = nameA
    setNameA(nextA)
    setNameB(nextB)
    const next = new URLSearchParams(searchParams)
    if (nextA) next.set('a', nextA)
    else next.delete('a')
    if (nextB) next.set('b', nextB)
    else next.delete('b')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!presetA || !presetB || presetA === presetB) return
    void runPrediction(presetA, presetB)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fighterA = useMemo(() => fighters.find((f) => f.name === nameA) ?? null, [fighters, nameA])
  const fighterB = useMemo(() => fighters.find((f) => f.name === nameB) ?? null, [fighters, nameB])
  const canScore = Boolean(nameA && nameB && nameA !== nameB)

  const score = async () => {
    if (!canScore) return
    try {
      setError(null)
      await runPrediction(nameA, nameB)
    } catch {
      setError(
        L(
          i18n.language,
          'Falha na predição. Tente novamente em instantes.',
          'Prediction failed. Please try again.',
          'Échec de prédiction. Veuillez réessayer.',
        ),
      )
    }
  }

  const activeFighters = useMemo(() => fighters.filter((f) => f.is_active).length, [fighters])
  const problem = error ?? predictionError ?? fightersError

  // Suggested marquee bouts for the organization
  const quickBouts = useMemo(() => {
    if (org.id === 'one') {
      return [
        ['Rodtang Jitmuangnon', 'Superlek Kiatmoo9'],
        ['Christian Lee', 'Saygid Izagakhmaev'],
        ['Demetrious Johnson', 'Adriano Moraes'],
        ['Anatoly Malykhin', 'Oumar Kane'],
      ]
    }
    return []
  }, [org.id])

  return (
    <div className="surface-card rounded-2xl border border-[var(--rule)] overflow-hidden shadow-sm">
      <header className="border-b border-[var(--rule)] px-4 py-5 sm:px-6 sm:py-6 bg-[var(--surface-2)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#F2C230]/40 bg-[#F2C230]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#F2C230]">
            <Sparkles className="h-3.5 w-3.5" />
            {org.shortName} Fight Predictor
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)]">
            <Zap className="h-3 w-3 text-[#C8102E]" />
            AI Engine
          </span>
        </div>

        <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-[var(--text-main)]">
          {L(i18n.language, 'Quem Vence?', 'Who takes it?', 'Qui gagne ?')}
        </h1>
        <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-[var(--text-muted)]">
          {L(
            i18n.language,
            `Selecione dois fighters do ${org.shortName}. O modelo de AI calcula as chances de vitória e os fatores determinantes.`,
            `Pick any two ${org.shortName} fighters. The machine learning model projects the odds and shows the numbers driving the prediction.`,
            `Sélectionnez deux fighters de ${org.shortName}. Le modèle d’AI calcule les cotes et détaille les facteurs décisifs.`,
          )}
        </p>

        {quickBouts.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Featured Matchups:
            </span>
            {quickBouts.map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                onClick={() => {
                  chooseCorner('a', a)
                  chooseCorner('b', b)
                  void runPrediction(a, b)
                }}
                className="cursor-pointer rounded-lg border border-[var(--rule)] bg-[var(--card-bg)] px-2.5 py-1 text-xs font-bold transition hover:bg-[var(--surface-3)]"
              >
                {a} vs {b}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* Roster & Model Stats Bar */}
      <div className="grid grid-cols-2 border-b border-[var(--rule)] lg:grid-cols-4 bg-[var(--card-bg)]">
        <div className="border-b border-r border-[var(--rule)] p-3 sm:px-5 sm:py-3.5 lg:border-b-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Fighters
          </p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">{fighters.length}</p>
          <p className="text-xs font-semibold text-[var(--text-muted)]">
            {activeFighters} {L(i18n.language, 'ativos', 'active', 'actifs')}
          </p>
        </div>

        <div className="border-b border-r border-[var(--rule)] p-3 sm:px-5 sm:py-3.5 lg:border-b-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Organization
          </p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">{org.shortName}</p>
          <p className="text-xs font-semibold text-[var(--text-muted)] truncate">{org.name}</p>
        </div>

        <div className="border-b border-r border-[var(--rule)] p-3 sm:px-5 sm:py-3.5 lg:border-b-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            AI Engine
          </p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">ML Pro</p>
          <p className="text-xs font-semibold text-[var(--text-muted)]">XGBoost / LightGBM</p>
        </div>

        <div className="p-3 sm:px-5 sm:py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            SHAP Factors
          </p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[#22c55e]">Active</p>
          <p className="text-xs font-semibold text-[var(--text-muted)]">
            Biometrics & Striking
          </p>
        </div>
      </div>

      {problem ? (
        <div className="border-b border-[var(--rule)] bg-[#C8102E] px-4 py-3 text-sm font-bold text-white sm:px-6">
          {problem}
        </div>
      ) : null}

      {/* Main Predictor Matchup Arena */}
      <div className="p-4 sm:p-6">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Corner Red (A) */}
          <CornerCard
            side="red"
            fighter={fighterA}
            fighters={fighters}
            disabledName={nameB}
            loading={fightersLoading}
            selectedName={nameA}
            onSelect={(name) => chooseCorner('a', name)}
            onOpenProfile={(name) => setProfileName(name)}
          />

          {/* Corner Blue (B) */}
          <CornerCard
            side="blue"
            fighter={fighterB}
            fighters={fighters}
            disabledName={nameA}
            loading={fightersLoading}
            selectedName={nameB}
            onSelect={(name) => chooseCorner('b', name)}
            onOpenProfile={(name) => setProfileName(name)}
          />
        </div>

        {/* Action Controls: Swap & Simulate */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={swapCorners}
            disabled={!nameA && !nameB}
            className="flex items-center gap-2 rounded-xl border border-[var(--rule)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-bold uppercase transition hover:bg-[var(--surface-3)] disabled:opacity-40 cursor-pointer"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Swap Corners
          </button>

          <button
            type="button"
            onClick={score}
            disabled={!canScore || predicting}
            className="flex items-center gap-2 rounded-xl border border-transparent bg-[#C8102E] px-6 py-2.5 text-base font-bold uppercase text-white shadow-md transition hover:bg-[#b00d28] disabled:opacity-50 cursor-pointer"
          >
            {predicting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
            Predict Fight
          </button>
        </div>

        {/* Prediction Results Display */}
        {prediction ? (
          <div className="mt-8 space-y-6">
            <OrgScorecard prediction={prediction} />
            <OrgTaleOfTheTape fighterA={prediction.fighter_a_profile} fighterB={prediction.fighter_b_profile} />
            {prediction.main_factors?.length ? <OrgDrivers factors={prediction.main_factors} /> : null}
          </div>
        ) : null}
      </div>

      {profileName ? (
        <OrgFighterModal
          key={profileName}
          org={org}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </div>
  )
}

function CornerCard({
  side,
  fighter,
  fighters,
  disabledName,
  loading,
  selectedName,
  onSelect,
  onOpenProfile,
}: {
  side: 'red' | 'blue'
  fighter: OrgFighter | null
  fighters: OrgFighter[]
  disabledName?: string
  loading: boolean
  selectedName: string
  onSelect: (name: string) => void
  onOpenProfile: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const block = side === 'red' ? 'bg-[#C8102E]' : 'bg-[#1F4E9C]'

  const sortedFighters = useMemo(() => {
    return [...fighters].sort((a, b) => a.name.localeCompare(b.name))
  }, [fighters])

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[var(--rule)] bg-[var(--card-bg)] overflow-hidden shadow-xs">
      <div className={`${block} flex items-center justify-between gap-3 px-4 py-2.5 text-white`}>
        <span className="font-extrabold uppercase text-lg sm:text-xl">
          {side === 'red' ? 'Red Corner' : 'Blue Corner'}
        </span>
        {fighter?.division ? (
          <span className="truncate text-xs font-bold uppercase tracking-wider">
            {getDivisionName(fighter.division, i18n.language)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Fighter Dropdown / Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            Select Fighter
          </label>
          <select
            value={selectedName}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-[var(--rule)] bg-[var(--surface-1)] px-3 py-2 text-sm font-bold text-[var(--text-main)] outline-none"
          >
            <option value="">
              {loading ? 'Loading...' : 'Choose a fighter...'}
            </option>
            {sortedFighters.map((f) => (
              <option key={f.name} value={f.name} disabled={f.name === disabledName}>
                {f.name} {f.division ? `(${getDivisionName(f.division, 'pt')})` : ''} {f.belt ? '👑' : ''}
              </option>
            ))}
          </select>
        </div>

        {fighter ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onOpenProfile(fighter.name)}
                className="shrink-0 cursor-pointer transition hover:scale-105"
                title={`View profile of ${fighter.name}`}
              >
                <FighterAvatar name={fighter.name} imageUrl={fighter.image_url} className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl" />
              </button>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-1.5 text-xl sm:text-2xl font-bold leading-tight text-[var(--text-main)]">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(fighter.name)}
                    className="cursor-pointer text-left hover:text-[#C8102E] hover:underline"
                  >
                    {fighter.name}
                  </button>
                  {fighter.belt ? <ChampionBelt /> : null}
                </h3>
                {fighter.nickname ? (
                  <p className="mt-1 text-xs font-medium italic text-[var(--text-muted)]">"{fighter.nickname}"</p>
                ) : null}
                {fighter.country ? (
                  <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                    📍 {fighter.hometown ? `${fighter.hometown}, ` : ''}{fighter.country}
                  </p>
                ) : null}
                {fighter.camp ? (
                  <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                    🥋 {fighter.camp}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-end justify-between border-y border-[var(--rule)] py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Record</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
                {fighter.wins ?? 0}-{fighter.losses ?? 0}{fighter.draws ? `-${fighter.draws}` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Age</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.age ? `${Math.round(fighter.age)}` : '—'}</span>
              </div>
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Height</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.height_cm ? `${Math.round(fighter.height_cm)} cm` : '—'}</span>
              </div>
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Reach</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.reach_cm ? `${Math.round(fighter.reach_cm)} cm` : '—'}</span>
              </div>
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Str. Acc</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.sig_str_acc ? `${Math.round(fighter.sig_str_acc * 100)}%` : '—'}</span>
              </div>
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">TD / 15m</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.takedown_avg_per_15min != null ? fighter.takedown_avg_per_15min.toFixed(2) : '—'}</span>
              </div>
              <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] p-2">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase">Finish Rate</span>
                <span className="text-sm font-bold text-[var(--text-main)]">{fighter.finish_rate != null ? `${Math.round(fighter.finish_rate * 100)}%` : '—'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center border-2 border-dashed border-[var(--rule)] rounded-xl py-12 text-center">
            <Swords className="h-10 w-10 text-[var(--text-muted)]/40" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Choose a fighter
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function OrgScorecard({
  prediction,
}: {
  prediction: PredictionResponse
}) {
  const { i18n } = useTranslation()
  const rows = [
    { name: prediction.fighter_a_profile.name, value: prediction.fighter_a_probability, color: 'bg-[#C8102E]' },
    { name: prediction.fighter_b_profile.name, value: prediction.fighter_b_probability, color: 'bg-[#1F4E9C]' },
  ]

  return (
    <section className="rounded-2xl border border-[var(--rule)] bg-[var(--card-bg)] overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)] border-b border-[var(--rule)] px-4 py-2.5">
        <span className="text-base font-bold uppercase tracking-wide text-[var(--text-main)]">
          AI Scorecard
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Win Probability
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Projected Winner
            </p>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
              {prediction.predicted_winner}
            </p>
          </div>
          <p className="text-4xl sm:text-5xl font-black text-[#C8102E]">
            {formatProbability(prediction.probability)}
          </p>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex items-end justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-main)]">{row.name}</span>
                <span className="text-sm font-extrabold text-[var(--text-main)]">{formatProbability(row.value)}</span>
              </div>
              <div className="mt-1 h-3 rounded-full overflow-hidden bg-[var(--surface-3)]">
                <div className={`h-full ${row.color}`} style={{ width: `${row.value * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs font-medium leading-relaxed text-[var(--text-muted)]">
          {localizePredictionMessage(prediction.message, prediction.predicted_winner, i18n.language)}
        </p>

        {prediction.data_confidence ? (
          <DataConfidenceNote confidence={prediction.data_confidence} />
        ) : null}
      </div>
    </section>
  )
}

type TapeFighter = FighterProfile | OrgFighter | null | undefined

function OrgTaleOfTheTape({ fighterA, fighterB }: { fighterA: TapeFighter; fighterB: TapeFighter }) {
  const rows = [
    { label: 'Age', a: fighterA?.age ? `${Math.round(fighterA.age)}` : '—', b: fighterB?.age ? `${Math.round(fighterB.age)}` : '—' },
    { label: 'Height', a: fighterA?.height_cm ? `${Math.round(fighterA.height_cm)} cm` : '—', b: fighterB?.height_cm ? `${Math.round(fighterB.height_cm)} cm` : '—' },
    { label: 'Reach', a: fighterA?.reach_cm ? `${Math.round(fighterA.reach_cm)} cm` : '—', b: fighterB?.reach_cm ? `${Math.round(fighterB.reach_cm)} cm` : '—' },
    { label: 'Record', a: `${fighterA?.wins ?? 0}-${fighterA?.losses ?? 0}`, b: `${fighterB?.wins ?? 0}-${fighterB?.losses ?? 0}` },
    { label: 'Striking Accuracy', a: fighterA?.sig_str_acc ? `${Math.round(fighterA.sig_str_acc * 100)}%` : '—', b: fighterB?.sig_str_acc ? `${Math.round(fighterB.sig_str_acc * 100)}%` : '—' },
    { label: 'Takedown Accuracy', a: fighterA?.takedown_acc ? `${Math.round(fighterA.takedown_acc * 100)}%` : '—', b: fighterB?.takedown_acc ? `${Math.round(fighterB.takedown_acc * 100)}%` : '—' },
    { label: 'Win Rate', a: fighterA?.win_rate ? `${Math.round(fighterA.win_rate * 100)}%` : '—', b: fighterB?.win_rate ? `${Math.round(fighterB.win_rate * 100)}%` : '—' },
  ]

  return (
    <section className="rounded-2xl border border-[var(--rule)] bg-[var(--card-bg)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--rule)] px-4 py-2.5">
        <span className="text-base font-bold uppercase tracking-wide text-[var(--text-main)]">
          Tale of the Tape
        </span>
      </div>

      <div className="divide-y divide-[var(--rule)] p-4">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 py-2 text-center text-xs font-bold">
            <span className="text-left font-mono font-extrabold text-[#C8102E] sm:text-sm">{row.a}</span>
            <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{row.label}</span>
            <span className="text-right font-mono font-extrabold text-[#1F4E9C] sm:text-sm">{row.b}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function OrgDrivers({ factors }: { factors: MainFactor[] }) {
  const { i18n } = useTranslation()
  const rows = factors.slice(0, 6)

  return (
    <section className="rounded-2xl border border-[var(--rule)] bg-[var(--card-bg)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--rule)] px-4 py-2.5">
        <span className="text-base font-bold uppercase tracking-wide text-[var(--text-main)]">
          Key Factors (SHAP)
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Model Explainability</span>
      </div>

      <div className="space-y-3 p-5">
        {rows.map((factor, index) => (
          <div key={factor.feature} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--text-main)] uppercase tracking-wide">
                #{index + 1} {localizeFeature(factor.feature, i18n.language)}
              </span>
              <span className="rounded bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--text-main)]">
                Favors {factor.impact}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full bg-[#C8102E]"
                style={{ width: `${Math.min(100, Math.max(15, factor.magnitude * 250))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
