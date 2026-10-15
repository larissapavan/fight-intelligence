import { useState, type ReactNode } from 'react'
import { UserRound } from 'lucide-react'

import { getFighterImageUrl, useFighterImages } from '../hooks/useFighterImages'
import type { FighterProfile } from '../types/api'
import { ChampionBelt } from './ChampionBelt'

interface FighterCardProps {
  title: string
  accent: 'red' | 'blue'
  fighter?: FighterProfile | null
  children?: ReactNode
}

const accentStyles = {
  red: {
    line: 'corner-flag corner-flag--red',
    badge: 'border-[#D32F2F]/30 bg-[#D32F2F]/10 text-[#FF6B6B]',
    text: 'text-[#FF6B6B]',
  },
  blue: {
    line: 'corner-flag corner-flag--blue',
    badge: 'border-[#2F5FA8]/30 bg-[#2F5FA8]/10 text-[#8FB3E8]',
    text: 'text-[#8FB3E8]',
  },
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function FighterCard({ title, accent, fighter, children }: FighterCardProps) {
  const styles = accentStyles[accent]
  const { imageByName } = useFighterImages()
  const emptyLabel = accent === 'red' ? 'Select Red Corner Fighter' : 'Select Blue Corner Fighter'
  const imageUrl = fighter ? getFighterImageUrl(fighter.name, imageByName, fighter.image_url) : null
  const record = fighter ? `${fighter.wins ?? 0}-${fighter.losses ?? 0}${fighter.draws ? `-${fighter.draws}` : ''}` : null
  const subtitleParts = fighter
    ? [
        `${record} record`,
        fighter.nickname ? `"${fighter.nickname}"` : null,
        fighter.division ?? fighter.stance,
      ].filter(Boolean)
    : []

  return (
    <article className="surface-card group overflow-visible rounded-[22px] transition duration-300 hover:-translate-y-0.5 hover:border-white/16">
      <div className={styles.line} />
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <CornerPortrait fighter={fighter} accent={accent} imageUrl={imageUrl} />
            <div className="min-w-0">
            <p className={`broadcast-label text-[10px] ${styles.text}`}>{title}</p>
            <h3 className="theme-text mt-1.5 inline-flex max-w-full items-center gap-1.5 text-xl font-bold uppercase leading-none tracking-[0.03em] sm:text-2xl">
              <span className="min-w-0">{fighter?.name ?? emptyLabel}</span>
              {fighter?.belt ? <ChampionBelt /> : null}
            </h3>
            {fighter ? <p className="theme-muted mt-1.5 text-xs leading-5">{subtitleParts.join(' • ')}</p> : null}
            </div>
          </div>
          <span className={`type-tech w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${styles.badge}`}>
            {accent === 'red' ? 'Red corner' : 'Blue corner'}
          </span>
        </div>

        {children}

        {fighter ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#FFFFFF] min-[430px]:grid-cols-3">
            <Stat accent={accent} label="Age" value={fighter.age ? `${fighter.age.toFixed(1)} y` : '—'} />
            <Stat accent={accent} label="Height" value={fighter.height_cm ? `${fighter.height_cm.toFixed(0)} cm` : '—'} />
            <Stat accent={accent} label="Weight" value={fighter.weight_lbs ? `${fighter.weight_lbs.toFixed(0)} lbs` : '—'} />
            <Stat accent={accent} label="Reach" value={fighter.reach_cm ? `${fighter.reach_cm.toFixed(0)} cm` : '—'} />
            <Stat accent={accent} label="Record" value={record ?? '—'} />
            <Stat accent={accent} label="Win rate" value={formatPercent(fighter.win_rate)} />
            <Stat accent={accent} label="Striking" value={formatPercent(fighter.sig_str_acc)} />
            <Stat accent={accent} label="Takedowns" value={formatPercent(fighter.takedown_acc)} />
            <Stat accent={accent} label="Style" value={fighter.stance || 'Unknown'} />
            <Stat accent={accent} label="Bouts" value={fighter.total_fights ?? '—'} />
            <Stat accent={accent} label="Rank signal" value={fighter.rank_signal ?? (fighter.belt ? 'Champion' : '—')} />
          </div>
        ) : (
          <div className="theme-muted mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-3 py-4 text-left text-sm">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${accent === 'red' ? 'border-[#D32F2F]/20 bg-[#D32F2F]/8 text-[#FF6B6B]' : 'border-[#2F5FA8]/20 bg-[#2F5FA8]/8 text-[#8FB3E8]'}`}>
              <UserRound className="h-5 w-5" />
            </span>
            <span>
              <span className="theme-text block font-semibold">{emptyLabel}</span>
              <span className="theme-muted mt-1 block text-xs leading-5">Fighter statistics appear only after a fighter is selected.</span>
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

function CornerPortrait({
  fighter,
  accent,
  imageUrl,
}: {
  fighter?: FighterProfile | null
  accent: 'red' | 'blue'
  imageUrl?: string | null
}) {
  const imageKey = `${fighter?.name ?? ''}:${imageUrl ?? ''}`
  const [imageState, setImageState] = useState({ key: '', failed: false, loaded: false })
  const failed = imageState.key === imageKey && imageState.failed
  const loaded = imageState.key === imageKey && imageState.loaded
  const showImage = Boolean(fighter && imageUrl && !failed)
  const toneClass = accent === 'red' ? 'from-[#D32F2F]/34' : 'from-[#2F5FA8]/34'

  return (
    <span
      className={`relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-gradient-to-br ${toneClass} to-[var(--avatar-bg)]`}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={`${fighter?.name ?? 'Fighter'} profile`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageState({ key: imageKey, failed: false, loaded: true })}
          onError={() => setImageState({ key: imageKey, failed: true, loaded: false })}
          className={`absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
      {fighter && (!showImage || !loaded) ? (
        <span className={`type-display text-xl font-bold uppercase ${accent === 'red' ? 'text-[#FF6B6B]' : 'text-[#8FB3E8]'}`}>
          {getInitials(fighter.name)}
        </span>
      ) : null}
      {!fighter ? (
        <UserRound className="h-6 w-6 text-[var(--text-muted)]" />
      ) : null}
    </span>
  )
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent: 'red' | 'blue' }) {
  return (
    <div className={`metric-tile min-h-[56px] rounded-xl px-2.5 py-2 ${accent === 'blue' ? 'metric-tile--blue' : ''}`}>
      <p className="theme-muted broadcast-label text-[9px]">{label}</p>
      <p className="type-num theme-text mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}
