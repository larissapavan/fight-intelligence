import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, ArrowRight, LoaderCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L, localeTag } from '../i18n/lang'
import { getDivisionName } from '../shared/data/divisions'
import { ChampionBelt } from '../shared/components/ChampionBelt'
import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { FighterSelect } from '../shared/components/FighterSelect'
import { FighterBadges, FlagList, TitleFightBadge } from '../shared/components/FighterBadges'
import { getFighterImageUrl, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import { formatProbability, localizePredictionMessage } from '../shared/data/probability'
import { DataConfidenceNote } from '../shared/components/DataConfidenceNote'
import { localizeFeature } from '../shared/utils/localizeFeature'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { usePrediction } from '../shared/hooks/usePrediction'
import { getMatchupTitleFight } from '../shared/data/titleFights'
import type { FighterProfile, MainFactor, PredictionResponse } from '../shared/types/api'

export function Predictor() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const presetA = searchParams.get('a') || searchParams.get('fighter_a') || ''
  const presetB = searchParams.get('b') || searchParams.get('fighter_b') || ''
  const [nameA, setNameA] = useState(() => presetA)
  const [nameB, setNameB] = useState(() => presetB)
  const [profileName, setProfileName] = useState<string | null>(null)
  const { fighters, loading, error: fightersError } = useFighters()
  const { modelInfo, health } = useModelInfo()
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
    // Only auto-score when the page mounts with URL params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fighterA = useMemo(() => fighters.find((fighter) => fighter.name === nameA) ?? null, [fighters, nameA])
  const fighterB = useMemo(() => fighters.find((fighter) => fighter.name === nameB) ?? null, [fighters, nameB])
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
          'Falha na predição. Verifique a conexão com o servidor e tente novamente.',
          'Prediction failed. Check whether the backend is available and try again.',
          'Échec du calcul. Vérifiez que le serveur est accessible et réessayez.',
        ),
      )
    }
  }

  const activeFighters = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])
  const shown = shownMetrics(modelInfo, i18n.language)
  const isOnline = Boolean(health?.model_loaded)
  const problem = error ?? predictionError ?? fightersError

  return (
    <div className="surface-card rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
      <Masthead dataThrough={health?.latest_fight_date ?? null} />

      <header className="border-b border-[var(--border-subtle)] px-4 py-5 sm:px-8 sm:py-7 bg-[var(--bg-surface-subtle)]">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent-red)]">{t('predictor.question', "Tonight's question")}</p>
        <h1 className="poster-display mt-2 text-2xl sm:text-3xl md:text-4xl text-[var(--text-primary)]">
          {t('predictor.whoTakesIt', 'Who takes it?')}
        </h1>
        <p className="mt-2 max-w-xl text-sm font-medium leading-6 sm:text-base text-[var(--text-secondary)]">
          {t('predictor.heroSubtitle', 'Pick any two fighters. The model gives you the odds and shows which numbers moved them.')}
        </p>
      </header>

      <Scoreboard
        cells={[
          { label: t('predictor.fightsOnFile', 'Fights on file'), value: health?.fights_tracked ? health.fights_tracked.toLocaleString(localeTag(i18n.language)) : '—' },
          {
            label: t('predictor.fighters', 'Fighters'),
            value: (health?.fighters_loaded ?? fighters.length).toLocaleString(localeTag(i18n.language)),
            note: activeFighters ? `${activeFighters.toLocaleString(localeTag(i18n.language))} ${t('predictor.active', 'active')}` : undefined,
          },
          {
            label: t('predictor.modelAccuracy', 'Model accuracy'),
            value: shown.accuracy != null ? `${(shown.accuracy * 100).toFixed(1)}%` : '—',
            note: shown.caption || undefined,
          },
          {
            label: t('predictor.backend', 'Backend'),
            value: isOnline ? t('predictor.onAir', 'On air') : t('header.apiOffline', 'Offline'),
            note: isOnline ? L(i18n.language, 'Modelo carregado', 'Model loaded', 'Modèle chargé') : L(i18n.language, 'Inacessível', 'Unreachable', 'Injoignable'),
            alert: !isOnline,
            onlineDot: isOnline,
          },
        ]}
      />

      {problem ? (
        <p className="border-b border-[var(--border-subtle)] bg-[var(--accent-gold)]/15 text-[var(--text-gold)] px-4 py-2 text-sm font-bold sm:px-8">{problem}</p>
      ) : null}

      <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]">
          <Corner side="red" fighter={fighterA} loading={loading} onOpenProfile={setProfileName}>
            <FighterSelect
              label={t('predictor.redCorner', 'Red corner')}
              corner="red"
              value={nameA}
              fighters={fighters}
              disabledFighterName={nameB}
              placeholder={t('predictor.searchPlaceholder', 'Search fighter by name...')}
              onChange={(val) => chooseCorner('a', val)}
            />
          </Corner>

          <div className="flex flex-col items-center justify-center gap-2 py-1 lg:py-0">
            <button
              type="button"
              onClick={swapCorners}
              disabled={!nameA && !nameB}
              title={L(i18n.language, 'Inverter cantos (Vermelho ⇄ Azul)', 'Swap corners (Red ⇄ Blue)', 'Inverser les coins (Rouge ⇄ Bleu)')}
              aria-label={L(i18n.language, 'Inverter cantos', 'Swap corners', 'Inverser les coins')}
              className={`poster-display group relative grid h-14 w-14 -rotate-6 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] text-2xl shadow-sm transition ${
                nameA || nameB ? 'cursor-pointer hover:rotate-0 hover:scale-105 active:scale-95 text-[var(--text-primary)]' : 'cursor-default text-[var(--text-muted)]'
              }`}
            >
              <span className={nameA || nameB ? 'group-hover:opacity-0 transition-opacity' : ''}>vs</span>
              {nameA || nameB ? (
                <ArrowLeftRight className="absolute h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100 text-[var(--text-primary)]" />
              ) : null}
            </button>
          </div>

          <Corner side="blue" fighter={fighterB} loading={loading} onOpenProfile={setProfileName}>
            <FighterSelect
              label={t('predictor.blueCorner', 'Blue corner')}
              corner="blue"
              value={nameB}
              fighters={fighters}
              disabledFighterName={nameA}
              placeholder={t('predictor.searchPlaceholder', 'Search fighter by name...')}
              onChange={(val) => chooseCorner('b', val)}
            />
          </Corner>
        </div>

        <button
          type="button"
          onClick={score}
          disabled={!canScore || predicting || loading}
          className="primary-action flex w-full items-center justify-center gap-3 rounded-xl py-3.5 px-6 text-xl uppercase tracking-wider transition cursor-pointer"
        >
          {predicting ? <LoaderCircle className="h-6 w-6 animate-spin" /> : null}
          {predicting ? t('predictor.predicting', 'Judges are scoring...') : canScore ? t('predictor.predictMatchup', 'Score the fight') : t('predictor.pickTwoPrompt', 'Pick both corners first')}
          {canScore && !predicting ? <ArrowRight className="h-6 w-6" /> : null}
        </button>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Scorecard prediction={prediction} fighterA={fighterA} fighterB={fighterB} />
          <Drivers factors={prediction?.main_factors ?? []} />
        </div>

        <TaleOfTape fighterA={fighterA} fighterB={fighterB} />
      </div>

      {profileName ? (
        <FighterProfileModal
          key={profileName}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </div>
  )
}

