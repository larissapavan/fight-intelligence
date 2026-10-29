import { motion } from 'framer-motion'
import {
  CalendarDays,
  Crown,
  ExternalLink,
  MapPin,
  Sparkles,
  Flame,
  Shield,
  Swords,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { getDivisionName } from '../data/divisions'
import {
  fightSummary,
  formatDate,
  formatHeight,
  formatMethod,
  formatReach,
  formatRecord,
  formatWeight,
  originLine,
} from '../data/orgFormat'
import type { OrgConfig } from '../data/orgs'
import { useOrgFighterFights, useOrgFighters } from '../hooks/useOrgData'
import { normalizeFighterName } from '../hooks/useFighterImages'
import type { FightRecord, OrgFighter } from '../types/api'
import { FighterAvatar } from './FighterAvatar'
import { FlagIcon } from './FlagIcon'
import { LoadingSkeleton } from './LoadingSkeleton'
import { MiniStat } from './MiniStat'
import { OrgFightLine } from './OrgFightLine'

type OrgFighterBout = FightRecord


function computeSimilarOrgFighters(target: OrgFighter | null, allFighters: OrgFighter[]) {
  if (!target) return []
  const targetKey = normalizeFighterName(target.name)
  const targetTotal = (target.wins ?? 0) + (target.losses ?? 0)
  const targetWinRate = targetTotal > 0 ? (target.wins ?? 0) / targetTotal : 0.5

  return allFighters
    .filter((f) => normalizeFighterName(f.name) !== targetKey && (f.wins != null || f.losses != null))
    .map((candidate) => {
      let score = 0.55
      if (target.division && candidate.division === target.division) score += 0.24
      const candTotal = (candidate.wins ?? 0) + (candidate.losses ?? 0)
      const candWinRate = candTotal > 0 ? (candidate.wins ?? 0) / candTotal : 0.5
      score += Math.max(0, 0.12 - Math.abs(targetWinRate - candWinRate) * 0.25)

      if (target.height_cm && candidate.height_cm) {
        score += Math.max(0, 0.05 - Math.abs(target.height_cm - candidate.height_cm) * 0.004)
      }
      if (target.age && candidate.age) {
        score += Math.max(0, 0.04 - Math.abs(target.age - candidate.age) * 0.005)
      }
      if (target.belt && candidate.belt) score += 0.03

      const similarity = Math.max(0.62, Math.min(0.98, score))
      return { fighter: candidate, similarity }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
}

/** UFC-grade fighter profile modal for every organization: career timeline, yearly trends, method breakdown, fight details and similar fighters. */
export function OrgFighterModal({
  org,
  name,
  onClose,
  onSelectFighter,
}: {
  org: OrgConfig
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()

  const { fighters } = useOrgFighters(org.id)
  const { fights, loading, error } = useOrgFighterFights(org.id, name)
  const [selectedBout, setSelectedBout] = useState<OrgFighterBout | null>(null)

  const profile = useMemo(
    () => fighters.find((fighter) => normalizeFighterName(fighter.name) === normalizeFighterName(name)) ?? null,
    [fighters, name],
  )
  const known = useMemo(() => new Set(fighters.map((fighter) => normalizeFighterName(fighter.name))), [fighters])

  const completedFights = useMemo(
    () => fights.filter((f) => Boolean(f.result || f.winner || f.method)),
    [fights],
  )

  const chronologicalFights = useMemo(
    () => [...completedFights].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [completedFights],
  )


  const weightClassHistory = useMemo(() => {
    const list: string[] = []
    for (const bout of chronologicalFights) {
      if (bout.weight_class && list[list.length - 1] !== bout.weight_class) {
        list.push(bout.weight_class)
      }
    }
    if (list.length === 0 && profile?.division) {
      list.push(profile.division)
    }
    return list
  }, [chronologicalFights, profile])

  const methodBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const bout of completedFights) {
      if (bout.result === 'win' && bout.method) {
        const key = bout.method
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [completedFights])

  const yearlyTrends = useMemo(() => {
    const byYear = new Map<string, { fights: number; wins: number }>()
    for (const bout of chronologicalFights) {
      const year = bout.date?.slice(0, 4)
      if (!year) continue
      const current = byYear.get(year) ?? { fights: 0, wins: 0 }
      current.fights += 1
      if (bout.result === 'win') current.wins += 1
      byYear.set(year, current)
    }
    return Array.from(byYear.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({
        year,
        fights: data.fights,
        wins: data.wins,
        winRate: data.fights > 0 ? Math.round((data.wins / data.fights) * 100) : 0,
      }))
  }, [chronologicalFights])

  const similarFighters = useMemo(
    () => computeSimilarOrgFighters(profile, fighters),
    [profile, fighters],
  )


  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const totalWins = profile?.wins ?? completedFights.filter((f) => f.result === 'win').length
  const totalLosses = profile?.losses ?? completedFights.filter((f) => f.result === 'loss').length
  const totalDraws = profile?.draws ?? 0
  const totalCareerFights = totalWins + totalLosses + totalDraws

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
        role="dialog"
        aria-label={L(i18n.language, `${name}, perfil no ${org.shortName}`, `${name}, ${org.shortName} fighter profile`, `${name}, profil ${org.shortName}`)}
        className="surface-card flex h-[min(680px,calc(100vh-1.5rem))] w-full max-w-[580px] flex-col overflow-hidden rounded-[22px] border-[var(--border-subtle)]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        {/* UFC-Style Modal Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FighterAvatar
              name={name}
              imageUrl={profile?.image_url ?? null}
              highlight={Boolean(profile?.belt)}
              className="h-16 w-16 sm:h-20 sm:w-20"
            />
            <div className="min-w-0">
              <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
                {L(i18n.language, `Perfil de Performance • ${org.shortName}`, `${org.shortName} fighter profile`, `Profil de performance • ${org.shortName}`)}
              </p>
              <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">
                {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} className="h-4 w-6" /> : null}
                <span className="min-w-0 truncate">{name}</span>
              </h2>
              {profile?.nickname ? <p className="text-sm italic text-[var(--text-muted)]">“{profile.nickname}”</p> : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                
                {profile ? <TitleLine fighter={profile} archived={Boolean(org.archived)} /> : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost-action grid h-9 w-9 shrink-0 place-items-center rounded-full"
            aria-label={L(i18n.language, 'Fechar perfil do lutador', 'Close fighter profile', 'Fermer le profil du combattant')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {/* Top 3 Summary Counter Row (UFC style) */}
            {totalCareerFights > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label={L(i18n.language, 'Lutas', 'Fights', 'Combats')} value={`${totalCareerFights}`} />
                <MiniStat label={L(i18n.language, 'Vitórias', 'Wins', 'Victoires')} value={`${totalWins}`} />
                <MiniStat label={L(i18n.language, 'Derrotas', 'Losses', 'Défaites')} value={`${totalLosses}`} />
              </div>
            ) : null}

            {/* Physical Build, Record & Camp Details */}
            {profile ? <Details org={org} fighter={profile} /> : null}

            {/* Combat & Striking / Grappling Stats */}
            {profile ? <FighterCombatStats fighter={profile} /> : null}

            {/* Broadcast-Style Upcoming Fight Card */}
            {profile?.next_fight ? (
              <div className="metric-tile relative overflow-hidden rounded-2xl border border-[#C8102E]/35 bg-gradient-to-br from-[#C8102E]/[0.10] via-transparent to-transparent p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8102E]/40 bg-[#C8102E]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-red)]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8102E]" />
                    {L(i18n.language, 'Próxima luta', 'Next fight', 'Prochain combat')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                    <CalendarDays className="h-3 w-3 text-[var(--accent-red)]" />
                    {formatDate(profile.next_fight.date, true, i18n.language)}
                  </span>
                </div>

                <p className="mt-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                  {profile.next_fight.event}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-3 py-2">
                  <span className="truncate text-sm font-bold text-[var(--text-main)]">{name}</span>
                  <span className="shrink-0 rounded bg-[#C8102E] px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-white">
                    vs {profile.next_fight.opponent} · {formatDate(profile.next_fight.date, true, i18n.language)}
                  </span>
                  {known.has(normalizeFighterName(profile.next_fight.opponent)) ? (
                    <button
                      type="button"
                      onClick={() => onSelectFighter(profile.next_fight!.opponent)}
                      className="truncate text-right text-sm font-bold text-[#F2C230] underline decoration-2 underline-offset-2"
                    >
                      {profile.next_fight.opponent}
                    </button>
                  ) : (
                    <span className="truncate text-right text-sm font-bold text-[var(--text-main)]">
                      {profile.next_fight.opponent}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Interactive Career Timeline (UFC style) */}
            {chronologicalFights.length > 0 ? (
              <OrgCareerTimeline
                fights={chronologicalFights}
                selected={selectedBout}
                onSelect={(bout) =>
                  setSelectedBout((prev) =>
                    prev && prev.event_name === bout.event_name && prev.opponent === bout.opponent ? null : bout,
                  )
                }
              />
            ) : null}

            {/* Selected Fight Detail Panel (UFC style) */}
            {selectedBout ? (
              <OrgBoutDetailPanel
                bout={selectedBout}
                knownOpponent={known.has(normalizeFighterName(selectedBout.opponent))}
                onSelectFighter={onSelectFighter}
                onClose={() => setSelectedBout(null)}
              />
            ) : null}

            {/* Yearly Trends Section (UFC style) */}
            {yearlyTrends.length > 1 ? (
              <div className="metric-tile rounded-2xl p-3">
                <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
                  {L(i18n.language, 'Desempenho por Ano', 'Yearly performance trends', 'Tendances par année')}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {yearlyTrends.slice(-4).map((item) => (
                    <div key={item.year} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-2.5 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-[var(--text-muted)]">{item.year}</span>
                        <span className="font-mono font-extrabold text-[var(--text-main)]">{item.winRate}%</span>
                      </div>
                      <div className="progress-track mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                        <div className="h-full rounded-full bg-[#C8102E]" style={{ width: `${item.winRate}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {item.wins}V / {item.fights}{' '}
                        {item.fights === 1 ? L(i18n.language, 'luta', 'fight', 'combat') : L(i18n.language, 'lutas', 'fights', 'combats')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Weight Class History (UFC style) */}
            {weightClassHistory.length > 0 ? (
              <div className="metric-tile rounded-2xl p-3">
                <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
                  {L(i18n.language, 'Histórico de Categorias', 'Weight class history', 'Historique des catégories')}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                  {weightClassHistory.map((wc, index) => (
                    <span key={`${wc}-${index}`} className="inline-flex items-center gap-1.5">
                      {index > 0 ? <span className="text-[var(--text-muted)]">→</span> : null}
                      {getDivisionName(wc, i18n.language)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Favorite Winning Methods Breakdown (UFC style) */}
            {methodBreakdown.length > 0 ? (
              <div className="metric-tile rounded-2xl p-3">
                <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
                  {L(i18n.language, 'Métodos de Vitória no Evento', 'Winning methods', 'Méthodes de victoire')}
                </p>
                <div className="mt-2 space-y-1.5">
                  {methodBreakdown.map(([method, count]) => {
                    const winsCount = Math.max(1, completedFights.filter((f) => f.result === 'win').length)
                    return (
                      <div key={method} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-xs text-[var(--text-muted)]">
                          {formatMethod(method, null, i18n.language) ?? method}
                        </span>
                        <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-[#C8102E]"
                            style={{ width: `${Math.min(100, (count / winsCount) * 100)}%` }}
                          />
                        </div>
                        <span className="type-num w-5 shrink-0 text-right text-xs font-semibold text-[var(--text-main)]">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Full Fight History List */}
            <section aria-label={L(i18n.language, `Lutas no ${org.shortName}`, `${org.shortName} fights`, `Combats ${org.shortName}`)}>
              <p className="broadcast-label mb-1.5 text-[11px] text-[var(--text-muted)]">
                {L(i18n.language, `Histórico no ${org.shortName}`, `${org.shortName} fights`, `Historique ${org.shortName}`)}
              </p>
              {loading ? (
                <div className="space-y-2">
                  <LoadingSkeleton className="h-[54px]" />
                  <LoadingSkeleton className="h-[54px]" />
                </div>
              ) : error ? (
                <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p>
              ) : fights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {L(i18n.language, `Nenhuma luta no ${org.shortName} registrada ainda.`, `No ${org.shortName} fights recorded yet.`, `Aucun combat ${org.shortName} enregistré pour l'instant.`)}
                </p>
              ) : (
                <ul className="space-y-2">
                  {fights.map((fight, idx) => (
                    <OrgFightLine
                      key={`${fight.fight_url ?? idx}-${fight.opponent}`}
                      fight={fight}
                      knownOpponent={known.has(normalizeFighterName(fight.opponent))}
                      onSelect={onSelectFighter}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Similar Fighters Section (UFC style) */}
            {similarFighters.length > 0 ? (
              <div className="metric-tile rounded-2xl p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                  <p className="broadcast-label text-[11px]">
                    {L(i18n.language, 'Lutadores similares', 'Similar fighters', 'Combattants similaires')}
                  </p>
                </div>
                <div className="grid gap-1.5">
                  {similarFighters.map(({ fighter: sim, similarity }, index) => (
                    <button
                      key={sim.name}
                      type="button"
                      onClick={() => onSelectFighter(sim.name)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                    >
                      <span className="broadcast-label w-4 shrink-0 text-[11px] text-[#666666]">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-main)]">{sim.name}</span>
                      {sim.division ? (
                        <span className="type-tech hidden shrink-0 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:inline">
                          {getDivisionName(sim.division, i18n.language)}
                        </span>
                      ) : null}
                      {sim.wins != null && sim.losses != null ? (
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">
                          {sim.wins}W–{sim.losses}L
                        </span>
                      ) : null}
                      <span className="shrink-0 rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-xs font-bold text-[#C8102E]">
                        {Math.round(similarity * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* External & Cross-Org Links */}
            <div className="flex flex-wrap gap-2 pt-1">
              {profile?.ufc_name ? (
                <Link
                  to={`/fighters?fighter=${encodeURIComponent(profile.ufc_name)}`}
                  onClick={onClose}
                  className="ghost-action inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-main)]"
                >
                  {L(i18n.language, 'Ver perfil completo no UFC →', 'Also in the UFC: open the UFC profile', 'Voir le profil complet à l\'UFC →')}
                </Link>
              ) : null}

              {profile?.profile_url ? (
                <a
                  href={profile.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-action inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-main)]"
                >
                  {L(i18n.language, `Perfil oficial no ${org.sourceName}`, `Profile on ${org.sourceName}`, `Profil officiel sur ${org.sourceName}`)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

function OrgCareerTimeline({
  fights,
  selected,
  onSelect,
}: {
  fights: OrgFighterBout[]
  selected: OrgFighterBout | null
  onSelect: (bout: OrgFighterBout) => void
}) {
  const { i18n } = useTranslation()

  const entries = fights.reduce<{
    items: Array<{ fight: OrgFighterBout; year: string | null; showYear: boolean }>
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
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
        {L(i18n.language, 'Linha do tempo da carreira', 'Career timeline', 'Chronologie de carrière')}{' '}
        <span className="normal-case tracking-normal opacity-80">
          · {L(i18n.language, 'toque em uma luta para detalhes', 'tap a fight for details', 'touchez un combat pour les détails')}
        </span>
      </p>
      <div className="pill-scroll mt-3 overflow-x-auto pb-1">
        <div className="relative flex min-w-max items-end gap-3 px-1">
          <div className="pointer-events-none absolute inset-x-1 top-[26px] h-px bg-white/12" />
          {entries.map(({ fight, year, showYear }, index) => {
            const isWin = fight.result === 'win'
            const isLoss = fight.result === 'loss'
            const isSelected =
              selected !== null && selected.event_name === fight.event_name && selected.opponent === fight.opponent

            return (
              <div key={index} className="relative z-10 flex shrink-0 flex-col items-center gap-1">
                <span className="h-3 whitespace-nowrap text-[11px] font-semibold text-[#666666]">{showYear ? year : ''}</span>
                <button
                  type="button"
                  onClick={() => onSelect(fight)}
                  aria-pressed={isSelected}
                  title={`${fight.opponent}, ${fight.date ?? ''}`}
                  className={`grid h-6 w-6 cursor-pointer place-items-center rounded-full border text-[11px] font-bold transition hover:scale-110 ${
                    isSelected ? 'ring-2 ring-[var(--rule)] ring-offset-2 ring-offset-[var(--card-bg)]' : ''
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

function OrgBoutDetailPanel({
  bout,
  knownOpponent,
  onSelectFighter,
  onClose,
}: {
  bout: OrgFighterBout
  knownOpponent: boolean
  onSelectFighter: (name: string) => void
  onClose: () => void
}) {
  const { i18n } = useTranslation()
  const isWin = bout.result === 'win'
  const isLoss = bout.result === 'loss'
  const summary = fightSummary(bout, i18n.language)

  return (
    <div className="metric-tile rounded-2xl border border-[#F2C230]/40 bg-[var(--surface-3)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                isWin ? 'bg-[#C8102E] text-white' : isLoss ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'bg-[var(--card-bg)] text-[var(--text-muted)]'
              }`}
            >
              {isWin
                ? L(i18n.language, 'Vitória', 'Win', 'Victoire')
                : isLoss
                  ? L(i18n.language, 'Derrota', 'Loss', 'Défaite')
                  : L(i18n.language, 'Sem resultado', 'No Contest / Draw', 'Sans résultat')}
            </span>
            {bout.title_fight ? (
              <span className="inline-flex items-center gap-1 bg-[#F2C230] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#0E0E0E]">
                <Crown className="h-3 w-3" /> {L(i18n.language, 'Disputa de Cinturão', 'Title Fight', 'Combat de Titre')}
              </span>
            ) : null}
            {bout.weight_class ? (
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {getDivisionName(bout.weight_class, i18n.language)}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 text-sm font-bold text-[var(--text-main)]">
            vs{' '}
            {knownOpponent ? (
              <button
                type="button"
                onClick={() => onSelectFighter(bout.opponent)}
                className="underline decoration-2 underline-offset-2 hover:text-[#F2C230]"
              >
                {bout.opponent}
              </button>
            ) : (
              bout.opponent
            )}
          </p>
          {summary ? <p className="mt-0.5 text-xs font-semibold text-[var(--text-main)]">{summary}</p> : null}
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {bout.event_name}
            {bout.date ? ` · ${formatDate(bout.date, true, i18n.language)}` : ''}
            {bout.location ? ` · ${bout.location}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ghost-action grid h-7 w-7 shrink-0 place-items-center rounded-full"
          aria-label={L(i18n.language, 'Fechar detalhes da luta', 'Close fight details', 'Fermer les détails')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}


function FighterCombatStats({ fighter }: { fighter: OrgFighter }) {
  const { i18n } = useTranslation()
  const hasStriking =
    fighter.sig_strikes_landed_per_min != null ||
    fighter.sig_str_acc != null ||
    fighter.striking_defense != null
  const hasGrappling =
    fighter.takedown_avg_per_15min != null ||
    fighter.takedown_acc != null ||
    fighter.takedown_defense != null ||
    fighter.submission_avg_per_15min != null
  const hasFinishes =
    fighter.finish_rate != null ||
    fighter.ko_rate != null ||
    fighter.sub_rate != null ||
    (fighter.win_streak != null && fighter.win_streak > 0)

  if (!hasStriking && !hasGrappling && !hasFinishes) return null

  const formatPct = (val?: number | null) => (val != null ? `${Math.round(val * 100)}%` : '—')
  const formatNum = (val?: number | null) => (val != null ? val.toFixed(2) : '—')

  return (
    <div className="metric-tile space-y-3 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent-red)]/15 text-[var(--accent-red)]">
            <Swords className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              {L(i18n.language, 'Métricas de Combate & Golpes', 'Combat & Striking Metrics', 'Métriques de combat & frappes')}
            </h4>
            <p className="text-[10px] text-[var(--text-muted)]">
              {L(i18n.language, 'Volume de trocação, precisão, defesa e grappling', 'Striking volume, accuracy, defense and grappling', 'Volume de frappe, précision, défense et lutte')}
            </p>
          </div>
        </div>
        {fighter.win_streak != null && fighter.win_streak > 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            <Flame className="h-3 w-3" />
            {fighter.win_streak} {L(i18n.language, 'vitórias seguidas', 'win streak', 'victoires consécutives')}
          </span>
        ) : null}
      </div>

      {/* Quick summary cards: Finish rate, KO rate, Sub rate */}
      {hasFinishes ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-2 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {L(i18n.language, 'Via Rápida', 'Finish Rate', 'Finitions')}
            </span>
            <span className="font-mono text-base font-extrabold text-[var(--text-main)]">
              {formatPct(fighter.finish_rate)}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-2 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {L(i18n.language, 'Nocautes (KO)', 'KO / TKO', 'K.-O.')}
            </span>
            <span className="font-mono text-base font-extrabold text-[#C8102E]">
              {formatPct(fighter.ko_rate)}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-2 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {L(i18n.language, 'Finalizações', 'Submissions', 'Soumissions')}
            </span>
            <span className="font-mono text-base font-extrabold text-[#38BDF8]">
              {formatPct(fighter.sub_rate)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Striking Section */}
      {hasStriking ? (
        <div className="space-y-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)]">
            <div className="flex items-center gap-1.5 text-[var(--accent-red)]">
              <Zap className="h-3.5 w-3.5" />
              <span>{L(i18n.language, 'Trocação & Golpes Traumáticos', 'Striking Statistics', 'Statistiques de frappe')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Golpes Conectados / min', 'Strikes Landed / min', 'Coups réussis / min')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatNum(fighter.sig_strikes_landed_per_min)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[var(--accent-red)]"
                  style={{ width: `${Math.min(100, ((fighter.sig_strikes_landed_per_min ?? 0) / 10) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Precisão de Golpes', 'Striking Accuracy', 'Précision de frappe')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatPct(fighter.sig_str_acc)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (fighter.sig_str_acc ?? 0) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Golpes Absorvidos / min', 'Strikes Absorbed / min', 'Coups absorbés / min')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatNum(fighter.sig_strikes_absorbed_per_min)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.min(100, ((fighter.sig_strikes_absorbed_per_min ?? 0) / 8) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Defesa de Golpes', 'Striking Defense', 'Défense de frappe')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatPct(fighter.striking_defense)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${Math.min(100, (fighter.striking_defense ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Grappling Section */}
      {hasGrappling ? (
        <div className="space-y-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)]">
            <div className="flex items-center gap-1.5 text-[#38BDF8]">
              <Shield className="h-3.5 w-3.5" />
              <span>{L(i18n.language, 'Grappling & Luta Agarrada', 'Grappling & Takedowns', 'Lutte & sol')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Média Quedas / 15m', 'Takedowns / 15m', 'Amenées / 15m')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatNum(fighter.takedown_avg_per_15min)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[#38BDF8]"
                  style={{ width: `${Math.min(100, ((fighter.takedown_avg_per_15min ?? 0) / 6) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Precisão de Quedas', 'Takedown Accuracy', 'Précision amenées')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatPct(fighter.takedown_acc)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (fighter.takedown_acc ?? 0) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Defesa de Quedas', 'Takedown Defense', 'Défense amenées')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatPct(fighter.takedown_defense)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${Math.min(100, (fighter.takedown_defense ?? 0) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{L(i18n.language, 'Finalizações / 15m', 'Sub. Avg / 15m', 'Tentat. soumission / 15m')}</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{formatNum(fighter.submission_avg_per_15min)}</span>
              </div>
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${Math.min(100, ((fighter.submission_avg_per_15min ?? 0) / 4) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TitleLine({ fighter, archived = false }: { fighter: OrgFighter; archived?: boolean }) {
  const { i18n } = useTranslation()
  if (!fighter.ranking && !fighter.belt) return null
  const interim = fighter.title_status === 'interim'
  return (
    <>
      {fighter.belt ? (
        <span
          className={`border-2 border-[var(--rule)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] ${
            interim ? 'bg-[#1F4E9C] text-white' : 'bg-[#F2C230] text-[#0E0E0E]'
          }`}
        >
          {interim
            ? L(i18n.language, 'Campeão Interino', 'Interim champion', 'Champion intérimaire')
            : archived
              ? L(i18n.language, 'Último Campeão', 'Final champion', 'Dernier champion')
              : L(i18n.language, 'Campeão', 'Champion', 'Champion')}
        </span>
      ) : null}
      {fighter.ranking ? (
        <span className="border-2 border-[var(--rule)] bg-[var(--surface-3)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--text-main)]">
          {fighter.ranking}
        </span>
      ) : null}
    </>
  )
}

function Details({ org, fighter }: { org: OrgConfig; fighter: OrgFighter }) {
  const { i18n } = useTranslation()
  const origin = originLine(fighter)
  const age = fighter.age == null ? null : `${Math.round(fighter.age)}`
  const isArchived = Boolean(org.archived)
  const stats: [string, string | null][] = [
    [L(i18n.language, 'Cartel Pro', 'Record', 'Palmarès pro'), formatRecord(fighter)],
    [L(i18n.language, `No ${org.shortName}`, ` ${org.shortName}`, `Chez ${org.shortName}`), fighter.org_record],
    [L(i18n.language, 'Categoria', 'Division', 'Catégorie'), fighter.division ? getDivisionName(fighter.division, i18n.language) : null],
    [L(i18n.language, 'Idade', 'Age', 'Âge'), age ? L(i18n.language, `${age} anos`, `${age} years`, `${age} ans`) : null],
    [L(i18n.language, 'Altura', 'Height', 'Taille'), formatHeight(fighter.height_cm, i18n.language)],
    [L(i18n.language, 'Envergadura', 'Reach', 'Allonge'), formatReach(fighter.reach_cm, i18n.language)],
    [L(i18n.language, 'Peso', 'Weight', 'Poids'), formatWeight(fighter.weight_lbs, i18n.language)],
    ...(isArchived
      ? []
      : ([
          [
            L(i18n.language, 'Status', 'Status', 'Statut'),
            fighter.is_active ? L(i18n.language, 'Ativo', 'Active', 'Actif') : L(i18n.language, 'Inativo', 'Not fighting', 'Inactif'),
          ],
        ] as [string, string | null][])),
  ]
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats
          .filter((stat): stat is [string, string] => Boolean(stat[1]))
          .map(([label, value]) => (
            <MiniStat key={label} label={label} value={value} />
          ))}
      </div>
      {origin || fighter.camp ? (
        <ul className="space-y-1 text-xs leading-5 text-[var(--text-muted)]">
          {origin ? (
            <li className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{origin}</span>
            </li>
          ) : null}
          {fighter.camp ? (
            <li className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-hidden="true" />
              <span>
                <span className="font-semibold text-[var(--text-main)]">{L(i18n.language, 'Equipe:', 'Camp:', 'Équipe :')}</span> {fighter.camp}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
