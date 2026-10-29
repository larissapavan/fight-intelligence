import { Fragment, useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, LoaderCircle, Ruler, ShieldAlert, Swords, Target } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { L, uiLang } from '../i18n/lang'
import { CopyLinkButton } from '../shared/components/CopyLinkButton'
import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { FighterSelect } from '../shared/components/FighterSelect'
import { FlagList, TitleFightBadge } from '../shared/components/FighterBadges'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { MatchupRadarChart } from '../shared/components/MatchupRadarChart'
import { RecentFightsPanel } from '../shared/components/RecentFightsPanel'
import { SectionHeading } from '../shared/components/SectionHeading'
import { ShapFactorBars } from '../shared/components/ShapFactorBars'
import { WinProbabilityBar } from '../shared/components/WinProbabilityBar'
import { localizePredictionMessage } from '../shared/data/probability'
import { getFighterImageUrl, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import { DataConfidenceNote } from '../shared/components/DataConfidenceNote'
import { usePrediction } from '../shared/hooks/usePrediction'
import { getMatchupTitleFight } from '../shared/data/titleFights'
import { getFighterPerformance } from '../shared/services/api'
import type { FighterPerformance, FighterProfile } from '../shared/types/api'

export function MatchupIntelligence() {
  const { t, i18n } = useTranslation()

  const [searchParams, setSearchParams] = useSearchParams()
  const presetFighterA = searchParams.get('a') || searchParams.get('fighter_a')
  const presetFighterB = searchParams.get('b') || searchParams.get('fighter_b')
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
      setError(t('predictor.selectTwoDifferent'))
      return
    }
    setError(null)
    await runPrediction(fighterAName, fighterBName)
  }

  const [syncedPreset, setSyncedPreset] = useState({ a: presetFighterA, b: presetFighterB })
  if (syncedPreset.a !== presetFighterA || syncedPreset.b !== presetFighterB) {
    setSyncedPreset({ a: presetFighterA, b: presetFighterB })
    if (presetFighterA) setFighterAName(presetFighterA)
    if (presetFighterB) setFighterBName(presetFighterB)
  }

  const { imageByName } = useFighterImages()
  const [profileName, setProfileName] = useState<string | null>(null)

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
    if (name) params.set(side, name)
    else params.delete(side)
    setSearchParams(params, { replace: true })
    if (nextA && nextB && nextA === nextB) {
      setError(t('predictor.selectTwoDifferent'))
    }
  }

  const swapCorners = () => {
    if (!fighterAName && !fighterBName) return
    const nextA = fighterBName
    const nextB = fighterAName
    setFighterAName(nextA)
    setFighterBName(nextB)
    const params = new URLSearchParams(searchParams)
    if (nextA) params.set('a', nextA)
    else params.delete('a')
    if (nextB) params.set('b', nextB)
    else params.delete('b')
    setSearchParams(params, { replace: true })
  }

  const fighterA = prediction?.fighter_a_profile ?? null
  const fighterB = prediction?.fighter_b_profile ?? null
  const titleFightInfo = getMatchupTitleFight(
    fighterA ?? (fighterAName ? { name: fighterAName } : null),
    fighterB ?? (fighterBName ? { name: fighterBName } : null),
  )
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
  const systemError = (canAnalyze ? null : error) ?? predictionError ?? fightersError
  const showResults = Boolean(fighterA && fighterB && prediction && !analyzing)

  return (
    <div className="space-y-6 sm:space-y-8">
      {eventName && fighterAName && fighterBName ? (
        <nav aria-label={L(i18n.language, 'Navegação estrutural', 'Breadcrumb', 'Fil d’Ariane')}>
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
          level={1}
          eyebrow={t('matchup.eyebrow')}
          title={t('matchup.title')}
          description={t('matchup.description')}
        />
      </section>

      <section id="matchup-fighters" className="surface-card scroll-mt-4 rounded-[20px] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-end">
          <FighterSelect
            label={t('predictor.redCorner')}
            corner="red"
            value={fighterAName}
            fighters={fighters}
            disabledFighterName={fighterBName}
            placeholder={t('headToHead.selectFirst')}
            onChange={(name) => chooseFighter('a', name)}
          />
          <div className="flex justify-center sm:pb-1">
            <button
              type="button"
              onClick={swapCorners}
              disabled={!fighterAName && !fighterBName}
              title={L(i18n.language, 'Inverter cantos (Vermelho ⇄ Azul)', 'Swap corners (Red ⇄ Blue)', 'Inverser les coins (Rouge ⇄ Bleu)')}
              aria-label={L(i18n.language, 'Inverter cantos', 'Swap corners', 'Inverser les coins')}
              className="ghost-action inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>
          <FighterSelect
            label={t('predictor.blueCorner')}
            corner="blue"
            value={fighterBName}
            fighters={fighters}
            disabledFighterName={fighterAName}
            placeholder={t('headToHead.selectSecond')}
            onChange={(name) => chooseFighter('b', name)}
          />
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze || analyzing || fightersLoading}
            className="primary-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {analyzing ? t('matchup.analyzing') : t('matchup.analyze')}
          </button>
        </div>
      </section>

      {systemError ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#C8102E]/20 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--accent-red)]" />
          {systemError}
        </p>
      ) : null}

      {canAnalyze ? (
        <>
          <section className="surface-card rounded-[20px] p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{L(i18n.language, 'Probabilidade do Modelo', 'Model odds', 'Cotes du modèle')}</p>
                  {titleFightInfo?.title_fight ? <TitleFightBadge fight={titleFightInfo} /> : null}
                </div>
                <h2 className="mt-0.5 text-xl font-black uppercase tracking-[0.03em] text-[var(--text-main)] sm:text-2xl">{t('predictor.winningChance')}</h2>
              </div>
              <CopyLinkButton
                href={`/matchup-intelligence?a=${encodeURIComponent(fighterAName)}&b=${encodeURIComponent(fighterBName)}`}
                label={L(i18n.language, 'Copiar link do combate', 'Copy matchup link', 'Copier le lien du combat')}
              />
            </div>

            {fighterA && fighterB ? (
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] p-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setProfileName(fighterA.name)}
                  className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left transition hover:opacity-85"
                  title={L(i18n.language, `Ver perfil de ${fighterA.name}`, `View ${fighterA.name}'s profile`, `Voir le profil de ${fighterA.name}`)}
                >
                  <FighterAvatar
                    name={fighterA.name}
                    imageUrl={getFighterImageUrl(fighterA.name, imageByName, fighterA.image_url)}
                    highlight={fighterA.belt}
                    className="h-11 w-11 shrink-0 sm:h-13 sm:w-13"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <FlagList fighter={fighterA} className="h-3.5 w-5 shrink-0" />
                      <span className="truncate text-sm font-bold text-[var(--text-main)] sm:text-base">{fighterA.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span className="type-num font-semibold">{fighterA.wins ?? 0}-{fighterA.losses ?? 0}{fighterA.draws ? `-${fighterA.draws}` : ''}</span>

                    </div>
                  </div>
                </button>

                <span className="broadcast-label rounded border border-[var(--line-soft)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">VS</span>

                <button
                  type="button"
                  onClick={() => setProfileName(fighterB.name)}
                  className="flex min-w-0 cursor-pointer flex-row-reverse items-center gap-2.5 text-right transition hover:opacity-85"
                  title={L(i18n.language, `Ver perfil de ${fighterB.name}`, `View ${fighterB.name}'s profile`, `Voir le profil de ${fighterB.name}`)}
                >
                  <FighterAvatar
                    name={fighterB.name}
                    imageUrl={getFighterImageUrl(fighterB.name, imageByName, fighterB.image_url)}
                    highlight={fighterB.belt}
                    className="h-11 w-11 shrink-0 sm:h-13 sm:w-13"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="truncate text-sm font-bold text-[var(--text-main)] sm:text-base">{fighterB.name}</span>
                      <FlagList fighter={fighterB} className="h-3.5 w-5 shrink-0" />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1.5 text-[11px] text-[var(--text-muted)]">

                      <span className="type-num font-semibold">{fighterB.wins ?? 0}-{fighterB.losses ?? 0}{fighterB.draws ? `-${fighterB.draws}` : ''}</span>
                    </div>
                  </div>
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              {analyzing || !showResults || !fighterA || !fighterB || !prediction ? (
                <LoadingSkeleton className="h-[120px]" label={L(i18n.language, 'Carregando probabilidade de vitória', 'Loading win probability', 'Chargement de la probabilité de victoire')} />
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
            {!analyzing && prediction?.message ? (
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                {localizePredictionMessage(prediction.message, prediction.predicted_winner, i18n.language)}
              </p>
            ) : null}
            {!analyzing && prediction ? (
              <div className="mt-3">
                <DataConfidenceNote confidence={prediction.data_confidence} />
              </div>
            ) : null}
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
                  title={L(i18n.language, 'Trocação', 'Striking', 'Frappe')}
                  icon={Swords}
                  fighterA={fighterA}
                  fighterB={fighterB}
                  rows={[
                    { label: L(i18n.language, 'Precisão', 'Accuracy', 'Précision'), key: 'sig_str_acc', format: formatPercent },
                    { label: L(i18n.language, 'Golpes Conectados', 'Sig. Strikes', 'Coups sign.'), key: 'sig_strikes_landed_per_min', format: formatPerMin },
                    { label: L(i18n.language, 'Defesa', 'Defense', 'Défense'), key: 'striking_defense', format: formatPercent },
                  ]}
                />
                <StatComparisonCard
                  title={L(i18n.language, 'Luta Agarrada', 'Grappling', 'Lutte')}
                  icon={Target}
                  fighterA={fighterA}
                  fighterB={fighterB}
                  rows={[
                    { label: L(i18n.language, 'Precisão de Quedas', 'TD Accuracy', 'Précision des amenées'), key: 'takedown_acc', format: formatPercent },
                    { label: L(i18n.language, 'Defesa de Quedas', 'TD Defense', 'Défense des amenées'), key: 'takedown_defense', format: formatPercent },
                    { label: L(i18n.language, 'Tentativas de Finalização', 'Sub Attempts', 'Tentatives de soumission'), key: 'submission_avg_per_15min', format: formatPlainNumber },
                  ]}
                />
                <StatComparisonCard
                  title={L(i18n.language, 'Atributos Físicos', 'Physical', 'Physique')}
                  icon={Ruler}
                  fighterA={fighterA}
                  fighterB={fighterB}
                  rows={[
                    { label: L(i18n.language, 'Altura', 'Height', 'Taille'), key: 'height_cm', format: (v) => formatHeight(v, i18n.language) },
                    { label: L(i18n.language, 'Envergadura', 'Reach', 'Allonge'), key: 'reach_cm', format: (v) => formatReach(v, i18n.language) },
                    { label: L(i18n.language, 'Idade', 'Age', 'Âge'), key: 'age', format: formatAge, higherIsBetter: false },
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
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {L(
              i18n.language,
              'Selecione dois lutadores e execute a análise para ver a comparação de trocação, luta agarrada, dados físicos e os fatores SHAP que explicam a previsão do modelo.',
              "Select two fighters and run the analysis to see the striking, grappling and physical breakdown, plus the key factors behind the model's read on this matchup.",
              'Choisissez deux lutteurs et lancez l’analyse pour voir la frappe, la lutte, le physique et les facteurs SHAP qui expliquent la lecture du modèle.',
            )}
          </p>
        </section>
      ) : null}

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

function MatchupAnalysisSkeleton({ includeOdds = true }: { includeOdds?: boolean }) {
  const { i18n } = useTranslation()
  return (
    <div className="space-y-3" role="status" aria-label={L(i18n.language, 'Analisando confronto', 'Analyzing matchup', 'Analyse du combat')}>
      {includeOdds ? <LoadingSkeleton className="h-[180px] rounded-[20px]" label={L(i18n.language, 'Carregando probabilidade de vitória', 'Loading win probability', 'Chargement de la probabilité de victoire')} /> : null}
      <LoadingSkeleton className="h-[340px] rounded-[20px]" label={L(i18n.language, 'Carregando gráfico de radar', 'Loading radar chart', 'Chargement du graphique radar')} />
      <div className="grid gap-3 lg:grid-cols-3">
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
        <LoadingSkeleton className="h-[180px] rounded-[20px]" />
      </div>
      <LoadingSkeleton className="h-[220px] rounded-[20px]" label={L(i18n.language, 'Carregando fatores do confronto', 'Loading matchup factors', 'Chargement des facteurs du combat')} />
      <LoadingSkeleton className="h-[260px] rounded-[20px]" label={L(i18n.language, 'Carregando lutas recentes', 'Loading recent fights', 'Chargement des combats récents')} />
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
        <h2 className="text-lg font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{title}</h2>
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
              <span className="py-2 text-base font-semibold text-[var(--text-main)]">{row.label}</span>
              <span className={`py-2 text-right text-lg font-bold ${aWins ? 'text-[#C8102E]' : 'text-[var(--text-main)]'}`}>
                {row.format(valueA)}
              </span>
              <span className={`py-2 text-right text-lg font-bold ${bWins ? 'text-[var(--accent-blue)]' : 'text-[var(--text-main)]'}`}>
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

function formatHeight(cm: number | null, language: string | boolean = false) {
  if (cm == null) return '—'
  if (uiLang(language) !== 'en') return `${Math.round(cm)} cm`
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}"`
}

function formatReach(cm: number | null, language: string | boolean = false) {
  if (cm == null) return '—'
  if (uiLang(language) !== 'en') return `${Math.round(cm)} cm`
  return `${Math.round(cm / 2.54)}"`
}

function formatAge(age: number | null) {
  if (age == null) return '—'
  return `${Math.round(age)}`
}
