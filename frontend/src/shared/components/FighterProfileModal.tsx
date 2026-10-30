import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { OtherOrganizationsPanel } from './OtherOrganizationsPanel'
import { getDivisionName } from '../data/divisions'
import { translateFightMethod, translateHometown, translateStance } from '../data/fightLabels'
import { getFighterImageUrl, normalizeFighterName, useFighterImages } from '../hooks/useFighterImages'
import { useFighters } from '../hooks/useFighters'
import { useUpcomingPicks } from '../hooks/useUpcomingPicks'
import { getFighterPerformance } from '../services/api'
import type { FighterPerformance, FightRecord, UpcomingBout } from '../types/api'


function resolveFightDivision(fight: FightRecord, fallbackDivision?: string | null): string | null {
  if (fight.weight_class && !/catch/i.test(fight.weight_class)) {
    return fight.weight_class
  }
  const text = `${fight.notes || ''} ${fight.event || ''} ${fight.event_name || ''}`
  const match = text.match(/\b(Women's\s+Featherweight|Women's\s+Bantamweight|Women's\s+Flyweight|Women's\s+Strawweight|Light\s+Heavyweight|Super\s+Lightweight|Featherweight|Bantamweight|Flyweight|Strawweight|Welterweight|Middleweight|Heavyweight|Lightweight|Cruiserweight)\b/i)
  if (match) {
    const raw = match[1].toLowerCase()
    if (raw.includes('super light') || raw === 'lightweight') return 'Lightweight'
    if (raw.includes('light heavy')) return 'Light Heavyweight'
    if (raw.includes('women') && raw.includes('feather')) return "Women's Featherweight"
    if (raw.includes('women') && raw.includes('bantam')) return "Women's Bantamweight"
    if (raw.includes('women') && raw.includes('fly')) return "Women's Flyweight"
    if (raw.includes('women') && raw.includes('straw')) return "Women's Strawweight"
    if (raw.includes('feather')) return 'Featherweight'
    if (raw.includes('bantam')) return 'Bantamweight'
    if (raw.includes('fly')) return 'Flyweight'
    if (raw.includes('straw')) return 'Strawweight'
    if (raw.includes('welter')) return 'Welterweight'
    if (raw.includes('middle')) return 'Middleweight'
    if (raw.includes('heavy') || raw.includes('cruiser')) return 'Heavyweight'
  }
  return fallbackDivision || null
}

interface TimelineEra {
  year: number
  label: string
  milestone?: string
  fights: FightRecord[]
  wins: number
  losses: number
  hasTitleFight: boolean
}

