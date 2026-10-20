import axios from 'axios'
import { motion } from 'framer-motion'
import { CalendarDays, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { CurrentChampionSeals, FighterBadges, FlagList, FormerChampionSeals, InterimChampionSeals, TitleFightBadge } from './FighterBadges'
import { FighterAvatar } from './FighterAvatar'
import { FighterOrigin } from './FighterOrigin'
import { LoadingSkeleton } from './LoadingSkeleton'
import { MiniStat } from './MiniStat'
import { METHOD_LABELS } from '../data/fightLabels'
import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import { useFighters } from '../hooks/useFighters'
import { getFighterPerformance, getSimilarFighters } from '../services/api'
import type { FighterPerformance, FighterProfile, FightRecord, SimilarFighter, YearlyTrend } from '../types/api'

export function FighterProfileModal({
  name,
  onClose,
  onSelectFighter,
}: {
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [similarFighters, setSimilarFighters] = useState<SimilarFighter[]>([])
  const [similarLoading, setSimilarLoading] = useState(true)
  const [selectedFight, setSelectedFight] = useState<FightRecord | null>(null)
  const { fighters: allFighters } = useFighters()
  const { imageByName: headerImages } = useFighterImages()
  const profile = useMemo(() => allFighters.find((fighter) => fighter.name === name) ?? null, [allFighters, name])

  useEffect(() => {
    let cancelled = false

    getFighterPerformance(name)
      .then((data) => {
        if (!cancelled) setPerformance(data)
      })
      .catch((requestError) => {
        console.error(requestError)
        if (cancelled) return
        const status = axios.isAxiosError(requestError) ? requestError.response?.status : undefined
        if (status === 404) {
          setError('No performance history found for this fighter.')
        } else if (status) {
          setError(`Unable to load performance history (server returned ${status}).`)
        } else {
          setError('Unable to load performance history. Check your connection and try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [name])

  useEffect(() => {
    let cancelled = false

    getSimilarFighters(name)
      .then((data) => {
        if (!cancelled) setSimilarFighters(data)
      })
      .catch((requestError) => {
        console.error(requestError)
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [name])

  return createPortal(
    <motion.div
      className="selector-backdrop fixed inset-0 z-[95] flex items-center justify-center overflow-hidden px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.section
        className="surface-card flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] border-white/14"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FighterAvatar
              name={name}
              imageUrl={getFighterImageUrl(name, headerImages, profile?.image_url)}
              highlight={Boolean(profile?.belt)}
              className="h-16 w-16 sm:h-20 sm:w-20"
            />
            <div className="min-w-0">
              <p className="broadcast-label text-[10px] text-[#999999]">Performance profile</p>
              <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">
                {profile ? <FlagList fighter={profile} className="h-4 w-6" /> : null}
                <span className="min-w-0 truncate">{name}</span>
              </h2>
              {profile ? <FighterOrigin fighter={profile} className="mt-1" /> : null}
              {profile ? <UfcStatusLine fighter={profile} /> : null}
              {profile ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <CurrentChampionSeals titles={profile.current_titles} />
                  <FighterBadges badges={(profile.badges ?? []).filter((badge) => badge !== 'bmf_current')} variant="full" />
                  <FormerChampionSeals titles={profile.former_titles} />
                  <InterimChampionSeals titles={profile.interim_titles} />
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost-action grid h-9 w-9 shrink-0 place-items-center rounded-full"
            aria-label="Close performance profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-2.5">
              <LoadingSkeleton className="h-[60px]" />
              <LoadingSkeleton className="h-[100px]" />
              <LoadingSkeleton className="h-[140px]" />
            </div>
          ) : error ? (
            profile?.ufc_status === 'never' ? (
              <NoUfcFightsNotice />
            ) : (
              <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p>
            )
          ) : performance && performance.total_fights === 0 && profile?.ufc_status === 'never' ? (
            <NoUfcFightsNotice />
          ) : performance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Fights" value={`${performance.total_fights}`} />
                <MiniStat label="Wins" value={`${performance.wins}`} />
                <MiniStat label="Losses" value={`${performance.losses}`} />
              </div>

              <CareerTimeline fights={performance.career_timeline} selected={selectedFight} onSelect={setSelectedFight} />

              {selectedFight ? (
                <FightDetailPanel
                  key={fightKey(selectedFight)}
                  fight={selectedFight}
                  fighterName={name}
                  onSelectFighter={onSelectFighter}
                  onClose={() => setSelectedFight(null)}
                />
              ) : null}

              <FighterTrends trends={performance.yearly_trends} />

              {performance.weight_class_history.length > 0 ? (
                <div className="metric-tile rounded-2xl p-3">
                  <p className="broadcast-label text-[10px] text-[#999999]">Weight class history</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#FFFFFF]">
                    {performance.weight_class_history.map((weightClass, index) => (
                      <span key={`${weightClass}-${index}`} className="inline-flex items-center gap-1.5">
                        {index > 0 ? <span className="text-[#999999]">→</span> : null}
                        {weightClass}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {Object.keys(performance.method_breakdown).length > 0 ? (
                <div className="metric-tile rounded-2xl p-3">
                  <p className="broadcast-label text-[10px] text-[#999999]">Favorite finishing methods</p>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(performance.method_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, count]) => (
                        <div key={method} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-[#999999]">{METHOD_LABELS[method] ?? method}</span>
                          <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-[#C8102E]"
                              style={{ width: `${(count / performance.wins) * 100}%` }}
                            />
                          </div>
                          <span className="type-num w-5 shrink-0 text-right text-xs font-semibold text-[#FFFFFF]">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <FightRecordList
                fights={performance.career_timeline}
                selected={selectedFight}
                onSelect={setSelectedFight}
              />
            </div>
          ) : null}

          {similarLoading ? (
            <LoadingSkeleton className="mt-3 h-[180px]" />
          ) : similarFighters.length > 0 ? (
            <div className="metric-tile mt-3 rounded-2xl p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[#999999]">
                <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                <p className="broadcast-label text-[10px]">Similar fighters</p>
              </div>
              <div className="grid gap-1.5">
                {similarFighters.map((fighter, index) => (
                  <button
                    key={fighter.name}
                    type="button"
                    onClick={() => onSelectFighter(fighter.name)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="broadcast-label w-4 shrink-0 text-[10px] text-[#666666]">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#FFFFFF]">{fighter.name}</span>
                    {fighter.division ? (
                      <span className="type-tech hidden shrink-0 text-[10px] uppercase tracking-[0.1em] text-[#999999] sm:inline">
                        {fighter.division}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs text-[#999999]">
                      {fighter.wins}-{fighter.losses}
                      {fighter.draws ? `-${fighter.draws}` : ''}
                    </span>
                    <span className="shrink-0 rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-xs font-bold text-[#C8102E]">
                      {Math.round(fighter.similarity * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

function CareerTimeline({
  fights,
  selected,
  onSelect,
}: {
  fights: FightRecord[] | undefined
  selected: FightRecord | null
  onSelect: (fight: FightRecord) => void
}) {
  if (!fights || fights.length === 0) return null

  const entries = fights.reduce<{
    items: Array<{ fight: FightRecord; year: string | null; showYear: boolean }>
    lastYear: string
  }>(
    (acc, fight) => {
      const year = fight.date ? fight.date.slice(0, 4) : null
      const showYear = year !== null && year !== acc.lastYear
      return {
        items: [...acc.items, { fight, year, showYear }],
        lastYear: showYear ? (year as string) : acc.lastYear,
      }
    },
    { items: [], lastYear: '' },
  ).items

  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[10px] text-[#999999]">Career timeline <span className="normal-case tracking-normal opacity-80">· tap a fight for details</span></p>
      <div className="pill-scroll mt-3 overflow-x-auto pb-1">
        <div className="relative flex min-w-max items-end gap-3 px-1">
          <div className="pointer-events-none absolute inset-x-1 top-[26px] h-px bg-white/12" />
          {entries.map(({ fight, year, showYear }, index) => {
            const isWin = fight.result === 'win'
            const isLoss = fight.result === 'loss'

            return (
              <div key={index} className="relative z-10 flex shrink-0 flex-col items-center gap-1">
                <span className="h-3 whitespace-nowrap text-[9px] font-semibold text-[#666666]">{showYear ? year : ''}</span>
                <button
                  type="button"
                  onClick={() => onSelect(fight)}
                  aria-pressed={selected !== null && fightKey(selected) === fightKey(fight)}
                  aria-label={`${isWin ? 'Win' : isLoss ? 'Loss' : 'No result'} vs ${fight.opponent}, ${fight.date ?? 'date unknown'}. Open fight details`}
                  title={`${fight.opponent}, ${fight.date ?? 'date unknown'}`}
                  className={`grid h-6 w-6 cursor-pointer place-items-center rounded-full border text-[10px] font-bold transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230] ${
                    selected !== null && fightKey(selected) === fightKey(fight) ? 'ring-2 ring-[var(--rule)] ring-offset-2 ring-offset-[var(--card-bg)]' : ''
                  } ${
                    isWin
                      ? 'border-[#C8102E] bg-[#C8102E] text-white'
                      : isLoss
                        ? 'border-[var(--rule)] bg-[var(--surface-3)] text-[var(--text-main)]'
                        : 'border-[var(--line-soft)] bg-[var(--surface-3)] text-[var(--text-muted)]'
                  }`}
                >
                  {isWin ? 'W' : isLoss ? 'L' : '–'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ROUND_COLORS = ['#C8102E', '#2F5FA8', '#CCCCCC', '#9c7a25', '#666666']

const chartTooltipStyle = {
  background: '#141414',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  fontSize: '11px',
}

function formatWinTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function FighterTrends({ trends }: { trends: YearlyTrend[] | undefined }) {
  if (!trends || trends.length < 2) return null

  const rateData = trends.map((trend) => ({
    year: `${trend.year}`,
    winRate: trend.win_rate != null ? Math.round(trend.win_rate * 1000) / 10 : null,
    finishRate: trend.finish_rate != null ? Math.round(trend.finish_rate * 1000) / 10 : null,
  }))

  const timeData = trends
    .filter((trend) => trend.avg_win_time_seconds != null)
    .map((trend) => ({ year: `${trend.year}`, seconds: trend.avg_win_time_seconds as number }))

  const rounds = Array.from(new Set(trends.flatMap((trend) => Object.keys(trend.round_distribution).map(Number)))).sort(
    (a, b) => a - b,
  )
  const roundData = trends.map((trend) => {
    const row: Record<string, number | string> = { year: `${trend.year}` }
    for (const round of rounds) {
      row[`R${round}`] = trend.round_distribution[round] ?? 0
    }
    return row
  })

  return (
    <div className="space-y-3">
      <div className="metric-tile rounded-2xl p-3">
        <p className="broadcast-label text-[10px] text-[#999999]">Win rate &amp; finish rate over time</p>
        <div className="mt-2 h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#999999', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [`${Number(value ?? 0)}%`, String(name ?? '')]}
              />
              <Line type="monotone" dataKey="winRate" name="Win rate" stroke="#C8102E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line
                type="monotone"
                dataKey="finishRate"
                name="Finish rate"
                stroke="#8FB3E8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-[#999999]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" />
            Win rate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FB3E8]" />
            Finish rate
          </span>
        </div>
      </div>

      {roundData.length > 0 && rounds.length > 0 ? (
        <div className="metric-tile rounded-2xl p-3">
          <p className="broadcast-label text-[10px] text-[#999999]">Round distribution by year (wins)</p>
          <div className="mt-2 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roundData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={chartTooltipStyle} />
                {rounds.map((round, index) => (
                  <Bar
                    key={round}
                    dataKey={`R${round}`}
                    name={`Round ${round}`}
                    stackId="rounds"
                    fill={ROUND_COLORS[index % ROUND_COLORS.length]}
                    radius={index === rounds.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[#999999]">
            {rounds.map((round, index) => (
              <span key={round} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ROUND_COLORS[index % ROUND_COLORS.length] }} />
                R{round}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {timeData.length > 1 ? (
        <div className="metric-tile rounded-2xl p-3">
          <p className="broadcast-label text-[10px] text-[#999999]">Average win time over time</p>
          <div className="mt-2 h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#999999', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#999999', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={formatWinTime}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [formatWinTime(Number(value ?? 0)), 'Avg win time']}
                />
                <Line type="monotone" dataKey="seconds" stroke="#CCCCCC" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ResultBadge({ result }: { result: 'win' | 'loss' | null }) {
  if (result === 'win') {
    return (
      <span className="type-tech rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#C8102E]">
        Win
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
        Loss
      </span>
    )
  }
  return (
    <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#999999]">
      NC
    </span>
  )
}


function fightKey(fight: FightRecord) {
  return fight.fight_url ?? `${fight.event_name}|${fight.date ?? ''}|${fight.opponent}`
}

function formatFightDate(date: string | null | undefined) {
  if (!date) return 'Date unknown'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Everything we know about one fight, with both fighters clickable to open their profiles. */
function FightDetailPanel({
  fight,
  fighterName,
  onSelectFighter,
  onClose,
}: {
  fight: FightRecord
  fighterName: string
  onSelectFighter: (name: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const methodLabel = fight.outcome ?? (fight.method ? METHOD_LABELS[fight.method] ?? fight.method : null)
  const hasWinner = Boolean(fight.winner)
  const isScorecard = Boolean(fight.outcome?.startsWith('Decision'))
  const facts: [string, string | null][] = [
    ['Result', methodLabel ?? 'Result pending'],
    ['Round', fight.round ? `R${fight.round}${fight.time ? ` · ${fight.time}` : ''}` : null],
    ['Scheduled', fight.num_rounds ? `${fight.num_rounds} rounds` : null],
    ['Division', fight.weight_class],
    ['Referee', fight.referee ?? null],
    ['Location', fight.location ?? null],
  ]

  return (
    <section ref={ref} aria-label="Fight details" className="metric-tile rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <TitleFightBadge fight={fight} />
            <p className="broadcast-label truncate text-[10px] text-[#999999]">{fight.event_name}</p>
          </div>
          <p className="theme-muted mt-0.5 text-[11px]">{formatFightDate(fight.date)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fight details"
          className="ghost-action grid h-7 w-7 shrink-0 place-items-center"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <FightSide name={fighterName} isWinner={fight.winner === fighterName} />
        <span className="broadcast-label self-center text-[10px] text-[#999999]">vs</span>
        <FightSide name={fight.opponent} isWinner={fight.winner === fight.opponent} onOpen={() => onSelectFighter(fight.opponent)} />
      </div>

      {!hasWinner ? (
        <p className="theme-muted mt-2 text-center text-[11px]">No winner recorded (draw or no contest).</p>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="broadcast-label text-[9px] text-[#999999]">{label}</dt>
              <dd className="truncate font-semibold text-[#FFFFFF]">{value}</dd>
            </div>
          ))}
      </dl>

      {fight.result_details ? (
        <p className="mt-2.5 border-t-2 border-[var(--line-soft)] pt-2 text-[12px] leading-5 text-[#FFFFFF]">
          <span className="broadcast-label mr-1.5 text-[9px] text-[#999999]">{isScorecard ? 'Scorecards' : 'Finish'}</span>
          {fight.result_details}
        </p>
      ) : null}
    </section>
  )
}

function FightSide({ name, isWinner, onOpen }: { name: string; isWinner: boolean; onOpen?: () => void }) {
  const body = (
    <>
      <span className="min-w-0 break-words text-sm font-bold uppercase leading-tight text-[#FFFFFF]">{name}</span>
      {isWinner ? (
        <span className="mt-1 inline-block w-fit bg-[#C8102E] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">Winner</span>
      ) : null}
      {onOpen ? <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-red)]">View profile →</span> : null}
    </>
  )
  const base = `flex min-w-0 flex-col items-start rounded-xl border-2 p-2 text-left ${isWinner ? 'border-[var(--rule)] bg-[var(--surface-3)]' : 'border-[var(--line-soft)]'}`
  return onOpen ? (
    <button type="button" onClick={onOpen} aria-label={`Open ${name}'s profile`} className={`${base} cursor-pointer transition hover:bg-[#F2C230]/30`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}


const RECORD_PREVIEW_ROWS = 8

/** The fighter's whole UFC record, newest first. Each row opens the fight details panel. */
function FightRecordList({
  fights,
  selected,
  onSelect,
}: {
  fights: FightRecord[]
  selected: FightRecord | null
  onSelect: (fight: FightRecord) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (fights.length === 0) return null

  const newestFirst = [...fights].reverse()
  const visible = expanded ? newestFirst : newestFirst.slice(0, RECORD_PREVIEW_ROWS)
  const wins = fights.filter((fight) => fight.result === 'win').length
  const losses = fights.filter((fight) => fight.result === 'loss').length
  const others = fights.length - wins - losses

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <p className="broadcast-label text-[10px] text-[#999999]">UFC fight record</p>
        <p className="type-num text-lg leading-none text-[#FFFFFF]">
          {wins}-{losses}
          {others ? `-${others}` : ''}
        </p>
      </div>
      <div className="grid gap-1.5">
        {visible.map((fight) => {
          const isSelected = selected !== null && fightKey(selected) === fightKey(fight)
          return (
            <button
              key={fightKey(fight)}
              type="button"
              onClick={() => onSelect(fight)}
              aria-pressed={isSelected}
              aria-label={`Open fight details: vs ${fight.opponent}, ${fight.date ?? 'date unknown'}`}
              className={`metric-tile w-full rounded-xl px-3 py-2 text-left ${isSelected ? 'ring-2 ring-[var(--rule)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="truncate text-sm font-semibold text-[#FFFFFF]">vs {fight.opponent}</span>
                  <TitleFightBadge fight={fight} className="!px-1 !text-[9px]" />
                </span>
                <ResultBadge result={fight.result} />
              </div>
              <p className="theme-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                {fight.date ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {fight.date}
                  </span>
                ) : null}
                <span>{fight.method ? METHOD_LABELS[fight.method] ?? fight.method : 'Result pending'}</span>
                {fight.round ? <span>R{fight.round}</span> : null}
                {fight.weight_class ? <span className="hidden sm:inline">{fight.weight_class}</span> : null}
              </p>
            </button>
          )
        })}
      </div>
      {newestFirst.length > RECORD_PREVIEW_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="ghost-action mt-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"
        >
          {expanded ? 'Show fewer fights' : `Show all ${newestFirst.length} fights`}
        </button>
      ) : null}
    </div>
  )
}


function formatStatusDate(date: string | null | undefined) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Where the fighter stands with the UFC. Debut and last fight for former fighters come from roster.watch (credited on the About page). */
function UfcStatusLine({ fighter }: { fighter: FighterProfile }) {
  if (fighter.ufc_status === 'never') {
    return <p className="mt-1 text-xs font-semibold text-[#999999]">No UFC fights on record</p>
  }
  if (fighter.ufc_status !== 'former') return null

  const debut = formatStatusDate(fighter.ufc_debut)
  const last = formatStatusDate(fighter.ufc_last_fight)
  return (
    <p className="mt-1 text-xs leading-5 text-[#999999]">
      <span className="font-bold uppercase tracking-[0.1em] text-[#FFFFFF]">Former UFC fighter</span>
      {debut ? ` · Debut ${debut}` : ''}
      {last ? ` · Last fight ${last}` : ''}
    </p>
  )
}

function NoUfcFightsNotice() {
  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[10px] text-[#999999]">No UFC fights on record</p>
      <p className="mt-1.5 text-sm leading-6 text-[#FFFFFF]">
        This fighter has no UFC fights in our data, and is not on the UFC's former-roster list either. The record shown
        on their card is their overall professional record, which includes fights in other organizations.
      </p>
    </div>
  )
}
