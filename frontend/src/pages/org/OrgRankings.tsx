import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Crown, Sparkles, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, uiLang } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { formatDate } from '../../shared/data/orgFormat'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import { useOrgRankings } from '../../shared/hooks/useOrgData'
import type { OrgRankingCategory, OrgRankingEntry } from '../../shared/types/api'

type Tab = 'division' | 'p4p'

export function OrgRankings() {
  const { i18n } = useTranslation()
  const org = useOrg()
  const { rankings, loading, error } = useOrgRankings(org.id)
  const [tab, setTab] = useState<Tab>('division')
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)

  const divisions = useMemo(() => rankings.filter((category) => !category.is_p4p), [rankings])
  const p4p = useMemo(() => rankings.filter((category) => category.is_p4p), [rankings])
  const activeDivision = divisions.find((category) => category.category === selectedDivision) ?? divisions[0] ?? null
  const activeP4p = p4p[0] ?? null
  const active = tab === 'division' ? activeDivision : activeP4p

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={L(i18n.language, `Rankings oficiais do ${org.shortName}`, `Official ${org.shortName} rankings`, `Classements officiels ${org.shortName}`)}
          title={L(i18n.language, 'Rankings por categoria e peso por peso', 'Divisional & pound-for-pound rankings', 'Classements par catégorie et livre pour livre')}
          description={L(
            i18n.language,
            `Rankings oficiais do ${org.sourceName}, com aproveitamento e data da última luta extraídos da base de dados.`,
            `The official ${org.sourceName} rankings, with each fighter's win rate and last fight added from our data.`,
            `Classements officiels de ${org.sourceName}, avec le taux de victoire et la date du dernier combat tirés de notre base.`,
          )}
        />
        {p4p.length ? (
          <div className="mt-4 inline-flex max-w-full overflow-x-auto chip-scroll rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
            <TabButton active={tab === 'division'} onClick={() => setTab('division')}>
              {L(i18n.language, 'Por Categoria', 'Category Ranking', 'Par catégorie')}
            </TabButton>
            <TabButton active={tab === 'p4p'} onClick={() => setTab('p4p')}>
              {L(i18n.language, 'Peso por Peso', 'Pound-for-Pound', 'Livre pour livre')}
            </TabButton>
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : !active ? (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[var(--text-muted)]">
          {L(i18n.language, 'Rankings ainda não disponíveis.', 'Rankings are not available yet.', 'Les classements ne sont pas encore disponibles.')}
        </div>
      ) : (
        <div className="space-y-4">
          {tab === 'division' ? (
            <div className="surface-card rounded-[18px] p-3.5">
              <label htmlFor="ranking-division" className="broadcast-label mb-2 block text-xs text-[var(--text-main)]">
                {L(i18n.language, 'Categoria', 'Division', 'Catégorie')}
              </label>
              <select
                id="ranking-division"
                value={active.category}
                onChange={(event) => setSelectedDivision(event.target.value)}
                className="soft-input theme-text w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {divisions.map((division) => (
                  <option key={division.category} value={division.category}>
                    {getDivisionName(division.category, i18n.language)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="surface-card flex flex-wrap gap-2 rounded-[18px] p-3">
              {p4p.map((category) => {
                const lang = uiLang(i18n.language)
                const label = lang === 'pt'
                  ? category.category
                      .replace('Men\'s Pound-for-Pound', 'Peso por Peso Masculino')
                      .replace('Women\'s Pound-for-Pound', 'Peso por Peso Feminino')
                      .replace('Pound-for-Pound', 'Peso por Peso')
                  : lang === 'fr'
                    ? category.category
                        .replace('Men\'s Pound-for-Pound', 'Livre pour livre masculin')
                        .replace('Women\'s Pound-for-Pound', 'Livre pour livre féminin')
                        .replace('Pound-for-Pound', 'Livre pour livre')
                    : category.category.replace('Pound-for-Pound ', '')
                return (
                  <span key={category.category} className="ghost-action inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent-red)]" />
                    {label}
                  </span>
                )
              })}
            </div>
          )}

          <RankingList org={org.id} category={active} vacantLabel={tab === 'division'} onOpenProfile={setProfileName} />
        </div>
      )}

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={() => setProfileName(null)} onSelectFighter={setProfileName} /> : null}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition sm:text-[13px] ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[var(--text-secondary)] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function RankingList({
  org,
  category,
  vacantLabel,
  onOpenProfile,
}: {
  org: string
  category: OrgRankingCategory
  vacantLabel: boolean
  onOpenProfile: (name: string) => void
}) {
  const { i18n } = useTranslation()
  // Champion and interim champion both sit at rank 0; the champion goes first.
  const titleHolders = category.entries.filter((entry) => entry.rank === 0)
  const contenders = category.entries.filter((entry) => entry.rank > 0)
  const vacant = vacantLabel && !titleHolders.some((entry) => entry.status === 'champion')

  return (
    <section aria-label={L(i18n.language, 'Atletas ranqueados', 'Ranked athletes', 'Athlètes classés')} className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-1 pb-2">
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{L(i18n.language, 'Atletas ranqueados', 'Ranked athletes', 'Athlètes classés')}</h2>
        <span className="text-xs text-[var(--text-muted)]">
          {contenders.length + titleHolders.length} {L(i18n.language, 'listados', 'listed', 'listés')}
        </span>
      </div>
      <div className="grid gap-2.5">
        {vacant ? (
          <article className="metric-tile flex items-center gap-3.5 rounded-2xl px-3.5 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-red)] text-white">
              <Crown className="h-4 w-4" />
            </span>
            <p className="text-base font-semibold text-[var(--text-main)]">{L(i18n.language, 'Cinturão vago', 'Championship vacant', 'Ceinture vacante')}</p>
          </article>
        ) : null}
        {titleHolders.map((entry) => (
          <RankingRow key={`${entry.status}-${entry.fighter}`} org={org} entry={entry} onOpenProfile={onOpenProfile} />
        ))}
        {contenders.map((entry) => (
          <RankingRow key={entry.fighter} org={org} entry={entry} onOpenProfile={onOpenProfile} />
        ))}
        {!titleHolders.length && !contenders.length ? (
          <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            {L(i18n.language, 'Nenhum atleta ranqueado nesta categoria.', 'No ranked athletes in this category.', 'Aucun athlète classé dans cette catégorie.')}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function RankingRow({
  org,
  entry,
  onOpenProfile,
}: {
  org: string
  entry: OrgRankingEntry
  onOpenProfile: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const lookup = useOrgFighterLookup(org)
  const profile = lookup(entry.fighter)
  const holder = entry.rank === 0
  const interim = entry.status === 'interim'

  const holderLabel = holder
    ? interim
      ? L(i18n.language, 'Campeão Interino', 'Interim champion', 'Champion intérimaire')
      : L(i18n.language, 'Campeão', 'Champion', 'Champion')
    : null

  const content = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
          holder ? (interim ? 'bg-[#1F4E9C] text-white' : 'bg-[var(--accent-red)] text-white') : 'bg-[var(--surface-3)] text-[var(--text-main)]'
        }`}
      >
        {holder ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <FighterAvatar name={entry.fighter} imageUrl={profile?.image_url ?? null} highlight={holder} className="h-12 w-12" />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--text-main)]">
          {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
          <span className="min-w-0 truncate">{entry.fighter}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-muted)]">
          {holder ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#0E0E0E]">
              <Trophy className="h-3.5 w-3.5" /> {holderLabel}
            </span>
          ) : null}
          {entry.win_rate !== null ? (
            <span>
              {L(i18n.language, 'Aproveitamento: ', 'Win rate: ', 'Taux de victoire : ')}
              {(entry.win_rate * 100).toFixed(1)}%
            </span>
          ) : null}
          {entry.last_fight ? (
            <span>
              {L(i18n.language, 'Última luta: ', 'Last fight: ', 'Dernier combat : ')}
              {formatDate(entry.last_fight, true, i18n.language)}
            </span>
          ) : null}
        </div>
      </div>

      <RankChange change={entry.rank_change} />
    </>
  )

  const base = 'metric-tile flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3'
  const accessibleLabel = L(
    i18n.language,
    `${entry.fighter}, ${entry.rank === 0 ? (interim ? 'campeão interino' : 'campeão') : `${entry.rank}º lugar`}. Ver perfil`,
    `${entry.fighter}, rank ${entry.rank || 'champion'}. View profile`,
    `${entry.fighter}, ${entry.rank === 0 ? (interim ? 'champion intérimaire' : 'champion') : `${entry.rank === 1 ? '1re' : `${entry.rank}e`} place`}. Voir le profil`,
  )

  return profile ? (
    <button
      type="button"
      onClick={() => onOpenProfile(profile.name)}
      aria-label={accessibleLabel}
      className={`${base} cursor-pointer text-left transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]`}
    >
      {content}
    </button>
  ) : (
    <article className={base}>{content}</article>
  )
}

/** "up 2", "down 1" or "new", as written by the scraper. */
function RankChange({ change }: { change: string | null }) {
  const { i18n } = useTranslation()
  if (!change) return null
  const [direction, amount] = change.split(' ')
  if (direction === 'up' || direction === 'down') {
    const Arrow = direction === 'up' ? ArrowUp : ArrowDown
    const titleText = L(
      i18n.language,
      `${direction === 'up' ? 'Subiu' : 'Caiu'} ${amount} ${amount === '1' ? 'posição' : 'posições'}`,
      `${direction === 'up' ? 'Up' : 'Down'} ${amount} place${amount === '1' ? '' : 's'}`,
      `${direction === 'up' ? 'Monté' : 'Descendu'} de ${amount} ${amount === '1' ? 'place' : 'places'}`,
    )

    return (
      <span
        title={titleText}
        className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          direction === 'up' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-[#C8102E]/30 bg-[#C8102E]/10 text-[#C8102E]'
        }`}
      >
        <Arrow className="h-3 w-3" />
        {amount}
      </span>
    )
  }
  const label = change === 'new' ? L(i18n.language, 'Novo', change, 'Nouveau') : change
  return <span className="type-tech rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--text-muted)]">{label}</span>
}
