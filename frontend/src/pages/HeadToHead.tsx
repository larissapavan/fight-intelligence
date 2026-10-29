import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, ArrowRight, CalendarDays, LoaderCircle, Share2, Sparkles, Swords, Trophy, Users } from 'lucide-react'

import { L, localeTag, uiLang } from '../i18n/lang'
import { getDivisionName } from '../shared/data/divisions'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { FighterSelect } from '../shared/components/FighterSelect'
import { SectionHeading } from '../shared/components/SectionHeading'
import { EditorialHeadToHeadSimulator } from '../shared/components/editorial/EditorialHeadToHeadSimulator'
import { useFighters } from '../shared/hooks/useFighters'
import { getHeadToHead, getOpponents } from '../shared/services/api'
import type { FightRecord, HeadToHeadResponse, Opponent } from '../shared/types/api'

const METHOD_LABELS_EN: Record<string, string> = {
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  'KO/TKO': 'Knockout',
  SUB: 'Submission',
  DQ: 'Disqualification',
}

const METHOD_LABELS_PT: Record<string, string> = {
  'U-DEC': 'Decisão Unânime',
  'S-DEC': 'Decisão Dividida',
  'M-DEC': 'Decisão Majoritária',
  'KO/TKO': 'Nocaute (KO/TKO)',
  SUB: 'Finalização',
  DQ: 'Desqualificação',
}

const METHOD_LABELS_FR: Record<string, string> = {
  'U-DEC': 'Décision unanime',
  'S-DEC': 'Décision partagée',
  'M-DEC': 'Décision majoritaire',
  'KO/TKO': 'KO/TKO',
  SUB: 'Soumission',
  DQ: 'Disqualification',
}

function useOpponents(fighterName: string): Opponent[] {
  const [loaded, setLoaded] = useState<{ name: string; opponents: Opponent[] } | null>(null)

  useEffect(() => {
    if (!fighterName) return
    let cancelled = false
    getOpponents(fighterName)
      .then((opponents) => {
        if (!cancelled) setLoaded({ name: fighterName, opponents })
      })
      .catch((requestError) => console.error(requestError))
    return () => {
      cancelled = true
    }
  }, [fighterName])

  return loaded && loaded.name === fighterName ? loaded.opponents : []
}