function Masthead({ dataThrough }: { dataThrough: string | null }) {
  const { i18n } = useTranslation()
  const date = dataThrough ? new Date(`${dataThrough}T00:00:00`) : null
  const label = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(localeTag(i18n.language), { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[var(--text-secondary)] sm:px-8">
      <span className="text-xs font-bold uppercase tracking-[0.25em]">
        {L(i18n.language, 'Inteligência de Combate · Mesa de Análise', 'Fight Intelligence · Matchup desk', 'Fight Intelligence · Table d’analyse')}
      </span>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {L(i18n.language, `Resultados até ${label}`, `Results through ${label}`, `Résultats jusqu’au ${label}`)}
        </span>
      ) : null}
    </div>
  )
}

function Scoreboard({ cells }: { cells: { label: string; value: string; note?: string; alert?: boolean; onlineDot?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] lg:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 border-r border-[var(--border-subtle)] px-4 py-3 sm:px-6 last:border-r-0 [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">{cell.label}</p>
          <p className={`poster-display mt-1 flex items-center gap-2 text-2xl sm:text-3xl ${cell.alert ? 'text-[var(--text-red)]' : 'text-[var(--text-primary)]'}`}>
            {cell.onlineDot ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-green)] animate-pulse" aria-hidden="true" />
            ) : null}
            <span className="min-w-0 truncate">{cell.value}</span>
          </p>
          {cell.note ? <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{cell.note}</p> : null}
        </div>
      ))}
    </div>
  )
}

