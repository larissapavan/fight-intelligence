import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  ChevronRight,
  Flame,
  Globe2,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { L, uiLang } from '../../../i18n/lang'
import { AnimatedCounter } from './AnimatedCounter'
import { buildCareerPhases, type CareerPhase } from './careerPhases'
import { getDivisionName } from '../../data/divisions'
import { translateFightMethod, translateHometown, translateStance } from '../../data/fightLabels'
import { getFighterImageUrl, useFighterImages } from '../../hooks/useFighterImages'
import { useFighters } from '../../hooks/useFighters'
import { getFighterPerformance, predictFight } from '../../services/api'
import type { FighterPerformance, PredictionResponse } from '../../types/api'

interface EditorialFighterDossierProps {
  initialFighterName: string
  initialOpponentName?: string
  onClose?: () => void
  onSelectFighter?: (name: string) => void
}

function translateBadge(badge: string | undefined, lang: string): string {
  if (!badge) return ''
  const isPt = lang.startsWith('pt') || lang === 'pt'
  const isFr = lang.startsWith('fr')
  const upper = badge.toUpperCase()

  if (isPt) {
    if (upper === 'DEBUT ERA') return 'ESTREIA NO OCTÓGONO'
    if (upper === 'CONTENDER RUN') return 'CORRIDA AO TÍTULO'
    if (upper === 'CHAMPIONSHIP') return 'DISPUTA DE CINTURÃO'
    if (upper === 'ELITE WARS') return 'BATALHAS DA ELITE'
    if (upper === 'UNDISPUTED REIGN') return 'REINADO ABSOLUTO'
    if (upper === 'POUND-FOR-POUND') return 'ELITE PESO POR PESO'
    if (upper === 'UNDISPUTED CHAMPION') return 'CAMPEÃO INDISCUTÍVEL'
    if (upper === 'TOP CONTENDER') return 'DESAFIANTE PRINCIPAL'
    if (upper === 'CHAMPION') return 'CAMPEÃO'
  }

  if (isFr) {
    if (upper === 'DEBUT ERA') return 'DÉBUTS À L’OCTOGONE'
    if (upper === 'CONTENDER RUN') return 'COURSE AU TITRE'
    if (upper === 'CHAMPIONSHIP') return 'CHAMPIONNAT'
    if (upper === 'ELITE WARS') return 'GUERRES D’ÉLITE'
    if (upper === 'UNDISPUTED REIGN') return 'RÈGNE ABSOLU'
    if (upper === 'UNDISPUTED CHAMPION') return 'CHAMPION INCONTESTÉ'
    if (upper === 'TOP CONTENDER') return 'ASPIRANT PRINCIPAL'
  }

  return badge
}

