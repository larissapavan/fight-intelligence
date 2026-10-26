import { motion } from 'framer-motion'
import { ArrowRight, Award, CalendarDays, ListOrdered, ShieldAlert, Swords, TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { FighterBadges, FlagList, TitleFightBadge } from '../shared/components/FighterBadges'
import { badgesForRankings } from '../shared/data/badges'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { LatestNewsCard } from '../shared/components/LatestNewsCard'
import { FightMatchupCard } from '../shared/components/FightMatchupCard'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { WinProbabilityBar } from '../shared/components/WinProbabilityBar'
import { useDataInfo } from '../shared/hooks/useDataInfo'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { usePrediction } from '../shared/hooks/usePrediction'
import { useTrackRecord } from '../shared/hooks/useTrackRecord'
import { getFighterImageUrl, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighterLookup } from '../shared/hooks/useFighterLookup'
import { useRankings } from '../shared/hooks/useRankings'
import { useUpcomingPicks } from '../shared/hooks/useUpcomingPicks'
import { useUpcomingEvents } from '../shared/hooks/useUpcomingEvents'
import { getFighterPerformance } from '../shared/services/api'
import type { EventSummary, FighterPerformance, FightResult } from '../shared/types/api'

type Trend = { streak: number; finishRate: number | null }

export function Home() {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const { health, modelInfo, error: modelError } = useModelInfo()
  const { data: trackRecord } = useTrackRecord()
  const { dataInfo } = useDataInfo()
  const { events, loading: eventsLoading, error: eventsError } = useUpcomingEvents()
  const { rankings, loading: rankingsLoading, error: rankingsError } = useRankings()
  const { prediction, loading: predicting, runPrediction } = usePrediction()
  const [trends, setTrends] = useState<Record<string, Trend>>({})
  // A fighter chosen in the Trending or Pound-for-pound cards opens in place, so closing it leaves you where you were.
  const [profileName, setProfileName] = useState<string | null>(null)

  const nextEvent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events.find((event) => event.date && event.date >= today) ?? events[0] ?? null
  }, [events])

  const mainEvent: FightResult | null = nextEvent?.fights[0] ?? null
  const fighterA = mainEvent?.fighter_1 ?? null
  const fighterB = mainEvent?.fighter_2 ?? null

  useEffect(() => {
    if (!fighterA || !fighterB) return

    void runPrediction(fighterA, fighterB)

    Promise.all([getFighterPerformance(fighterA), getFighterPerformance(fighterB)])
      .then(([performanceA, performanceB]) => {
        setTrends({
          [fighterA]: computeTrend(performanceA),
          [fighterB]: computeTrend(performanceB),
        })
      })
      .catch((requestError) => {
        console.error(requestError)
      })
  }, [fighterA, fighterB, runPrediction])

  const p4pRankings = rankings.find((category) => category.is_p4p) ?? null
  const systemError = modelError ?? eventsError

  return (
    <div className="space-y-6 sm:space-y-8">
      {systemError ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#C8102E]/20 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--accent-red)]" />
          {systemError}
        </p>
      ) : null}

      <motion.section
        className="page-hero overflow-hidden rounded-[20px] px-3 py-3 sm:px-4 sm:py-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold uppercase leading-[0.92] tracking-[0.02em] text-[var(--text-main)] sm:text-4xl">
          Fight Intelligence
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          {isPt
            ? 'O que vem a seguir no UFC: a próxima luta principal, o palpite da IA, o momento dos lutadores e os líderes do ranking peso por peso.'
            : "What's next in the UFC: the upcoming main event, the model's pick for it, how the fighters are trending and the top of the pound-for-pound ranking, all from the same data the model uses."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/predictor"
            className="primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white max-xs:w-full"
          >
            {isPt ? 'Simular uma Luta' : 'Predict a fight'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/events"
            className="ghost-action theme-text inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] max-xs:w-full"
          >
            {isPt ? 'Ver Card Completo' : 'See the full card'}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
          <MiniStat
            label={isPt ? 'Lutadores no banco' : 'Fighters tracked'}
            value={health?.fighters_loaded ? health.fighters_loaded.toLocaleString(isPt ? 'pt-BR' : 'en-US') : '—'}
            icon={Swords}
          />
          <MiniStat
            label={isPt ? 'Próximo evento' : 'Next event'}
            value={eventsLoading ? (isPt ? 'Carregando...' : 'Loading...') : nextEvent ? formatShortDate(nextEvent.date, i18n.language) : '—'}
            icon={CalendarDays}
          />
          <MiniStat
            label={isPt ? 'Dados até' : 'Data through'}
            value={dataInfo?.last_updated ? formatShortDate(dataInfo.last_updated, i18n.language) : '—'}
            icon={Award}
          />
        </div>
      </motion.section>

      <TrackRecordStrip
        fightsAnalyzed={health?.fights_tracked ?? null}
        testAccuracy={shownMetrics(modelInfo).accuracy}
        testNote={shownMetrics(modelInfo).caption}
        liveAccuracy={trackRecord?.accuracy ?? null}
        resolved={trackRecord?.resolved ?? null}
      />

      <MainEventCard
        loading={eventsLoading}
        error={eventsError}
        nextEvent={nextEvent}
        mainEvent={mainEvent}
        predictedWinner={prediction?.predicted_winner ?? null}
        probabilityA={prediction?.fighter_a_probability ?? null}
        probabilityB={prediction?.fighter_b_probability ?? null}
        predicting={predicting}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <TrendingCard mainEvent={mainEvent} trends={trends} onOpenProfile={setProfileName} />
        <RankingsCard category={p4pRankings} loading={rankingsLoading} error={rankingsError} onOpenProfile={setProfileName} />
      </section>

      <FullCardSection nextEvent={nextEvent} />

      <LatestNewsCard quiet />

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

function computeTrend(performance: FighterPerformance): Trend {
  let streak = 0
  for (let index = performance.career_timeline.length - 1; index >= 0; index -= 1) {
    if (performance.career_timeline[index].result === 'win') {
      streak += 1
    } else {
      break
    }
  }

  const finishes = (performance.method_breakdown['KO/TKO'] ?? 0) + (performance.method_breakdown['Submission'] ?? 0)
  const finishRate = performance.wins > 0 ? finishes / performance.wins : null

  return { streak, finishRate }
}

function formatShortDate(date: string | null, lang: string = 'pt-BR') {
  if (!date) return '—'
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(date: string | null, lang: string = 'pt-BR') {
  if (!date) return lang === 'pt-BR' ? 'Data a confirmar' : 'Date TBA'
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function MainEventCard({
  loading,
  error,
  nextEvent,
  mainEvent,
  predictedWinner,
  probabilityA,
  probabilityB,
  predicting,
}: {
  loading: boolean
  error: string | null
  nextEvent: { name: string; date: string | null; fight_count: number } | null
  mainEvent: FightResult | null
  predictedWinner: string | null
  probabilityA: number | null
  probabilityB: number | null
  predicting: boolean
}) {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  if (loading) return <LoadingSkeleton className="h-[340px] rounded-[20px]" />

  if (error || !nextEvent || !mainEvent) {
    return (
      <div className="surface-card rounded-[20px] p-4 text-center">
        <p className="text-sm leading-6 text-[#999999]">
          {error ?? (isPt ? 'Nenhum evento do UFC agendado no momento.' : 'No upcoming UFC events are scheduled right now.')}
        </p>
      </div>
    )
  }

  return (
    <article className="surface-card rounded-[20px] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="broadcast-label text-[11px] text-[var(--accent-red)]">{t('home.nextCard', 'Upcoming event')}</p>
          <h2 className="mt-1 text-2xl font-black uppercase leading-tight tracking-[0.03em] text-[var(--text-main)] sm:text-4xl">{nextEvent.name}</h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatFullDate(nextEvent.date, i18n.language)} • {nextEvent.fight_count} {isPt ? 'lutas' : 'fights'}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="broadcast-label text-[11px] text-[var(--accent-red)]">{t('home.mainEvent', 'Main event')}</p>
          <TitleFightBadge fight={mainEvent} />
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <MainEventName name={mainEvent.fighter_1} align="right" />
          <span className="broadcast-label border border-[var(--rule)] px-2 py-1 text-[11px] text-[var(--text-muted)]">VS</span>
          <MainEventName name={mainEvent.fighter_2} align="left" />
        </div>
        {mainEvent.weight_class ? (
          <p className="type-tech mt-2 text-center text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{mainEvent.weight_class}</p>
        ) : null}

        {predicting ? (
          <div className="mt-4">
            <LoadingSkeleton className="h-[88px]" />
          </div>
        ) : probabilityA != null && probabilityB != null ? (
          <div className="mt-5">
            <WinProbabilityBar
              showNames={false}
              nameA={mainEvent.fighter_1}
              nameB={mainEvent.fighter_2}
              probabilityA={probabilityA}
              probabilityB={probabilityB}
              predictedWinner={predictedWinner}
            />
          </div>
        ) : null}
      </div>

      <Link
        to={`/matchup-intelligence?a=${encodeURIComponent(mainEvent.fighter_1)}&b=${encodeURIComponent(mainEvent.fighter_2)}&event=${encodeURIComponent(nextEvent.name)}`}
        className="primary-action mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
      >
        {t('home.analyzeMatchup', 'Analyze matchup')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  )
}

function MainEventName({ name, align }: { name: string; align: 'left' | 'right' }) {
  const lookup = useFighterLookup()
  const { imageByName } = useFighterImages()
  const fighter = lookup(name)
  const right = align === 'right'

  // Narrow screens stack the photo above the name; from `sm` up it sits beside it, facing the middle of the card.
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2 sm:items-center sm:gap-3 ${right ? 'sm:flex-row-reverse sm:justify-start' : 'sm:flex-row'}`}>
      <FighterAvatar
        name={name}
        imageUrl={getFighterImageUrl(name, imageByName, fighter?.image_url)}
        highlight
        className="h-20 w-[4.25rem] shrink-0 sm:h-24 sm:w-20"
      />
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${right ? 'items-end text-right' : 'items-start text-left'} max-sm:w-full max-sm:items-center max-sm:text-center`}>
        <p className="type-display w-full text-base font-bold uppercase leading-tight text-[var(--text-main)] sm:text-2xl">{name}</p>
        {fighter ? (
          <span className={`flex flex-wrap items-center gap-1 ${right ? 'sm:justify-end' : 'sm:justify-start'} max-sm:justify-center`}>
            <FlagList fighter={fighter} />
            <FighterBadges badges={fighter.badges} />
          </span>
        ) : null}
      </div>
    </div>
  )
}

function FullCardSection({ nextEvent }: { nextEvent: EventSummary | null }) {
  const { t } = useTranslation()
  const pickFor = useUpcomingPicks()
  if (!nextEvent || nextEvent.fights.length <= 1) return null

  const restOfCard = nextEvent.fights.slice(1)

  return (
    <section className="surface-card rounded-[20px] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[var(--accent-red)]">
        <ListOrdered className="h-4 w-4" />
        <p className="broadcast-label text-[11px]">
          {t('home.restOfCard', { count: restOfCard.length, defaultValue: `Rest of the card • ${restOfCard.length} fights` })}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {restOfCard.map((fight, index) => (
          <FightMatchupCard
            key={index}
            fight={fight}
            eventName={nextEvent.name}
            pick={pickFor(nextEvent.name, fight.fighter_1, fight.fighter_2)}
          />
        ))}
      </div>
    </section>
  )
}

function TrendingCard({
  mainEvent,
  trends,
  onOpenProfile,
}: {
  mainEvent: FightResult | null
  trends: Record<string, Trend>
  onOpenProfile: (name: string) => void
}) {
  const { t } = useTranslation()
  if (!mainEvent) return null

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#C8102E]">
        <TrendingUp className="h-4 w-4" />
        <p className="broadcast-label text-[11px]">{t('home.trending', 'Trending')}</p>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <TrendRow name={mainEvent.fighter_1} trend={trends[mainEvent.fighter_1]} onOpenProfile={onOpenProfile} />
        <TrendRow name={mainEvent.fighter_2} trend={trends[mainEvent.fighter_2]} onOpenProfile={onOpenProfile} />
      </div>
    </article>
  )
}

const CLICKABLE_ROW =
  'w-full cursor-pointer text-left transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]'

function TrendRow({
  name,
  trend,
  onOpenProfile,
}: {
  name: string
  trend: Trend | undefined
  onOpenProfile: (name: string) => void
}) {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const profile = useFighterLookup()(name)
  const { imageByName } = useFighterImages()
  if (!trend) return <LoadingSkeleton className="h-[52px]" />

  const content = (
    <>
      <FighterAvatar
        name={name}
        imageUrl={getFighterImageUrl(name, imageByName, profile?.image_url)}
        className="h-10 w-9"
      />
      <span className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--text-main)]">{name}</p>
        <p className="mt-0.5 text-xs leading-4 text-[var(--text-muted)]">
          {trend.streak > 0 ? (
            <span className="text-[var(--accent-red)]">↑ {trend.streak} {t('home.winStreak', 'fight win streak')}</span>
          ) : (
            <span>{isPt ? 'Vindo de derrota' : 'Coming off a loss'}</span>
          )}
          {trend.finishRate != null ? ` • ${Math.round(trend.finishRate * 100)}% ${t('home.finishRate', 'finish rate')}` : ''}
        </p>
      </span>
    </>
  )
  const box = 'flex items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-3 py-2.5'

  // Only fighters we have a profile for open one; anyone else stays a plain row.
  return profile ? (
    <button type="button" onClick={() => onOpenProfile(profile.name)} aria-label={`${name}. View profile`} className={`${box} ${CLICKABLE_ROW}`}>
      {content}
    </button>
  ) : (
    <div className={box}>{content}</div>
  )
}

