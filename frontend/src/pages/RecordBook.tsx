import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Trophy } from 'lucide-react'

import { L, uiLang } from '../i18n/lang'
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

const CATEGORY_NAMES_FR: Record<string, string> = {
  Fights: 'Combats et victoires',
  Time: 'Temps de combat',
  Striking: 'Frappe',
  Grappling: 'Lutte au sol',
}

const STAT_TITLES_FR: Record<string, string> = {
  TotalFights: 'Total de combats',
  Wins: 'Victoires',
  Finishes: 'Victoires avant la limite',
  KOTKOWins: 'Victoires par KO/TKO',
  SubmissionWins: 'Victoires par soumission',
  DecisionWins: 'Victoires par décision',
  WinStreak: 'Plus longue série de victoires',
  TitleFightWins: 'Victoires en combat de titre',
  TotalAwards: 'Total des bonus de la soirée',
  AverageFightTimeShort: 'Temps de combat moyen le plus court',
  AverageFightTimeLong: 'Temps de combat moyen le plus long',
  TotalFightTime: 'Temps de combat total dans l’octogone',
  ControlTime: 'Temps de contrôle total',
  ControlTimePercentage: 'Pourcentage de temps de contrôle',
  TopPositionTime: 'Temps de contrôle en position haute',
  TopPositionTimePercentage: 'Pourcentage de temps en position haute',
  BottomPositionTime: 'Temps au sol en position basse',
  BottomPositionTimePercentage: 'Pourcentage de temps en position basse',
  Knockdowns: 'Knockdowns infligés',
  KnockdownsAverage: 'Moyenne de knockdowns (par 15 min)',
  SigStrikesLanded: 'Coups significatifs réussis',
  SigStrikesAccuracy: 'Précision des coups significatifs',
  SLpM: 'Coups significatifs réussis par minute',
  SignificantStrikesDifferential: 'Différentiel de coups significatifs',
  SignificantStrikesDefense: 'Défense des coups significatifs',
  SApM: 'Coups significatifs absorbés par minute',
  TotalStrikesLanded: 'Total des coups réussis',
  TakedownsLanded: 'Amenées au sol réussies',
  TakedownsAccuracy: 'Précision des amenées au sol',
  TakedownsDefense: 'Défense des amenées au sol',
  SubmissionsAttempted: 'Tentatives de soumission',
  SubmissionsAverage: 'Moyenne des tentatives de soumission (par 15 min)',
}

const STAT_NOTES_FR: Record<string, string> = {
  'Minimum 5 UFC Fights': 'Au moins 5 combats à l’UFC',
  'Minimum 5 UFC Fights and 500 Significant Strike Attempts': 'Au moins 5 combats à l’UFC et 500 tentatives de coups significatifs',
  'Minimum 5 UFC Fights and 500 Strike Attempts by Opponents': 'Au moins 5 combats à l’UFC et 500 tentatives de coups des adversaires',
  'Minimum 5 UFC Fights and 20 Takedown Attempts': 'Au moins 5 combats à l’UFC et 20 tentatives d’amenée au sol',
  'Minimum 5 UFC Fights and 20 Takedown Attempts by Opponent': 'Au moins 5 combats à l’UFC et 20 tentatives d’amenée au sol de l’adversaire',
}

function localizedLabel(language: string, english: string, pt: Record<string, string>, fr: Record<string, string>, key: string) {
  const lang = uiLang(language)
  if (lang === 'pt') return pt[key] ?? english
  if (lang === 'fr') return fr[key] ?? english
  return english
}

export function RecordBook() {
  const { t, i18n } = useTranslation()
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
          <div role="group" aria-label={L(i18n.language, 'Categorias de recordes', 'Record categories', 'Catégories de records')} className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll">
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
                {localizedLabel(i18n.language, category.name, CATEGORY_NAMES_PT, CATEGORY_NAMES_FR, category.name)}
                <span className="ml-1.5 opacity-70">{category.stats.length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {active ? <p className="mt-2 text-sm text-[var(--text-muted)]">{getBlurb(active.name)}</p> : null}
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
            <StatCard key={stat.key} stat={stat} onOpenProfile={setProfileName} />
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

function StatCard({ stat, onOpenProfile }: { stat: RecordBookStat; onOpenProfile: (name: string) => void }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = `stat-${stat.key}`
  const title = localizedLabel(i18n.language, stat.title, STAT_TITLES_PT, STAT_TITLES_FR, stat.key)
  const note = stat.note ? localizedLabel(i18n.language, stat.note, STAT_NOTES_PT, STAT_NOTES_FR, stat.note) : stat.note

  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-[var(--bg-surface-subtle)] sm:px-4"
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
                <LeaderRow leader={leader} onOpenProfile={onOpenProfile} />
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
}: {
  leader: RecordBookStat['leaders'][number]
  onOpenProfile: (name: string) => void
}) {
  const { i18n } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(leader.fighter)}
      aria-label={L(i18n.language, `${leader.fighter}, #${leader.rank}. Ver perfil`, `${leader.fighter}, rank ${leader.rank}. View profile`, `${leader.fighter}, rang ${leader.rank}. Voir le profil`)}
      className="flex w-full cursor-pointer items-center text-left gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none"
    >
      <span className="type-num w-4 shrink-0 text-right text-[11px] text-[var(--text-muted)]">{leader.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-main)]">{leader.fighter}</p>
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[var(--text-main)]">{leader.value}</span>
    </button>
  )
}