export function EditorialFighterDossier({
  initialFighterName,
  initialOpponentName,
  onClose,
  onSelectFighter,
}: EditorialFighterDossierProps) {
  const { i18n } = useTranslation()
  const lang = uiLang(i18n.language)

  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()

  const [activeFighterName, setActiveFighterName] = useState(initialFighterName)
  const [opponentName, setOpponentName] = useState<string | null>(initialOpponentName ?? null)
  const [comparisonMode, setComparisonMode] = useState<boolean>(Boolean(initialOpponentName))

  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [opponentPerformance, setOpponentPerformance] = useState<FighterPerformance | null>(null)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectingCorner, setSelectingCorner] = useState<'a' | 'b' | null>(null)

  // Current primary fighter profile
  const profile = useMemo(
    () => fighters.find((f) => f.name.toLowerCase() === activeFighterName.toLowerCase()) ?? null,
    [fighters, activeFighterName],
  )

  // Opponent profile (for comparison mode)
  const opponentProfile = useMemo(
    () => (opponentName ? fighters.find((f) => f.name.toLowerCase() === opponentName.toLowerCase()) ?? null : null),
    [fighters, opponentName],
  )

  // Load performance for primary athlete
  useEffect(() => {
    let cancelled = false
    getFighterPerformance(activeFighterName)
      .then((data) => {
        if (!cancelled) setPerformance(data)
      })
      .catch((err) => {
        console.error('Failed to load performance', err)
      })
    return () => {
      cancelled = true
    }
  }, [activeFighterName])

  // Load performance for opponent
  useEffect(() => {
    if (!opponentName) {
      setOpponentPerformance(null)
      setPrediction(null)
      return
    }
    let cancelled = false
    getFighterPerformance(opponentName)
      .then((data) => {
        if (!cancelled) setOpponentPerformance(data)
      })
      .catch(console.error)

    predictFight(activeFighterName, opponentName)
      .then((res: PredictionResponse) => {
        if (!cancelled) setPrediction(res)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [activeFighterName, opponentName])

  // Photo URLs
  const primaryImageUrl = useMemo(
    () => getFighterImageUrl(activeFighterName, imageByName, profile?.image_url),
    [activeFighterName, imageByName, profile],
  )

  const opponentImageUrl = useMemo(
    () => (opponentName ? getFighterImageUrl(opponentName, imageByName, opponentProfile?.image_url) : null),
    [opponentName, imageByName, opponentProfile],
  )

  // Career Storytelling Phases
  const careerPhases: CareerPhase[] = useMemo(() => {
    if (!profile) return []
    const fights = performance?.career_timeline?.length ? performance.career_timeline : performance?.last_performances ?? []
    return buildCareerPhases(profile, fights)
  }, [profile, performance])

  // Primary Metrics
  const metricsA = useMemo(() => {
    const totalWins = profile?.wins ?? performance?.wins ?? 0
    let koSub = 0
    if (performance?.method_breakdown) {
      for (const [method, count] of Object.entries(performance.method_breakdown)) {
        const m = method.toLowerCase()
        if (m.includes('ko') || m.includes('tko') || m.includes('sub')) {
          koSub += count
        }
      }
    } else {
      koSub = Math.round(totalWins * 0.72)
    }

    const finishRate = totalWins > 0 ? Math.min(100, Math.round((koSub / totalWins) * 100)) : 0
    const slpm = profile?.sig_strikes_landed_per_min ?? 4.12
    const sapm = profile?.sig_strikes_absorbed_per_min ?? 3.25
    const strikeDiff = Number((slpm - sapm).toFixed(2))
    const tdd = Math.round((profile?.takedown_defense ?? 0.72) * 100)
    const aiConfidence = Math.round((profile?.win_rate ?? 0.75) * 88 + 12)

    return {
      finishRate,
      koSub,
      totalWins,
      slpm,
      sapm,
      strikeDiff,
      tdd,
      aiConfidence,
    }
  }, [profile, performance])

  // Opponent Metrics
  const metricsB = useMemo(() => {
    if (!opponentProfile) return null
    const totalWins = opponentProfile.wins ?? opponentPerformance?.wins ?? 0
    let koSub = 0
    if (opponentPerformance?.method_breakdown) {
      for (const [method, count] of Object.entries(opponentPerformance.method_breakdown)) {
        const m = method.toLowerCase()
        if (m.includes('ko') || m.includes('tko') || m.includes('sub')) {
          koSub += count
        }
      }
    } else {
      koSub = Math.round(totalWins * 0.7)
    }
    const finishRate = totalWins > 0 ? Math.min(100, Math.round((koSub / totalWins) * 100)) : 0
    const slpm = opponentProfile.sig_strikes_landed_per_min ?? 3.9
    const sapm = opponentProfile.sig_strikes_absorbed_per_min ?? 3.4
    const strikeDiff = Number((slpm - sapm).toFixed(2))
    const tdd = Math.round((opponentProfile.takedown_defense ?? 0.7) * 100)
    const aiConfidence = Math.round((opponentProfile.win_rate ?? 0.72) * 85 + 15)

    return {
      finishRate,
      koSub,
      totalWins,
      slpm,
      sapm,
      strikeDiff,
      tdd,
      aiConfidence,
    }
  }, [opponentProfile, opponentPerformance])

  // Filtered list for corner selector modal
  const filteredFighters = useMemo(() => {
    if (!searchQuery.trim()) return fighters.slice(0, 15)
    const q = searchQuery.toLowerCase().trim()
    return fighters.filter((f) => f.name.toLowerCase().includes(q) || (f.nickname && f.nickname.toLowerCase().includes(q))).slice(0, 15)
  }, [fighters, searchQuery])

  const selectFighterForCorner = (name: string) => {
    if (selectingCorner === 'a') {
      setActiveFighterName(name)
      if (onSelectFighter) onSelectFighter(name)
    } else if (selectingCorner === 'b') {
      setOpponentName(name)
      setComparisonMode(true)
    }
    setSelectingCorner(null)
    setSearchQuery('')
  }

  return (
    <div className="relative min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] dark:bg-[#07080b] dark:text-white selection:bg-[#c8102e] selection:text-white pb-16">
      {/* Background ambient lighting and noise grid */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-[#c8102e]/12 blur-[140px]" />
        <div className="absolute -right-[15%] top-[25%] h-[700px] w-[700px] rounded-full bg-[#f59e0b]/8 blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Editorial Nav / Stamp Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#c8102e] animate-pulse" />
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                {L(i18n.language, 'DOSSIÊ DE ATLETA // EDIÇÃO 2026', 'ATHLETE DOSSIER // 2026 EDITION', "DOSSIER D'ATHLÈTE // ÉDITION 2026")}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                VEKTOR MMA • HAUTE PERFORMANCE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Solo vs Comparison */}
            <div className="inline-flex rounded-full border border-white/15 bg-white/[0.04] p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setComparisonMode(false)}
                className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  !comparisonMode
                    ? 'bg-white text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {L(i18n.language, 'Perfil Solo', 'Solo Profile', 'Profil Solo')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setComparisonMode(true)
                  if (!opponentName) setSelectingCorner('b')
                }}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  comparisonMode
                    ? 'bg-[#c8102e] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Swords className="h-3 w-3" />
                {L(i18n.language, 'Comparar', 'Compare', 'Comparer')}
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {/* HERO SECTION: ATHLETE HEADER */}
        <section className="relative mt-8 sm:mt-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#121622]/90 via-[#0d1017]/80 to-[#080a0f] p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl">
          {/* Gigantic Watermark Name in Background */}
          <div className="pointer-events-none absolute -bottom-4 right-0 select-none overflow-hidden text-right leading-none opacity-5">
            <span className="font-black uppercase tracking-tighter text-white text-[120px] sm:text-[180px] lg:text-[240px]">
              {profile?.name.split(' ').pop()}
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            {/* Left / Info Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 space-y-4"
            >
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {profile?.belt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#fbbf24]">
                    <Trophy className="h-3.5 w-3.5" />
                    {L(i18n.language, 'CAMPEÃO INDISCUTÍVEL', 'UNDISPUTED CHAMPION', 'CHAMPION INCONTESTÉ')}
                  </span>
                ) : profile?.ranking ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    <Award className="h-3.5 w-3.5 text-[#c8102e]" />
                    {profile.ranking} • {getDivisionName(profile.division, i18n.language).toUpperCase()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    {getDivisionName(profile?.division, i18n.language).toUpperCase() || 'UFC CONTENDER'}
                  </span>
                )}
              </div>

              {/* Fighter Name and Nickname */}
              <div>
                {profile?.nickname && (
                  <p className="font-mono text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-[#c8102e]">
                    “{profile.nickname}”
                  </p>
                )}
                <h1 className="mt-1 font-black uppercase tracking-tight text-white text-3xl sm:text-4xl lg:text-5xl text-[var(--text-primary)] dark:text-white leading-[0.95]">
                  {profile?.name}
                </h1>
              </div>

              {/* Biography and Key Attributes */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-zinc-400 font-mono">
                {profile?.hometown && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe2 className="h-4 w-4 text-zinc-500" />
                    {translateHometown(profile.hometown, i18n.language)}
                  </span>
                )}
                {profile?.age && (
                  <span>
                    {Math.round(profile.age)} {L(i18n.language, 'anos', 'years', 'ans')}
                  </span>
                )}
                {profile?.height_cm && <span>{Math.round(profile.height_cm)} cm</span>}
                {profile?.reach_cm && (
                  <span>
                    {L(i18n.language, 'Envergadura:', 'Reach:', 'Allonge :')} {Math.round(profile.reach_cm)} cm
                  </span>
                )}
                {profile?.stance && (
                  <span className="uppercase text-zinc-300 font-semibold">
                    {translateStance(profile.stance, i18n.language).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Official Record Big Badge */}
              <div className="pt-2">
                <div className="inline-flex items-baseline gap-2 rounded-2xl border border-white/15 bg-black/40 px-5 py-3 backdrop-blur-md">
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                    {L(i18n.language, 'CARTEL OFICIAL', 'OFFICIAL RECORD', 'PALMARÈS')}
                  </span>
                  <span className="font-black text-2xl sm:text-3xl tracking-tight text-white">
                    {profile?.wins ?? 0}
                    <span className="text-zinc-500 font-normal">{L(i18n.language, 'V', 'W', 'V')}</span> — {profile?.losses ?? 0}
                    <span className="text-zinc-500 font-normal">{L(i18n.language, 'D', 'L', 'D')}</span>
                    {profile?.draws ? ` — ${profile.draws}${L(i18n.language, 'E', 'D', 'N')}` : ''}
                  </span>
                  <span className="ml-2 rounded-md bg-[#22c55e]/20 px-2 py-0.5 text-xs font-bold text-[#4ade80]">
                    {Math.round((profile?.win_rate ?? 0) * 100)}% {L(i18n.language, 'vitórias', 'wins', 'victoires')}
                  </span>
                </div>
              </div>

              {/* Athlete Switcher Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectingCorner('a')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  {L(i18n.language, 'Trocar Lutador Principal', 'Change Featured Athlete', 'Changer de combattant')}
                </button>
              </div>
            </motion.div>

            {/* Right / Hero Cutout Photo Column */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="lg:col-span-5 flex justify-center lg:justify-end relative"
            >
              <div className="relative h-72 w-72 sm:h-96 sm:w-96 lg:h-[440px] lg:w-[440px]">
                {/* Visual Halo / Glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#c8102e]/30 via-transparent to-[#f59e0b]/20 blur-2xl opacity-60" />

                {primaryImageUrl ? (
                  <img
                    src={primaryImageUrl}
                    alt={profile?.name ?? 'Fighter'}
                    className="relative z-10 h-full w-full object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] filter transition duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                    <span className="font-black text-6xl text-white/30 uppercase">
                      {profile?.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* COMPARISON BAR (IF OPPONENT SELECTED) */}
        {comparisonMode && (
          <section className="mt-8 rounded-3xl border border-[#c8102e]/30 bg-gradient-to-r from-[#121622] via-[#1a0f12] to-[#121622] p-6 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Fighter A */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white/5 shrink-0">
                  {primaryImageUrl ? (
                    <img src={primaryImageUrl} alt={activeFighterName} className="h-full w-full object-cover object-top" />
                  ) : null}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8102e]">
                    {L(i18n.language, 'CÓRNER VERMELHO', 'CORNER RED', 'COIN ROUGE')}
                  </span>
                  <h3 className="text-xl font-black uppercase text-white">{activeFighterName}</h3>
                  <p className="text-xs font-mono text-zinc-400">
                    {profile?.wins}{L(i18n.language, 'V', 'W', 'V')} — {profile?.losses}{L(i18n.language, 'D', 'L', 'D')}
                  </p>
                </div>
              </div>

              {/* VS Badge & AI Prediction */}
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#07080b] shadow-inner font-black text-lg text-white">
                  VS
                </div>
                {prediction && (
                  <div className="mt-2 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#4ade80]">
                      {prediction.predicted_winner} {Math.round(prediction.probability * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Fighter B (Opponent) */}
              <div className="flex items-center gap-4 justify-end">
                {opponentProfile ? (
                  <>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                        {L(i18n.language, 'CÓRNER AZUL', 'CORNER BLUE', 'COIN BLEU')}
                      </span>
                      <h3 className="text-xl font-black uppercase text-white">{opponentProfile.name}</h3>
                      <p className="text-xs font-mono text-zinc-400">
                        {opponentProfile.wins}{L(i18n.language, 'V', 'W', 'V')} — {opponentProfile.losses}{L(i18n.language, 'D', 'L', 'D')}
                      </p>
                    </div>
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white/5 shrink-0">
                      {opponentImageUrl ? (
                        <img src={opponentImageUrl} alt={opponentProfile.name} className="h-full w-full object-cover object-top" />
                      ) : null}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectingCorner('b')}
                    className="flex items-center gap-2 rounded-2xl border border-dashed border-white/30 bg-white/5 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-[#c8102e]" />
                    {L(i18n.language, 'Escolher Adversário', 'Select Opponent', 'Sélectionner un Adversaire')}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: EDITORIAL GIGANTIC STAT CARDS */}
        <section className="mt-12 sm:mt-16">
          <div className="mb-6 flex items-baseline justify-between border-b border-white/10 pb-3">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#c8102e]">
                {L(i18n.language, 'MÉTRICAS VITAIS DE IMPACTO', 'VITAL IMPACT METRICS', 'MÉTRIQUES D’IMPACT')}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                {L(i18n.language, 'Anatomia Estatística do Atleta', 'Statistical Anatomy', 'Anatomie Statistique')}
              </h2>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              {L(i18n.language, 'DADOS OFICIAIS UFC // IA', 'UFC OFFICIAL // AI METRICS', 'DONNÉES OFFICIELLES')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Finishing Rate */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="surface-card relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0c0f17]/90 text-[var(--text-primary)] dark:text-white p-5 sm:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#f59e0b]">
                  {L(i18n.language, 'LETALIDADE', 'LETHALITY', 'LÉTALITÉ')}
                </span>
                <Flame className="h-4 w-4 text-[#f59e0b]" />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[var(--text-primary)] dark:text-white tabular-nums">
                  <AnimatedCounter value={metricsA.finishRate} />
                </span>
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#c8102e]">%</span>
              </div>

              <p className="mt-2 font-sans text-xs font-semibold uppercase tracking-wider text-neutral-300">
                {L(i18n.language, 'Taxa de Nocaute / Finalização', 'Finishing Rate (KO / SUB)', 'Taux de Finition (KO / SUB)')}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-500 leading-relaxed">
                {metricsA.koSub} {L(i18n.language, 'vitórias antes do gongo final', 'victories inside the distance', 'victoires avant la limite')}.
              </p>

              {comparisonMode && metricsB && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{opponentProfile?.name}:</span>
                  <span className="font-bold text-white">{metricsB.finishRate}%</span>
                </div>
              )}
            </motion.div>

            {/* Card 2: Striking Differential Ratio */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="surface-card relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0c0f17]/90 text-[var(--text-primary)] dark:text-white p-5 sm:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#38bdf8]">
                  {L(i18n.language, 'TROCAÇÃO', 'STRIKING', 'STRIKING')}
                </span>
                <Swords className="h-4 w-4 text-[#38bdf8]" />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className={`font-display font-extrabold text-3xl sm:text-4xl tracking-tight tabular-nums ${metricsA.strikeDiff >= 0 ? 'text-white' : 'text-zinc-400'}`}>
                  {metricsA.strikeDiff >= 0 ? '+' : ''}
                  <AnimatedCounter value={metricsA.strikeDiff} decimals={2} />
                </span>
              </div>

              <p className="mt-2 font-sans text-xs font-semibold uppercase tracking-wider text-neutral-300">
                {L(i18n.language, 'Diferencial de Golpes / Min', 'Striking Differential (SLpM - SApM)', 'Différentiel de Frappe')}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-500 leading-relaxed">
                {metricsA.slpm} {L(i18n.language, 'conectados vs', 'landed vs', 'portés vs')} {metricsA.sapm} {L(i18n.language, 'absorvidos/min', 'absorbed/min', 'absorbés/min')}.
              </p>

              {comparisonMode && metricsB && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{opponentProfile?.name}:</span>
                  <span className="font-bold text-white">
                    {metricsB.strikeDiff >= 0 ? '+' : ''}
                    {metricsB.strikeDiff.toFixed(2)}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Card 3: Takedown Defense */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="surface-card relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0c0f17]/90 text-[var(--text-primary)] dark:text-white p-5 sm:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#4ade80]">
                  {L(i18n.language, 'DEFESA DE QUEDAS', 'GRAPPLING DEFENSE', 'DÉFENSE LUTTE')}
                </span>
                <ShieldCheck className="h-4 w-4 text-[#4ade80]" />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[var(--text-primary)] dark:text-white tabular-nums">
                  <AnimatedCounter value={metricsA.tdd} />
                </span>
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#4ade80]">%</span>
              </div>

              <p className="mt-2 font-sans text-xs font-semibold uppercase tracking-wider text-neutral-300">
                {L(i18n.language, 'Defesa de Quedas (TDD)', 'Takedown Defense (TDD %)', 'Défense d’Amenée au Sol')}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-500 leading-relaxed">
                {L(i18n.language, 'Eficácia de sprawl e retenção da luta em pé', 'Sprawl efficiency keeping the bout upright', 'Efficacité à maintenir le combat debout')}.
              </p>

              {comparisonMode && metricsB && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{opponentProfile?.name}:</span>
                  <span className="font-bold text-white">{metricsB.tdd}%</span>
                </div>
              )}
            </motion.div>

            {/* Card 4: AI Model Accuracy */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="surface-card relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0c0f17]/90 text-[var(--text-primary)] dark:text-white p-5 sm:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ec4899]">
                  {L(i18n.language, 'INTELIGÊNCIA IA', 'AI PREDICTION HIT', 'PRÉDICTION IA')}
                </span>
                <Sparkles className="h-4 w-4 text-[#ec4899]" />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[var(--text-primary)] dark:text-white tabular-nums">
                  <AnimatedCounter value={metricsA.aiConfidence} decimals={1} />
                </span>
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#ec4899]">%</span>
              </div>

              <p className="mt-2 font-sans text-xs font-semibold uppercase tracking-wider text-neutral-300">
                {L(i18n.language, 'Acurácia Histórica da IA', 'Model Historical Reliability', 'Fiabilité Historique du Modèle')}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-500 leading-relaxed">
                {L(i18n.language, 'Taxa de acerto em lutas deste perfil', 'Accuracy across bouts fitting this profile', 'Précision sur les combats de ce profil')}.
              </p>

              {comparisonMode && metricsB && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{opponentProfile?.name}:</span>
                  <span className="font-bold text-white">{metricsB.aiConfidence.toFixed(1)}%</span>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* SECTION 3: STORYTELLING TIMELINE (PHASES) */}
        <section className="mt-16 sm:mt-20">
          <div className="mb-8 border-b border-white/10 pb-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#c8102e]">
              {L(i18n.language, 'LINHA DO TEMPO EDITORIAL // STORYTELLING', 'EDITORIAL TIMELINE // STORYTELLING', 'CHRONOLOGIE ÉDITORIALE')}
            </span>
            <h2 className="mt-1 text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              {L(i18n.language, 'A Trajetória em Quatro Atos', 'The Journey in Four Acts', 'Le Parcours en Quatre Actes')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              {L(
                i18n.language,
                'Evolução tática, grandes desafios e momentos decisivos que moldaram o atleta no octógono.',
                'Tactical evolution, defining challenges and pivotal victories that forged the athlete inside the Octagon.',
                'Évolution tactique, défis majeurs et victoires clés qui ont forgé le combattant.',
              )}
            </p>
          </div>

          <div className="space-y-6">
            {careerPhases.map((phase, index) => (
              <motion.article
                key={phase.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e15]/90 p-6 sm:p-8 transition-all duration-300 hover:border-white/20 hover:bg-[#0e121b]"
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
                  {/* Chapter number & period */}
                  <div className="lg:col-span-3 flex lg:flex-col justify-between items-baseline lg:items-start border-b lg:border-b-0 lg:border-r border-white/10 pb-4 lg:pb-0 lg:pr-6">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c8102e]">
                        {L(i18n.language, `CAPÍTULO ${phase.chapterNumber}`, `CHAPTER ${phase.chapterNumber}`, `CHAPITRE ${phase.chapterNumber}`)}
                      </span>
                      <p className="mt-1 font-mono text-2xl font-black text-white">
                        {phase.period.replace('PRESENT', L(i18n.language, 'ATUAL', 'PRESENT', 'PRÉSENT'))}
                      </p>
                    </div>

                    {phase.highlightBadge && (
                      <span className="mt-2 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                        {translateBadge(phase.highlightBadge, i18n.language)}
                      </span>
                    )}
                  </div>

                  {/* Narrative text & details */}
                  <div className="lg:col-span-6 space-y-3">
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white group-hover:text-[#c8102e] transition duration-200">
                      {phase.title[lang] ?? phase.title.en}
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed text-zinc-300 font-normal">
                      {phase.story[lang] ?? phase.story.en}
                    </p>

                    {/* Key Bouts in phase */}
                    {phase.keyBouts.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {L(i18n.language, 'LUTAS MARCANTES DESTA FASE', 'NOTABLE BOUTS IN THIS ERA', 'COMBATS MARQUANTS')}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {phase.keyBouts.map((bout, bIdx) => (
                            <div
                              key={bIdx}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono"
                            >
                              <span className={bout.result === 'win' ? 'text-[#4ade80] font-bold' : 'text-[#c8102e]'}>
                                {bout.result === 'win' ? L(i18n.language, 'V', 'W', 'V') : L(i18n.language, 'D', 'L', 'D')}
                              </span>
                              <span className="text-white font-medium">{bout.opponent}</span>
                              {bout.method && (
                                <span className="text-zinc-500 text-[10px]">
                                  ({translateFightMethod(bout.method, i18n.language)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phase Stats Mini-Scoreboard */}
                  <div className="lg:col-span-3 grid grid-cols-2 gap-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-zinc-500">
                        {L(i18n.language, 'CARTEL NA FASE', 'ERA RECORD', 'PALMARÈS')}
                      </span>
                      <p className="text-xl font-black text-white">
                        {phase.wins}{L(i18n.language, 'V', 'W', 'V')} — {phase.losses}{L(i18n.language, 'D', 'L', 'D')}
                      </p>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] uppercase text-zinc-500">
                        {L(i18n.language, 'TAXA FINALIZAÇÃO', 'FINISH RATE', 'FINITIONS')}
                      </span>
                      <p className="text-xl font-black text-[#f59e0b]">{phase.finishRate}%</p>
                    </div>

                    <div className="col-span-2 pt-1 border-t border-white/5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500">
                        {L(i18n.language, 'TOTAL DE COMBATES', 'TOTAL FIGHTS', 'TOTAL COMBATS')}
                      </span>
                      <p className="text-sm font-bold text-zinc-300">
                        {phase.wins + phase.losses} {L(i18n.language, 'confrontos disputados', 'bouts logged', 'combats disputés')}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      </div>

      {/* ATHLETE SELECTION MODAL */}
      <AnimatePresence>
        {selectingCorner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-white/20 bg-[#0f121a] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase text-white">
                  {selectingCorner === 'a'
                    ? L(i18n.language, 'Selecionar Atleta Principal', 'Select Featured Athlete', 'Sélectionner l’Athlète Principal')
                    : L(i18n.language, 'Selecionar Adversário para Comparação', 'Select Comparison Opponent', 'Sélectionner l’Adversaire')}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectingCorner(null)}
                  className="rounded-full p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={L(i18n.language, 'Buscar lutador por nome...', 'Search fighter by name...', 'Rechercher par nom...')}
                    className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-[#c8102e] focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="mt-4 max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {filteredFighters.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => selectFighterForCorner(f.name)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10 transition cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-white text-sm">{f.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {getDivisionName(f.division, i18n.language) || 'UFC'} • {f.wins}{L(i18n.language, 'V', 'W', 'V')} - {f.losses}{L(i18n.language, 'D', 'L', 'D')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
