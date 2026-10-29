import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Award, Crown, Flame, History, Layers, Shield, Swords, Trophy } from 'lucide-react'

import { L, localeTag } from '../../i18n/lang'
import { ChampionBelt } from '../../shared/components/ChampionBelt'
import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { divisionLimit, getDivisionName } from '../../shared/data/divisions'
import {
  buildDivisionReigns,
  buildGreatestOrgChampions,
  compactNameKey,
  type GreatestOrgChampion,
  type OrgTitleReign,
} from '../../shared/data/orgChampions'
import { compareDivisions, formatDate, formatMethod, formatRecord } from '../../shared/data/orgFormat'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgEvents, useOrgRankings } from '../../shared/hooks/useOrgData'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import type { OrgFighter } from '../../shared/types/api'

type ViewKey = 'current' | 'history' | 'greatest'

export function OrgChampions() {
  const { i18n } = useTranslation()
  const org = useOrg()
  const past = useOrgEvents(org.id)
  const { rankings, loading: rankingsLoading } = useOrgRankings(org.id)
  const lookup = useOrgFighterLookup(org.id)

  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('view')
  const validViews: ViewKey[] = ['current', 'history', 'greatest']
  const view: ViewKey = validViews.includes(requested as ViewKey) ? (requested as ViewKey) : 'current'
  const chooseView = (next: ViewKey) => setSearchParams(next === 'current' ? {} : { view: next }, { replace: true })

  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [profileName, setProfileName] = useState<string | null>(null)

  const isArchived = Boolean(org.archived)

  const champions = useMemo(
    () =>
      rankings
        .filter((category) => !category.is_p4p)
        .map((category) => ({
          division: category.category,
          holders: category.entries.filter((entry) => entry.rank === 0),
        }))
        .sort((a, b) => compareDivisions(a.division, b.division)),
    [rankings],
  )

  const finalChampionByDivision = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const { division, holders } of champions) {
      const champ = holders.find((entry) => entry.status !== 'interim')?.fighter ?? null
      map.set(division, champ)
    }
    return map
  }, [champions])

  const reignsByDivision = useMemo(
    () => buildDivisionReigns(past.events, finalChampionByDivision),
    [past.events, finalChampionByDivision],
  )

  const greatestChampions = useMemo(
    () => buildGreatestOrgChampions(reignsByDivision, finalChampionByDivision),
    [reignsByDivision, finalChampionByDivision],
  )

  const allDivisions = useMemo(() => {
    const set = new Set<string>([
      ...champions.map((c) => c.division),
      ...Array.from(reignsByDivision.keys()),
    ])
    return Array.from(set).sort(compareDivisions)
  }, [champions, reignsByDivision])

  const activeDivision = useMemo(() => {
    if (selectedDivision && selectedDivision !== 'ALL' && allDivisions.includes(selectedDivision)) {
      return selectedDivision
    }
    return allDivisions[0] ?? ''
  }, [selectedDivision, allDivisions])

  const totalReignsCount = useMemo(() => {
    let total = 0
    for (const list of reignsByDivision.values()) total += list.length
    return total
  }, [reignsByDivision])

  const totalDefensesCount = useMemo(() => {
    let total = 0
    for (const list of reignsByDivision.values()) {
      for (const r of list) {
        total += r.defenses.filter((d) => d.outcome === 'win').length
      }
    }
    return total
  }, [reignsByDivision])

  const multiDivisionChampions = useMemo(
    () => greatestChampions.filter((c) => c.divisions.length > 1),
    [greatestChampions],
  )

  const views: { key: ViewKey; label: string; short: string }[] = [
    {
      key: 'current',
      label: isArchived
        ? L(i18n.language, 'Últimos Campeões (2023)', 'Final Champions (2023)', 'Derniers Champions (2023)')
        : L(i18n.language, 'Campeões Atuais', 'Current Champions', 'Champions Actuels'),
      short: isArchived
        ? L(i18n.language, 'Últimos (2023)', 'Final (2023)', 'Derniers')
        : L(i18n.language, 'Atuais', 'Current', 'Actuels'),
    },
    {
      key: 'history',
      label: L(i18n.language, 'Histórico por Categoria', 'History by Division', 'Historique par Catégorie'),
      short: L(i18n.language, 'Por Categoria', 'By Division', 'Par Catégorie'),
    },
    {
      key: 'greatest',
      label: L(i18n.language, 'Maiores Campeões', 'Greatest Champions', 'Plus Grands Champions'),
      short: L(i18n.language, 'Maiores', 'Greatest', 'Plus Grands'),
    },
  ]

  const isLoading = rankingsLoading || past.loading

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="page-hero rounded-[20px] px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <SectionHeading
              level={1}
              eyebrow={
                isArchived
                  ? L(i18n.language, `${org.shortName} • Galeria de Cinturões (2009–2023)`, `${org.shortName} • Title Gallery (2009–2023)`, `${org.shortName} • Galerie des Titres (2009–2023)`)
                  : L(i18n.language, `${org.shortName} • Galeria de Cinturões`, `${org.shortName} • Champions & Lineage`, `${org.shortName} • Champions et Lignée`)
              }
              title={
                isArchived
                  ? L(i18n.language, `Campeões do ${org.shortName}`, `${org.shortName} champions`, `Champions du ${org.shortName}`)
                  : L(i18n.language, `Campeões da ${org.shortName}`, `${org.shortName} champions`, `Champions de la ${org.shortName}`)
              }
              description={
                isArchived
                  ? L(
                      i18n.language,
                      'Últimos detentores de cinturão no encerramento do Bellator em 2023, histórico completo de reinados por categoria e os maiores campeões da história da organização.',
                      'The final belt holders when Bellator closed in 2023, complete title lineage across every weight class, and the greatest champions in Bellator history.',
                      'Les derniers détenteurs de ceinture fin 2023, la lignée complète par catégorie et les plus grands champions de l\'histoire du Bellator.',
                    )
                  : L(
                      i18n.language,
                      'Detentores atuais de cinturão da PFL, linhagem histórica de todas as disputas de título e os atletas mais vitoriosos em lutas de campeonato.',
                      'Current PFL belt holders, complete championship lineage by weight class, and the most decorated title-fight winners in league history.',
                      'Détenteurs actuels de ceinture de la PFL, lignée historique par catégorie et les combattants les plus titrés.',
                    )
              }
            />

            <div
              role="tablist"
              aria-label={L(i18n.language, 'Escolha a visualização de campeões', 'Choose champions view', 'Choisir la vue des champions')}
              className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll"
            >
              {views.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`org-champions-tab-${item.key}`}
                  aria-label={item.label}
                  aria-selected={view === item.key}
                  aria-controls="org-champions-panel"
                  onClick={() => chooseView(item.key)}
                  className={`shrink-0 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] transition sm:px-5 ${
                    view === item.key
                      ? 'bg-[#0E0E0E] text-white dark:bg-white dark:text-[#0E0E0E] shadow-sm'
                      : 'text-[var(--text-main)] hover:bg-[#F2C230] hover:text-[#0E0E0E]'
                  }`}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label={L(i18n.language, 'Divisões', 'Divisions', 'Catégories')}
              value={allDivisions.length.toLocaleString(localeTag(i18n.language))}
              note={isArchived ? '2009–2023' : L(i18n.language, 'categorias', 'weight classes', 'catégories')}
            />
            <StatTile
              label={L(i18n.language, 'Reinados', 'Title Reigns', 'Règnes')}
              value={totalReignsCount.toLocaleString(localeTag(i18n.language))}
              note={L(i18n.language, 'conquistas', 'belts won', 'titres gagnés')}
            />
            <StatTile
              label={L(i18n.language, 'Campeões', 'Champions', 'Champions')}
              value={greatestChampions.length.toLocaleString(localeTag(i18n.language))}
              note={L(i18n.language, 'atletas distintos', 'unique fighters', 'combattants')}
            />
            <StatTile
              label={L(i18n.language, 'Defesas', 'Defenses', 'Défenses')}
              value={totalDefensesCount.toLocaleString(localeTag(i18n.language))}
              note={L(i18n.language, 'bem-sucedidas', 'successful', 'réussies')}
            />
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[160px]" />
          ))}
        </section>
      ) : (
        <div
          id="org-champions-panel"
          role="tabpanel"
          aria-labelledby={`org-champions-tab-${view}`}
          className="space-y-5"
        >
          {allDivisions.length > 1 && (view === 'current' || view === 'history') ? (
            <div
              role="group"
              aria-label={L(i18n.language, 'Selecionar categoria', 'Select division', 'Sélectionner une catégorie')}
              className="chip-scroll flex w-full max-w-full items-center gap-2 overflow-x-auto pb-1"
            >
              {allDivisions.map((div) => {
                const count = reignsByDivision.get(div)?.length ?? 0
                const isSelected = activeDivision === div
                return (
                  <button
                    key={div}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDivision(div)}
                    className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-[0.08em] transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#F2C230] text-[#0E0E0E] shadow-md shadow-[#F2C230]/25 ring-2 ring-[#F2C230] scale-[1.02]'
                        : 'border border-[var(--border-subtle)] bg-[var(--surface-3)] text-[var(--text-secondary)] hover:border-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {getDivisionName(div, i18n.language)} {count > 0 ? `(${count})` : ''}
                  </button>
                )
              })}
            </div>
          ) : null}

          {view === 'current' ? (
            activeDivision ? (
              <div className="w-full">
                <CurrentChampionDivisionCard
                  key={activeDivision}
                  division={activeDivision}
                  holders={champions.find((c) => c.division === activeDivision)?.holders ?? []}
                  reigns={reignsByDivision.get(activeDivision) ?? []}
                  lookup={lookup}
                  isArchived={isArchived}
                  onOpenFighter={setProfileName}
                />
              </div>
            ) : (
              <p className="surface-card rounded-[20px] px-4 py-6 text-sm text-[var(--text-muted)]">
                {L(i18n.language, 'Nenhum campeão cadastrado.', 'No champions available.', 'Aucun champion disponible.')}
              </p>
            )
          ) : null}

          {view === 'history' ? (
            <div className="space-y-4">
              {activeDivision ? (
                <div className="w-full">
                  <DivisionHistoryCard
                    key={activeDivision}
                    division={activeDivision}
                    reigns={reignsByDivision.get(activeDivision) ?? []}
                    finalChampion={finalChampionByDivision.get(activeDivision) ?? null}
                    isArchived={isArchived}
                    lookup={lookup}
                    onOpenFighter={setProfileName}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {view === 'greatest' ? (
            <GreatestChampionsView
              greatest={greatestChampions}
              multiDivision={multiDivisionChampions}
              isArchived={isArchived}
              lookup={lookup}
              onOpenFighter={setProfileName}
            />
          ) : null}
        </div>
      )}

      {profileName ? (
        <OrgFighterModal
          key={profileName}
          org={org}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </div>
  )
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
      {note ? <p className="text-[11px] text-[var(--text-muted)]">{note}</p> : null}
    </div>
  )
}


function CurrentChampionDivisionCard({
  division,
  holders,
  reigns,
  lookup,
  isArchived,
  onOpenFighter,
}: {
  division: string
  holders: { fighter: string; status: string | null }[]
  reigns: OrgTitleReign[]
  lookup: (name: string) => OrgFighter | undefined
  isArchived: boolean
  onOpenFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const championEntry = holders.find((entry) => entry.status !== 'interim') ?? null
  const interimEntry = holders.find((entry) => entry.status === 'interim') ?? null
  const championName = championEntry?.fighter ?? null
  const profile = championName ? lookup(championName) : undefined
  const record = profile ? formatRecord(profile) : null
  const limit = divisionLimit(division)

  // Find the active/final reign for this champion
  const activeReign = useMemo(() => {
    if (!championName) return null
    return [...reigns].reverse().find((r) => !r.interim && compactNameKey(r.champion) === compactNameKey(championName)) ?? null
  }, [reigns, championName])

  const defensesCount = activeReign ? activeReign.defenses.filter((d) => d.outcome === 'win').length : 0

  return (
    <article className="surface-card w-full overflow-hidden rounded-[20px] p-4 sm:p-6 shadow-xl border border-[var(--border-subtle)]">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* Left Side: Champion Identity & Details */}
        <div className="flex flex-col justify-between">
          <div>
            {/* Division Header + Gold Belt */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="broadcast-label text-sm font-black uppercase tracking-[0.12em] text-[var(--text-main)]">
                    {getDivisionName(division, i18n.language)}
                  </span>
                  {limit ? <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">({limit})</span> : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {isArchived
                    ? L(i18n.language, 'Último Detentor Linear (Encerramento 2023)', 'Final Title Holder (2023 Closure)', 'Dernier Détenteur (Fin 2023)')
                    : L(i18n.language, 'Campeão Mundial da Divisão', 'Divisional World Champion', 'Champion du Monde de la Catégorie')}
                </p>
              </div>
              <ChampionBelt className="h-8 w-auto shrink-0" />
            </div>

            {/* Champion Identity */}
            {championName ? (
              <div className="mt-4 flex items-start gap-4">
                <FighterAvatar
                  name={championName}
                  imageUrl={profile?.image_url ?? null}
                  highlight
                  className="h-24 w-20 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 border border-transparent bg-[#F2C230] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#0E0E0E]">
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      {isArchived
                        ? L(i18n.language, 'Último Campeão', 'Final Champion', 'Dernier Champion')
                        : L(i18n.language, 'Campeão Atual', 'Current Champion', 'Champion Actuel')}
                    </span>
                    {record ? (
                      <span className="border border-[var(--line-soft)] bg-[var(--surface-3)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-main)]">
                        {record}
                      </span>
                    ) : null}
                    {defensesCount > 0 ? (
                      <span className="inline-flex items-center gap-1 border border-[var(--line-soft)] bg-[var(--surface-3)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-main)]">
                        <Shield className="h-3 w-3 text-[var(--accent-red)]" aria-hidden="true" />
                        {defensesCount} {defensesCount === 1 ? L(i18n.language, 'defesa', 'defense', 'défense') : L(i18n.language, 'defesas', 'defenses', 'défenses')}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenFighter(championName)}
                    className="mt-2 flex max-w-full items-center gap-2 text-left text-2xl font-black uppercase tracking-tight text-[var(--text-main)] hover:underline"
                  >
                    {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
                    <span className="truncate">{championName}</span>
                  </button>

                  {profile?.nickname ? (
                    <p className="text-xs italic text-[var(--text-muted)]">“{profile.nickname}”</p>
                  ) : null}

                  {activeReign ? (
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-main)]">
                        {L(i18n.language, 'Conquistou contra', 'Won belt vs.', 'Conquis contre')} {activeReign.opponent}
                      </span>
                      {activeReign.date ? ` · ${formatDate(activeReign.date, true, i18n.language)}` : ''}
                      {activeReign.eventName ? ` (${activeReign.eventName})` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {isArchived
                    ? L(i18n.language, 'Cinturão Desativado / Vago', 'Title Deactivated / Vacant', 'Titre Désactivé / Vacant')
                    : L(i18n.language, 'Cinturão Vago', 'Vacant Title', 'Ceinture Vacante')}
                </p>
              </div>
            )}

            {/* Interim Champion Banner if present */}
            {interimEntry?.fighter ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {L(i18n.language, 'Campeão Interino', 'Interim Champion', 'Champion Intérimaire')}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenFighter(interimEntry.fighter)}
                  className="text-xs font-extrabold text-[var(--text-main)] underline decoration-2 underline-offset-2 hover:text-[#F2C230]"
                >
                  {interimEntry.fighter}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Side: Quick History Lineage of this category to fill the screen */}
        {reigns.length > 0 ? (
          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-main)]">
                <History className="h-3.5 w-3.5 text-[var(--accent-red)]" aria-hidden="true" />
                {L(
                  i18n.language,
                  `Linhagem da Categoria (${reigns.length} ${reigns.length === 1 ? 'reinado' : 'reinados'})`,
                  `Division Lineage (${reigns.length} ${reigns.length === 1 ? 'reign' : 'reigns'})`,
                  `Lignée (${reigns.length} ${reigns.length === 1 ? 'règne' : 'règnes'})`,
                )}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {reigns[0]?.date?.slice(0, 4)}–{reigns[reigns.length - 1]?.date?.slice(0, 4) ?? '2023'}
              </span>
            </div>

            <ol className="mt-2 divide-y divide-[var(--line-soft)] max-h-[220px] overflow-y-auto chip-scroll pr-1">
              {[...reigns].reverse().map((r, index) => {
                const winDefs = r.defenses.filter((d) => d.outcome === 'win').length
                return (
                  <li key={`${r.date}-${r.champion}-${index}`} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0">
                      <span className="mr-2 font-mono font-bold text-[var(--text-muted)]">
                        {r.interim ? 'INT' : `#${r.reignOrder}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenFighter(r.champion)}
                        className="font-bold text-[var(--text-main)] hover:underline"
                      >
                        {r.champion}
                      </button>
                      <span className="text-[var(--text-muted)]">
                        {' '}
                        · {L(i18n.language, 'venceu', 'def.', 'bat')} {r.opponent} ({r.date?.slice(0, 4) ?? '—'})
                      </span>
                    </div>
                    {winDefs > 0 ? (
                      <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--text-main)]">
                        {winDefs} {winDefs === 1 ? 'def.' : 'defs.'}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function DivisionHistoryCard({
  division,
  reigns,
  finalChampion,
  isArchived = false,
  lookup,
  onOpenFighter,
}: {
  division: string
  reigns: OrgTitleReign[]
  finalChampion: string | null
  isArchived?: boolean
  lookup: (name: string) => OrgFighter | undefined
  onOpenFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const divisionLabel = getDivisionName(division, i18n.language)
  const limit = divisionLimit(division)
  const uniqueChamps = useMemo(() => new Set(reigns.map((r) => compactNameKey(r.champion))).size, [reigns])
  const firstYear = reigns[0]?.date?.slice(0, 4)
  const lastYear = reigns[reigns.length - 1]?.date?.slice(0, 4)

  return (
    <article className="surface-card flex flex-col overflow-hidden rounded-[20px]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{divisionLabel}</h3>
            {limit ? <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">({limit})</span> : null}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {reigns.length} {reigns.length === 1 ? L(i18n.language, 'reinado', 'reign', 'règne') : L(i18n.language, 'reinados', 'reigns', 'règnes')}
            {' · '}
            {uniqueChamps} {uniqueChamps === 1 ? L(i18n.language, 'campeão', 'champion', 'champion') : L(i18n.language, 'campeões', 'champions', 'champions')}
            {firstYear && lastYear ? ` · ${firstYear === lastYear ? firstYear : `${firstYear}–${isArchived ? '2023' : lastYear}`}` : ''}
          </p>
        </div>

        {finalChampion ? (
          <button
            type="button"
            onClick={() => onOpenFighter(finalChampion)}
            className="inline-flex items-center gap-1.5 border-2 border-[var(--rule)] bg-[#F2C230] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0E0E0E] transition hover:brightness-95"
          >
            <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {isArchived ? L(i18n.language, 'Último:', 'Final:', 'Dernier :') : L(i18n.language, 'Atual:', 'Current:', 'Actuel :')}{' '}
              {finalChampion}
            </span>
          </button>
        ) : (
          <span className="border border-[var(--line-soft)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {isArchived
              ? L(i18n.language, 'Título desativado', 'Title deactivated', 'Titre désactivé')
              : L(i18n.language, 'Cinturão vago', 'Vacant', 'Vacant')}
          </span>
        )}
      </header>

      {reigns.length ? (
        <ol className="divide-y divide-[var(--line-soft)] px-4 py-2">
          {reigns.map((reign, idx) => {
            const profile = lookup(reign.champion)
            const year = reign.date?.slice(0, 4) ?? '—'
            const defCount = reign.defenses.filter((d) => d.outcome === 'win').length
            const ncCount = reign.defenses.filter((d) => d.outcome === 'draw_nc').length
            const methodText = formatMethod(reign.method, null, i18n.language)

            return (
              <li
                key={`${reign.date}-${reign.champion}-${idx}`}
                className="grid grid-cols-[2.25rem_auto_minmax(0,1fr)] items-start gap-2.5 py-2.5 sm:grid-cols-[2.5rem_auto_minmax(0,1fr)_auto]"
              >
                <div className="pt-0.5 text-center">
                  <span
                    className={`inline-flex min-w-[2rem] items-center justify-center border border-[var(--rule)] px-1 py-0.5 font-mono text-[11px] font-bold uppercase leading-none ${
                      reign.isFinal
                        ? 'bg-[#F2C230] text-[#0E0E0E]'
                        : reign.interim
                          ? 'bg-[#1F4E9C] text-white'
                          : 'bg-[var(--surface-3)] text-[var(--text-main)]'
                    }`}
                  >
                    {reign.interim ? 'INT' : `#${reign.reignOrder}`}
                  </span>
                  <p className="mt-1 font-mono text-[10px] font-bold text-[var(--text-muted)]">{year}</p>
                </div>

                <FighterAvatar
                  name={reign.champion}
                  imageUrl={profile?.image_url ?? null}
                  highlight={reign.isFinal}
                  className="h-11 w-10 shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
                    <button
                      type="button"
                      onClick={() => onOpenFighter(reign.champion)}
                      className="truncate text-left text-sm font-bold text-[var(--text-main)] hover:underline"
                    >
                      {reign.champion}
                    </button>
                    {reign.fighterReignIndex > 1 && !reign.interim ? (
                      <span className="border border-[var(--line-soft)] bg-[var(--surface-3)] px-1.5 py-px font-mono text-[10px] font-bold uppercase text-[var(--text-main)]">
                        {reign.fighterReignIndex}x
                      </span>
                    ) : null}
                    {reign.interim ? (
                      <span className="border border-[var(--rule)] bg-[#1F4E9C] px-1.5 py-px text-[10px] font-bold uppercase text-white">
                        {L(i18n.language, 'Interino', 'Interim', 'Intérimaire')}
                      </span>
                    ) : null}
                    {reign.isFinal ? (
                      <span className="border border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[10px] font-bold uppercase text-[#0E0E0E]">
                        {isArchived
                          ? L(i18n.language, 'Último Campeão', 'Final Champion', 'Dernier champion')
                          : L(i18n.language, 'Campeão Atual', 'Current Champion', 'Champion actuel')}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-main)]">
                      {L(i18n.language, 'Venceu', 'def.', 'bat')} {reign.opponent}
                    </span>
                    {methodText ? ` · ${methodText}${reign.round ? ` (R${reign.round})` : ''}` : ''}
                    {reign.date ? ` · ${formatDate(reign.date, true, i18n.language)}` : ''}
                    {reign.eventName ? ` · ${reign.eventName}` : ''}
                  </p>

                  {reign.defenses.length > 0 ? (
                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">
                      <Shield className="mr-1 inline h-3 w-3 text-[var(--accent-red)]" aria-hidden="true" />
                      <span className="font-semibold text-[var(--text-main)]">
                        {defCount} {defCount === 1 ? L(i18n.language, 'defesa', 'defense', 'défense') : L(i18n.language, 'defesas', 'defenses', 'défenses')}
                        {ncCount > 0 ? ` (+${ncCount} NC/Empate)` : ''}:
                      </span>{' '}
                      {reign.defenses.map((d) => `${d.opponent}${d.outcome === 'draw_nc' ? ' (NC/Draw)' : ''}`).join(', ')}
                    </p>
                  ) : null}
                </div>

                <div className="hidden text-right sm:block">
                  <span className="inline-flex items-center gap-1 border border-[var(--line-soft)] bg-[var(--surface-3)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-main)]">
                    <Swords className="h-3 w-3 text-[var(--accent-red)]" aria-hidden="true" />
                    {defCount} {defCount === 1 ? L(i18n.language, 'def.', 'def.', 'déf.') : L(i18n.language, 'defs.', 'defs.', 'défs.')}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="px-4 py-4 text-xs text-[var(--text-muted)]">
          <History className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          {L(i18n.language, 'Sem reinados registrados nesta categoria.', 'No title reigns recorded for this division.', 'Aucun règne enregistré dans cette catégorie.')}
        </p>
      )}
    </article>
  )
}

function GreatestChampionsView({
  greatest,
  multiDivision,
  isArchived,
  lookup,
  onOpenFighter,
}: {
  greatest: GreatestOrgChampion[]
  multiDivision: GreatestOrgChampion[]
  isArchived: boolean
  lookup: (name: string) => OrgFighter | undefined
  onOpenFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()

  const mostTitleWins = greatest[0] ?? null
  const mostDefenses = useMemo(
    () => [...greatest].sort((a, b) => b.defensesCount - a.defensesCount || b.titleWinsCount - a.titleWinsCount)[0] ?? null,
    [greatest],
  )

  return (
    <div className="space-y-5">
      {/* Record Highlights Row */}
      <div className="grid gap-3 md:grid-cols-3">
        {mostTitleWins ? (
          <div className="surface-card rounded-[20px] border-l-4 border-l-[#F2C230] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <Trophy className="h-4 w-4 text-[#F2C230]" aria-hidden="true" />
              {L(i18n.language, 'Mais Vitórias em Disputas de Cinturão', 'Most Title-Fight Wins', 'Plus de Victoires pour le Titre')}
            </div>
            <button
              type="button"
              onClick={() => onOpenFighter(mostTitleWins.champion)}
              className="mt-2 block text-left text-xl font-extrabold uppercase text-[var(--text-main)] hover:underline"
            >
              {mostTitleWins.champion}
            </button>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-main)]">{mostTitleWins.titleWinsCount}</span>{' '}
              {L(i18n.language, 'vitórias em lutas de título', 'title fight wins', 'victoires en combat de titre')} ({mostTitleWins.reignsCount}{' '}
              {mostTitleWins.reignsCount === 1 ? L(i18n.language, 'reinado', 'reign', 'règne') : L(i18n.language, 'reinados', 'reigns', 'règnes')},{' '}
              {mostTitleWins.defensesCount} {L(i18n.language, 'defesas', 'defenses', 'défenses')})
            </p>
          </div>
        ) : null}

        {mostDefenses ? (
          <div className="surface-card rounded-[20px] border-l-4 border-l-[var(--accent-red)] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <Flame className="h-4 w-4 text-[var(--accent-red)]" aria-hidden="true" />
              {L(i18n.language, 'Recordista de Defesas de Cinturão', 'Most Title Defenses', 'Record de Défenses de Titre')}
            </div>
            <button
              type="button"
              onClick={() => onOpenFighter(mostDefenses.champion)}
              className="mt-2 block text-left text-xl font-extrabold uppercase text-[var(--text-main)] hover:underline"
            >
              {mostDefenses.champion}
            </button>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-main)]">{mostDefenses.defensesCount}</span>{' '}
              {L(i18n.language, 'defesas bem-sucedidas de cinturão', 'successful title defenses', 'défenses de titre réussies')}
            </p>
          </div>
        ) : null}

        <div className="surface-card rounded-[20px] border-l-4 border-l-[#1F4E9C] p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <Layers className="h-4 w-4 text-[#1F4E9C]" aria-hidden="true" />
            {L(i18n.language, 'Campeões em Múltiplas Categorias', 'Multi-Division Champions', 'Champions Multi-Catégories')}
          </div>
          {multiDivision.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {multiDivision.map((champ) => (
                <button
                  key={champ.champion}
                  type="button"
                  onClick={() => onOpenFighter(champ.champion)}
                  className="border border-[var(--rule)] bg-[var(--surface-3)] px-2.5 py-1 text-xs font-extrabold uppercase text-[var(--text-main)] hover:bg-[#F2C230] hover:text-[#0E0E0E]"
                >
                  {champ.champion} ({champ.divisions.map((d) => getDivisionName(d, i18n.language)).join(' & ')})
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {L(
                i18n.language,
                'Todos os campeões conquistaram seus títulos em uma única divisão.',
                'Every champion won their titles within a single weight class.',
                'Tous les champions ont remporté leurs titres dans une seule catégorie.',
              )}
            </p>
          )}
        </div>
      </div>

      {/* Greatest Champions Leaderboard */}
      <section className="surface-card overflow-hidden rounded-[20px]">
        <header className="border-b border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3">
          <h2 className="text-base font-extrabold uppercase tracking-[0.04em] text-[var(--text-main)]">
            {L(
              i18n.language,
              'Ranking Histórico dos Maiores Campeões',
              'All-Time Greatest Champions Leaderboard',
              'Classement Historique des Plus Grands Champions',
            )}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {L(
              i18n.language,
              'Classificados pelo total de vitórias em lutas de cinturão, defesas bem-sucedidas e número de reinados.',
              'Ranked by total title-fight victories, successful belt defenses and number of championship reigns.',
              'Classés par victoires en combats de titre, défenses réussies et nombre de règnes.',
            )}
          </p>
        </header>

        <ol className="divide-y divide-[var(--line-soft)]">
          {greatest.map((entry, index) => {
            const profile = lookup(entry.champion)
            const record = profile ? formatRecord(profile) : null

            return (
              <li
                key={entry.champion}
                className="grid grid-cols-[2.5rem_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[3rem_auto_minmax(0,1fr)_auto]"
              >
                <div className="text-center">
                  <span
                    className={`inline-flex min-w-[2.25rem] items-center justify-center border border-[var(--rule)] px-1.5 py-0.5 font-mono text-xs font-extrabold ${
                      index === 0
                        ? 'bg-[#F2C230] text-[#0E0E0E]'
                        : index < 3
                          ? 'bg-[#0E0E0E] text-white dark:bg-white dark:text-[#0E0E0E]'
                          : 'bg-[var(--surface-3)] text-[var(--text-main)]'
                    }`}
                  >
                    #{index + 1}
                  </span>
                </div>

                <FighterAvatar
                  name={entry.champion}
                  imageUrl={profile?.image_url ?? null}
                  highlight={entry.isCurrentOrFinal}
                  className="h-12 w-11 shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
                    <button
                      type="button"
                      onClick={() => onOpenFighter(entry.champion)}
                      className="truncate text-left text-base font-bold text-[var(--text-main)] hover:underline"
                    >
                      {entry.champion}
                    </button>
                    {record ? <span className="font-mono text-xs text-[var(--text-muted)]">({record})</span> : null}
                    {entry.divisions.length > 1 ? (
                      <span className="inline-flex items-center gap-1 border border-[var(--rule)] bg-[#1F4E9C] px-1.5 py-px text-[10px] font-bold uppercase text-white">
                        <Award className="h-3 w-3" aria-hidden="true" />
                        {L(i18n.language, 'Duplo Campeão', 'Double Champ', 'Double Champion')}
                      </span>
                    ) : null}
                    {entry.isCurrentOrFinal ? (
                      <span className="border border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[10px] font-bold uppercase text-[#0E0E0E]">
                        {isArchived
                          ? L(i18n.language, 'Último Campeão', 'Final Champ', 'Dernier Champion')
                          : L(i18n.language, 'Campeão Atual', 'Current Champ', 'Champion Actuel')}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {entry.divisions.map((div) => getDivisionName(div, i18n.language)).join(' · ')}
                    {entry.firstTitleDate
                      ? ` · ${entry.firstTitleDate.slice(0, 4)}–${
                          entry.lastTitleDate?.slice(0, 4) ?? entry.firstTitleDate.slice(0, 4)
                        }`
                      : ''}
                  </p>
                </div>

                <div className="col-span-3 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
                  <span className="border border-[var(--rule)] bg-[#F2C230] px-2.5 py-1 font-mono text-xs font-extrabold uppercase text-[#0E0E0E]">
                    {entry.titleWinsCount} {entry.titleWinsCount === 1 ? L(i18n.language, 'vitória de título', 'title win', 'victoire') : L(i18n.language, 'vitórias de título', 'title wins', 'victoires')}
                  </span>
                  <span className="border border-[var(--line-soft)] bg-[var(--surface-3)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--text-main)]">
                    {entry.reignsCount}x {L(i18n.language, 'campeão', 'champ', 'champion')}
                  </span>
                  <span className="border border-[var(--line-soft)] bg-[var(--surface-3)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--text-main)]">
                    {entry.defensesCount} {entry.defensesCount === 1 ? 'def.' : 'defs.'}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
