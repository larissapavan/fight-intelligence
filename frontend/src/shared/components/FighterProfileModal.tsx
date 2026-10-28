import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, ChevronDown, HelpCircle, Info, Sparkles, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { L, localeTag, uiLang } from '../../i18n/lang'
import { CurrentChampionSeals, FighterBadges, FlagList, FormerChampionSeals, InterimChampionSeals, TitleFightBadge } from './FighterBadges'
import { FighterAvatar } from './FighterAvatar'
import { FighterOrigin } from './FighterOrigin'
import { LoadingSkeleton } from './LoadingSkeleton'
import { MiniStat } from './MiniStat'
import { OtherOrganizationsPanel } from './OtherOrganizationsPanel'
import { getDivisionName } from '../data/divisions'
import { getMethodLabel } from '../data/fightLabels'
import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import { useFighters } from '../hooks/useFighters'
import { useUpcomingPicks } from '../hooks/useUpcomingPicks'
import { getFighterPerformance, getSimilarFighters } from '../services/api'
import type { FighterPerformance, FighterProfile, FightRecord, SimilarFighter, UpcomingBout, YearlyTrend } from '../types/api'

export function FighterProfileModal({
  name,
  onClose,
  onSelectFighter,
}: {
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const { t, i18n } = useTranslation()

  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [similarFighters, setSimilarFighters] = useState<SimilarFighter[]>([])
  const [similarLoading, setSimilarLoading] = useState(true)
  const [selectedFight, setSelectedFight] = useState<FightRecord | null>(null)
  const [showEloExplainer, setShowEloExplainer] = useState(false)
  const eloSectionRef = useRef<HTMLDivElement>(null)
  const { fighters: allFighters } = useFighters()
  const { imageByName: headerImages } = useFighterImages()
  const profile = useMemo(() => allFighters.find((fighter) => fighter.name === name) ?? null, [allFighters, name])

  const upcomingFights: UpcomingBout[] = useMemo(() => {
    if (performance?.upcoming_fights && performance.upcoming_fights.length > 0) {
      return performance.upcoming_fights
    }
    if (performance?.next_fight) {
      return [performance.next_fight]
    }
    if (profile?.upcoming_fights && profile.upcoming_fights.length > 0) {
      return profile.upcoming_fights
    }
    if (profile?.next_fight) {
      return [profile.next_fight]
    }
    return []
  }, [performance, profile])

  const handleTopEloBadgeClick = () => {
    setShowEloExplainer(true)
    setTimeout(() => {
      eloSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

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
          setError(L(i18n.language, 'Nenhum histórico encontrado para este lutador.', 'No performance history found for this fighter.', 'Aucun historique trouvé pour ce combattant.'))
        } else if (status) {
          setError(L(i18n.language, `Falha ao carregar histórico (servidor retornou ${status}).`, `Unable to load performance history (server returned ${status}).`, `Impossible de charger l'historique (le serveur a renvoyé ${status}).`))
        } else {
          setError(L(i18n.language, 'Falha ao carregar histórico. Verifique sua conexão.', 'Unable to load performance history. Check your connection and try again.', 'Impossible de charger l\'historique. Vérifiez votre connexion.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [name, i18n.language])

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
        className="surface-card flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] "
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
              <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{t('fighterProfile.performanceProfile')}</p>
              <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">
                {profile ? <FlagList fighter={profile} className="h-4 w-6" /> : null}
                <span className="min-w-0 truncate">{name}</span>
              </h2>
              {profile ? <FighterOrigin fighter={profile} className="mt-1" /> : null}
              {profile ? <UfcStatusLine fighter={profile} /> : null}
              {profile ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {profile.elo ? (
                    <button
                      type="button"
                      onClick={handleTopEloBadgeClick}
                      className="inline-flex items-center gap-1 rounded-full border border-[#F2C230]/40 bg-[#F2C230]/10 px-2 py-0.5 text-[11px] font-bold text-[#F2C230] cursor-pointer hover:bg-[#F2C230]/25 transition hover:scale-105 active:scale-95"
                      title={L(i18n.language, 'Clique para ver o que é o Elo Rating', 'Click to see what Elo Rating is', 'Cliquez pour voir ce qu\'est l\'Elo Rating')}
                      aria-label={L(i18n.language, `Elo ${profile.elo}, clique para ver a explicação`, `Elo ${profile.elo}, click to see explanation`, `Elo ${profile.elo}, cliquez pour voir l'explication`)}
                    >
                      <Zap className="h-3 w-3" /> Elo {profile.elo}
                      {profile.elo_rank ? ` • #${profile.elo_rank} P4P` : ''}
                      <HelpCircle className="h-2.5 w-2.5 opacity-80" />
                    </button>
                  ) : null}
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
            aria-label={t('fighterProfile.close')}
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
              <div className="space-y-3">
                {upcomingFights.length > 0 ? (
                  <UpcomingFightsSection
                    fights={upcomingFights}
                    currentFighter={name}
                    onSelectFighter={onSelectFighter}
                    onClose={onClose}
                  />
                ) : null}
                <NoUfcFightsNotice />
              </div>
            ) : (
              <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p>
            )
          ) : performance && performance.total_fights === 0 && profile?.ufc_status === 'never' ? (
            <div className="space-y-3">
              {upcomingFights.length > 0 ? (
                <UpcomingFightsSection
                  fights={upcomingFights}
                  currentFighter={name}
                  onSelectFighter={onSelectFighter}
                  onClose={onClose}
                />
              ) : null}
              <NoUfcFightsNotice />
            </div>
          ) : performance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label={t('fighterProfile.fights')} value={`${performance.total_fights}`} />
                <MiniStat label={t('fighterProfile.wins')} value={`${performance.wins}`} />
                <MiniStat label={t('fighterProfile.losses')} value={`${performance.losses}`} />
              </div>

              {profile?.elo ? (
                <div
                  ref={eloSectionRef}
                  id="fighter-elo-section"
                  className="metric-tile rounded-2xl border border-[#F2C230]/30 bg-[#F2C230]/[0.06] transition overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setShowEloExplainer((prev) => !prev)}
                    className="flex w-full items-center justify-between p-3 text-left cursor-pointer transition hover:bg-[#F2C230]/[0.09]"
                    aria-expanded={showEloExplainer}
                    aria-label={L(i18n.language, 'Clique para ver a explicação do Elo Rating', 'Click to see Elo Rating explanation', 'Cliquez pour voir l\'explication de l\'Elo Rating')}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#F2C230]/20 text-[#F2C230]">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="broadcast-label text-[10px] text-[#CCCCCC]">{t('fighterProfile.eloRating')}</p>
                          <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-[#F2C230] bg-[#F2C230]/15">
                            {L(i18n.language, showEloExplainer ? 'Explicado' : 'O que é?', showEloExplainer ? 'Guide' : 'What is it?', showEloExplainer ? 'Expliqué' : 'C\'est quoi ?')}
                          </span>
                        </div>
                        <p className="text-base font-bold text-[var(--text-main)] tabular-nums">{profile.elo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {t('fighterProfile.peakElo')}: <span className="font-semibold text-[#CCCCCC]">{profile.peak_elo ?? profile.elo}</span>
                        </p>
                        {profile.elo_rank ? (
                          <p className="text-[11px] font-semibold text-[#F2C230]">
                            {L(i18n.language, `#${profile.elo_rank} no Ranking P4P`, `#${profile.elo_rank} P4P Rating`, `#${profile.elo_rank} au classement livre pour livre`)}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-3)] text-[#F2C230]">
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showEloExplainer ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {showEloExplainer ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-[#F2C230]/20 bg-[var(--surface-3)] px-3.5 pb-3.5 pt-3 text-xs leading-relaxed text-[var(--text-soft)] space-y-2.5"
                      >
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#F2C230] text-[11px]">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          <span>{L(i18n.language, 'Como funciona o Elo Rating no MMA?', 'How MMA Elo Rating Works', 'Comment fonctionne l\'Elo Rating en MMA ?')}</span>
                        </div>

                        <p className="text-[var(--text-main)]">
                          <>
                            {L(i18n.language, 'O ', 'The ', 'L\'')}
                            <strong>Elo Rating</strong>
                            {L(
                              i18n.language,
                              ' é uma avaliação matemática (originada no xadrez) que mede a força competitiva real de cada atleta baseando-se estritamente no nível dos oponentes que ele enfrentou.',
                              ' is an objective mathematical system (originally developed for chess) that measures a fighter\'s true competitive skill based strictly on the quality of opposition faced.',
                              ' est une évaluation mathématique (née aux échecs) qui mesure la force compétitive réelle de chaque athlète uniquement selon le niveau des adversaires affrontés.',
                            )}
                          </>
                        </p>

                        <ul className="space-y-1.5 pl-3 border-l-2 border-[#F2C230]/40 text-[11px] text-[var(--text-soft)]">
                          <li>
                            <strong className="text-[var(--text-main)]">{L(i18n.language, 'Qualidade da Oposição:', 'Strength of Competition:', 'Qualité de l\'opposition :')}</strong>{' '}
                            {L(
                              i18n.language,
                              'Superar adversários com pontuação muito superior rende grandes saltos no rating; vencer azarões adiciona poucos pontos.',
                              'Defeating higher-rated opponents yields major rating gains; beating heavy underdogs adds only minimal points.',
                              'Battre des adversaires beaucoup mieux notés fait bondir le rating ; battre des outsiders n\'ajoute que peu de points.',
                            )}
                          </li>
                          <li>
                            <strong className="text-[var(--text-main)]">{L(i18n.language, 'Punição para Zebras:', 'Upset Penalties:', 'Pénalité des surprises :')}</strong>{' '}
                            {L(
                              i18n.language,
                              'Ser derrotado por um lutador com pontuação menor desconta uma pontuação pesada.',
                              'Losing to an opponent with a significantly lower rating results in sharp point deductions.',
                              'Perdre contre un combattant nettement moins bien noté retire beaucoup de points.',
                            )}
                          </li>
                          <li>
                            <strong className="text-[var(--text-main)]">{L(i18n.language, '100% Matemático e Imparcial:', '100% Objective & Neutral:', '100 % mathématique et impartial :')}</strong>{' '}
                            {L(
                              i18n.language,
                              'Diferente dos rankings oficiais do UFC (que dependem de votos subjetivos de jornalistas), o Elo não sofre interferência promocional, de hype ou preferências de juízes.',
                              'Unlike official UFC rankings (voted on by media journalists), Elo has zero promotional bias, hype or popularity votes.',
                              'Contrairement aux classements officiels de l\'UFC (votés par des journalistes), l\'Elo n\'a aucun biais promotionnel, de hype ou de popularité.',
                            )}
                          </li>
                        </ul>

                        <div className="pt-2 border-t border-[var(--line-soft)]">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            {L(i18n.language, 'Escala de Níveis no UFC:', 'UFC Rating Benchmarks:', 'Échelle des niveaux à l\'UFC :')}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                            <div className="rounded bg-[var(--surface-1)] px-2 py-1 border border-[var(--line-soft)] text-[var(--text-main)]">
                              <span className="font-bold text-[#F2C230]">1700+</span>:{' '}
                              {L(i18n.language, 'Campeões & Lendas P4P', 'Champs & P4P Elite', 'Champions et légendes livre pour livre')}
                            </div>
                            <div className="rounded bg-[var(--surface-1)] px-2 py-1 border border-[var(--line-soft)] text-[var(--text-main)]">
                              <span className="font-bold text-[#F2C230]">1600–1699</span>:{' '}
                              {L(i18n.language, 'Top 5 e Desafiantes', 'Top 5 & Contenders', 'Top 5 et prétendants')}
                            </div>
                            <div className="rounded bg-[var(--surface-1)] px-2 py-1 border border-[var(--line-soft)] text-[var(--text-main)]">
                              <span className="font-bold text-[#F2C230]">1500–1599</span>:{' '}
                              {L(i18n.language, 'Top 15 e Veteranos', 'Top 15 & Veterans', 'Top 15 et vétérans')}
                            </div>
                            <div className="rounded bg-[var(--surface-1)] px-2 py-1 border border-[var(--line-soft)] text-[var(--text-main)]">
                              <span className="font-bold text-[#F2C230]">1400–1499</span>:{' '}
                              {L(i18n.language, 'Média do Plantel UFC', 'UFC Roster Average', 'Moyenne du roster UFC')}
                            </div>
                            <div className="rounded bg-[var(--surface-1)] px-2 py-1 border border-[var(--line-soft)] text-[var(--text-main)] col-span-2 sm:col-span-1">
                              <span className="font-bold text-[var(--text-muted)]">&lt; 1400</span>:{' '}
                              {L(i18n.language, 'Estreantes / Fase Inicial', 'Prospects / Rebuilding', 'Débutants / reconstruction')}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}

              {upcomingFights.length > 0 ? (
                <UpcomingFightsSection
                  fights={upcomingFights}
                  currentFighter={name}
                  onSelectFighter={onSelectFighter}
                  onClose={onClose}
                />
              ) : null}

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
                  <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{t('fighterProfile.weightHistory')}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                    {performance.weight_class_history.map((weightClass, index) => (
                      <span key={`${weightClass}-${index}`} className="inline-flex items-center gap-1.5">
                        {index > 0 ? <span className="text-[var(--text-muted)]">→</span> : null}
                        {getDivisionName(weightClass, i18n.language)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {Object.keys(performance.method_breakdown).length > 0 ? (
                <div className="metric-tile rounded-2xl p-3">
                  <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{t('fighterProfile.favoriteMethods')}</p>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(performance.method_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, count]) => (
                        <div key={method} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-[var(--text-muted)]">{getMethodLabel(method, i18n.language)}</span>
                          <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-[#C8102E]"
                              style={{ width: `${(count / performance.wins) * 100}%` }}
                            />
                          </div>
                          <span className="type-num w-5 shrink-0 text-right text-xs font-semibold text-[var(--text-main)]">{count}</span>
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

          {!loading ? <OtherOrganizationsPanel name={name} /> : null}

          {similarLoading ? (
            <LoadingSkeleton className="mt-3 h-[180px]" />
          ) : similarFighters.length > 0 ? (
            <div className="metric-tile mt-3 rounded-2xl p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[var(--text-muted)]">
                <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                <p className="broadcast-label text-[11px]">{L(i18n.language, 'Lutadores similares', 'Similar fighters', 'Combattants similaires')}</p>
              </div>
              <div className="grid gap-1.5">
                {similarFighters.map((fighter, index) => (
                  <button
                    key={fighter.name}
                    type="button"
                    onClick={() => onSelectFighter(fighter.name)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="broadcast-label w-4 shrink-0 text-[11px] text-[#666666]">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-main)]">{fighter.name}</span>
                    {fighter.division ? (
                      <span className="type-tech hidden shrink-0 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:inline">
                        {getDivisionName(fighter.division, i18n.language)}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
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
  const { i18n } = useTranslation()
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

            return (
              <div key={index} className="relative z-10 flex shrink-0 flex-col items-center gap-1">
                <span className="h-3 whitespace-nowrap text-[11px] font-semibold text-[#666666]">{showYear ? year : ''}</span>
                <button
                  type="button"
                  onClick={() => onSelect(fight)}
                  aria-pressed={selected !== null && fightKey(selected) === fightKey(fight)}
                  aria-label={L(
                    i18n.language,
                    `${isWin ? 'Vitória' : isLoss ? 'Derrota' : 'Sem resultado'} vs ${fight.opponent}, ${fight.date ?? 'data desconhecida'}. Abrir detalhes da luta`,
                    `${isWin ? 'Win' : isLoss ? 'Loss' : 'No result'} vs ${fight.opponent}, ${fight.date ?? 'date unknown'}. Open fight details`,
                    `${isWin ? 'Victoire' : isLoss ? 'Défaite' : 'Sans résultat'} vs ${fight.opponent}, ${fight.date ?? 'date inconnue'}. Ouvrir les détails du combat`,
                  )}
                  title={`${fight.opponent}, ${fight.date ?? L(i18n.language, 'data desconhecida', 'date unknown', 'date inconnue')}`}
                  className={`grid h-6 w-6 cursor-pointer place-items-center rounded-full border text-[11px] font-bold transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230] ${
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
  const { i18n } = useTranslation()
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
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
          {L(i18n.language, 'Evolução de vitórias e nocautes/finalizações', 'Win rate & finish rate over time', 'Évolution des victoires et des finish')}
        </p>
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
              <Line type="monotone" dataKey="winRate" name={L(i18n.language, 'Taxa de vitória', 'Win rate', 'Taux de victoire')} stroke="#C8102E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line
                type="monotone"
                dataKey="finishRate"
                name={L(i18n.language, 'Taxa de finalização/KO', 'Finish rate', 'Taux de finish')}
                stroke="#8FB3E8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" />
            {L(i18n.language, 'Taxa de vitória', 'Win rate', 'Taux de victoire')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FB3E8]" />
            {L(i18n.language, 'Nocaute / Finalização', 'Finish rate', 'KO / soumission')}
          </span>
        </div>
      </div>

      {roundData.length > 0 && rounds.length > 0 ? (
        <div className="metric-tile rounded-2xl p-3">
          <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
            {L(i18n.language, 'Distribuição de vitórias por round ao longo dos anos', 'Round distribution by year (wins)', 'Répartition des victoires par round au fil des années')}
          </p>
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
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
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
          <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
            {L(i18n.language, 'Tempo médio de vitória por ano', 'Average win time over time', 'Temps de victoire moyen par année')}
          </p>
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
                  formatter={(value) => [formatWinTime(Number(value ?? 0)), L(i18n.language, 'Tempo médio', 'Avg win time', 'Temps moyen')]}
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
  const { i18n } = useTranslation()
  if (result === 'win') {
    return (
      <span className="type-tech rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[11px] font-bold uppercase text-[#C8102E]">
        {L(i18n.language, 'Vitória', 'Win', 'Victoire')}
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
        {L(i18n.language, 'Derrota', 'Loss', 'Défaite')}
      </span>
    )
  }
  return (
    <span className="type-tech rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
      NC
    </span>
  )
}

function fightKey(fight: FightRecord) {
  return fight.fight_url ?? `${fight.event_name}|${fight.date ?? ''}|${fight.opponent}`
}

function formatFightDate(date: string | null | undefined, language: string | boolean) {
  if (!date) return L(language, 'Data desconhecida', 'Date unknown', 'Date inconnue')
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(localeTag(language), { year: 'numeric', month: 'short', day: 'numeric' })
}

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
  const { i18n } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const rawOutcome = fight.outcome
  const outcomeLang = uiLang(i18n.language)
  const localizedOutcome = !rawOutcome
    ? rawOutcome
    : outcomeLang === 'pt'
      ? rawOutcome
          .replace(/Decision - Unanimous/gi, 'Decisão Unânime')
          .replace(/Decision - Split/gi, 'Decisão Dividida')
          .replace(/Decision - Majority/gi, 'Decisão Majoritária')
          .replace(/Submission/gi, 'Finalização')
          .replace(/KO\/TKO/gi, 'Nocaute (KO/TKO)')
          .replace(/Overturned/gi, 'Sem Resultado (NC)')
      : outcomeLang === 'fr'
        ? rawOutcome
            .replace(/Decision - Unanimous/gi, 'Décision unanime')
            .replace(/Decision - Split/gi, 'Décision partagée')
            .replace(/Decision - Majority/gi, 'Décision majoritaire')
            .replace(/Submission/gi, 'Soumission')
            .replace(/KO\/TKO/gi, 'KO/TKO')
            .replace(/Overturned/gi, 'Sans résultat (NC)')
        : rawOutcome

  const methodLabel = localizedOutcome ?? (fight.method ? getMethodLabel(fight.method, i18n.language) : null)
  const hasWinner = Boolean(fight.winner)
  const isScorecard = Boolean(fight.outcome?.startsWith('Decision'))
  const facts: [string, string | null][] = [
    [L(i18n.language, 'Resultado', 'Result', 'Résultat'), methodLabel ?? L(i18n.language, 'Pendente', 'Result pending', 'Résultat en attente')],
    [L(i18n.language, 'Round', 'Round', 'Round'), fight.round ? `R${fight.round}${fight.time ? ` · ${fight.time}` : ''}` : null],
    [L(i18n.language, 'Previsto', 'Scheduled', 'Prévu'), fight.num_rounds ? `${fight.num_rounds} rounds` : null],
    [L(i18n.language, 'Divisão', 'Division', 'Catégorie'), fight.weight_class ? getDivisionName(fight.weight_class, i18n.language) : null],
    [L(i18n.language, 'Árbitro', 'Referee', 'Arbitre'), fight.referee ?? null],
    [L(i18n.language, 'Local', 'Location', 'Lieu'), fight.location ?? null],
  ]

  return (
    <section ref={ref} aria-label={L(i18n.language, 'Detalhes da luta', 'Fight details', 'Détails du combat')} className="metric-tile rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <TitleFightBadge fight={fight} />
            <p className="broadcast-label truncate text-[11px] text-[var(--text-muted)]">{fight.event_name}</p>
          </div>
          <p className="theme-muted mt-0.5 text-[11px]">{formatFightDate(fight.date, i18n.language)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={L(i18n.language, 'Fechar detalhes da luta', 'Close fight details', 'Fermer les détails du combat')}
          className="ghost-action grid h-7 w-7 shrink-0 place-items-center"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <FightSide name={fighterName} isWinner={fight.winner === fighterName} />
        <span className="broadcast-label self-center text-[11px] text-[var(--text-muted)]">vs</span>
        <FightSide name={fight.opponent} isWinner={fight.winner === fight.opponent} onOpen={() => onSelectFighter(fight.opponent)} />
      </div>

      {!hasWinner ? (
        <p className="theme-muted mt-2 text-center text-[11px]">
          {L(i18n.language, 'Sem vencedor registrado (empate ou no contest).', 'No winner recorded (draw or no contest).', 'Aucun vainqueur enregistré (nul ou sans résultat).')}
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</dt>
              <dd className="truncate font-semibold text-[var(--text-main)]">{value}</dd>
            </div>
          ))}
      </dl>

      {fight.result_details ? (
        <p className="mt-2.5 border-t-2 border-[var(--line-soft)] pt-2 text-[12px] leading-5 text-[var(--text-main)]">
          <span className="broadcast-label mr-1.5 text-[11px] text-[var(--text-muted)]">{isScorecard ? L(i18n.language, 'Pontuação', 'Scorecards', 'Cartes des juges') : L(i18n.language, 'Desfecho', 'Finish', 'Conclusion')}</span>
          {fight.result_details}
        </p>
      ) : null}
    </section>
  )
}

function FightSide({ name, isWinner, onOpen }: { name: string; isWinner: boolean; onOpen?: () => void }) {
  const { i18n } = useTranslation()
  const body = (
    <>
      <span className="min-w-0 break-words text-sm font-bold uppercase leading-tight text-[var(--text-main)]">{name}</span>
      {isWinner ? (
        <span className="mt-1 inline-block w-fit bg-[#C8102E] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
          {L(i18n.language, 'Vencedor', 'Winner', 'Vainqueur')}
        </span>
      ) : null}
      {onOpen ? <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-red)]">{L(i18n.language, 'Ver perfil →', 'View profile →', 'Voir le profil →')}</span> : null}
    </>
  )
  const base = `flex min-w-0 flex-col items-start rounded-xl border-2 p-2 text-left ${isWinner ? 'border-[var(--rule)] bg-[var(--surface-3)]' : 'border-[var(--line-soft)]'}`
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={L(i18n.language, `Abrir perfil de ${name}`, `Open ${name}'s profile`, `Ouvrir le profil de ${name}`)}
      className={`${base} cursor-pointer transition hover:bg-[#F2C230]/30`}
    >
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}

const RECORD_PREVIEW_ROWS = 8

function FightRecordList({
  fights,
  selected,
  onSelect,
}: {
  fights: FightRecord[]
  selected: FightRecord | null
  onSelect: (fight: FightRecord) => void
}) {
  const { i18n } = useTranslation()
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
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{L(i18n.language, 'Cartel no UFC', 'UFC fight record', 'Palmarès UFC')}</p>
        <p className="type-num text-lg leading-none text-[var(--text-main)]">
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
              aria-label={L(
                i18n.language,
                `Abrir detalhes da luta: vs ${fight.opponent}, ${fight.date ?? 'data desconhecida'}`,
                `Open fight details: vs ${fight.opponent}, ${fight.date ?? 'date unknown'}`,
                `Ouvrir les détails du combat : vs ${fight.opponent}, ${fight.date ?? 'date inconnue'}`,
              )}
              className={`metric-tile w-full rounded-xl px-3 py-2 text-left ${isSelected ? 'ring-2 ring-[var(--rule)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="truncate text-sm font-semibold text-[var(--text-main)]">vs {fight.opponent}</span>
                  <TitleFightBadge fight={fight} className="!px-1 !text-[11px]" />
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
                <span>{fight.method ? getMethodLabel(fight.method, i18n.language) : L(i18n.language, 'Pendente', 'Result pending', 'Résultat en attente')}</span>
                {fight.round ? <span>R{fight.round}</span> : null}
                {fight.weight_class ? <span className="hidden sm:inline">{getDivisionName(fight.weight_class, i18n.language)}</span> : null}
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
          {expanded ? L(i18n.language, 'Mostrar menos lutas', 'Show fewer fights', 'Afficher moins de combats') : L(i18n.language, `Mostrar todas as ${newestFirst.length} lutas`, `Show all ${newestFirst.length} fights`, `Afficher les ${newestFirst.length} combats`)}
        </button>
      ) : null}
    </div>
  )
}

function formatStatusDate(date: string | null | undefined, language: string | boolean) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(localeTag(language), { year: 'numeric', month: 'short', day: 'numeric' })
}

function UfcStatusLine({ fighter }: { fighter: FighterProfile }) {
  const { i18n } = useTranslation()
  if (fighter.ufc_status === 'never') {
    return <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{L(i18n.language, 'Sem lutas registradas no UFC', 'No UFC fights on record', 'Aucun combat UFC enregistré')}</p>
  }
  if (fighter.ufc_status !== 'former') return null

  const debut = formatStatusDate(fighter.ufc_debut, i18n.language)
  const last = formatStatusDate(fighter.ufc_last_fight, i18n.language)
  return (
    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
      <span className="font-bold uppercase tracking-[0.1em] text-[var(--text-main)]">{L(i18n.language, 'Ex-atleta do UFC', 'Former UFC fighter', 'Ancien combattant UFC')}</span>
      {debut ? ` · ${L(i18n.language, 'Estreia', 'Debut', 'Début')} ${debut}` : ''}
      {last ? ` · ${L(i18n.language, 'Última luta', 'Last fight', 'Dernier combat')} ${last}` : ''}
    </p>
  )
}

function NoUfcFightsNotice() {
  const { i18n } = useTranslation()
  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
        {L(i18n.language, 'Sem lutas registradas no UFC', 'No UFC fights on record', 'Aucun combat UFC enregistré')}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--text-main)]">
        {L(
          i18n.language,
          'Este atleta ainda não possui histórico oficial de lutas no UFC na base de dados. O cartel exibido corresponde ao histórico profissional geral em outras organizações.',
          "This fighter has no UFC fights in our data, and is not on the UFC's former-roster list either. The record shown on their card is their overall professional record, which includes fights in other organizations.",
          'Ce combattant n\'a aucun combat UFC dans nos données, et ne figure pas non plus sur la liste des anciens de l\'UFC. Le palmarès affiché est son palmarès professionnel global, combats dans d\'autres organisations compris.',
        )}
      </p>
    </div>
  )
}

function getDaysUntilLabel(eventDate: string, language: string | boolean): string | null {
  const parsed = new Date(`${eventDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = parsed.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return L(language, 'Hoje', 'Today', 'Aujourd\'hui')
  if (diffDays === 1) return L(language, 'Amanhã', 'Tomorrow', 'Demain')
  if (diffDays > 1) return L(language, `em ${diffDays} dias`, `in ${diffDays} days`, `dans ${diffDays} jours`)
  return null
}

function UpcomingFightsSection({
  fights,
  currentFighter,
  onSelectFighter,
  onClose,
}: {
  fights: UpcomingBout[]
  currentFighter: string
  onSelectFighter: (name: string) => void
  onClose: () => void
}) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { fighters: allFighters } = useFighters()
  const { imageByName } = useFighterImages()
  const getUpcomingPick = useUpcomingPicks()

  if (!fights || fights.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-[#F2C230]" />
          <h3 className="broadcast-label text-xs font-bold text-[var(--text-main)]">
            {L(
              i18n.language,
              fights.length === 1 ? 'Próxima Luta Confirmada' : 'Próximas Lutas Confirmadas',
              fights.length === 1 ? 'Next Scheduled Fight' : 'Upcoming Scheduled Fights',
              fights.length === 1 ? 'Prochain combat confirmé' : 'Prochains combats confirmés',
            )}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#22c55e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          {L(i18n.language, 'Oficial UFC', 'Official UFC', 'Officiel UFC')}
        </span>
      </div>

      <div className="grid gap-2">
        {fights.map((fight, idx) => {
          const opponentProfile = allFighters.find((f) => f.name.toLowerCase() === fight.opponent.toLowerCase())
          const opponentImg = getFighterImageUrl(fight.opponent, imageByName, opponentProfile?.image_url)
          const divisionLabel = fight.weight_class ? getDivisionName(fight.weight_class, i18n.language) : null
          const pick = getUpcomingPick(fight.event_name, currentFighter, fight.opponent) ?? getUpcomingPick(fight.event_name, fight.opponent, currentFighter)
          const countdown = getDaysUntilLabel(fight.event_date, i18n.language)
          const formattedDate = formatFightDate(fight.event_date, i18n.language)
          const location = fight.location
            ? L(i18n.language, fight.location.replace(/,\s*USA$/i, ', EUA'), fight.location, fight.location.replace(/,\s*USA$/i, ', États-Unis'))
            : null

          return (
            <div
              key={`${fight.event_name}-${fight.opponent}-${idx}`}
              className="metric-tile rounded-2xl border-2 border-[#F2C230]/40 bg-gradient-to-br from-[#F2C230]/[0.08] via-[var(--surface-3)] to-[var(--surface-2)] p-3.5 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="type-display text-sm font-bold uppercase tracking-wide text-[var(--text-main)]">
                  {fight.event_name}
                </span>
                <span className="theme-muted text-[11px] font-semibold">
                  {formattedDate} {countdown ? `(${countdown})` : ''}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {divisionLabel ? (
                  <span className="theme-muted text-[11px] font-semibold">{divisionLabel}</span>
                ) : null}
                {location ? (
                  <span className="theme-muted text-[11px]">· {location}</span>
                ) : null}
                {fight.is_main_event ? (
                  <span className="rounded border border-[var(--rule)] bg-[#C8102E] px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
                    {L(i18n.language, 'Luta Principal', 'Main Event', 'Combat principal')}
                  </span>
                ) : null}
                {fight.title_fight ? (
                  fight.interim_title ? (
                    <span className="rounded border border-[var(--rule)] bg-[#1F4E9C] px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
                      {L(i18n.language, 'Cinturão Interino', 'Interim Title', 'Titre intérimaire')}
                    </span>
                  ) : fight.bmf_title ? (
                    <span className="rounded border border-[var(--rule)] bg-[#C9CDD3] px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[#0E0E0E]">
                      {L(i18n.language, 'Cinturão BMF', 'BMF Title', 'Titre BMF')}
                    </span>
                  ) : (
                    <span className="rounded border border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[#0E0E0E]">
                      {L(i18n.language, 'Disputa de Cinturão', 'Title Fight', 'Combat de titre')}
                    </span>
                  )
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-black/40 p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="type-display text-xs font-bold text-[#F2C230]">VS</span>
                  <FighterAvatar name={fight.opponent} imageUrl={opponentImg} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <p className="broadcast-label text-[10px] text-[var(--text-muted)]">{L(i18n.language, 'Adversário anunciado', 'Announced opponent', 'Adversaire annoncé')}</p>
                    <button
                      type="button"
                      onClick={() => onSelectFighter(fight.opponent)}
                      className="truncate text-left text-sm font-bold text-[var(--text-main)] hover:text-[#F2C230] hover:underline cursor-pointer"
                    >
                      {fight.opponent}
                    </button>
                    {opponentProfile ? (
                      <p className="theme-muted text-[11px]">
                        {opponentProfile.wins}-{opponentProfile.losses}-{opponentProfile.draws}
                        {opponentProfile.ranking ? ` · #${opponentProfile.ranking}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectFighter(fight.opponent)}
                    className="ghost-action px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-main)] hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
                  >
                    {L(i18n.language, 'Ver Perfil', 'Profile', 'Profil')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      const params = new URLSearchParams({
                        a: currentFighter,
                        b: fight.opponent,
                      })
                      if (fight.event_name) params.set('event', fight.event_name)
                      navigate(`/matchup-intelligence?${params.toString()}`)
                    }}
                    title={L(i18n.language, 'Analisar confronto na inteligência do modelo', 'Analyze matchup in intelligence tool', 'Analyser la confrontation dans l\'outil du modèle')}
                    className="ghost-action px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F2C230] hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
                  >
                    {L(i18n.language, 'Análise', 'Matchup', 'Analyse')}
                  </button>
                </div>
              </div>

              {pick ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onClose()
                    const params = new URLSearchParams({ a: currentFighter, b: fight.opponent })
                    if (fight.event_name) params.set('event', fight.event_name)
                    navigate(`/matchup-intelligence?${params.toString()}`)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onClose()
                      const params = new URLSearchParams({ a: currentFighter, b: fight.opponent })
                      if (fight.event_name) params.set('event', fight.event_name)
                      navigate(`/matchup-intelligence?${params.toString()}`)
                    }
                  }}
                  className="mt-2.5 cursor-pointer rounded-lg border border-[var(--line-soft)] bg-black/30 p-2 transition hover:bg-black/50"
                  title={L(i18n.language, 'Clique para ver a análise completa deste confronto', 'Click to see full matchup analysis', 'Cliquez pour voir l\'analyse complète de cette confrontation')}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="theme-muted font-medium">
                      {L(i18n.language, 'Prognóstico do Modelo:', 'Model Prediction:', 'Pronostic du modèle :')}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">
                      {pick.predicted_winner} ({Math.round(pick.probability * 100)}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10 flex">
                    <div
                      className="bg-[#C8102E] transition-all"
                      style={{
                        width: `${Math.round((pick.fighter_1 === currentFighter ? pick.fighter_1_probability : 1 - pick.fighter_1_probability) * 100)}%`,
                      }}
                    />
                    <div className="bg-[#1F4E9C] flex-1" />
                  </div>
                </div>
              ) : null}

              <p className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <span className="text-[#22c55e] font-bold">✓</span>
                <span>{L(i18n.language, 'Luta oficialmente confirmada e anunciada pelo UFC (sem boatos).', 'Officially confirmed and announced UFC bout (no rumors).', 'Combat officiellement confirmé et annoncé par l\'UFC (pas de rumeurs).')}</span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
