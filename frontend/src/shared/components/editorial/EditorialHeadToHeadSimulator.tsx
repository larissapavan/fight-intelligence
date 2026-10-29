import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftRight,
  ChevronDown,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { L } from '../../../i18n/lang'
import { AnimatedCounter } from './AnimatedCounter'
import { getFighterImageUrl, useFighterImages } from '../../hooks/useFighterImages'
import { useFighters } from '../../hooks/useFighters'
import { usePrediction } from '../../hooks/usePrediction'

interface EditorialHeadToHeadSimulatorProps {
  initialFighterA?: string
  initialFighterB?: string
  onSelectFighterA?: (name: string) => void
  onSelectFighterB?: (name: string) => void
}

export function EditorialHeadToHeadSimulator({
  initialFighterA = 'Alex Pereira',
  initialFighterB = 'Magomed Ankalaev',
  onSelectFighterA,
  onSelectFighterB,
}: EditorialHeadToHeadSimulatorProps) {
  const { i18n } = useTranslation()
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()

  const [nameA, setNameA] = useState(initialFighterA)
  const [nameB, setNameB] = useState(initialFighterB)
  const [selectingCorner, setSelectingCorner] = useState<'a' | 'b' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { prediction, loading: predicting, runPrediction } = usePrediction()

  // Profiles
  const profileA = useMemo(
    () => fighters.find((f) => f.name.toLowerCase() === nameA.toLowerCase()) ?? null,
    [fighters, nameA],
  )
  const profileB = useMemo(
    () => fighters.find((f) => f.name.toLowerCase() === nameB.toLowerCase()) ?? null,
    [fighters, nameB],
  )

  // Images
  const imgA = useMemo(
    () => getFighterImageUrl(nameA, imageByName, profileA?.image_url),
    [nameA, imageByName, profileA],
  )
  const imgB = useMemo(
    () => getFighterImageUrl(nameB, imageByName, profileB?.image_url),
    [nameB, imageByName, profileB],
  )

  // Auto-run prediction when matchup changes
  useEffect(() => {
    if (nameA && nameB && nameA.toLowerCase() !== nameB.toLowerCase()) {
      void runPrediction(nameA, nameB)
    }
  }, [nameA, nameB, runPrediction])

  const swapCorners = () => {
    const tempA = nameA
    setNameA(nameB)
    setNameB(tempA)
    if (onSelectFighterA) onSelectFighterA(nameB)
    if (onSelectFighterB) onSelectFighterB(tempA)
  }

  // Filtered fighters for corner selector
  const filteredFighters = useMemo(() => {
    if (!searchQuery.trim()) return fighters.slice(0, 15)
    const q = searchQuery.toLowerCase().trim()
    return fighters
      .filter((f) => f.name.toLowerCase().includes(q) || (f.nickname && f.nickname.toLowerCase().includes(q)))
      .slice(0, 15)
  }, [fighters, searchQuery])

  const selectFighter = (name: string) => {
    if (selectingCorner === 'a') {
      setNameA(name)
      if (onSelectFighterA) onSelectFighterA(name)
    } else if (selectingCorner === 'b') {
      setNameB(name)
      if (onSelectFighterB) onSelectFighterB(name)
    }
    setSelectingCorner(null)
    setSearchQuery('')
  }

  // Comparison stats
  const probA = prediction ? Math.round(prediction.fighter_a_probability * 100) : 50
  const probB = prediction ? Math.round(prediction.fighter_b_probability * 100) : 50

  const reachDiff = (profileA?.reach_cm ?? 0) - (profileB?.reach_cm ?? 0)
  const ageDiff = (profileA?.age ?? 0) - (profileB?.age ?? 0)

  return (
    <section className="surface-card-elevated relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] dark:border-white/10 bg-[var(--bg-surface)] dark:bg-[#0a0c13] text-[var(--text-primary)] dark:text-white p-4 sm:p-6 lg:p-7 shadow-xl">
      {/* Background Volumetric Lighting */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-25 dark:opacity-100">
        <div className="absolute -left-20 top-1/4 h-[420px] w-[420px] rounded-full bg-[#E11D48]/15 blur-[120px]" />
        <div className="absolute -right-20 top-1/4 h-[420px] w-[420px] rounded-full bg-[#2563EB]/15 blur-[120px]" />
        <div className="absolute left-1/2 -bottom-20 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-[#F59E0B]/8 blur-[130px]" />
      </div>

      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] dark:border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#E11D48] animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-muted)]">
            SIMULATEUR DE COMBAT // TALE OF THE TAPE ÉDITORIAL
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={swapCorners}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] dark:border-white/15 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white transition cursor-pointer"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>{L(i18n.language, 'Inverter Cantos', 'Swap Corners', 'Inverser les Coins')}</span>
          </button>
        </div>
      </div>

      {/* TALE OF THE TAPE: SPLIT SCREEN FACE-TO-FACE */}
      <div className="relative z-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* CORNER RED (FIGHTER A) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#E11D48] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white">
              CORNER RED
            </span>
            {profileA?.belt && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#fbbf24]">
                <Trophy className="h-3 w-3" /> CHAMPION
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectingCorner('a')}
            className="group flex items-center gap-2 cursor-pointer text-left"
          >
            <div>
              {profileA?.nickname && (
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#E11D48]">
                  “{profileA.nickname}”
                </p>
              )}
              <h3 className="font-['Anton','Barlow_Condensed',Impact,sans-serif] text-2xl sm:text-3xl xl:text-4xl uppercase leading-[0.9] tracking-[0.02em] text-[var(--text-primary)] dark:text-white group-hover:text-[#E11D48] transition">
                {nameA}
              </h3>
            </div>
            <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-white transition" />
          </button>

          <p className="font-mono text-xs text-zinc-400">
            {profileA?.division ?? 'UFC'} • {profileA?.wins ?? 0}W - {profileA?.losses ?? 0}L
            
          </p>

          {/* Cutout Hero Image */}
          <div className="relative h-44 w-44 sm:h-52 sm:w-52 overflow-hidden rounded-2xl border border-[var(--border-subtle)] dark:border-white/10 bg-gradient-to-t from-[var(--bg-surface-hover)] to-transparent dark:from-black/80 dark:via-white/5 p-2">
            {imgA ? (
              <img
                src={imgA}
                alt={nameA}
                className="h-full w-full object-contain object-bottom filter drop-shadow-[0_10px_20px_rgba(225,29,72,0.3)] transition duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-black text-5xl text-white/20">
                {nameA.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </motion.div>

        {/* CENTER AXIS: WIN PROBABILITY & MACHINE LEARNING SCORE */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-4">
          <div className="relative flex flex-col items-center">
            {/* VS Badge */}
            <span className="font-display font-extrabold text-2xl text-neutral-500 tracking-widest uppercase">
              VS
            </span>

            {/* Central ML Probabilities */}
            <div className="mt-3 flex items-baseline justify-center gap-3">
              <div className="text-right">
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#E11D48] tracking-tight tabular-nums">
                  <AnimatedCounter value={probA} />%
                </span>
              </div>
              <span className="text-zinc-600 font-display font-extrabold text-xl">:</span>
              <div className="text-left">
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-[#2563EB] tracking-tight tabular-nums">
                  <AnimatedCounter value={probB} />%
                </span>
              </div>
            </div>

            <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
              {predicting ? 'CALCULATING SHAP ENGINE...' : '● ENGINE v2.4 // SHAP PROBABILITY'}
            </p>

            {/* Prediction Indicator */}
            {prediction && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 shadow-md">
                <Sparkles className="h-3 w-3 text-[#fbbf24]" />
                <span className="font-mono text-[11px] font-medium tracking-widest uppercase text-white truncate max-w-[140px]">
                  FAVORITO: {prediction.predicted_winner.split(' ').pop()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CORNER BLUE (FIGHTER B) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-5 flex flex-col items-center lg:items-end text-center lg:text-right space-y-3"
        >
          <div className="flex items-center gap-2">
            {profileB?.belt && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#fbbf24]">
                <Trophy className="h-3 w-3" /> CHAMPION
              </span>
            )}
            <span className="rounded bg-[#2563EB] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white">
              CORNER BLUE
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectingCorner('b')}
            className="group flex items-center gap-2 cursor-pointer text-right"
          >
            <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-white transition" />
            <div>
              {profileB?.nickname && (
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#2563EB]">
                  “{profileB.nickname}”
                </p>
              )}
              <h3 className="font-['Anton','Barlow_Condensed',Impact,sans-serif] text-2xl sm:text-3xl xl:text-4xl uppercase leading-[0.9] tracking-[0.02em] text-[var(--text-primary)] dark:text-white group-hover:text-[#2563EB] transition">
                {nameB}
              </h3>
            </div>
          </button>

          <p className="font-mono text-xs text-zinc-400">
            {profileB?.division ?? 'UFC'} • {profileB?.wins ?? 0}W - {profileB?.losses ?? 0}L
            
          </p>

          {/* Cutout Hero Image */}
          <div className="relative h-44 w-44 sm:h-52 sm:w-52 overflow-hidden rounded-2xl border border-[var(--border-subtle)] dark:border-white/10 bg-gradient-to-t from-[var(--bg-surface-hover)] to-transparent dark:from-black/80 dark:via-white/5 p-2">
            {imgB ? (
              <img
                src={imgB}
                alt={nameB}
                className="h-full w-full object-contain object-bottom filter drop-shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-black text-5xl text-white/20">
                {nameB.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* COMPARATIVE METRIC BARS */}
      <div className="relative z-10 mt-8 space-y-4 pt-5 border-t border-[var(--border-subtle)] dark:border-white/10">
        <h4 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 text-center">
          ANALYSE COMPARATIVE DES VOLUMES ET DE LA DÉFENSE
        </h4>

        {/* Striking Volume (SLpM) */}
        <ComparativeBar
          label="Golpes Significativos Conectados / Min (SLpM)"
          valA={profileA?.sig_strikes_landed_per_min ?? 4.2}
          valB={profileB?.sig_strikes_landed_per_min ?? 3.8}
          unit=" golpes"
        />

        {/* Striking Accuracy */}
        <ComparativeBar
          label="Precisão de Golpes (Strike Accuracy %)"
          valA={Math.round((profileA?.sig_str_acc ?? 0.5) * 100)}
          valB={Math.round((profileB?.sig_str_acc ?? 0.48) * 100)}
          unit="%"
        />

        {/* Takedown Defense */}
        <ComparativeBar
          label="Defesa de Quedas (TDD %)"
          valA={Math.round((profileA?.takedown_defense ?? 0.75) * 100)}
          valB={Math.round((profileB?.takedown_defense ?? 0.72) * 100)}
          unit="%"
        />

        {/* Physical measurements info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
          <MeasurementCard label="Envergadura A" val={`${Math.round(profileA?.reach_cm ?? 180)} cm`} />
          <MeasurementCard
            label="Diferencial de Alcance"
            val={`${reachDiff >= 0 ? '+' : ''}${Math.round(reachDiff)} cm`}
            highlight={reachDiff !== 0}
          />
          <MeasurementCard label="Envergadura B" val={`${Math.round(profileB?.reach_cm ?? 180)} cm`} />
          <MeasurementCard
            label="Diferença de Idade"
            val={`${ageDiff >= 0 ? '+' : ''}${Math.round(ageDiff)} anos`}
          />
        </div>
      </div>

      {/* CORNER SELECTION MODAL */}
      <AnimatePresence>
        {selectingCorner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-[var(--border-default)] dark:border-white/20 bg-[var(--bg-surface)] dark:bg-[#0d1017] text-[var(--text-primary)] dark:text-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] dark:border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase text-[var(--text-primary)] dark:text-white">
                  {selectingCorner === 'a'
                    ? L(i18n.language, 'Selecionar Canto Vermelho', 'Select Red Corner', 'Sélectionner le Coin Rouge')
                    : L(i18n.language, 'Selecionar Canto Azul', 'Select Blue Corner', 'Sélectionner le Coin Bleu')}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectingCorner(null)}
                  className="rounded-full p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar atleta pelo nome..."
                    className="w-full rounded-xl border border-[var(--border-default)] dark:border-white/15 bg-[var(--bg-surface-subtle)] dark:bg-white/5 py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] dark:text-white placeholder-[var(--text-muted)] focus:border-[#E11D48] focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="mt-4 max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {filteredFighters.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => selectFighter(f.name)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[var(--bg-surface-hover)] dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-[var(--text-primary)] dark:text-white text-sm">{f.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {f.division ?? 'UFC'} • {f.wins}W - {f.losses}L
                        </p>
                      </div>
                      <span className="font-mono text-xs text-zinc-500">Selecionar</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

function ComparativeBar({
  label,
  valA,
  valB,
  unit = '',
}: {
  label: string
  valA: number
  valB: number
  unit?: string
}) {
  const sum = valA + valB || 1
  const pctA = Math.round((valA / sum) * 100)
  const pctB = 100 - pctA

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-bold text-[#E11D48] tabular-nums">
          {valA}
          {unit}
        </span>
        <span className="font-sans font-medium text-xs text-neutral-400 text-center uppercase tracking-wider">{label}</span>
        <span className="font-mono font-bold text-[#2563EB] tabular-nums">
          {valB}
          {unit}
        </span>
      </div>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)] dark:bg-white/5 p-0.5">
        <div
          className="h-full rounded-l-full bg-gradient-to-r from-[#E11D48] to-[#ff4d6d] transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="h-full rounded-r-full bg-gradient-to-l from-[#2563EB] to-[#60a5fa] transition-all duration-500"
          style={{ width: `${pctB}%` }}
        />
      </div>
    </div>
  )
}

function MeasurementCard({
  label,
  val,
  highlight = false,
}: {
  label: string
  val: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] dark:border-white/5 bg-[var(--bg-surface-subtle)] dark:bg-white/[0.03] p-2.5 text-center backdrop-blur-sm">
      <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-400 font-medium">{label}</span>
      <p className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${highlight ? 'text-[#F59E0B]' : 'text-[var(--text-primary)] dark:text-white'}`}>
        {val}
      </p>
    </div>
  )
}