export function HeadToHead() {
  const { t, i18n } = useTranslation()
  const { fighters } = useFighters()
  const [searchParams, setSearchParams] = useSearchParams()
  const presetA = searchParams.get('a') || searchParams.get('fighter_a') || ''
  const presetB = searchParams.get('b') || searchParams.get('fighter_b') || ''
  const [fighterAName, setFighterAName] = useState(() => presetA)
  const [fighterBName, setFighterBName] = useState(() => presetB)
  const [result, setResult] = useState<HeadToHeadResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'editorial' | 'classic'>('editorial')

  const chooseFighter = (side: 'a' | 'b', value: string) => {
    if (side === 'a') setFighterAName(value)
    else setFighterBName(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set(side, value)
    else next.delete(side)
    setSearchParams(next, { replace: true })
  }

  const swapCorners = () => {
    if (!fighterAName && !fighterBName) return
    const nextA = fighterBName
    const nextB = fighterAName
    setFighterAName(nextA)
    setFighterBName(nextB)
    const next = new URLSearchParams(searchParams)
    if (nextA) next.set('a', nextA)
    else next.delete('a')
    if (nextB) next.set('b', nextB)
    else next.delete('b')
    setSearchParams(next, { replace: true })
  }

  const opponentsOfA = useOpponents(fighterAName)
  const opponentsOfB = useOpponents(fighterBName)
  const suggestionsForB = useMemo(
    () => (fighterAName && opponentsOfA.length ? { label: fighterAName, opponents: opponentsOfA } : undefined),
    [fighterAName, opponentsOfA],
  )
  const suggestionsForA = useMemo(
    () => (fighterBName && opponentsOfB.length ? { label: fighterBName, opponents: opponentsOfB } : undefined),
    [fighterBName, opponentsOfB],
  )

  const canCompare = Boolean(fighterAName && fighterBName && fighterAName !== fighterBName)

  const handleCompare = async (a = fighterAName, b = fighterBName) => {
    if (!a || !b || a === b) {
      setError(t('predictor.selectTwoDifferent'))
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getHeadToHead(a, b)
      setResult(data)
    } catch (requestError) {
      console.error(requestError)
      setError(
        L(
          i18n.language,
          'Não foi possível carregar o histórico de confrontos. Verifique se o servidor está disponível.',
          'Unable to load head-to-head history. Check whether the backend is available.',
          'Impossible de charger l’historique des confrontations. Vérifiez si le serveur est disponible.',
        ),
      )
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!presetA || !presetB || presetA === presetB) return
    void handleCompare(presetA, presetB)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      {/* Editorial vs Classic Mode Switcher */}
      <div className="surface-card flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0c0d12]/90 px-4 py-3 shadow-sm text-[var(--text-primary)] dark:text-zinc-300">
        <span className="font-['Anton','Barlow_Condensed',Impact,sans-serif] text-sm uppercase tracking-widest text-zinc-300">
          {L(i18n.language, 'Modo de Confronto', 'Matchup Mode', 'Mode de confrontation')}
        </span>
        <div className="inline-flex rounded-xl bg-[var(--bg-surface-subtle)] dark:bg-black/40 p-1 border border-[var(--border-subtle)] dark:border-white/10">
          <button
            type="button"
            onClick={() => setViewMode('editorial')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              viewMode === 'editorial'
                ? 'bg-[#E11D48] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tale of the Tape ✨
          </button>
          <button
            type="button"
            onClick={() => setViewMode('classic')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              viewMode === 'classic'
                ? 'bg-zinc-700 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {L(i18n.language, 'Histórico Completo', 'Full History', 'Historique complet')}
          </button>
        </div>
      </div>

      {viewMode === 'editorial' ? (
        <EditorialHeadToHeadSimulator
          initialFighterA={fighterAName || 'Alex Pereira'}
          initialFighterB={fighterBName || 'Magomed Ankalaev'}
          onSelectFighterA={(name) => chooseFighter('a', name)}
          onSelectFighterB={(name) => chooseFighter('b', name)}
        />
      ) : (
        <>
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={t('headToHead.eyebrow')}
          title={t('headToHead.title')}
          description={t('headToHead.description')}
        />

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
          <FighterSelect
            label={t('headToHead.fighterA')}
            corner="red"
            value={fighterAName}
            fighters={fighters}
            disabledFighterName={fighterBName}
            placeholder={t('headToHead.selectFirst')}
            suggestions={suggestionsForA}
            onChange={(val) => chooseFighter('a', val)}
          />

          <div className="hidden justify-center pb-2.5 lg:flex">
            <button
              type="button"
              onClick={swapCorners}
              disabled={!fighterAName && !fighterBName}
              title={L(i18n.language, 'Inverter lutadores', 'Swap fighters', 'Inverser les lutteurs')}
              aria-label={L(i18n.language, 'Inverter lutadores', 'Swap fighters', 'Inverser les lutteurs')}
              className={`type-display group relative inline-flex items-center justify-center rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-3 py-1.5 text-xl font-bold uppercase text-[#C8102E] transition ${
                fighterAName || fighterBName ? 'cursor-pointer hover:bg-[#C8102E] hover:text-white' : 'cursor-default'
              }`}
            >
              <span className={fighterAName || fighterBName ? 'group-hover:opacity-0 transition-opacity' : ''}>{t('common.vs')}</span>
              {fighterAName || fighterBName ? (
                <ArrowLeftRight className="absolute h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </button>
          </div>

          <FighterSelect
            label={t('headToHead.fighterB')}
            corner="blue"
            value={fighterBName}
            fighters={fighters}
            disabledFighterName={fighterAName}
            placeholder={t('headToHead.selectSecond')}
            suggestions={suggestionsForB}
            onChange={(val) => chooseFighter('b', val)}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleCompare()}
          disabled={!canCompare || loading}
          className="primary-action mt-3 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
          {loading ? t('headToHead.searching') : t('headToHead.findHistory')}
        </button>

        {error ? (
          <p className="mt-3 rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">
            {error}
          </p>
        ) : null}
      </section>

      {result ? <HeadToHeadResultView result={result} onOpenProfile={setProfileName} /> : null}
        </>
      )}

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

function HeadToHeadResultView({ result, onOpenProfile }: { result: HeadToHeadResponse; onOpenProfile: (name: string) => void }) {
  const { t, i18n } = useTranslation()

  if (result.meetings.length === 0) {
    return (
      <div className="space-y-3">
        <section className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{t('headToHead.neverFought')}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {t('headToHead.neverFoughtDesc', { fighterA: result.fighter_a, fighterB: result.fighter_b })}
          </p>
        </section>

        {result.network_path.length > 0 ? <NetworkPathCard result={result} onOpenProfile={onOpenProfile} /> : null}
        {result.common_opponents.length > 0 ? <CommonOpponentsCard result={result} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <section className="surface-card rounded-[20px] p-4 text-center">
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
          {L(i18n.language, `${result.meetings.length} ${result.meetings.length === 1 ? 'confronto' : 'confrontos'}`, `${result.meetings.length} ${result.meetings.length === 1 ? 'meeting' : 'meetings'}`, `${result.meetings.length} ${result.meetings.length === 1 ? 'affrontement' : 'affrontements'}`)}
        </p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile(result.fighter_a)}
            className="type-display cursor-pointer truncate text-right text-lg font-bold uppercase text-[var(--text-main)] hover:text-[#C8102E] hover:underline sm:text-xl"
          >
            {result.fighter_a}
          </button>
          <p className="data-value text-3xl font-bold text-[#C8102E] sm:text-4xl">
            {result.fighter_a_wins}-{result.fighter_b_wins}
            {result.no_contests ? `-${result.no_contests}` : ''}
          </p>
          <button
            type="button"
            onClick={() => onOpenProfile(result.fighter_b)}
            className="type-display cursor-pointer truncate text-left text-lg font-bold uppercase text-[var(--text-main)] hover:text-[#C8102E] hover:underline sm:text-xl"
          >
            {result.fighter_b}
          </button>
        </div>
      </section>

      <section className="grid gap-2.5">
        {result.meetings.map((meeting, index) => (
          <MeetingRow key={`${meeting.event_name}-${index}`} meeting={meeting} fighterA={result.fighter_a} fighterB={result.fighter_b} />
        ))}
      </section>

      {result.common_opponents.length > 0 ? <CommonOpponentsCard result={result} /> : null}
    </div>
  )
}

function NetworkPathCard({ result, onOpenProfile }: { result: HeadToHeadResponse; onOpenProfile: (name: string) => void }) {
  const { i18n } = useTranslation()
  const degrees = result.degrees_of_separation ?? 0

  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#C8102E]">
        <Share2 className="h-4 w-4" />
        <p className="broadcast-label text-[11px]">
          {L(i18n.language, `Conexão pela rede de lutas • ${degrees} grau${degrees === 1 ? '' : 's'} de separação`, `Bout network path • ${degrees} degree${degrees === 1 ? '' : 's'} of separation`, `Réseau de combats • ${degrees} degré${degrees === 1 ? '' : 's'} de séparation`)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {result.network_path.map((name, index) => {
          const isEndpoint = index === 0 || index === result.network_path.length - 1
          return (
            <div key={`${name}-${index}`} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenProfile(name)}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition hover:border-[#F2C230] ${
                  isEndpoint ? 'border-[#C8102E]/25 bg-[#C8102E]/10 text-[var(--accent-red)]' : 'border-[var(--line-soft)] bg-[var(--surface-3)] text-[var(--text-main)]'
                }`}
              >
                {name}
              </button>
              {index < result.network_path.length - 1 ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#666666]" /> : null}
            </div>
          )
        })}
      </div>
    </article>
  )
}

function CommonOpponentsCard({ result }: { result: HeadToHeadResponse }) {
  const { i18n } = useTranslation()
  return (
    <article className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#C8102E]">
        <Users className="h-4 w-4" />
        <p className="broadcast-label text-[11px]">{L(i18n.language, `Adversários em comum (${result.common_opponents.length})`, `Common opponents (${result.common_opponents.length})`, `Adversaires communs (${result.common_opponents.length})`)}</p>
      </div>
      <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-2.5 gap-y-1.5">
        <span />
        <span className="type-tech text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-red)]">{lastWord(result.fighter_a)}</span>
        <span className="type-tech text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-blue)]">{lastWord(result.fighter_b)}</span>
        {result.common_opponents.map((common) => (
          <Fragment key={common.opponent}>
            <span className="min-w-0 truncate rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-main)]">
              {common.opponent}
            </span>
            <ResultChip result={common.fighter_a_result} />
            <ResultChip result={common.fighter_b_result} />
          </Fragment>
        ))}
      </div>
    </article>
  )
}

function ResultChip({ result }: { result: 'win' | 'loss' | null }) {
  const { i18n } = useTranslation()

  if (result === 'win') {
    return (
      <span className="type-tech justify-self-end rounded-full border border-[#C8102E]/25 bg-[#C8102E]/10 px-2 py-0.5 text-[11px] font-bold uppercase text-[#C8102E]">
        {L(i18n.language, 'Vitória', 'Win', 'Victoire')}
      </span>
    )
  }
  if (result === 'loss') {
    return (
      <span className="type-tech justify-self-end rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
        {L(i18n.language, 'Derrota', 'Loss', 'Défaite')}
      </span>
    )
  }
  return (
    <span className="type-tech justify-self-end rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">
      NC
    </span>
  )
}

function lastWord(fullName: string) {
  return fullName.trim().split(' ').slice(-1)[0] ?? fullName
}

function MeetingRow({ meeting, fighterA, fighterB }: { meeting: FightRecord; fighterA: string; fighterB: string }) {
  const { i18n } = useTranslation()
  const winnerName = meeting.result === 'win' ? fighterA : meeting.result === 'loss' ? fighterB : null

  return (
    <article className="surface-card rounded-[18px] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">{meeting.event_name}</h3>
        {meeting.date ? (
          <span className="theme-muted inline-flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(meeting.date, i18n.language)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {winnerName ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
            <Trophy className="h-4 w-4 text-[#C8102E]" />
            {winnerName} {L(i18n.language, 'venceu', 'won', 'a gagné')}
          </span>
        ) : (
          <span className="theme-muted">{L(i18n.language, 'Sem resultado oficial', 'No official result', 'Pas de résultat officiel')}</span>
        )}
        {meeting.weight_class ? <span className="selector-chip">{getDivisionName(meeting.weight_class, i18n.language)}</span> : null}
      </div>

      <p className="theme-muted mt-1.5 text-xs">{formatMethod(meeting, i18n.language)} {meeting.round ? `· R${meeting.round}` : ''} {meeting.time ?? ''}</p>
    </article>
  )
}

function formatDate(date: string, lang: string = 'en-US'): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(localeTag(lang), { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMethod(meeting: FightRecord, language: string | boolean = false): string {
  if (!meeting.method) return L(language, 'Resultado a definir', 'Result pending', 'Résultat en attente')
  const lang = uiLang(language)
  const labels = lang === 'pt' ? METHOD_LABELS_PT : lang === 'fr' ? METHOD_LABELS_FR : METHOD_LABELS_EN
  const label = labels[meeting.method] ?? meeting.method
  return meeting.method_detail ? `${label} (${meeting.method_detail})` : label
}
