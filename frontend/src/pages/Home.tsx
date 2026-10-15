import { motion } from 'framer-motion'
import { ArrowRight, Award, CalendarDays, CircleDot, ListOrdered, ShieldAlert, Swords, TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { usePrediction } from '../shared/hooks/usePrediction'
import { useRankings } from '../shared/hooks/useRankings'
import { useUpcomingEvents } from '../shared/hooks/useUpcomingEvents'
import { getFighterPerformance } from '../shared/services/api'
import type { EventSummary, FighterPerformance, FightResult } from '../shared/types/api'

type Trend = { streak: number; finishRate: number | null }

export function Home() {
  const { health, loading: modelLoading, error: modelError } = useModelInfo()
  const { events, loading: eventsLoading, error: eventsError } = useUpcomingEvents()
  const { rankings, loading: rankingsLoading, error: rankingsError } = useRankings()
  const { prediction, loading: predicting, runPrediction } = usePrediction()
  const [trends, setTrends] = useState<Record<string, Trend>>({})

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
    <div className="space-y-3 sm:space-y-4">
      {systemError ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#D32F2F]/20 bg-[#D32F2F]/8 px-3 py-2 text-sm text-[#FFFFFF]">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[#FF6B6B]" />
          {systemError}
        </p>
      ) : null}

      <motion.section
        className="page-hero overflow-hidden rounded-[20px] px-3 py-3 sm:px-4 sm:py-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold uppercase leading-[0.92] tracking-[0.02em] text-[#FFFFFF] sm:text-4xl">
          Fight Intelligence
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#E5E5E5]">
          A live look at what's next in the UFC — the upcoming main event, a real model prediction, fighter momentum
          and the current pound-for-pound picture, all pulled from the same data this platform predicts from.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            label="Fights analyzed"
            value={health?.fights_tracked ? health.fights_tracked.toLocaleString('en-US') : '—'}
            icon={Award}
          />
          <MiniStat label="Fighters tracked" value={health?.fighters_loaded ? `${health.fighters_loaded}` : '—'} icon={Swords} />
          <StatusStat online={Boolean(health?.model_loaded)} loading={modelLoading} />
          <MiniStat label="Next event" value={eventsLoading ? 'Loading...' : nextEvent ? formatShortDate(nextEvent.date) : '—'} icon={CalendarDays} />
        </div>
      </motion.section>

      <section className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
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

        <div className="grid gap-3">
          <TrendingCard mainEvent={mainEvent} trends={trends} />
          <RankingsCard category={p4pRankings} loading={rankingsLoading} error={rankingsError} />
        </div>
      </section>

      <FullCardSection nextEvent={nextEvent} />
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

function formatShortDate(date: string | null) {
  if (!date) return '—'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(date: string | null) {
  if (!date) return 'Date TBA'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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
  if (loading) return <LoadingSkeleton className="h-[340px] rounded-[20px]" />

  if (error || !nextEvent || !mainEvent) {
    return (
      <div className="surface-card rounded-[20px] p-4 text-center">
        <p className="text-sm leading-6 text-[#999999]">
          {error ?? 'No upcoming UFC events are scheduled right now.'}
        </p>
      </div>
    )
  }

  const winnerIsA = predictedWinner === mainEvent.fighter_1

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="broadcast-label text-[10px] text-[#999999]">Upcoming event</p>
          <h2 className="mt-1 truncate text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{nextEvent.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#999999]">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatFullDate(nextEvent.date)} • {nextEvent.fight_count} fights
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/8 bg-black/18 p-3">
        <p className="broadcast-label text-[10px] text-[#D32F2F]">Main event</p>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <p className="type-display truncate text-right text-sm font-bold uppercase text-[#FFFFFF] sm:text-base">{mainEvent.fighter_1}</p>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-[#999999]">VS</span>
          <p className="type-display truncate text-left text-sm font-bold uppercase text-[#FFFFFF] sm:text-base">{mainEvent.fighter_2}</p>
        </div>
        {mainEvent.weight_class ? (
          <p className="type-tech mt-1 text-center text-[10px] uppercase tracking-[0.12em] text-[#999999]">{mainEvent.weight_class}</p>
        ) : null}

        {predicting ? (
          <div className="mt-3">
            <LoadingSkeleton className="h-[52px]" />
          </div>
        ) : probabilityA != null && probabilityB != null ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className={winnerIsA ? 'text-[#D32F2F]' : 'text-[#FFFFFF]'}>{Math.round(probabilityA * 100)}%</span>
              <span className={!winnerIsA ? 'text-[#8FB3E8]' : 'text-[#FFFFFF]'}>{Math.round(probabilityB * 100)}%</span>
            </div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-[#262626]">
              <div className="h-full bg-gradient-to-r from-[#A5151C] to-[#D32F2F]" style={{ width: `${probabilityA * 100}%` }} />
              <div className="h-full bg-gradient-to-r from-[#1c3c6e] to-[#2F5FA8]" style={{ width: `${probabilityB * 100}%` }} />
            </div>
            <p className="mt-2 text-center text-xs text-[#999999]">
              Model favors <span className="font-semibold text-[#FFFFFF]">{predictedWinner}</span>
            </p>
          </div>
        ) : null}
      </div>

      <Link
        to={`/matchup-intelligence?a=${encodeURIComponent(mainEvent.fighter_1)}&b=${encodeURIComponent(mainEvent.fighter_2)}`}
        className="primary-action mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
      >
        Analyze matchup
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  )
}

function FullCardSection({ nextEvent }: { nextEvent: EventSummary | null }) {
  if (!nextEvent || nextEvent.fights.length <= 1) return null

  const restOfCard = nextEvent.fights.slice(1)

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#D32F2F]">
        <ListOrdered className="h-4 w-4" />
        <p className="broadcast-label text-[10px]">
          Rest of the card • {restOfCard.length} {restOfCard.length === 1 ? 'fight' : 'fights'}
        </p>
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {restOfCard.map((fight, index) => (
          <FightCardRow key={index} fight={fight} />
        ))}
      </div>
    </section>
  )
}