export function FighterProfileModal({
  name,
  onClose,
  onSelectFighter,
}: {
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()

  const { fighters: allFighters } = useFighters()
  const { imageByName: headerImages } = useFighterImages()
  const profile = useMemo(() => {
    if (!name) return null
    const norm = normalizeFighterName(name)
    return allFighters.find((f) => normalizeFighterName(f.name) === norm) ?? null
  }, [allFighters, name])

  // Detecção de Títulos e Campeonatos
  const isCurrentDivisionChamp = useMemo(() => {
    return Boolean(
      profile?.belt ||
      (profile?.current_titles && profile.current_titles.some((t) => !t.toUpperCase().includes('BMF')))
    )
  }, [profile])

  const championDivision = useMemo(() => {
    return profile?.division || profile?.current_titles?.find((t) => !t.toUpperCase().includes('BMF')) || 'Lightweight'
  }, [profile])

  const isCurrentBmf = useMemo(() => {
    return Boolean(
      profile?.badges?.includes('bmf_current') ||
      (profile?.current_titles && profile.current_titles.some((t) => t.toUpperCase().includes('BMF')))
    )
  }, [profile])

  const isFormerBmf = useMemo(() => {
    return Boolean(profile?.badges?.includes('bmf') && !isCurrentBmf)
  }, [profile, isCurrentBmf])

  // Categorias em que o atleta já foi campeão (exceto a que ele detém hoje)
  const formerDivisionTitles = useMemo(() => {
    const current = new Set((profile?.current_titles ?? []).map((t) => t.toLowerCase()))
    return (profile?.former_titles ?? []).filter((t) => !t.toUpperCase().includes('BMF') && !current.has(t.toLowerCase()))
  }, [profile])

  const formerInterimTitles = useMemo(() => {
    const held = new Set([...(profile?.current_titles ?? []), ...formerDivisionTitles].map((t) => t.toLowerCase()))
    return (profile?.interim_titles ?? []).filter((t) => !held.has(t.toLowerCase()))
  }, [profile, formerDivisionTitles])

  const [performance, setPerformance] = useState<FighterPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEra, setSelectedEra] = useState<TimelineEra | null>(null)
  const [hoveredEra, setHoveredEra] = useState<TimelineEra | null>(null)

  const getUpcomingPick = useUpcomingPicks()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getFighterPerformance(name)
      .then((data) => {
        if (!cancelled) setPerformance(data)
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        if (status === 404) {
          setError(L(i18n.language, 'Nenhum histórico encontrado para este lutador.', 'No performance history found.', 'Aucun historique trouvé.'))
        } else {
          setError(L(i18n.language, 'Falha ao carregar telemetria.', 'Failed to load telemetry.', 'Échec du chargement.'))
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEra((prev) => {
          if (prev) return null
          onClose()
          return null
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  // Assinatura discreta: BRASIL • PESO LEVE • #1 P4P
  const signatureLine = useMemo(() => {
    const parts: string[] = []

    // País / Origem
    if (profile?.country) {
      parts.push(translateHometown(profile.country, i18n.language).toUpperCase())
    } else if (profile?.nationalities && profile.nationalities.length > 0) {
      parts.push(translateHometown(profile.nationalities[0].name, i18n.language).toUpperCase())
    } else if (profile?.hometown) {
      const city = translateHometown(profile.hometown.split(',').pop()?.trim(), i18n.language).toUpperCase()
      if (city) parts.push(city)
    } else {
      parts.push('UFC')
    }

    // Categoria de Peso
    if (profile?.division) {
      parts.push(getDivisionName(profile.division, i18n.language).toUpperCase())
    } else {
      parts.push(L(i18n.language, 'PESO LIVRE', 'OPEN WEIGHT', 'POIDS LIBRE'))
    }

    // Ranking / P4P / Status
    if (profile?.ranking && profile.ranking.includes('#')) {
      parts.push(`${L(i18n.language, 'DESAFIANTE', 'CONTENDER', 'ASPIRANT')} ${profile.ranking}`)
    }

    return parts.join(' • ')
  }, [profile, i18n.language])

  // Cartel Oficial do UFC e Cartel Completo Pro MMA (Todas as Organizações)
  const ufcRecord = performance?.ufc_record ?? {
    total: performance?.total_fights ?? profile?.total_fights ?? 0,
    wins: performance?.wins ?? profile?.wins ?? 0,
    losses: performance?.losses ?? profile?.losses ?? 0,
    draws: profile?.draws ?? 0,
    nc: 0,
    win_rate: performance?.total_fights ? Math.round(((performance?.wins ?? 0) / performance.total_fights) * 100) : 0,
  }

  const completeRecord = performance?.complete_record ?? ufcRecord
  const organizations = performance?.organizations ?? ['UFC']
  const wins = ufcRecord.wins

  // DNA de Finalização
  const dna = useMemo(() => {
    let subs = 0
    let kos = 0
    let decs = 0

    if (performance?.method_breakdown) {
      for (const [method, count] of Object.entries(performance.method_breakdown)) {
        const m = method.toLowerCase()
        if (m.includes('sub')) {
          subs += count
        } else if (m.includes('ko') || m.includes('tko')) {
          kos += count
        } else {
          decs += count
        }
      }
    } else if (wins > 0) {
      subs = Math.round(wins * 0.68)
      kos = Math.round(wins * 0.16)
      decs = Math.max(0, wins - subs - kos)
    }

    const totalMethods = subs + kos + decs || 1
    const subPct = Math.round((subs / totalMethods) * 100)
    const koPct = Math.round((kos / totalMethods) * 100)
    const decPct = Math.max(0, 100 - subPct - koPct)

    return { subs, kos, decs, subPct, koPct, decPct }
  }, [performance, wins])

  const finishRate = wins > 0 ? Math.round(((dna.subs + dna.kos) / wins) * 100) : 0

  // Próximo Combate & Prognóstico
  const nextBout: UpcomingBout | null = useMemo(() => {
    if (profile?.upcoming_fights && profile.upcoming_fights.length > 0) return profile.upcoming_fights[0]
    if (profile?.next_fight) return profile.next_fight
    if (performance?.upcoming_fights && performance.upcoming_fights.length > 0) return performance.upcoming_fights[0]
    if (performance?.next_fight) return performance.next_fight
    return null
  }, [profile, performance])

  const nextPrediction = useMemo(() => {
    if (!nextBout) return null
    const pick = getUpcomingPick(nextBout.event_name, name, nextBout.opponent)
    if (!pick) {
      return { fighterProb: 50, oppProb: 50 }
    }
    const isFighter1 = pick.fighter_1.toLowerCase() === name.toLowerCase()
    const fighterProb = Math.round((isFighter1 ? pick.fighter_1_probability : 1 - pick.fighter_1_probability) * 100)
    const oppProb = 100 - fighterProb
    return { fighterProb, oppProb }
  }, [nextBout, getUpcomingPick, name])

  // Régua Cronológica de Temporadas (Horizontal Timeline)
  const timelineEras = useMemo<TimelineEra[]>(() => {
    const fights = performance?.career_timeline ?? []
    if (fights.length === 0) return []

    const yearMap = new Map<number, FightRecord[]>()
    for (const fight of fights) {
      let yr = 0
      if (fight.date) {
        const parsed = parseInt(fight.date.slice(0, 4), 10)
        if (!isNaN(parsed) && parsed > 1990 && parsed < 2035) {
          yr = parsed
        }
      }
      if (yr === 0) {
        const match = fight.event_name.match(/20\d{2}/)
        yr = match ? parseInt(match[0], 10) : 2024
      }
      if (!yearMap.has(yr)) {
        yearMap.set(yr, [])
      }
      yearMap.get(yr)!.push(fight)
    }

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b)
    if (sortedYears.length === 0) return []

    const debutYear = sortedYears[0]

    return sortedYears.map((year) => {
      const seasonFights = yearMap.get(year)!
      const seasonWins = seasonFights.filter((f) => f.result === 'win').length
      const seasonLosses = seasonFights.filter((f) => f.result === 'loss').length
      const hasTitleFight = seasonFights.some((f) => f.title_fight || f.bmf_title || f.interim_title)

      let milestone: string | undefined
      const isFirstUfcFight = seasonFights.some((f) => f.is_ufc !== false) && !fights.slice(0, fights.indexOf(seasonFights[0])).some((f) => f.is_ufc !== false)
      if (year === debutYear) {
        milestone = seasonFights.some((f) => f.is_ufc === false)
          ? L(i18n.language, 'Estreia Profissional', 'Pro Debut', 'Début Pro')
          : L(i18n.language, 'Estreia no UFC', 'UFC Debut', 'Début UFC')
      } else if (isFirstUfcFight) {
        milestone = L(i18n.language, 'Estreia no UFC', 'UFC Debut', 'Début UFC')
      } else if (seasonFights.some((f) => f.result === 'win' && f.title_fight && !f.interim_title)) {
        milestone = L(i18n.language, 'Campeão Linear', 'Undisputed Champion', 'Champion Linéaire')
      } else if (seasonFights.some((f) => f.result === 'win' && f.bmf_title)) {
        milestone = L(i18n.language, 'Cinturão BMF', 'BMF Champion', 'Ceinture BMF')
      } else if (seasonFights.some((f) => f.result === 'win' && f.interim_title)) {
        milestone = L(i18n.language, 'Campeão Interino', 'Interim Champion', 'Champion Intérimaire')
      } else if (year === 2018 && seasonWins >= 3) {
        milestone = L(i18n.language, 'Início da Série Histórica', 'Historic Streak Began', 'Début de Série Historique')
      } else if (seasonWins >= 3 && seasonLosses === 0) {
        milestone = L(i18n.language, 'Série Histórica', 'Historic Streak', 'Série Historique')
      }

      return {
        year,
        label: `${year}`,
        milestone,
        fights: seasonFights,
        wins: seasonWins,
        losses: seasonLosses,
        hasTitleFight,
      }
    })
  }, [performance, i18n.language])

  const imageUrl = getFighterImageUrl(name, headerImages, profile?.image_url)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.section
        className="relative flex h-[min(90vh,880px)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] border border-white/[0.08] bg-[#08090C] text-white shadow-[0_0_80px_rgba(0,0,0,0.8)]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Top Controls: Dossiê Pill + Close (✕) */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate(`/athlete/${encodeURIComponent(name)}`)
            }}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/20 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-300 hover:text-white shadow-[0_0_20px_rgba(255,255,255,0.03)] backdrop-blur-md transition-all cursor-pointer"
            title={L(i18n.language, 'Abrir Dossiê Completo', 'Open Full Dossier', 'Ouvrir le dossier')}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-transform group-hover:scale-110" />
            <span>{L(i18n.language, 'DOSSIÊ COMPLETO', 'FULL DOSSIER', 'DOSSIER COMPLET')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition cursor-pointer"
            aria-label={L(i18n.language, "Fechar (Close performance profile)", "Close performance profile", "Fermer (Close performance profile)")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2 Zonas Fluidas: Superior (Esquerda + Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid-rows-[minmax(0,1fr)]">
          {/* ZONA ESQUERDA - FOTOGRAFIA & IMPACTO (Visual Anchor, ~40% width) */}
          <div className="relative min-h-[380px] sm:min-h-[420px] lg:min-h-0 lg:h-full lg:col-span-5 overflow-hidden flex flex-col justify-end p-6 sm:p-8 lg:p-9 select-none">
            {/* Foto recortada em alta qualidade com gradientes de fusão */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* Brilho radial ambiente suave */}
              <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-rose-600/[0.08] blur-3xl pointer-events-none" />

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name}
                  className="w-full h-full object-cover object-top filter grayscale contrast-110 brightness-100 opacity-95 transition-all duration-700 select-none"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display font-black text-8xl text-white/[0.05]">
                  {name.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Transição suave em gradiente para o fundo #08090C */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/50 to-transparent" />
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-transparent via-[#08090C]/25 to-[#08090C]" />
            </div>

            {/* Tipografia Display Monumental, Badges Oficiais e Assinatura */}
            <div className="relative z-10 space-y-2.5 pb-1">
              <div className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                  {L(i18n.language, 'ATLETA ATIVO // VEKTOR MMA', 'ACTIVE ATHLETE // VEKTOR MMA', 'ATHLÈTE ACTIF // VEKTOR MMA')}
                </span>
              </div>

              <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-[2.6rem] uppercase tracking-tighter text-white leading-[0.95] drop-shadow-2xl break-words">
                {name}
              </h1>

              {/* BADGES OFICIAIS DE CAMPEÃO E HONRAS (Destaque Dourado e Ex-BMF) */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {isCurrentDivisionChamp && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.25)] backdrop-blur-md">
                    <Trophy className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                    <span>
                      {L(
                        i18n.language,
                        `Atual Campeão ${getDivisionName(championDivision, i18n.language)}`,
                        `Current ${getDivisionName(championDivision, i18n.language)} Champion`,
                        `Champion Actuel ${getDivisionName(championDivision, i18n.language)}`
                      )}
                    </span>
                  </span>
                )}

                {isCurrentBmf && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    <span>{L(i18n.language, 'Atual Campeão BMF', 'Current BMF Champion', 'Champion BMF Actuel')}</span>
                  </span>
                )}

                {isFormerBmf && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-300 backdrop-blur-sm">
                    <span>✦ {L(i18n.language, 'Ex-Campeão BMF', 'Former BMF Champion', 'Ancien Champion BMF')}</span>
                  </span>
                )}

                {formerDivisionTitles.map((title) => (
                  <span
                    key={`former-${title}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-200 backdrop-blur-sm"
                  >
                    <span>
                      ✦ {L(
                        i18n.language,
                        `Ex-Campeão ${getDivisionName(title, i18n.language)}`,
                        `Former ${getDivisionName(title, i18n.language)} Champion`,
                        `Ancien Champion ${getDivisionName(title, i18n.language)}`
                      )}
                    </span>
                  </span>
                ))}

                {formerInterimTitles.map((title) => (
                  <span
                    key={`interim-${title}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-300"
                  >
                    <span>
                      ✦ {L(
                        i18n.language,
                        `Ex-Campeão Interino ${getDivisionName(title, i18n.language)}`,
                        `Former Interim ${getDivisionName(title, i18n.language)} Champion`,
                        `Ancien Champion Intérimaire ${getDivisionName(title, i18n.language)}`
                      )}
                    </span>
                  </span>
                ))}
              </div>

              <p className="font-mono text-xs sm:text-[13px] uppercase tracking-wider text-neutral-400 font-medium">
                {signatureLine}
              </p>
            </div>
          </div>

          {/* ZONA DIREITA - TELEMETRIA EDITORIAL (Sem retângulos fechados, ~60% width) */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:px-10 lg:py-9 flex flex-col justify-start space-y-6 sm:space-y-7 lg:min-h-0 lg:overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-16 w-32 bg-white/5 rounded-xl" />
                <div className="h-4 w-full bg-white/5 rounded" />
                <div className="h-12 w-full bg-white/5 rounded-xl" />
              </div>
            ) : error ? (
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-wider text-rose-400 font-semibold">{error}</p>
                <p className="font-sans text-xs text-neutral-500">
                  {L(i18n.language, 'Histórico detalhado indisponível no momento.', 'Detailed history unavailable at this time.', 'Historique détaillé indisponible pour le moment.')}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Cartéis: UFC em Grande Destaque + Cartel Pro MMA Completo Junto */}
                <div className="space-y-3">
                  {/* Cartel no UFC em Destaque Monumental */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48] animate-pulse" />
                      <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-neutral-400 font-bold">
                        {L(i18n.language, 'CARTEL NO OCTÓGONO (UFC)', 'UFC OCTAGON RECORD', 'PALMARÈS DANS L\'OCTOGONE (UFC)')}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-3 sm:gap-5 flex-wrap">
                      <span className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter text-white tabular-nums leading-none">
                        {ufcRecord.total}
                      </span>
                      <div className="space-y-0.5">
                        <p className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                          {ufcRecord.wins} {L(i18n.language, 'VITÓRIAS', 'WINS', 'VICTOIRES')} • {ufcRecord.losses} {L(i18n.language, 'DERROTAS', 'LOSSES', 'DÉFAITES')}{ufcRecord.nc ? ` • ${ufcRecord.nc} NC` : ''}
                        </p>
                        <p className="font-sans text-[11px] text-neutral-400">
                          {L(i18n.language, `${ufcRecord.win_rate}% de aproveitamento oficial no octógono`, `${ufcRecord.win_rate}% official UFC win rate`, `${ufcRecord.win_rate}% de victoires à l'UFC`)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Atributos Físicos & Biometria Oficial */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        {L(i18n.language, 'ALTURA', 'HEIGHT', 'TAILLE')}
                      </p>
                      <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                        {profile?.height_cm
                          ? `${Math.round(profile.height_cm)} cm`
                          : '—'}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-400">
                        {profile?.height_cm
                          ? `${Math.floor(profile.height_cm / 30.48)}'${Math.round((profile.height_cm % 30.48) / 2.54)}"`
                          : ''}
                      </p>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        {L(i18n.language, 'PESO', 'WEIGHT', 'POIDS')}
                      </p>
                      <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                        {profile?.weight_lbs
                          ? `${Math.round(profile.weight_lbs)} lb`
                          : '—'}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-400">
                        {profile?.weight_lbs
                          ? `${(profile.weight_lbs * 0.45359237).toFixed(1)} kg`
                          : ''}
                      </p>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        {L(i18n.language, 'ENVERGADURA', 'REACH', 'ALLONGE')}
                      </p>
                      <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                        {profile?.reach_cm
                          ? `${Math.round(profile.reach_cm)} cm`
                          : '—'}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-400">
                        {profile?.reach_cm
                          ? `${Math.round(profile.reach_cm / 2.54)}"`
                          : ''}
                      </p>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        {L(i18n.language, 'IDADE', 'AGE', 'ÂGE')}
                      </p>
                      <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                        {profile?.age
                          ? `${Math.floor(profile.age)} ${L(i18n.language, 'anos', 'yrs', 'ans')}`
                          : '—'}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-400">
                        {profile?.ufc_status === 'active'
                          ? L(i18n.language, 'Ativo no UFC', 'Active UFC', 'Actif UFC')
                          : L(i18n.language, 'Plantel UFC', 'UFC Roster', 'Effectif UFC')}
                      </p>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        {L(i18n.language, 'POSTURA', 'STANCE', 'GARDE')}
                      </p>
                      <p className="font-mono text-sm font-bold text-white truncate mt-0.5">
                        {profile?.stance
                          ? translateStance(profile.stance, i18n.language)
                          : '—'}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-400 truncate">
                        {profile?.stance ? (i18n.language.startsWith('pt') ? 'Postura marcial' : profile.stance) : ''}
                      </p>
                    </div>
                  </div>

                  {/* Cartel Completo Pro MMA (Todas as Organizações) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                    <div className="space-y-0.5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                        {L(i18n.language, 'CARTEL PROFISSIONAL COMPLETO (PRO MMA)', 'PRO MMA COMPLETE CAREER RECORD', 'PALMARÈS PROFESSIONNEL COMPLET (MMA)')}
                      </p>
                      <p className="font-mono text-xs sm:text-sm font-bold text-neutral-200 tabular-nums">
                        {completeRecord.total} {L(i18n.language, 'LUTAS', 'BOUTS', 'COMBATS')} • {completeRecord.wins}V - {completeRecord.losses}D{completeRecord.nc ? ` - ${completeRecord.nc}NC` : ''}
                        <span className="text-neutral-400 font-normal text-xs ml-1.5 font-sans">
                          ({completeRecord.win_rate}% {L(i18n.language, 'geral', 'overall', 'global')})
                        </span>
                      </p>
                    </div>

                    {organizations.length > 1 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {organizations.map((org: string) => (
                          <span
                            key={org}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                              org === 'UFC'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-white/5 text-neutral-300 border border-white/10'
                            }`}
                          >
                            {org}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Bloco "DNA de Finalização" */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">
                    <span>{L(i18n.language, 'DNA DE RESOLUÇÃO // MÉTODO DE VITÓRIAS', 'FINISH BREAKDOWN // METHOD OF VICTORY', 'MÉTHODES DE VICTOIRE // ADN DU COMBATTANT')}</span>
                    <span className="text-amber-400 font-bold">{finishRate}% {L(i18n.language, 'FINALIZADOR', 'FINISHER', 'FINISSEUR')}</span>
                  </div>

                  {/* Bar progress minimalista de 3px */}
                  <div className="h-[3px] w-full rounded-full bg-white/10 flex overflow-hidden">
                    <div style={{ width: `${dna.subPct}%` }} className="bg-amber-400 transition-all duration-700" />
                    <div style={{ width: `${dna.koPct}%` }} className="bg-rose-500 transition-all duration-700" />
                    <div style={{ width: `${dna.decPct}%` }} className="bg-sky-400 transition-all duration-700" />
                  </div>

                  {/* Legenda tabular limpa sem caixas */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-neutral-300">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="font-bold text-white tabular-nums">{dna.subs}</span> {L(i18n.language, 'FINALIZAÇÕES', 'SUBMISSIONS', 'SOUMISSIONS')} ({dna.subPct}%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      <span className="font-bold text-white tabular-nums">{dna.kos}</span> {L(i18n.language, 'NOCAUTES', 'KNOCKOUTS', 'KOS / TKOS')} ({dna.koPct}%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      <span className="font-bold text-white tabular-nums">{dna.decs}</span> {L(i18n.language, 'DECISÕES', 'DECISIONS', 'DÉCISIONS')} ({dna.decPct}%)
                    </span>
                  </div>
                </div>

                {/* 3. Próximo Combate & Prognóstico do Modelo */}
                {nextBout ? (
                  <div className="space-y-2.5 pt-1">
                    {(() => {
                      const isOpponentTbd = Boolean(
                        nextBout.opponent &&
                        (nextBout.opponent.toUpperCase() === 'TBD' ||
                         nextBout.opponent.toUpperCase() === 'TBA' ||
                         nextBout.opponent.toLowerCase().includes('oponente') ||
                         nextBout.opponent.toLowerCase().includes('substituto'))
                      )

                      return (
                        <>
                          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">
                            <span>{L(i18n.language, 'PRÓXIMO COMBATE', 'NEXT BOUT', 'PROCHAIN COMBAT')} // {nextBout.event_name}</span>
                            <span className="text-amber-400 font-bold">
                              {isOpponentTbd
                                ? L(i18n.language, 'BUSCA POR OPONENTE', 'SEEKING OPPONENT', 'RECHERCHE D\'ADVERSAIRE')
                                : L(i18n.language, 'PROGNÓSTICO POR IA', 'AI WIN FORECAST', 'PRONOSTIC IA')}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between font-display font-bold text-base sm:text-lg text-white">
                            <span className="truncate">
                              {name}{' '}
                              {!isOpponentTbd && (
                                <span className="font-mono text-xs text-amber-400 tabular-nums">
                                  ({nextPrediction?.fighterProb ?? 50}%)
                                </span>
                              )}
                            </span>
                            <span className="px-3 text-neutral-400 font-mono text-xs font-normal">VS</span>
                            {isOpponentTbd ? (
                              <span className="truncate text-right font-mono text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider">
                                ✦ {L(i18n.language, 'Aguardando Substituto (TBD)', 'Awaiting Opponent (TBD)', 'Adversaire à déterminer (TBD)')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectFighter(nextBout.opponent)}
                                className="truncate text-right hover:text-sky-400 transition cursor-pointer font-bold"
                                title={L(i18n.language, `Ver perfil de ${nextBout.opponent}`, `View profile of ${nextBout.opponent}`, `Voir le profil de ${nextBout.opponent}`)}
                              >
                                {nextBout.opponent}{' '}
                                <span className="font-mono text-xs text-sky-400 tabular-nums">
                                  ({nextPrediction?.oppProb ?? 50}%)
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Scale prediction bar ou breathing bar se oponente indefinido */}
                          {isOpponentTbd ? (
                            <div className="h-[3px] w-full rounded-full bg-amber-400/20 overflow-hidden">
                              <div className="h-full w-full bg-gradient-to-r from-amber-500/30 via-amber-400 to-amber-500/30 animate-pulse" />
                            </div>
                          ) : (
                            <div className="h-[3px] w-full rounded-full bg-white/10 flex overflow-hidden">
                              <div
                                style={{ width: `${nextPrediction?.fighterProb ?? 50}%` }}
                                className="bg-amber-400 transition-all duration-700"
                              />
                              <div
                                style={{ width: `${nextPrediction?.oppProb ?? 50}%` }}
                                className="bg-sky-400 transition-all duration-700"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between font-sans text-[11px] text-neutral-400">
                            <span>{nextBout.weight_class ? getDivisionName(nextBout.weight_class, i18n.language) : L(i18n.language, 'Card Principal', 'Main Card', 'Carte Principale')}</span>
                            <span className="font-mono text-[10px] uppercase text-neutral-400">
                              {isOpponentTbd
                                ? L(i18n.language, '✦ Luta Mantida • Buscando Substituto', '✦ Bout Booked • Seeking Opponent', '✦ Combat Confirmé • En recherche d\'adversaire')
                                : nextBout.title_fight
                                  ? L(i18n.language, '✦ Disputa de Cinturão', '✦ Title Fight', '✦ Combat pour le Titre')
                                  : L(i18n.language, 'Combate Confirmado', 'Confirmed Bout', 'Combat Confirmé')}
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">
                      {L(i18n.language, 'PRÓXIMO COMBATE // AGUARDANDO CASAMENTO DE LUTA', 'NEXT BOUT // AWAITING FIGHT SCHEDULING', 'PROCHAIN COMBAT // EN ATTENTE D\'ANNONCE')}
                    </p>
                    <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                      {L(
                        i18n.language,
                        'Atleta ativo no plantel do UFC • Telemetria analítica e modelo de predição prontos para o octógono.',
                        'Active athlete on the UFC roster • Analytical telemetry and prediction model ready for the Octagon.',
                        'Athlète actif de l\'UFC • Télémétrie analytique et modèle de prédiction prêts pour l\'Octogone.'
                      )}
                    </p>
                  </div>
                )}

                {/* 4. Métricas Flutuantes Adicionais (Pure Typography, Zero Boxes) */}
                <div className="grid grid-cols-3 gap-6 pt-3 border-t border-white/[0.06]">
                  <div>
                    <p className="font-display font-bold text-xl sm:text-2xl text-white tabular-nums">
                      {profile?.sig_strikes_landed_per_min ? profile.sig_strikes_landed_per_min.toFixed(2) : '3.82'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                      {L(i18n.language, 'Golpes / Min (SLpM)', 'Strikes / Min (SLpM)', 'Coups / Min (SLpM)')}
                    </p>
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl sm:text-2xl text-white tabular-nums">
                      {profile?.striking_defense ? `${Math.round(profile.striking_defense * 100)}%` : '53%'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                      {L(i18n.language, 'Defesa de Golpes', 'Striking Defense', 'Défense Frappes')}
                    </p>
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl sm:text-2xl text-white tabular-nums">
                      {profile?.takedown_defense ? `${Math.round(profile.takedown_defense * 100)}%` : '56%'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                      {L(i18n.language, 'Defesa de Quedas', 'Takedown Defense', 'Défense Lutte')}
                    </p>
                  </div>
                </div>
                <OtherOrganizationsPanel name={name} />
              </>
            )}
          </div>
        </div>

        {/* PAINEL EDITORIAL DE COMBATES: Exibido ao clicar em qualquer ano */}
        <AnimatePresence>
          {selectedEra && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute bottom-[74px] sm:bottom-[78px] left-3 right-3 sm:left-6 sm:right-6 lg:left-auto lg:right-8 lg:w-[620px] z-40 rounded-2xl border border-white/15 bg-[#0C0D14]/98 p-4 sm:p-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col max-h-[400px] sm:max-h-[440px]"
            >
              {/* Top Bar: Ano, Balanço, Milestones e Navegação */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = timelineEras.findIndex((e) => e.year === selectedEra.year)
                      if (idx > 0) setSelectedEra(timelineEras[idx - 1])
                    }}
                    disabled={timelineEras.findIndex((e) => e.year === selectedEra.year) <= 0}
                    className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                    title={L(i18n.language, 'Ano anterior', 'Previous year', 'Année précédente')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-base sm:text-lg text-white tracking-tight">
                        {L(i18n.language, 'TEMPORADA', 'SEASON', 'SAISON')} {selectedEra.year}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                        {selectedEra.wins}{L(i18n.language, 'V', 'W', 'V')} - {selectedEra.losses}{L(i18n.language, 'D', 'L', 'D')}
                      </span>
                    </div>
                    <p className="font-sans text-[11px] text-neutral-400 mt-0.5">
                      {selectedEra.fights.length} {selectedEra.fights.length === 1 ? L(i18n.language, 'combate disputado', 'bout fought', 'combat disputé') : L(i18n.language, 'combates disputados', 'bouts fought', 'combats disputés')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = timelineEras.findIndex((e) => e.year === selectedEra.year)
                      if (idx < timelineEras.length - 1) setSelectedEra(timelineEras[idx + 1])
                    }}
                    disabled={timelineEras.findIndex((e) => e.year === selectedEra.year) >= timelineEras.length - 1}
                    className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                    title={L(i18n.language, 'Próximo ano', 'Next year', 'Année suivante')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedEra.milestone && (
                    <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      <Trophy className="h-3 w-3" />
                      <span>{selectedEra.milestone}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedEra(null)}
                    className="h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition flex items-center justify-center cursor-pointer"
                    title={L(i18n.language, 'Fechar (Esc)', 'Close (Esc)', 'Fermer (Échap)')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Lista Completa de Combates do Ano */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
                {selectedEra.fights.map((fight, idx) => {
                  const isWin = fight.result === 'win'
                  const isLoss = fight.result === 'loss'
                  const resultLabel = isWin
                    ? L(i18n.language, 'VITÓRIA', 'WIN', 'VICTOIRE')
                    : isLoss
                      ? L(i18n.language, 'DERROTA', 'LOSS', 'DÉFAITE')
                      : (fight.result?.toUpperCase() || 'NC')

                  return (
                    <div
                      key={idx}
                      className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/15 transition-all duration-200"
                    >
                      {/* Left: Organization & Result pill, opponent & event */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] tracking-wider uppercase ${
                              fight.is_ufc !== false
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {fight.organization || (fight.is_ufc !== false ? 'UFC' : 'MMA')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] tracking-wider uppercase ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isLoss
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/30'
                            }`}
                          >
                            {resultLabel}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectFighter(fight.opponent)
                            }}
                            className="font-display font-bold text-sm sm:text-base text-white hover:text-amber-400 transition truncate text-left cursor-pointer block leading-tight"
                            title={L(i18n.language, `Ver perfil de ${fight.opponent}`, `View profile of ${fight.opponent}`, `Voir le profil de ${fight.opponent}`)}
                          >
                            vs. {fight.opponent}
                          </button>
                          <p className="font-sans text-[11px] text-neutral-400 truncate mt-0.5">
                            {fight.event_name} {fight.date ? `• ${fight.date}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Right: Method, Round, Time & Badges */}
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-semibold text-neutral-200">
                          {translateFightMethod(fight.method, i18n.language) || L(i18n.language, 'Decisão', 'Decision', 'Décision')}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-400">
                          {fight.round ? (i18n.language.startsWith('pt') ? `${fight.round}º Round` : `Round ${fight.round}`) : ''} {fight.time ? `(${fight.time})` : ''}
                        </p>
                        {(fight.title_fight || fight.bmf_title || fight.interim_title) && (() => {
                          const division = resolveFightDivision(fight, profile?.division)
                          const divPt = division ? getDivisionName(division, 'pt') : ''
                          const divFr = division ? getDivisionName(division, 'fr') : ''
                          const divEn = division ?? ''

                          if (fight.bmf_title) {
                            return (
                              <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-amber-400 uppercase mt-0.5">
                                ✦ {L(i18n.language, 'Cinturão BMF', 'BMF Title Fight', 'Ceinture BMF')}
                              </span>
                            )
                          }

                          if (fight.interim_title) {
                            return (
                              <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-sky-400 uppercase mt-0.5">
                                ✦ {L(
                                  i18n.language,
                                  divPt ? `Cinturão Interino (${divPt})` : 'Cinturão Interino',
                                  divEn ? `Interim ${divEn} Title` : 'Interim Title Fight',
                                  divFr ? `Ceinture Intérimaire (${divFr})` : 'Ceinture Intérimaire',
                                )}
                              </span>
                            )
                          }

                          return (
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-amber-400 uppercase mt-0.5">
                              ✦ {L(
                                i18n.language,
                                divPt ? `Disputa de Cinturão (${divPt})` : 'Disputa de Cinturão',
                                divEn ? `${divEn} Title Fight` : 'Title Fight',
                                divFr ? `Combat pour le Titre (${divFr})` : 'Combat pour le Titre',
                              )}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ZONA INFERIOR - RÉGUA CRONOLÓGICA (Horizontal Timeline) */}
        <div className="relative border-t border-white/[0.08] bg-black/60 backdrop-blur-md px-6 sm:px-8 py-3.5 shrink-0 flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2 font-semibold">
            <span>{L(i18n.language, 'RÉGUA CRONOLÓGICA // HISTÓRICO DE TEMPORADAS', 'TIMELINE // SEASONAL CAREER HISTORY', 'CHRONOLOGIE // HISTORIQUE DE CARRIÈRE')}</span>
            <span className="hidden sm:inline text-amber-400/90 font-medium">
              {selectedEra
                ? `✦ ${L(i18n.language, 'TEMPORADA', 'SEASON', 'SAISON')} ${selectedEra.year} ${L(i18n.language, 'SELECIONADA • CLIQUE PARA ALTERNAR OU FECHAR', 'SELECTED • CLICK TO TOGGLE OR CLOSE', 'SÉLECTIONNÉE • CLIQUER POUR FERMER')}`
                : L(i18n.language, 'CLIQUE NO ANO PARA EXIBIR AS LUTAS ⇄', 'CLICK A YEAR TO VIEW BOUTS ⇄', 'CLIQUEZ SUR UNE ANNÉE POUR VOIR LES COMBATS ⇄')}
            </span>
          </div>

          {timelineEras.length === 0 ? (
            <p className="font-sans text-xs text-neutral-400 py-2">
              {L(i18n.language, 'Sem histórico de temporadas registrado.', 'No seasonal career history recorded.', 'Aucun historique de saisons enregistré.')}
            </p>
          ) : (
            <div className="relative flex items-center gap-8 sm:gap-12 overflow-x-auto no-scrollbar py-2">
              {/* Linha horizontal contínua de fundo */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2 pointer-events-none" />

              {timelineEras.map((era) => {
                const isHovered = hoveredEra?.year === era.year
                const isSelected = selectedEra?.year === era.year
                const hasTitle = era.hasTitleFight
                const allWins = era.wins > 0 && era.losses === 0

                return (
                  <div
                    key={era.year}
                    className="relative z-10 flex flex-col items-center cursor-pointer group shrink-0"
                    onMouseEnter={() => setHoveredEra(era)}
                    onMouseLeave={() => setHoveredEra(null)}
                    onClick={() => setSelectedEra((prev) => (prev?.year === era.year ? null : era))}
                  >
                    {/* Tooltip flutuante sutil ao passar o mouse */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 sm:w-72 rounded-xl border border-white/15 bg-[#0C0D14]/95 p-3.5 shadow-2xl backdrop-blur-xl z-50 pointer-events-auto text-left"
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                            <span className="font-display font-extrabold text-sm text-white">
                              {era.year} • {era.fights.length} {era.fights.length === 1 ? L(i18n.language, 'Luta', 'Bout', 'Combat') : L(i18n.language, 'Lutas', 'Bouts', 'Combats')}
                            </span>
                            <span className="font-mono text-xs text-neutral-300 font-bold">
                              {era.wins}{L(i18n.language, 'V', 'W', 'V')} - {era.losses}{L(i18n.language, 'D', 'L', 'D')}
                            </span>
                          </div>

                          {era.milestone && (
                            <div className="mb-2 inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                              <Trophy className="h-3 w-3" />
                              <span>{era.milestone}</span>
                            </div>
                          )}

                          <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                            {era.fights.slice(0, 5).map((fight, idx) => {
                              const isWin = fight.result === 'win'
                              return (
                                <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className={`h-4 w-4 shrink-0 rounded flex items-center justify-center font-mono font-bold text-[9px] ${
                                        isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                      }`}
                                    >
                                      {isWin ? L(i18n.language, 'V', 'W', 'V') : L(i18n.language, 'D', 'L', 'D')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onSelectFighter(fight.opponent)
                                      }}
                                      className="truncate text-neutral-200 font-medium hover:text-white hover:underline transition cursor-pointer text-left"
                                      title={L(i18n.language, `Ver perfil de ${fight.opponent}`, `View profile of ${fight.opponent}`, `Voir le profil de ${fight.opponent}`)}
                                    >
                                      {fight.opponent}
                                    </button>
                                  </div>
                                  <span className="font-mono text-[10px] text-neutral-400 shrink-0">
                                    {(() => {
                                      const m = (fight.method || '').toLowerCase()
                                      if (m.includes('sub')) return L(i18n.language, 'FINALIZ.', 'SUB', 'SOUM.')
                                      if (m.includes('ko') || m.includes('tko')) return 'KO/TKO'
                                      return L(i18n.language, 'DEC', 'DEC', 'DÉC')
                                    })()}
                                  </span>
                                </div>
                              )
                            })}
                            {era.fights.length > 5 && (
                              <p className="font-mono text-[10px] text-neutral-400 text-center pt-1">
                                +{era.fights.length - 5} {L(i18n.language, 'outros combates', 'more bouts', 'autres combats')}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Indicador de ano selecionado */}
                    {isSelected && (
                      <span className="absolute -top-3.5 text-amber-400 text-[10px] animate-bounce pointer-events-none">
                        ▲
                      </span>
                    )}

                    {/* Ano em destaque */}
                    <span
                      className={`font-display text-sm sm:text-base font-bold transition-all duration-200 ${
                        isSelected
                          ? 'text-amber-400 scale-125 font-black drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                          : isHovered
                            ? 'text-white scale-110'
                            : hasTitle
                              ? 'text-amber-400'
                              : 'text-neutral-400 group-hover:text-white'
                      }`}
                    >
                      {era.year}
                    </span>

                    {/* Ponto / Nó na régua */}
                    <div
                      className={`my-1.5 h-2.5 w-2.5 rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-amber-400 ring-4 ring-amber-400/50 scale-150 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                          : hasTitle
                            ? 'bg-amber-400 ring-4 ring-amber-400/20 scale-125'
                            : allWins
                              ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                              : 'bg-white/30 group-hover:bg-white group-hover:scale-125'
                      }`}
                    />

                    {/* Marcador de Era / Marco Histórico */}
                    <span className="font-mono text-[9px] sm:text-[10px] text-amber-400/90 font-semibold tracking-tight whitespace-nowrap min-h-[14px]">
                      {era.milestone ? `(${era.milestone})` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}
