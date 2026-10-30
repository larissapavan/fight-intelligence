import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Crown, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFightRow } from '../../shared/components/OrgFightRow'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, localeTag } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { buildDivisionReigns } from '../../shared/data/orgChampions'
import { compareDivisions, formatDate, formatRecord } from '../../shared/data/orgFormat'
import { orgPath, type OrgConfig } from '../../shared/data/orgs'
import { useGyms } from '../../shared/hooks/useGyms'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgEvents, useOrgFighters, useOrgRankings, useOrgUpcomingEvents } from '../../shared/hooks/useOrgData'
import { useUpcomingPicks } from '../../shared/hooks/useUpcomingPicks'
import type { UpcomingPick } from '../../shared/types/api'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import type { OrgEvent, OrgFighter } from '../../shared/types/api'
import { DivisionHistoryCard } from './OrgChampions'

const LATEST_RESULTS = 4

export function OrgHome() {
  const { t, i18n } = useTranslation()
  const org = useOrg()
  const { fighters } = useOrgFighters(org.id)
  const past = useOrgEvents(org.id)
  const upcoming = useOrgUpcomingEvents(org.id)
  const pickFor = useUpcomingPicks(org.id, org.hasPredictions)
  const { rankings, loading: rankingsLoading } = useOrgRankings(org.id)
  const { gyms } = useGyms()
  const lookup = useOrgFighterLookup(org.id)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [selectedDivision, setSelectedDivision] = useState<string>('')

  const isArchived = Boolean(org.archived)
  const nextEvent = upcoming.events[0] ?? null
  const latestEvent = past.events[0] ?? null
  const fightCount = useMemo(() => past.events.reduce((sum, event) => sum + event.fight_count, 0), [past.events])
  const activeCount = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])
  const orgGymsCount = useMemo(() => gyms.filter((gym) => (gym.orgs[org.id] ?? 0) > 0).length, [gyms, org.id])

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

  const historyDivisions = useMemo(() => {
    const allDivs = new Set<string>([
      ...champions.map((c) => c.division),
      ...Array.from(reignsByDivision.keys()),
    ])
    return Array.from(allDivs).sort(compareDivisions)
  }, [champions, reignsByDivision])

  const activeDivision = useMemo(() => {
    if (selectedDivision && historyDivisions.includes(selectedDivision)) {
      return selectedDivision
    }
    return historyDivisions[0] ?? ''
  }, [selectedDivision, historyDivisions])

  const visibleHistoryDivisions = useMemo(
    () => (activeDivision ? historyDivisions.filter((d) => d === activeDivision) : historyDivisions.slice(0, 1)),
    [historyDivisions, activeDivision],
  )

  const totalReignsCount = useMemo(() => {
    let total = 0
    for (const list of reignsByDivision.values()) total += list.length
    return total
  }, [reignsByDivision])

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="surface-card relative overflow-hidden rounded-[24px] border border-[var(--border-subtle)] p-5 sm:p-7 shadow-xl">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <SectionHeading
              level={1}
              eyebrow={isArchived ? `${org.name} • Archive (2009–2023)` : org.name}
              title={L(i18n.language, `${org.shortName} • Vektor MMA`, `${org.shortName} Vektor MMA`, `${org.shortName} • Vektor MMA`)}
              description={t(`landing.taglines.${org.id}`, { defaultValue: org.tagline })}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {org.hasPredictions ? (
                <Link
                  to={orgPath(org, 'predictor')}
                  className="primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                >
                  {L(i18n.language, 'Simular Combate', 'Predict a fight', 'Prédire un combat')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              <Link
                to={orgPath(org, 'events')}
                className="ghost-action theme-text inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em]"
              >
                {L(i18n.language, 'Ver Eventos', 'See fight cards', 'Voir les événements')}
              </Link>
            </div>
          </div>
          <div className={`grid gap-2 ${isArchived ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <Tile
              label={L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')}
              value={fighters.length.toLocaleString(localeTag(i18n.language))}
              note={
                isArchived
                  ? L(i18n.language, 'acervo 2009–2023', 'archive 2009–2023', 'archives 2009–2023')
                  : `${activeCount.toLocaleString(localeTag(i18n.language))} ${L(i18n.language, 'ativos', 'active', 'actifs')}`
              }
            />
            {isArchived ? (
              <Tile
                label={L(i18n.language, 'Academias', 'Gyms', 'Salles')}
                value={orgGymsCount.toLocaleString(localeTag(i18n.language))}
                note={L(i18n.language, 'academias mapeadas', 'gyms tracked', 'salles répertoriées')}
              />
            ) : null}
            <Tile
              label={L(i18n.language, 'Eventos', 'Events', 'Événements')}
              value={past.events.length.toLocaleString(localeTag(i18n.language))}
              note={isArchived ? 'Bellator 1 – 301' : undefined}
            />
            <Tile
              label={L(i18n.language, 'Combates', 'Fights', 'Combats')}
              value={fightCount.toLocaleString(localeTag(i18n.language))}
              note={
                isArchived && totalReignsCount > 0
                  ? `${totalReignsCount} ${L(i18n.language, 'reinados de título', 'title reigns', 'règnes de titre')}`
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      {isArchived ? (
        <p role="note" className="surface-card rounded-[20px] px-4 py-4 text-sm leading-6 text-[var(--text-main)]">
          {L(
            i18n.language,
            'O Bellator realizou seu último evento em 2023 e foi absorvido pela PFL, portanto este é um arquivo histórico: os dados aqui não são mais atualizados.',
            org.archived ?? 'Archive 2009–2023. Bellator held its last event in 2023.',
            "Le Bellator a organisé son dernier événement en 2023 avant d'être absorbé par la PFL : il s'agit donc d'archives historiques qui ne sont plus mises à jour.",
          )}
        </p>
      ) : null}

      {isArchived ? (
        <section aria-label="Archive sections" className="space-y-3">
          <SectionHeading
            eyebrow={L(i18n.language, 'Seções do Arquivo', 'Archive sections', "Sections d'archive")}
            title={L(i18n.language, 'Navegue pelo Arquivo Histórico', 'Explore the archive', "Explorer l'archive")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Link to={orgPath(org, 'events')} className="surface-card rounded-2xl p-4 transition hover:bg-[var(--bg-surface-hover)]">
              <span className="text-sm font-bold">{L(i18n.language, 'Eventos', 'Events', 'Événements')}</span>
            </Link>
            <Link to={orgPath(org, 'fighters')} className="surface-card rounded-2xl p-4 transition hover:bg-[var(--bg-surface-hover)]">
              <span className="text-sm font-bold">{L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')}</span>
            </Link>
            {org.hasChampions ? (
              <Link to={orgPath(org, 'champions')} className="surface-card rounded-2xl p-4 transition hover:bg-[var(--bg-surface-hover)]">
                <span className="text-sm font-bold">{L(i18n.language, 'Campeões', 'Champions', 'Champions')}</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isArchived && nextEvent ? (
        <section aria-label="Next event" className="space-y-3">
          <SectionHeading
            eyebrow={L(i18n.language, 'Próximo Evento', 'Next card', 'Prochain événement')}
            title={nextEvent.name}
          />
          {upcoming.loading ? (
            <LoadingSkeleton className="h-[150px]" />
          ) : (
            <EventPanel org={org} event={nextEvent} limit={3} scheduled pickFor={pickFor} onOpenFighter={setProfileName} />
          )}
        </section>
      ) : null}

      <section aria-label="Champions" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionHeading
            eyebrow={L(i18n.language, isArchived ? 'Últimos Campeões (2023)' : 'Cinturões', isArchived ? 'Final champions (2023)' : 'Titles', isArchived ? 'Derniers champions (2023)' : 'Ceintures')}
            title={L(
              i18n.language,
              isArchived ? `Últimos Campeões do ${org.shortName}` : `Campeões do ${org.shortName}`,
              isArchived ? `Final ${org.shortName} champions` : `${org.shortName} champions`,
              isArchived ? `Derniers champions ${org.shortName}` : `Champions ${org.shortName}`,
            )}
            description={
              isArchived
                ? L(
                    i18n.language,
                    'Atletas que detinham o cinturão linear de cada categoria no encerramento das atividades do Bellator em novembro de 2023.',
                    'The fighters holding each division’s belt when Bellator held its final event in November 2023.',
                    'Les combattants qui détenaient la ceinture de chaque catégorie lors de la fermeture du Bellator fin 2023.',
                  )
                : undefined
            }
          />
          {org.hasChampions ? (
            <Link
              to={orgPath(org, 'champions')}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-main)] underline decoration-2 underline-offset-4 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
            >
              {L(i18n.language, 'Seção completa de Campeões', 'Full champions section', 'Section complète des champions')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        {rankingsLoading ? (
          <LoadingSkeleton className="h-[120px]" />
        ) : champions.length ? (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {champions.map(({ division, holders }) => (
              <li key={division}>
                <ChampionTile
                  division={division}
                  holders={holders}
                  lookup={lookup}
                  archived={isArchived}
                  onOpen={setProfileName}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {L(i18n.language, 'Lista de campeões indisponível no momento.', 'Champions are not available yet.', 'La liste des champions n\'est pas encore disponible.')}
          </p>
        )}
      </section>

      {isArchived ? (
        <section aria-label="Title history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow={L(i18n.language, 'Linhagem Completa (2009–2023)', 'Complete Lineage (2009–2023)', 'Lignée complète (2009–2023)')}
              title={L(
                i18n.language,
                'Histórico de Campeões por Categoria',
                'Championship history by division',
                'Historique des champions par catégorie',
              )}
              description={L(
                i18n.language,
                'Todos os reinados e defesas de cinturão de cada divisão do Bellator, do campeão inaugural até o encerramento em 2023.',
                'Every title reign and successful defense across each Bellator weight class from 2009 to 2023.',
                'Tous les règnes et défenses de titre dans chaque catégorie du Bellator de 2009 à 2023.',
              )}
            />
          </div>

          {historyDivisions.length > 1 ? (
            <div
              role="group"
              aria-label={L(i18n.language, 'Filtrar histórico por categoria', 'Filter title history by division', 'Filtrer par catégorie')}
              className="chip-scroll flex w-full max-w-full items-center gap-2 overflow-x-auto pb-1"
            >
              {historyDivisions.map((div) => {
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
                    {getDivisionName(div, i18n.language)} ({count})
                  </button>
                )
              })}
            </div>
          ) : null}

          {past.loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-[220px]" />
              ))}
            </div>
          ) : (
            <div className="w-full">
              {visibleHistoryDivisions.map((division) => (
                <DivisionHistoryCard
                  key={division}
                  division={division}
                  reigns={reignsByDivision.get(division) ?? []}
                  finalChampion={finalChampionByDivision.get(division) ?? null}
                  isArchived={isArchived}
                  lookup={lookup}
                  onOpenFighter={setProfileName}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!isArchived && latestEvent ? (
        <section aria-label="Latest results" className="space-y-3">
          <SectionHeading eyebrow={L(i18n.language, 'Últimos Resultados', 'Latest results', 'Derniers résultats')} title={latestEvent.name} />
          <EventPanel org={org} event={latestEvent} limit={LATEST_RESULTS} onOpenFighter={setProfileName} />
        </section>
      ) : null}

      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {isArchived
          ? L(
              i18n.language,
              `Arquivo histórico compilado a partir de ${org.sourceName === 'ESPN and Wikipedia' ? 'ESPN e Wikipedia' : org.sourceName}.`,
              `Archive built from ${org.sourceName}.`,
              `Archives historiques compilées à partir d'${org.sourceName === 'ESPN and Wikipedia' ? 'ESPN et Wikipédia' : org.sourceName}.`,
            )
          : L(i18n.language, `Dados oficiais via ${org.sourceName}, sincronizados diariamente.`, `Data from ${org.sourceName}, refreshed daily.`, `Données officielles via ${org.sourceName}, synchronisées chaque jour.`)}{' '}
        {L(
          i18n.language,
          'As previsões da IA e o histórico detalhado estão focados no UFC atualmente, onde o modelo preditivo foi validado.',
          'Predictions, head-to-head and the track record are UFC-only for now: the model is trained on UFC fights.',
          'Les prévisions, le face-à-face et le bilan des pronostics restent pour l\'instant limités à l\'UFC : le modèle est entraîné sur des combats UFC.',
        )}{' '}
        <Link to="/predictor" className="font-semibold underline decoration-2 underline-offset-2 hover:bg-[#F2C230] hover:text-[#0E0E0E]">
          {L(i18n.language, 'Simular lutas no UFC →', 'Try the UFC predictor', 'Simuler des combats UFC →')}
        </Link>
      </p>

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={() => setProfileName(null)} onSelectFighter={setProfileName} /> : null}
    </div>
  )
}



