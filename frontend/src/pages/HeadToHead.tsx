import { useState } from 'react'
import { CalendarDays, LoaderCircle, Swords, Trophy } from 'lucide-react'

import { FighterSelect } from '../shared/components/FighterSelect'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useFighters } from '../shared/hooks/useFighters'
import { getHeadToHead } from '../shared/services/api'
import type { FightRecord, HeadToHeadResponse } from '../shared/types/api'

const METHOD_LABELS: Record<string, string> = {
  'U-DEC': 'Unanimous Decision',
  'S-DEC': 'Split Decision',
  'M-DEC': 'Majority Decision',
  'KO/TKO': 'Knockout',
  SUB: 'Submission',
  DQ: 'Disqualification',
}

export function HeadToHead() {
  const { fighters } = useFighters()
  const [fighterAName, setFighterAName] = useState('')
  const [fighterBName, setFighterBName] = useState('')
  const [result, setResult] = useState<HeadToHeadResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCompare = Boolean(fighterAName && fighterBName && fighterAName !== fighterBName)

  const handleCompare = async () => {
    if (!canCompare) {
      setError('Select two different fighters to search their head-to-head history.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getHeadToHead(fighterAName, fighterBName)
      setResult(data)
    } catch (requestError) {
      console.error(requestError)
      setError('Unable to load head-to-head history. Check whether the backend is available.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          eyebrow="Rivalry lookup"
          title="Head-to-head history"
          description="Pick two fighters to see every time they've met, who won, and how."
        />

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
          <FighterSelect
            label="Fighter A"
            corner="red"
            value={fighterAName}
            fighters={fighters}
            disabledFighterName={fighterBName}
            placeholder="Select first fighter"
            onChange={setFighterAName}
          />

          <div className="hidden justify-center pb-3.5 lg:flex">
            <span className="rounded-full border border-[#E81B23]/25 bg-[#E81B23]/10 px-3 py-1.5 text-xl font-bold uppercase text-[#E81B23]">
              VS
            </span>
          </div>

          <FighterSelect
            label="Fighter B"
            corner="blue"
            value={fighterBName}
            fighters={fighters}
            disabledFighterName={fighterAName}
            placeholder="Select second fighter"
            onChange={setFighterBName}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleCompare()}
          disabled={!canCompare || loading}
          className="primary-action mt-3 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
          {loading ? 'Searching...' : 'Find their history'}
        </button>

        {error ? (
          <p className="mt-3 rounded-xl border border-[#E81B23]/25 bg-[#E81B23]/8 px-3 py-2 text-sm text-[#FFFFFF]">
            {error}
          </p>
        ) : null}
      </section>

      {result ? <HeadToHeadResultView result={result} /> : null}
    </div>
  )
}

function HeadToHeadResultView({ result }: { result: HeadToHeadResponse }) {
  if (result.meetings.length === 0) {
    return (
      <section className="surface-card rounded-[20px] px-4 py-7 text-center">
        <p className="text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Never fought</p>
        <p className="mt-2 text-sm text-[#999999]">
          {result.fighter_a} and {result.fighter_b} have no recorded UFC meetings.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      <section className="surface-card rounded-[20px] p-4 text-center">
        <p className="broadcast-label text-[10px] text-[#999999]">
          {result.meetings.length} {result.meetings.length === 1 ? 'meeting' : 'meetings'}
        </p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="truncate text-right text-lg font-bold uppercase text-[#FFFFFF] sm:text-xl">{result.fighter_a}</p>
          <p className="data-value text-3xl font-bold text-[#E81B23] sm:text-4xl">
            {result.fighter_a_wins}-{result.fighter_b_wins}
            {result.no_contests ? `-${result.no_contests}` : ''}
          </p>
          <p className="truncate text-left text-lg font-bold uppercase text-[#FFFFFF] sm:text-xl">{result.fighter_b}</p>
        </div>
      </section>

      <section className="grid gap-2.5">
        {result.meetings.map((meeting, index) => (
          <MeetingRow key={`${meeting.event_name}-${index}`} meeting={meeting} fighterA={result.fighter_a} fighterB={result.fighter_b} />
        ))}
      </section>
    </div>
  )
}

function MeetingRow({ meeting, fighterA, fighterB }: { meeting: FightRecord; fighterA: string; fighterB: string }) {
  const winnerName = meeting.result === 'win' ? fighterA : meeting.result === 'loss' ? fighterB : null

  return (
    <article className="surface-card rounded-[18px] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#FFFFFF]">{meeting.event_name}</h3>
        {meeting.date ? (
          <span className="theme-muted inline-flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(meeting.date)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {winnerName ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#FFFFFF]">
            <Trophy className="h-4 w-4 text-[#E81B23]" />
            {winnerName} won
          </span>
        ) : (
          <span className="theme-muted">No official result</span>
        )}
        {meeting.weight_class ? <span className="selector-chip">{meeting.weight_class}</span> : null}
      </div>

      <p className="theme-muted mt-1.5 text-xs">{formatMethod(meeting)} {meeting.round ? `· R${meeting.round}` : ''} {meeting.time ?? ''}</p>
    </article>
  )
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMethod(meeting: FightRecord): string {
  if (!meeting.method) return 'Result pending'
  const label = METHOD_LABELS[meeting.method] ?? meeting.method
  return meeting.method_detail ? `${label} (${meeting.method_detail})` : label
}