function FightCardRow({ fight }: { fight: FightResult }) {
  return (
    <Link
      to={`/matchup-intelligence?a=${encodeURIComponent(fight.fighter_1)}&b=${encodeURIComponent(fight.fighter_2)}`}
      className="group flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/18 px-3 py-2.5 transition hover:border-[#D32F2F]/25 hover:bg-white/[0.05]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#FFFFFF]">
          {fight.fighter_1} <span className="text-[#999999]">vs</span> {fight.fighter_2}
        </p>
        {fight.weight_class ? (
          <p className="type-tech mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[#999999]">{fight.weight_class}</p>
        ) : null}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#666666] transition group-hover:text-[#D32F2F]" />
    </Link>
  )
}

function TrendingCard({ mainEvent, trends }: { mainEvent: FightResult | null; trends: Record<string, Trend> }) {
  if (!mainEvent) return null

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#D32F2F]">
        <TrendingUp className="h-4 w-4" />
        <p className="broadcast-label text-[10px]">Trending</p>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <TrendRow name={mainEvent.fighter_1} trend={trends[mainEvent.fighter_1]} />
        <TrendRow name={mainEvent.fighter_2} trend={trends[mainEvent.fighter_2]} />
      </div>
    </article>
  )
}

function TrendRow({ name, trend }: { name: string; trend: Trend | undefined }) {
  if (!trend) return <LoadingSkeleton className="h-[52px]" />

  return (
    <div className="rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <p className="truncate text-xs font-semibold text-[#FFFFFF]">{name}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-[#999999]">
        {trend.streak > 0 ? (
          <span className="text-[#D32F2F]">↑ {trend.streak}-fight win streak</span>
        ) : (
          <span>Coming off a loss</span>
        )}
        {trend.finishRate != null ? ` • ${Math.round(trend.finishRate * 100)}% finish rate` : ''}
      </p>
    </div>
  )
}

function RankingsCard({
  category,
  loading,
  error,
}: {
  category: { entries: { rank: number; fighter: string }[] } | null
  loading: boolean
  error: string | null
}) {
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#D32F2F]">
          <Trophy className="h-4 w-4" />
          <p className="broadcast-label text-[10px]">Pound-for-pound</p>
        </div>
        <Link to="/rankings" className="type-tech text-[10px] font-semibold uppercase tracking-[0.1em] text-[#999999] transition hover:text-white">
          View all
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
          {category.entries.slice(0, 3).map((entry) => (
            <div key={entry.rank} className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-black/18 px-3 py-2">
              <span className="data-value w-5 shrink-0 text-sm font-bold text-[#D32F2F]">{entry.rank}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#FFFFFF]">{entry.fighter}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-[#999999]">Rankings unavailable right now.</p>
      )}
    </article>
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
    <div className="rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <div className="flex items-center gap-2 text-[#D32F2F]">
        <Icon className="h-3.5 w-3.5" />
        <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
      </div>
      <p className="data-value mt-1 text-xl font-bold text-[#FFFFFF]">{value}</p>
    </div>
  )
}

function StatusStat({ online, loading }: { online: boolean; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <div className="flex items-center gap-2">
        <CircleDot className={`h-3.5 w-3.5 ${online ? 'fill-[#D32F2F] text-[#D32F2F] animate-pulse' : 'fill-[#999999] text-[#999999]'}`} />
        <p className="broadcast-label text-[10px] text-[#999999]">API status</p>
      </div>
      <div className="mt-1 inline-flex rounded-full border border-white/8 px-2.5 py-0.5">
        <span className={`type-tech text-xs font-semibold uppercase tracking-[0.16em] ${loading ? 'text-[#CCCCCC]' : online ? 'text-[#D32F2F]' : 'text-[#999999]'}`}>
          {loading ? 'Checking...' : online ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  )
}
