import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Trophy } from 'lucide-react'

import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { useRecordBook } from '../shared/hooks/useRecordBook'
import type { RecordBookCategory, RecordBookStat } from '../shared/types/api'

const CATEGORY_BLURBS: Record<string, string> = {
  Fights: 'Wins, finishes, streaks and title wins across a whole career.',
  Time: 'How long fights last and how much of that time a fighter spends in control.',
  Striking: 'Significant strikes, accuracy, defense and knockdowns.',
  Grappling: 'Takedowns, takedown defense and submission attempts.',
}

const CATEGORY_NAMES_PT: Record<string, string> = {
  Fights: 'Lutas & Vitórias',
  Time: 'Tempo de Combate',
  Striking: 'Golpes & Trocação',
  Grappling: 'Quedas & Chão',
}

const STAT_TITLES_PT: Record<string, string> = {
  TotalFights: 'Total de Lutas',
  Wins: 'Vitórias',
  Finishes: 'Vitórias pela Via Rápida (Nocautes e Finalizações)',
  KOTKOWins: 'Vitórias por Nocaute (KO/TKO)',
  SubmissionWins: 'Vitórias por Finalização',
  DecisionWins: 'Vitórias por Decisão',
  WinStreak: 'Maior Sequência de Vitórias',
  TitleFightWins: 'Vitórias em Disputas de Cinturão',
  TotalAwards: 'Total de Bônus da Noite',
  AverageFightTimeShort: 'Menor Média de Tempo de Luta',
  AverageFightTimeLong: 'Maior Média de Tempo de Luta',
  TotalFightTime: 'Tempo Total de Luta no Octógono',
  ControlTime: 'Tempo Total de Controle',
  ControlTimePercentage: 'Porcentagem de Tempo de Controle',
  TopPositionTime: 'Tempo de Controle por Cima no Chão',
  TopPositionTimePercentage: 'Porcentagem de Tempo por Cima no Chão',
  BottomPositionTime: 'Tempo de Chão por Baixo',
  BottomPositionTimePercentage: 'Porcentagem de Tempo por Baixo',
  Knockdowns: 'Knockdowns Aplicados',
  KnockdownsAverage: 'Média de Knockdowns (por 15 min)',
  SigStrikesLanded: 'Golpes Traumáticos Conectados',
  SigStrikesAccuracy: 'Precisão de Golpes Traumáticos',
  SLpM: 'Golpes Traumáticos Conectados por Minuto',
  SignificantStrikesDifferential: 'Saldo Diferencial de Golpes Traumáticos',
  SignificantStrikesDefense: 'Defesa de Golpes Traumáticos',
  SApM: 'Golpes Traumáticos Absorvidos por Minuto',
  TotalStrikesLanded: 'Total de Golpes Conectados',
  TakedownsLanded: 'Quedas Aplicadas',
  TakedownsAccuracy: 'Precisão de Quedas',
  TakedownsDefense: 'Defesa de Quedas',
  SubmissionsAttempted: 'Tentativas de Finalização',
  SubmissionsAverage: 'Média de Tentativas de Finalização (por 15 min)',
}

const STAT_NOTES_PT: Record<string, string> = {
  'Minimum 5 UFC Fights': 'Mínimo de 5 lutas no UFC',
  'Minimum 5 UFC Fights and 500 Significant Strike Attempts': 'Mínimo de 5 lutas no UFC e 500 tentativas de golpes traumáticos',
  'Minimum 5 UFC Fights and 500 Strike Attempts by Opponents': 'Mínimo de 5 lutas no UFC e 500 tentativas de golpes pelos oponentes',
  'Minimum 5 UFC Fights and 20 Takedown Attempts': 'Mínimo de 5 lutas no UFC e 20 tentativas de queda',
  'Minimum 5 UFC Fights and 20 Takedown Attempts by Opponent': 'Mínimo de 5 lutas no UFC e 20 tentativas de queda pelo oponente',
}

export function RecordBook() {
  const { t, i18n } = useTranslation()
  const isPt = Boolean(i18n.language?.startsWith('pt'))
  const { data, loading, error } = useRecordBook()
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)

  const categories = data?.categories ?? []
  const active: RecordBookCategory | undefined = categories.find((category) => category.name === categoryName) ?? categories[0]

  const getBlurb = (name?: string) => {
    if (!name) return ''
    const key = `recordBook.blurbs.${name}`
    const translated = t(key)
    return translated !== key ? translated : (CATEGORY_BLURBS[name] ?? '')
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={t('recordBook.eyebrow')}
          title={t('recordBook.title')}
          description={t('recordBook.description')}
        />

        {categories.length ? (
          <div role="group" aria-label={isPt ? 'Categorias de recordes' : 'Record categories'} className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll">
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                aria-pressed={category.name === active?.name}
                onClick={() => setCategoryName(category.name)}
                className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition sm:px-5 ${
                  category.name === active?.name
                    ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                    : 'text-[var(--text-main)] hover:bg-[#F2C230] hover:text-[#0E0E0E]'
                }`}
              >
                {isPt ? (CATEGORY_NAMES_PT[category.name] ?? category.name) : category.name}
                <span className="ml-1.5 opacity-70">{category.stats.length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {active ? <p className="mt-2 text-sm text-[#999999]">{getBlurb(active.name)}</p> : null}
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[48px]" />
          ))}
        </section>
      ) : active ? (
        <section className="grid gap-2.5">
          {active.stats.map((stat) => (
            <StatCard key={stat.key} stat={stat} onOpenProfile={setProfileName} isPt={isPt} />
          ))}
        </section>
      ) : null}

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

function StatCard({ stat, onOpenProfile, isPt }: { stat: RecordBookStat; onOpenProfile: (name: string) => void; isPt: boolean }) {
  const [open, setOpen] = useState(false)
  const panelId = `stat-${stat.key}`
  const title = isPt ? (STAT_TITLES_PT[stat.key] ?? stat.title) : stat.title
  const note = isPt && stat.note ? (STAT_NOTES_PT[stat.note] ?? stat.note) : stat.note

  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03] sm:px-4"
      >
        <Trophy className="h-4 w-4 shrink-0 text-[#C8102E]" />
        <h3 className="broadcast-label text-xs text-[var(--text-main)]">{title}</h3>
        <span className="theme-muted text-xs">({stat.leaders.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {note ? <p className="theme-muted mb-2 text-[11px] leading-4">{note}</p> : null}
          <ol className="lg:columns-2 lg:gap-x-8">
            {stat.leaders.map((leader, index) => (
              <li key={`${leader.rank}-${leader.fighter}-${index}`} className="break-inside-avoid">
                <LeaderRow leader={leader} onOpenProfile={onOpenProfile} isPt={isPt} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

function LeaderRow({
  leader,
  onOpenProfile,
  isPt,
}: {
  leader: RecordBookStat['leaders'][number]
  onOpenProfile: (name: string) => void
  isPt: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(leader.fighter)}
      aria-label={isPt ? `${leader.fighter}, #${leader.rank}. Ver perfil` : `${leader.fighter}, rank ${leader.rank}. View profile`}
      className="flex w-full cursor-pointer items-center text-left gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none"
    >
      <span className="type-num w-4 shrink-0 text-right text-[11px] text-[#999999]">{leader.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-main)]">{leader.fighter}</p>
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[var(--text-main)]">{leader.value}</span>
    </button>
  )
}