function Corner({
  side,
  fighter,
  loading,
  onOpenProfile,
  children,
}: {
  side: 'red' | 'blue'
  fighter: FighterProfile | null
  loading: boolean
  onOpenProfile: (name: string) => void
  children: ReactNode
}) {
  const { i18n } = useTranslation()
  const { imageByName } = useFighterImages()
  const block = side === 'red' ? 'bg-[var(--accent-red)] text-white' : 'bg-[var(--accent-blue)] text-white'

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
      <div className={`${block} flex items-center justify-between gap-3 px-4 py-2.5`}>
        <span className="poster-display text-xl sm:text-2xl">
          {side === 'red' ? L(i18n.language, 'Canto Vermelho', 'Red corner', 'Coin rouge') : L(i18n.language, 'Canto Azul', 'Blue corner', 'Coin bleu')}
        </span>
        {fighter ? <span className="truncate text-xs font-bold uppercase tracking-widest">{fighter.division ? getDivisionName(fighter.division, i18n.language) : fighter.stance}</span> : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {children}

        {fighter ? (
          <FighterSheet fighter={fighter} imageUrl={getFighterImageUrl(fighter.name, imageByName, fighter.image_url)} onOpenProfile={() => onOpenProfile(fighter.name)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface-subtle)] px-4 py-10 text-center">
            <p className="poster-display text-3xl sm:text-4xl text-[var(--text-muted)]">{loading ? '...' : L(i18n.language, 'A definir', 'TBA', 'À définir')}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">{L(i18n.language, 'Aguardando lutador', 'To be announced', 'En attente d’un lutteur')}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function FighterSheet({ fighter, imageUrl, onOpenProfile }: { fighter: FighterProfile; imageUrl: string | null; onOpenProfile: () => void }) {
  const { i18n } = useTranslation()
  const record = `${fighter.wins ?? 0}-${fighter.losses ?? 0}${fighter.draws ? `-${fighter.draws}` : ''}`
  const place = fighter.hometown ?? fighter.country
  const rows: [string, string][] = [
    [L(i18n.language, 'Idade', 'Age', 'Âge'), fighter.age ? `${fighter.age.toFixed(0)}` : '—'],
    [L(i18n.language, 'Altura', 'Height', 'Taille'), fighter.height_cm ? `${fighter.height_cm.toFixed(0)} cm` : '—'],
    [L(i18n.language, 'Envergadura', 'Reach', 'Allonge'), fighter.reach_cm ? `${fighter.reach_cm.toFixed(0)} cm` : '—'],
    [L(i18n.language, 'Peso', 'Weight', 'Poids'), fighter.weight_lbs ? `${fighter.weight_lbs.toFixed(0)} lb` : '—'],
    [L(i18n.language, 'Postura', 'Stance', 'Garde'), fighter.stance || '—'],
    [L(i18n.language, 'Taxa de vitória', 'Win rate', 'Taux de victoire'), fighter.win_rate != null ? `${(fighter.win_rate * 100).toFixed(1)}%` : '—'],
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="shrink-0 cursor-pointer transition hover:scale-105"
          title={L(i18n.language, `Abrir perfil completo de ${fighter.name}`, `Open ${fighter.name}'s full profile`, `Ouvrir le profil complet de ${fighter.name}`)}
        >
          <FighterAvatar name={fighter.name} imageUrl={imageUrl} className="h-24 w-24 sm:h-28 sm:w-28" />
        </button>
        <div className="min-w-0">
          <h3 className="poster-display flex flex-wrap items-center gap-2 text-2xl leading-none sm:text-3xl text-[var(--text-primary)]">
            <button
              type="button"
              onClick={onOpenProfile}
              className="truncate transition hover:text-[var(--accent-red)] cursor-pointer"
            >
              {fighter.name}
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">({record})</span>
          </h3>
          {fighter.nickname ? (
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-[var(--accent-red)]">
              “{fighter.nickname}”
            </p>
          ) : null}
          {place ? <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{place}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {fighter.belt ? <ChampionBelt /> : null}
            <FighterBadges badges={fighter.badges} />
            <FlagList fighter={fighter} />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg bg-[var(--bg-surface-subtle)] p-2 border border-[var(--border-subtle)]">
            <dt className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
            <dd className="poster-display mt-0.5 truncate text-lg text-[var(--text-primary)]">{value}</dd>
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
  const { i18n } = useTranslation()
  const titleFightInfo = getMatchupTitleFight(
    prediction?.fighter_a_profile ?? fighterA,
    prediction?.fighter_b_profile ?? fighterB,
  )

  const rows = prediction
    ? [
        { name: prediction.fighter_a_profile.name, value: prediction.fighter_a_probability, color: 'bg-[var(--accent-red)]' },
        { name: prediction.fighter_b_profile.name, value: prediction.fighter_b_probability, color: 'bg-[var(--accent-blue)]' },
      ]
    : [
        { name: fighterA?.name ?? L(i18n.language, 'Canto Vermelho', 'Red corner', 'Coin rouge'), value: null, color: 'bg-[var(--accent-red)]' },
        { name: fighterB?.name ?? L(i18n.language, 'Canto Azul', 'Blue corner', 'Coin bleu'), value: null, color: 'bg-[var(--accent-blue)]' },
      ]

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="poster-display text-lg text-[var(--text-primary)]">{L(i18n.language, 'Placar de Probabilidades', 'Official scorecard', 'Carte des probabilités')}</span>
          {titleFightInfo?.title_fight ? <TitleFightBadge fight={titleFightInfo} /> : null}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">{L(i18n.language, 'Chances da IA', 'Model odds', 'Cotes du modèle')}</span>
      </div>

      <div className="relative space-y-4 p-4 sm:p-5">
        {prediction ? (
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-red)]">{L(i18n.language, 'Favorito Previsto', 'Projected winner', 'Vainqueur prévu')}</p>
              <p className="poster-display mt-1 break-words text-2xl leading-none sm:text-3xl text-[var(--text-primary)]">{prediction.predicted_winner}</p>
            </div>
            <p className="poster-display text-4xl leading-none text-[var(--accent-red)] sm:text-5xl">{formatProbability(prediction.probability)}</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex items-end">
                <span className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">{row.name}</span>
                <span className="poster-leader border-dotted border-[var(--border-default)]" aria-hidden="true" />
                <span className="poster-display text-xl text-[var(--text-primary)]">{row.value != null ? formatProbability(row.value) : '--'}</span>
              </div>
              <div className="mt-1 h-3.5 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                {row.value != null ? <div className={`h-full ${row.color}`} style={{ width: `${row.value * 100}%` }} /> : null}
              </div>
            </div>
          ))}
        </div>

        {prediction ? (
          <>
            <p className="text-sm font-medium leading-6 text-[var(--text-secondary)]">{localizePredictionMessage(prediction.message, prediction.predicted_winner, i18n.language)}</p>
            <DataConfidenceNote confidence={prediction.data_confidence} />
          </>
        ) : (
          <div className="flex justify-end pt-2 text-[var(--accent-red)]">
            <span className="poster-display poster-stamp text-2xl border-[var(--border-default)]">{L(i18n.language, 'Aguardando combate', 'Awaiting bout', 'En attente du combat')}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function Drivers({ factors }: { factors: MainFactor[] }) {
  const { i18n } = useTranslation()
  const max = Math.max(...factors.map((factor) => factor.magnitude), 0.01)
  const rows = factors.slice(0, 6)

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3">
        <span className="poster-display text-lg text-[var(--text-primary)]">{L(i18n.language, 'Fatores Determinantes', 'Why the model leans', 'Pourquoi le modèle penche')}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">SHAP</span>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {rows.length ? (
          rows.map((factor, index) => (
            <div key={factor.feature}>
              <div className="flex items-end gap-2">
                <span className="poster-display w-5 shrink-0 text-lg text-[var(--accent-red)]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide sm:text-sm text-[var(--text-primary)]">
                  {localizeFeature(factor.feature, i18n.language)}
                </span>
                <span className="poster-leader border-dotted border-[var(--border-default)]" aria-hidden="true" />
                <span className="poster-display text-sm text-[var(--text-secondary)]">{factor.impact}</span>
              </div>
              <div className="mt-1 h-2 rounded-full overflow-hidden bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <div className="h-full bg-[var(--accent-red)]" style={{ width: `${Math.min(100, (factor.magnitude / max) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {L(
                  i18n.language,
                  `${localizeFeature(factor.feature, true)} favoreceu a previsão para ${factor.impact}.`,
                  factor.explanation,
                  `${localizeFeature(factor.feature, i18n.language)} a pesé en faveur de ${factor.impact}.`,
                )}
              </p>
            </div>
          ))
        ) : (
          <>
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-end gap-2 text-[var(--text-muted)]">
                <span className="poster-display w-6 shrink-0 text-xl text-[var(--text-muted)]/40">{n}</span>
                <span className="poster-leader border-dotted border-[var(--border-default)]" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]/60">--</span>
              </div>
            ))}
            <p className="text-sm font-medium leading-6 text-[var(--text-muted)]">
              {L(i18n.language, 'Simule a luta para ver os fatores que definiram o favoritismo.', 'Score the fight to see the three numbers that pushed the odds, ranked.', 'Calculez le combat pour voir les chiffres qui ont fait pencher les cotes, du plus fort au plus faible.')}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

