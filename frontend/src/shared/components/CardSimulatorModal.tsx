import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Swords, Bot, User, Share2, Check, RotateCcw, X } from 'lucide-react'
import { L } from '../../i18n/lang'
import { getDivisionName } from '../data/divisions'
import type { EventSummary, UpcomingPick } from '../types/api'

interface CardSimulatorModalProps {
  event: EventSummary
  pickFor?: (event: string, fighterA: string, fighterB: string) => UpcomingPick | undefined
  onClose: () => void
  onOpenFighter?: (name: string) => void
}

export function CardSimulatorModal({ event, pickFor, onClose }: CardSimulatorModalProps) {
  const { i18n } = useTranslation()

  const storageKey = `ufc_simulator_picks_${event.name}`
  const [userPicks, setUserPicks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const [copied, setCopied] = useState(false)

  const handlePick = (fightId: string, winner: string) => {
    setUserPicks((prev) => {
      const updated = { ...prev, [fightId]: winner }
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch { /* ignore storage error */ }
      return updated
    })
  }

  const handleClear = () => {
    setUserPicks({})
    try {
      localStorage.removeItem(storageKey)
    } catch { /* ignore storage error */ }
  }

  // Calculate statistics
  const fights = useMemo(() => event.fights ?? [], [event.fights])
  const stats = useMemo(() => {
    let totalPicked = 0
    let agreedWithAi = 0
    let totalWithAi = 0

    fights.forEach((fight, idx) => {
      const fightId = fight.fight_url ?? `${fight.fighter_1}_${fight.fighter_2}_${idx}`
      const userChoice = userPicks[fightId]
      const aiPick = pickFor?.(event.name, fight.fighter_1, fight.fighter_2)

      if (userChoice) {
        totalPicked++
        if (aiPick) {
          totalWithAi++
          if (aiPick.predicted_winner.toLowerCase() === userChoice.toLowerCase()) {
            agreedWithAi++
          }
        }
      }
    })

    const agreementPct = totalWithAi > 0 ? Math.round((agreedWithAi / totalWithAi) * 100) : 0
    return { totalPicked, agreedWithAi, totalWithAi, agreementPct }
  }, [fights, userPicks, pickFor, event.name])

  const handleShare = () => {
    let text = L(
      i18n.language,
      `🥊 MEUS PALPITES VS IA • ${event.name}\n`,
      `🥊 MY PICKS VS AI • ${event.name}\n`,
      `🥊 MES PRONOSTICS CONTRE L'IA • ${event.name}\n`,
    )
    
    if (event.date) {
      text += `📅 ${event.date}\n\n`
    } else {
      text += '\n'
    }

    fights.forEach((fight, idx) => {
      const fightId = fight.fight_url ?? `${fight.fighter_1}_${fight.fighter_2}_${idx}`
      const userChoice = userPicks[fightId]
      const aiPick = pickFor?.(event.name, fight.fighter_1, fight.fighter_2)

      if (userChoice) {
        const matchesAi = aiPick && aiPick.predicted_winner.toLowerCase() === userChoice.toLowerCase()
        const aiInfo = aiPick ? `🤖 IA: ${aiPick.predicted_winner} (${Math.round(aiPick.probability * 100)}%)` : ''
        const verdict = matchesAi
          ? L(i18n.language, '🤝 [CONCORDO]', '🤝 [AGREE]', '🤝 [D\'ACCORD]')
          : L(i18n.language, '⚡ [ZEBRA/DIVERGÊNCIA]', '⚡ [UPSET/DISAGREE]', '⚡ [SURPRISE/DÉSACCORD]')
        text += `• ${fight.fighter_1} vs ${fight.fighter_2}\n  👉 ${L(i18n.language, 'Meu palpite', 'My pick', 'Mon pronostic')}: ${userChoice} | ${aiInfo} ${verdict}\n\n`
      }
    })

    if (stats.totalWithAi > 0) {
      text += L(
        i18n.language,
        `📊 Concordância com o Modelo de IA: ${stats.agreementPct}% (${stats.agreedWithAi}/${stats.totalWithAi} lutas)\n`,
        `📊 Agreement with AI Model: ${stats.agreementPct}% (${stats.agreedWithAi}/${stats.totalWithAi} fights)\n`,
        `📊 Accord avec le modèle d'IA : ${stats.agreementPct}% (${stats.agreedWithAi}/${stats.totalWithAi} combats)\n`,
      )
    }
    text += L(i18n.language, `Faça seus palpites no site: https://fight-intelligence.vercel.app/`, `Make your picks at: https://fight-intelligence.vercel.app/`, `Faites vos pronostics sur le site : https://fight-intelligence.vercel.app/`)

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2.5 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="surface-card flex max-h-[92vh] h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--line-soft)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#C8102E]/10 p-2 text-[#C8102E]">
              <Swords className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide text-[var(--text-main)] sm:text-lg">
                {L(i18n.language, 'Simulador de Card: Você vs. IA', 'Card Simulator: You vs. AI', 'Simulateur de carte : vous contre l\'IA')}
              </h2>
              <p className="theme-muted truncate text-xs">{event.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost-action grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Score & Agreement Banner */}
        <div className="border-b border-[var(--line-soft)] bg-[var(--surface-3)] px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs text-[var(--text-muted)]">{L(i18n.language, 'Palpites definidos', 'Picks made', 'Pronostics faits')}: </span>
                <span className="font-bold text-[var(--text-main)]">{stats.totalPicked} / {fights.length}</span>
              </div>
              <div className="h-3 w-px bg-[var(--line-soft)]" />
              <div>
                <span className="text-xs text-[var(--text-muted)]">{L(i18n.language, 'Concordância c/ IA', 'AI Agreement', 'Accord avec l\'IA')}: </span>
                <span className="font-bold text-[#F2C230]">{stats.agreementPct}%</span>
                <span className="text-xs text-[var(--text-muted)]"> ({stats.agreedWithAi}/{stats.totalWithAi})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stats.totalPicked > 0 ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-main)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {L(i18n.language, 'Limpar', 'Reset', 'Réinitialiser')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleShare}
                disabled={stats.totalPicked === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C8102E] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg transition hover:bg-[#a50d26] disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? L(i18n.language, 'Copiado!', 'Copied!', 'Copié !') : L(i18n.language, 'Compartilhar', 'Share', 'Partager')}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line-soft)]">
            <div
              className="h-full bg-gradient-to-r from-[#C8102E] to-[#F2C230] transition-all duration-300"
              style={{ width: `${(stats.totalPicked / (fights.length || 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Fights list */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {fights.map((fight, idx) => {
            const fightId = fight.fight_url ?? `${fight.fighter_1}_${fight.fighter_2}_${idx}`
            const userChoice = userPicks[fightId]
            const aiPick = pickFor?.(event.name, fight.fighter_1, fight.fighter_2)
            const isF1User = userChoice?.toLowerCase() === fight.fighter_1.toLowerCase()
            const isF2User = userChoice?.toLowerCase() === fight.fighter_2.toLowerCase()
            const isF1Ai = aiPick?.predicted_winner.toLowerCase() === fight.fighter_1.toLowerCase()
            const isF2Ai = aiPick?.predicted_winner.toLowerCase() === fight.fighter_2.toLowerCase()

            return (
              <div
                key={fightId}
                className="rounded-2xl border border-[var(--line-soft)] bg-[var(--tile-bg)] p-3 transition hover:border-[var(--rule)]"
              >
                {/* Weight class / Division */}
                <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span className="font-semibold uppercase tracking-wider">
                    {fight.weight_class ? getDivisionName(fight.weight_class, i18n.language) : L(i18n.language, 'Combate', 'Bout', 'Combat')}
                  </span>
                  {aiPick ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line-soft)] bg-[var(--surface-3)] px-2 py-0.5 text-[10px] text-[var(--text-main)]">
                      <Bot className="h-3 w-3 text-[#C8102E]" />
                      IA: <span className="font-bold text-[#F2C230]">{aiPick.predicted_winner}</span> ({Math.round(aiPick.probability * 100)}%)
                    </span>
                  ) : null}
                </div>

                {/* Fighters Choice Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Fighter 1 Button */}
                  <button
                    type="button"
                    onClick={() => handlePick(fightId, fight.fighter_1)}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition ${
                      isF1User
                        ? 'border-[#C8102E] bg-[#C8102E]/20 text-white shadow-md'
                        : 'border-[var(--line-soft)] bg-[var(--surface-3)] text-[var(--text-muted)] hover:border-[var(--rule)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isF1User ? <User className="h-3.5 w-3.5 text-[#C8102E]" /> : null}
                      <span className="text-sm font-bold uppercase">{fight.fighter_1}</span>
                    </div>
                    {isF1Ai ? (
                      <span className="mt-1 text-[10px] text-[#F2C230] font-medium">
                        ★ {L(i18n.language, 'Palpite da IA', 'AI Pick', 'Pronostic de l\'IA')}
                      </span>
                    ) : null}
                  </button>

                  {/* Fighter 2 Button */}
                  <button
                    type="button"
                    onClick={() => handlePick(fightId, fight.fighter_2)}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition ${
                      isF2User
                        ? 'border-[#2F5FA8] bg-[#2F5FA8]/20 text-white shadow-md'
                        : 'border-[var(--line-soft)] bg-[var(--surface-3)] text-[var(--text-muted)] hover:border-[var(--rule)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isF2User ? <User className="h-3.5 w-3.5 text-[var(--accent-blue)]" /> : null}
                      <span className="text-sm font-bold uppercase">{fight.fighter_2}</span>
                    </div>
                    {isF2Ai ? (
                      <span className="mt-1 text-[10px] text-[#F2C230] font-medium">
                        ★ {L(i18n.language, 'Palpite da IA', 'AI Pick', 'Pronostic de l\'IA')}
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Feedback line */}
                {userChoice && aiPick ? (
                  <div className="mt-2 text-center text-[11px]">
                    {userChoice.toLowerCase() === aiPick.predicted_winner.toLowerCase() ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <Check className="h-3 w-3" /> {L(i18n.language, 'Você e a IA concordam no vencedor', 'You agree with AI', 'Vous et l\'IA êtes d\'accord sur le vainqueur')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                        ⚡ {L(i18n.language, 'Seu palpite vai contra a IA (aposta na zebra)', 'Upset pick against AI', 'Votre pronostic va à l\'encontre de l\'IA (pari sur la surprise)')}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
