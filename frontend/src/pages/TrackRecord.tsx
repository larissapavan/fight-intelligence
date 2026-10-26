import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Check, RefreshCw, Scale, Target, X } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { useTrackRecord } from '../shared/hooks/useTrackRecord'
import { syncTrackRecord } from '../shared/services/api'
import type { ConfidenceBand, RecentEvaluation, TrackedFight } from '../shared/types/api'

const percent = (value: number | null | undefined) => (value == null ? '—' : `${Math.round(value * 100)}%`)

function formatDate(date: string | null | undefined, lang: string = 'en-US') {
  if (!date) return '—'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(lang === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TrackRecord() {
  const { t, i18n } = useTranslation()
  const { data, loading, error, reload } = useTrackRecord()
  const { modelInfo } = useModelInfo()
  const shown = shownMetrics(modelInfo)
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await syncTrackRecord()
      const msg = isPt
        ? `Sincronização concluída: ${res.settled_count} lutas liquidadas, ${res.new_logged_count} novas lutas registradas. Total liquidadas: ${res.total_resolved}.`
        : `Sync complete: ${res.settled_count} fights settled, ${res.new_logged_count} new logged. Total settled: ${res.total_resolved}.`
      setSyncMessage({ type: 'success', text: msg })
      await reload()
    } catch (err) {
      console.error(err)
      setSyncMessage({
        type: 'error',
        text: isPt ? 'Falha ao sincronizar resultados com o servidor.' : 'Failed to sync results with the server.',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={t('trackRecord.eyebrow')}
          title={t('trackRecord.title')}
          description={t('trackRecord.description')}
        />
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="ghost-action flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/[0.1] disabled:opacity-50 transition shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin text-[#F2C230]' : 'text-[#CCCCCC]'}`} />
          {syncing ? t('trackRecord.syncing') : t('trackRecord.syncButton')}
        </button>
      </section>

      {syncMessage ? (
        <div
          className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
            syncMessage.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border border-[#C8102E]/30 bg-[#C8102E]/10 text-white'
          }`}
        >
          {syncMessage.text}
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p> : null}

      {loading ? (
        <LoadingSkeleton className="h-[220px]" />
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label={isPt ? 'Resumo de desempenho' : 'Summary'}>
            <Tile label={t('trackRecord.picksLogged')} value={`${data.logged}`} />
            <Tile label={t('trackRecord.settled')} value={`${data.resolved}`} hint={data.pending ? `${data.pending} ${t('trackRecord.waiting')}` : undefined} />
            <Tile label={t('trackRecord.liveAccuracy')} value={percent(data.accuracy)} hint={data.resolved ? `${data.correct} de ${data.resolved}` : (isPt ? 'após o primeiro card' : 'after the first card')} />
            <Tile label={shown.source === 'recent' ? t('trackRecord.recentFights') : t('trackRecord.reported')} value={percent(shown.accuracy)} hint={shown.source === 'recent' ? `${shown.caption}` : undefined} />
          </section>

          {data.resolved === 0 ? <WaitingCard data={data} /> : null}

          {data.bands.length ? (
            <CalibrationCard title={isPt ? 'Calibração ao Vivo: taxa real de acerto por faixa de confiança' : 'Live picks: when the model says X%, how often is it right?'} bands={data.bands} />
          ) : null}

          {modelInfo?.recent_evaluation?.baselines?.length ? <BaselineCard evaluation={modelInfo.recent_evaluation} /> : null}

          {modelInfo?.recent_evaluation?.calibration?.length ? (
            <CalibrationCard
              title={isPt ? 'Calibração no Backtest Histórico' : 'Back-test: when the model says X%, how often is it right?'}
              note={isPt ? `Validação estatística em ${modelInfo.recent_evaluation.fights.toLocaleString('pt-BR')} combates recentes.` : `The same check on ${modelInfo.recent_evaluation.fights.toLocaleString('en-US')} recent fights.`}
              bands={modelInfo.recent_evaluation.calibration}
            />
          ) : null}

          {data.recent.length ? (
            <FightList title={t('trackRecord.recentResults')} fights={data.recent} />
          ) : null}
          {data.biggest_misses.length ? (
            <FightList title={t('trackRecord.biggestMisses')} note={t('trackRecord.biggestMissesNote')} fights={data.biggest_misses} />
          ) : null}

          <section className="surface-card rounded-[20px] p-3 sm:p-4">
            <h2 className="broadcast-label text-xs text-[var(--text-main)]">{t('trackRecord.howMeasured')}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--text-main)] marker:text-[#C8102E]">
              {isPt ? (
                <>
                  <li>Cada combate anunciado tem seu palpite e probabilidade registrados antes do card, utilizando apenas os números históricos dos lutadores até aquela data.</li>
                  <li>Assim que o evento termina, o resultado oficial é confrontado com o palpite prévio. Empates e lutas sem resultado (No Contest) são desconsiderados.</li>
                  <li>As previsões ao vivo são o teste definitivo de desempenho no mundo real, sem qualquer viés retrospectivo.</li>
                </>
              ) : (
                <>
                  <li>The daily update saves the model&apos;s pick and confidence for every announced fight, using each fighter&apos;s numbers that day.</li>
                  <li>After the event the result is matched to the saved pick. Draws and no contests count for neither side.</li>
                  <li>Live picks are the true measure of predictive skill, evaluated strictly forward in time.</li>
                </>
              )}
              {data.earlier_model_note ? <li>{data.earlier_model_note}</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric-tile px-3 py-3">
      <p className="type-display text-3xl leading-none text-[var(--text-main)]">{value}</p>
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-main)]">{label}</p>
      {hint ? <p className="theme-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}

function WaitingCard({ data }: { data: NonNullable<ReturnType<typeof useTrackRecord>['data']> }) {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <section className="surface-card flex items-start gap-3 rounded-[20px] p-3 sm:p-4">
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#C8102E]" />
      <div>
        <h2 className="text-lg font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{t('trackRecord.waitingTitle')}</h2>
        <p className="mt-1 text-[15px] leading-6 text-[var(--text-main)]">
          {data.pending
            ? (isPt
                ? `${data.pending} palpites gravados aguardando a realização das lutas${data.next_event ? `, começando por ${data.next_event.name} em ${formatDate(data.next_event.date, i18n.language)}` : ''}.`
                : `${data.pending} picks are saved and waiting for their fights${data.next_event ? `, starting with ${data.next_event.name} on ${formatDate(data.next_event.date, i18n.language)}` : ''}.`)
            : (isPt ? 'Nenhum palpite foi salvo ainda.' : 'No picks have been saved yet.')}{' '}
          {data.tracking_since ? (isPt ? `Rastreamento iniciado em ${formatDate(data.tracking_since, i18n.language)}.` : `Tracking began on ${formatDate(data.tracking_since, i18n.language)}.`) : ''}
        </p>
      </div>
    </section>
  )
}

function CalibrationCard({ title, note, bands }: { title: string; note?: string; bands: ConfidenceBand[] }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{title}</h2>
      </div>
      {note ? <p className="theme-muted mt-0.5 text-xs">{note}</p> : null}
      <ul className="mt-3 grid gap-3">
        {bands.map((band) => (
          <li key={band.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--text-main)]">
              <span className="font-bold">{isPt ? 'Faixa de Confiança' : 'Confidence'} {band.label}</span>
              <span className="theme-muted text-xs">{band.fights} {isPt ? 'lutas' : (band.fights === 1 ? 'fight' : 'fights')}</span>
            </div>
            <Bar label={isPt ? 'Probabilidade média projetada' : 'Model said'} value={band.average_confidence} tone="muted" />
            <Bar label={isPt ? 'Taxa real de acerto' : 'Actually right'} value={band.accuracy} tone="strong" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BaselineCard({ evaluation }: { evaluation: RecentEvaluation }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  const rows = [
    { label: isPt ? 'Modelo de IA (UFC Predictor)' : 'The model', accuracy: evaluation.accuracy, strong: true },
    ...(evaluation.baselines ?? []).map((rule) => ({ label: rule.label, accuracy: rule.accuracy, strong: false })),
  ].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">
          {isPt ? 'Supera métodos estatísticos tradicionais?' : 'Does it beat simple rules?'}
        </h2>
      </div>
      <p className="theme-muted mt-0.5 text-xs">
        {isPt
          ? `Acurácia nas mesmas ${evaluation.fights.toLocaleString('pt-BR')} lutas recentes. O modelo só agrega valor real se superar estas referências clássicas.`
          : `Accuracy on the same ${evaluation.fights.toLocaleString('en-US')} recent fights. A model is only worth something if it beats these.`}
      </p>
      <ul className="mt-3 grid gap-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--text-main)]">
              <span className={row.strong ? 'font-bold' : ''}>{row.label}</span>
              <span className="type-num font-bold">{percent(row.accuracy)}</span>
            </div>
            <div className="mt-1 h-3 border-2 border-[var(--rule)] bg-[var(--surface-3)]">
              <div className={`h-full ${row.strong ? 'bg-[#C8102E]' : 'bg-[#F2C230]'}`} style={{ width: `${Math.round(row.accuracy * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Bar({ label, value, tone }: { label: string; value: number; tone: 'muted' | 'strong' }) {
  return (
    <div className="mt-1.5 grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-xs text-[var(--text-main)]">
      <span className="font-semibold">{label}</span>
      <div className="h-3 border-2 border-[var(--rule)] bg-[var(--surface-3)]">
        <div className={`h-full ${tone === 'strong' ? 'bg-[#C8102E]' : 'bg-[#F2C230]'}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="type-num text-right font-bold">{percent(value)}</span>
    </div>
  )
}

function FightList({ title, note, fights }: { title: string; note?: string; fights: TrackedFight[] }) {
  const { i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))

  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <h2 className="broadcast-label text-xs text-[var(--text-main)]">{title}</h2>
      {note ? <p className="theme-muted mt-0.5 text-xs">{note}</p> : null}
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {fights.map((fight) => (
          <li key={`${fight.event_date}-${fight.fighter_1}-${fight.fighter_2}`} className="metric-tile flex items-center gap-3 px-3 py-2.5">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center ${fight.correct ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'bg-[#C8102E] text-white'}`}
              title={fight.correct ? (isPt ? 'Acerto' : 'Right') : (isPt ? 'Erro' : 'Wrong')}
            >
              {fight.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug text-[var(--text-main)]">
                {fight.fighter_1} <span className="font-normal">vs.</span> {fight.fighter_2}
              </p>
              <p className="theme-muted text-xs leading-5">
                {isPt ? 'Previu' : 'Picked'} {fight.predicted_winner} ({percent(fight.confidence)}) · {isPt ? 'vencedor' : 'won by'} {fight.winner ?? '—'} · {formatDate(fight.event_date, i18n.language)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