type TapeRow = { label: string; a: number | null; b: number | null; unit?: string; better: 'high' | 'low' | 'none'; pct?: boolean }

function TaleOfTape({ fighterA, fighterB }: { fighterA: FighterProfile | null; fighterB: FighterProfile | null }) {
  const { i18n } = useTranslation()

  const rows: TapeRow[] = [
    { label: L(i18n.language, 'Idade', 'Age', 'Âge'), a: fighterA?.age ?? null, b: fighterB?.age ?? null, better: 'none' },
    { label: L(i18n.language, 'Altura (cm)', 'Height (cm)', 'Taille (cm)'), a: fighterA?.height_cm ?? null, b: fighterB?.height_cm ?? null, better: 'high' },
    { label: L(i18n.language, 'Envergadura (cm)', 'Reach (cm)', 'Allonge (cm)'), a: fighterA?.reach_cm ?? null, b: fighterB?.reach_cm ?? null, better: 'high' },
    { label: L(i18n.language, 'Vitórias', 'Wins', 'Victoires'), a: fighterA?.wins ?? null, b: fighterB?.wins ?? null, better: 'high' },
    { label: L(i18n.language, 'Derrotas', 'Losses', 'Défaites'), a: fighterA?.losses ?? null, b: fighterB?.losses ?? null, better: 'low' },
    { label: L(i18n.language, 'Taxa de vitória', 'Win rate', 'Taux de victoire'), a: fighterA?.win_rate ?? null, b: fighterB?.win_rate ?? null, better: 'high', pct: true },
    { label: L(i18n.language, 'Precisão de golpes', 'Striking accuracy', 'Précision des coups'), a: fighterA?.sig_str_acc ?? null, b: fighterB?.sig_str_acc ?? null, better: 'high', pct: true },
    { label: L(i18n.language, 'Precisão de quedas', 'Takedown accuracy', 'Précision des amenées'), a: fighterA?.takedown_acc ?? null, b: fighterB?.takedown_acc ?? null, better: 'high', pct: true },
  ]
  const ready = Boolean(fighterA && fighterB)

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3">
        <span className="poster-display text-lg text-[var(--text-primary)]">{L(i18n.language, 'Raio-X dos Lutadores', 'Tale of the tape', 'La fiche comparative')}</span>
        <span className="hidden text-[11px] font-bold uppercase tracking-[0.2em] sm:inline text-[var(--text-muted)]">{L(i18n.language, 'Destaque = vantagem', 'Highlight = edge', 'Surligné = avantage')}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-[var(--border-subtle)] text-center">
        <span className="poster-display truncate bg-[var(--accent-red)] px-3 py-2 text-base text-white sm:text-lg">{fighterA?.name ?? L(i18n.language, 'Canto Vermelho', 'Red corner', 'Coin rouge')}</span>
        <span className="w-24 shrink-0 sm:w-40" />
        <span className="poster-display truncate bg-[var(--accent-blue)] px-3 py-2 text-base text-white sm:text-lg">{fighterB?.name ?? L(i18n.language, 'Canto Azul', 'Blue corner', 'Coin bleu')}</span>
      </div>

      <div>
        {rows.map((row) => {
          const edge = ready ? edgeOf(row) : null
          return (
            <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--border-subtle)] last:border-b-0 py-1">
              <Cell value={row.a} row={row} winning={edge === 'a'} ready={ready} />
              <span className="w-24 shrink-0 px-1 text-center text-[11px] font-bold uppercase leading-tight tracking-wider text-[var(--text-secondary)] sm:w-40 sm:text-xs">{row.label}</span>
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
      <span className={`poster-display inline-block px-2 text-xl sm:text-2xl ${winning ? 'bg-[var(--accent-gold)] text-black rounded font-black' : ready ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{text}</span>
    </span>
  )
}

function edgeOf(row: TapeRow): 'a' | 'b' | null {
  if (row.better === 'none' || row.a == null || row.b == null || row.a === row.b) return null
  const aWins = row.better === 'high' ? row.a > row.b : row.a < row.b
  return aWins ? 'a' : 'b'
}
