import { CalendarClock, Check, Scale, Target, X } from 'lucide-react'

import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { shownMetrics } from '../shared/data/modelAccuracy'
import { useModelInfo } from '../shared/hooks/useModelInfo'
import { useTrackRecord } from '../shared/hooks/useTrackRecord'
import type { ConfidenceBand, RecentEvaluation, TrackedFight } from '../shared/types/api'

const percent = (value: number | null | undefined) => (value == null ? '—' : `${Math.round(value * 100)}%`)

function formatDate(date: string | null | undefined) {
  if (!date) return '—'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TrackRecord() {
  const { data, loading, error } = useTrackRecord()
  const { modelInfo } = useModelInfo()
  const shown = shownMetrics(modelInfo)

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading level={1}
          eyebrow="Model report card"
          title="Track record"
          description="Every pick the model makes is saved before the fight and checked once the result is in. Nothing is back-filled, so these numbers are real predictions, not a replay."
        />
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[#FFFFFF]">{error}</p> : null}

      {loading ? (
        <LoadingSkeleton className="h-[220px]" />
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Summary">
            <Tile label="Picks logged" value={`${data.logged}`} />
            <Tile label="Settled" value={`${data.resolved}`} hint={data.pending ? `${data.pending} waiting` : undefined} />
            <Tile label="Live accuracy" value={percent(data.accuracy)} hint={data.resolved ? `${data.correct} of ${data.resolved}` : 'after the first card'} />
            <Tile label={shown.source === 'recent' ? 'Recent fights' : 'Reported test'} value={percent(shown.accuracy)} hint={shown.source === 'recent' ? `${shown.caption}, not live` : 'could not be checked'} />
          </section>

          {data.resolved === 0 ? <WaitingCard data={data} /> : null}

          {data.bands.length ? (
            <CalibrationCard title="Live picks: when the model says X%, how often is it right?" bands={data.bands} />
          ) : null}

          {modelInfo?.recent_evaluation?.baselines?.length ? <BaselineCard evaluation={modelInfo.recent_evaluation} /> : null}

          {modelInfo?.recent_evaluation?.calibration?.length ? (
            <CalibrationCard
              title="Back-test: when the model says X%, how often is it right?"
              note={`The same check on ${modelInfo.recent_evaluation.fights.toLocaleString('en-US')} recent fights. A well-calibrated model has the two bars level.`}
              bands={modelInfo.recent_evaluation.calibration}
            />
          ) : null}

          {data.recent.length ? (
            <FightList title="Recent results" fights={data.recent} />
          ) : null}
          {data.biggest_misses.length ? (
            <FightList title="Biggest misses" note="The most confident picks that were wrong." fights={data.biggest_misses} />
          ) : null}

          <section className="surface-card rounded-[20px] p-3 sm:p-4">
            <h2 className="broadcast-label text-xs text-[#FFFFFF]">How this is measured</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#FFFFFF] marker:text-[#C8102E]">
              <li>The daily update saves the model&apos;s pick and confidence for every announced fight, using each fighter&apos;s numbers that day.</li>
              <li>After the event the result is matched to the saved pick. Draws and no contests count for neither side.</li>
              <li>The recent-fights number is my own re-check of the model on past fights, using each fighter&apos;s age and record as of that fight. It is the best estimate until enough live picks are settled, but those fights were not predicted in advance, so live accuracy is the fairer test.</li>
              <li>A few dozen fights is a small sample. Read the live number as a trend, not a verdict.</li>
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
      <p className="type-display text-3xl leading-none text-[#FFFFFF]">{value}</p>
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFFFFF]">{label}</p>
      {hint ? <p className="theme-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}

function WaitingCard({ data }: { data: NonNullable<ReturnType<typeof useTrackRecord>['data']> }) {
  return (
    <section className="surface-card flex items-start gap-3 rounded-[20px] p-3 sm:p-4">
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#C8102E]" />
      <div>
        <h2 className="text-lg font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Waiting for the first results</h2>
        <p className="mt-1 text-[15px] leading-6 text-[#FFFFFF]">
          {data.pending
            ? `${data.pending} picks are saved and waiting for their fights${data.next_event ? `, starting with ${data.next_event.name} on ${formatDate(data.next_event.date)}` : ''}.`
            : 'No picks have been saved yet.'}{' '}
          {data.tracking_since ? `Tracking began on ${formatDate(data.tracking_since)}.` : ''}
        </p>
      </div>
    </section>
  )
}

function CalibrationCard({ title, note, bands }: { title: string; note?: string; bands: ConfidenceBand[] }) {
  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">{title}</h2>
      </div>
      {note ? <p className="theme-muted mt-0.5 text-xs">{note}</p> : null}
      <ul className="mt-3 grid gap-3">
        {bands.map((band) => (
          <li key={band.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[#FFFFFF]">
              <span className="font-bold">Confidence {band.label}</span>
              <span className="theme-muted text-xs">{band.fights} {band.fights === 1 ? 'fight' : 'fights'}</span>
            </div>
            <Bar label="Model said" value={band.average_confidence} tone="muted" />
            <Bar label="Actually right" value={band.accuracy} tone="strong" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BaselineCard({ evaluation }: { evaluation: RecentEvaluation }) {
  const rows = [
    { label: 'The model', accuracy: evaluation.accuracy, strong: true },
    ...(evaluation.baselines ?? []).map((rule) => ({ label: rule.label, accuracy: rule.accuracy, strong: false })),
  ].sort((a, b) => b.accuracy - a.accuracy)
  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[#FFFFFF]">Does it beat simple rules?</h2>
      </div>
      <p className="theme-muted mt-0.5 text-xs">
        Accuracy on the same {evaluation.fights.toLocaleString('en-US')} recent fights. A model is only worth something if it beats these.
      </p>
      <ul className="mt-3 grid gap-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm text-[#FFFFFF]">
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
    <div className="mt-1.5 grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-xs text-[#FFFFFF]">
      <span className="font-semibold">{label}</span>
      <div className="h-3 border-2 border-[var(--rule)] bg-[var(--surface-3)]">
        <div className={`h-full ${tone === 'strong' ? 'bg-[#C8102E]' : 'bg-[#F2C230]'}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="type-num text-right font-bold">{percent(value)}</span>
    </div>
  )
}

function FightList({ title, note, fights }: { title: string; note?: string; fights: TrackedFight[] }) {
  return (
    <section className="surface-card rounded-[20px] p-3 sm:p-4">
      <h2 className="broadcast-label text-xs text-[#FFFFFF]">{title}</h2>
      {note ? <p className="theme-muted mt-0.5 text-xs">{note}</p> : null}
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {fights.map((fight) => (
          <li key={`${fight.event_date}-${fight.fighter_1}-${fight.fighter_2}`} className="metric-tile flex items-center gap-3 px-3 py-2.5">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center ${fight.correct ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'bg-[#C8102E] text-white'}`}
              title={fight.correct ? 'Right' : 'Wrong'}
            >
              {fight.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              <span className="sr-only">{fight.correct ? 'Right pick' : 'Wrong pick'}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug text-[#FFFFFF]">
                {fight.fighter_1} <span className="font-normal">vs.</span> {fight.fighter_2}
              </p>
              <p className="theme-muted text-xs leading-5">
                Picked {fight.predicted_winner} ({percent(fight.confidence)}) · won by {fight.winner ?? '—'} · {formatDate(fight.event_date)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