function RankingsCard({
  category,
  loading,
  error,
  onOpenProfile,
}: {
  category: { entries: { rank: number; fighter: string }[] } | null
  loading: boolean
  error: string | null
  onOpenProfile: (name: string) => void
}) {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const lookup = useFighterLookup()
  const { imageByName } = useFighterImages()
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#C8102E]">
          <Trophy className="h-4 w-4" />
          <p className="broadcast-label text-[11px]">{t('home.poundForPound', 'Pound-for-pound')}</p>
        </div>
        <Link to="/rankings" className="type-tech inline-flex min-h-10 items-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-red)]">
          {isPt ? 'Ver todos' : 'View all'}
        </Link>
      </div>

      {loading ? (
        <div className="mt-2.5 space-y-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[40px]" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-2.5 text-xs text-[#999999]">{error}</p>
      ) : category ? (
        <div className="mt-2.5 space-y-1.5">
          {category.entries.slice(0, 3).map((entry) => {
            const profile = lookup(entry.fighter)
            const content = (
              <>
                <FighterAvatar
                  name={entry.fighter}
                  imageUrl={getFighterImageUrl(entry.fighter, imageByName, profile?.image_url)}
                  className="h-10 w-9"
                />
                <span className="data-value w-5 shrink-0 text-sm font-bold text-[var(--accent-red)]">{entry.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text-main)]">{entry.fighter}</span>
                {profile ? <FighterBadges badges={badgesForRankings(profile.badges)} /> : null}
              </>
            )
            const box = 'flex items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-3 py-2.5'
            return profile ? (
              <button
                key={entry.rank}
                type="button"
                onClick={() => onOpenProfile(profile.name)}
                aria-label={`${entry.fighter}, rank ${entry.rank}. View profile`}
                className={`${box} ${CLICKABLE_ROW}`}
              >
                {content}
              </button>
            ) : (
              <div key={entry.rank} className={box}>
                {content}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-[#999999]">{isPt ? 'Rankings indisponíveis no momento.' : 'Rankings unavailable right now.'}</p>
      )}
    </article>
  )
}

function percentLabel(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function TrackRecordStrip({
  fightsAnalyzed,
  testAccuracy,
  testNote,
  liveAccuracy,
  resolved,
}: {
  fightsAnalyzed: number | null
  testAccuracy: number | null
  testNote: string
  liveAccuracy: number | null
  resolved: number | null
}) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const accuracy = resolved && resolved > 0 && liveAccuracy != null ? liveAccuracy : testAccuracy
  const accuracyNote = resolved && resolved > 0 && liveAccuracy != null ? (isPt ? 'palpites ao vivo' : 'live picks') : testNote

  return (
    <section className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-[20px] px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="broadcast-label text-[11px] text-[#999999]">{isPt ? 'Taxa de Acerto da IA' : 'Model accuracy'}</p>
          <p className="data-value text-xl font-bold text-[var(--text-main)]">{percentLabel(accuracy)}</p>
          <p className="text-[11px] text-[#999999]">{accuracyNote}</p>
        </div>
        <div>
          <p className="broadcast-label text-[11px] text-[#999999]">{isPt ? 'Lutas Analisadas' : 'Fights analyzed'}</p>
          <p className="data-value text-xl font-bold text-[var(--text-main)]">
            {fightsAnalyzed ? fightsAnalyzed.toLocaleString(isPt ? 'pt-BR' : 'en-US') : '—'}
          </p>
          <p className="text-[11px] text-[#999999]">{isPt ? 'histórico oficial do UFC' : 'career bouts on file'}</p>
        </div>
      </div>
      <Link
        to="/track-record"
        className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8102E] transition hover:text-white"
      >
        {isPt ? 'Histórico Completo' : 'Track record'}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/6 bg-black/18 px-2 py-1.5 sm:px-3 sm:py-2">
      <div className="flex items-center gap-1.5 text-[#C8102E] sm:gap-2">
        <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
        <p className="broadcast-label truncate text-[11px] text-[#999999]">{label}</p>
      </div>
      <p className="data-value mt-0.5 truncate text-base font-bold text-[var(--text-main)] sm:mt-1 sm:text-xl">{value}</p>
    </div>
  )
}