function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="surface-card rounded-2xl border border-[var(--border-subtle)] p-3.5 sm:p-4 transition hover:border-[var(--border-strong)]">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-black text-[var(--text-main)] sm:text-3xl">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{note}</p> : null}
    </div>
  )
}

function EventPanel({
  org,
  event,
  limit,
  scheduled = false,
  pickFor,
  onOpenFighter,
}: {
  org: OrgConfig
  event: OrgEvent
  limit: number
  scheduled?: boolean
  pickFor?: (event: string, f1: string, f2: string) => UpcomingPick | undefined
  onOpenFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const fights = event.fights.slice(0, limit)
  return (
    <div className="surface-card rounded-[20px] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(event.date, true, i18n.language)}
        </span>
        {event.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3">
        {fights.map((fight, index) => (
          <OrgFightRow key={fight.fight_url ?? index} org={org.id} fight={fight} scheduled={scheduled} pick={pickFor?.(event.name, fight.fighter_1, fight.fighter_2)} onOpenFighter={onOpenFighter} />
        ))}
      </div>
      <Link
        to={`${orgPath(org, 'events')}?q=${encodeURIComponent(event.name)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-main)] underline decoration-2 underline-offset-4 hover:bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        {event.fight_count > fights.length
          ? L(i18n.language, `Card completo (${event.fight_count} lutas)`, `Full card (${event.fight_count} fights)`, `Carte complète (${event.fight_count} combats)`)
          : L(i18n.language, 'Ver card completo', 'Open the card', 'Voir la carte complète')}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function ChampionTile({
  division,
  holders,
  lookup,
  archived = false,
  onOpen,
}: {
  division: string
  holders: { fighter: string; status: string | null }[]
  lookup: (name: string) => OrgFighter | undefined
  archived?: boolean
  onOpen: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const champion = holders.find((entry) => entry.status !== 'interim') ?? null
  const interim = holders.find((entry) => entry.status === 'interim') ?? null
  const profile = champion ? lookup(champion.fighter) : undefined
  const record = profile ? formatRecord(profile) : null

  return (
    <div className="surface-card flex h-full items-center gap-3.5 rounded-2xl border border-[var(--border-subtle)] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-lg">
      <FighterAvatar name={champion?.fighter ?? division} imageUrl={profile?.image_url ?? null} highlight={Boolean(champion)} className="h-14 w-12" />
      <div className="min-w-0 flex-1">
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{getDivisionName(division, i18n.language)}</p>
        {champion ? (
          <>
            <button type="button" onClick={() => onOpen(champion.fighter)} className="mt-0.5 flex max-w-full items-center gap-1.5 text-left text-base font-bold text-[var(--text-main)] hover:underline">
              <Crown className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-hidden="true" />
              {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} /> : null}
              <span className="truncate">{champion.fighter}</span>
            </button>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              {record ? <span className="font-semibold text-[var(--text-main)]">{record}</span> : null}
              {record && archived ? ' · ' : ''}
              {archived ? L(i18n.language, 'Último campeão', 'Final champion', 'Dernier champion') : null}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-sm font-bold text-[var(--text-muted)]">
            {archived
              ? L(i18n.language, 'Desativado / Vago', 'Inactive / Vacant', 'Inactif / Vacant')
              : L(i18n.language, 'Cinturão Vago', 'Vacant', 'Ceinture vacante')}
          </p>
        )}
        {interim ? (
          <button type="button" onClick={() => onOpen(interim.fighter)} className="block max-w-full truncate text-left text-xs text-[var(--text-muted)] underline decoration-2 underline-offset-2">
            {L(i18n.language, 'Interino', 'Interim', 'Intérimaire')}: {interim.fighter}
          </button>
        ) : null}
      </div>
    </div>
  )
}
