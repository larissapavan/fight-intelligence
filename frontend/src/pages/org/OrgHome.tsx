import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Crown, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFightRow } from '../../shared/components/OrgFightRow'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, localeTag } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { compareDivisions, formatDate } from '../../shared/data/orgFormat'
import { orgPath, type OrgConfig } from '../../shared/data/orgs'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgEvents, useOrgFighters, useOrgRankings, useOrgUpcomingEvents } from '../../shared/hooks/useOrgData'
import { useOrgFighterLookup } from '../../shared/hooks/useOrgFighterLookup'
import type { OrgEvent } from '../../shared/types/api'

const LATEST_RESULTS = 4

export function OrgHome() {
  const { t, i18n } = useTranslation()
  const org = useOrg()
  const { fighters } = useOrgFighters(org.id)
  const past = useOrgEvents(org.id)
  const upcoming = useOrgUpcomingEvents(org.id)
  const { rankings, loading: rankingsLoading } = useOrgRankings(org.id)
  const lookup = useOrgFighterLookup(org.id)
  const [profileName, setProfileName] = useState<string | null>(null)

  const nextEvent = upcoming.events[0] ?? null
  const latestEvent = past.events[0] ?? null
  const fightCount = useMemo(() => past.events.reduce((sum, event) => sum + event.fight_count, 0), [past.events])
  const activeCount = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="page-hero rounded-[20px] px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <SectionHeading
              level={1}
              eyebrow={org.name}
              title={L(i18n.language, `${org.shortName} • Estatísticas & Inteligência`, `${org.shortName} fight intelligence`, `${org.shortName} • statistiques et intelligence`)}
              description={t(`landing.taglines.${org.id}`, { defaultValue: org.tagline })}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroLink to={orgPath(org, 'events')}>{L(i18n.language, 'Cards & Eventos', 'Fight cards', 'Cartes et événements')}</HeroLink>
              <HeroLink to={orgPath(org, 'fighters')}>{L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')}</HeroLink>
              {org.hasRankings ? <HeroLink to={orgPath(org, 'rankings')}>{t('nav.rankings', 'Rankings')}</HeroLink> : null}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile
              label={L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')}
              value={fighters.length.toLocaleString(localeTag(i18n.language))}
              note={`${activeCount.toLocaleString(localeTag(i18n.language))} ${L(i18n.language, 'em atividade', 'active', 'en activité')}`}
            />
            <Tile label={L(i18n.language, 'Eventos', 'Events', 'Événements')} value={past.events.length.toLocaleString(localeTag(i18n.language))} />
            <Tile label={L(i18n.language, 'Lutas Cadastradas', 'Fights', 'Combats')} value={fightCount.toLocaleString(localeTag(i18n.language))} />
          </div>
        </div>
      </section>

      {org.archived && !nextEvent ? (
        <p role="note" className="surface-card rounded-[20px] px-4 py-4 text-sm leading-6 text-[var(--text-main)]">
          {L(
            i18n.language,
            'O Bellator realizou seu último evento em 2023 e foi absorvido pela PFL, portanto este é um arquivo histórico: os dados aqui não são mais atualizados.',
            org.archived,
            'Le Bellator a organisé son dernier événement en 2023 avant d\'être absorbé par la PFL : il s\'agit donc d\'archives historiques qui ne sont plus mises à jour.',
          )}
        </p>
      ) : (
        <section aria-label="Next event" className="space-y-3">
          <SectionHeading
            eyebrow={L(i18n.language, 'Próximo Evento', 'Next card', 'Prochain événement')}
            title={nextEvent ? nextEvent.name : L(i18n.language, 'Nenhum evento anunciado', 'No event announced', 'Aucun événement annoncé')}
          />
          {upcoming.loading ? (
            <LoadingSkeleton className="h-[150px]" />
          ) : nextEvent ? (
            <EventPanel org={org} event={nextEvent} limit={3} scheduled onOpenFighter={setProfileName} />
          ) : (
            <p className="surface-card rounded-[20px] px-4 py-5 text-sm text-[var(--text-muted)]">
              {L(
                i18n.language,
                `O próximo card do ${org.shortName} ainda não foi confirmado.`,
                `The next ${org.shortName} card has not been announced yet.`,
                `La prochaine carte ${org.shortName} n'a pas encore été confirmée.`,
              )}
            </p>
          )}
        </section>
      )}

      <section aria-label="Champions" className="space-y-3">
        <SectionHeading
          eyebrow={L(i18n.language, org.archived ? 'Últimos Campeões' : 'Cinturões', org.archived ? 'Final champions' : 'Titles', org.archived ? 'Derniers champions' : 'Ceintures')}
          title={L(i18n.language, `Campeões do ${org.shortName}`, `${org.shortName} champions`, `Champions ${org.shortName}`)}
        />
        {rankingsLoading ? (
          <LoadingSkeleton className="h-[120px]" />
        ) : champions.length ? (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {champions.map(({ division, holders }) => (
              <li key={division}>
                <ChampionTile division={division} holders={holders} lookup={lookup} onOpen={setProfileName} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {L(i18n.language, 'Lista de campeões indisponível no momento.', 'Champions are not available yet.', 'La liste des champions n\'est pas encore disponible.')}
          </p>
        )}
      </section>

      {latestEvent ? (
        <section aria-label="Latest results" className="space-y-3">
          <SectionHeading eyebrow={L(i18n.language, 'Últimos Resultados', 'Latest results', 'Derniers résultats')} title={latestEvent.name} />
          <EventPanel org={org} event={latestEvent} limit={LATEST_RESULTS} onOpenFighter={setProfileName} />
        </section>
      ) : null}

      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {org.archived
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

function HeroLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="primary-action inline-flex items-center gap-1.5 px-4 py-2.5 text-xs uppercase">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
      {note ? <p className="text-[11px] text-[var(--text-muted)]">{note}</p> : null}
    </div>
  )
}

function EventPanel({
  org,
  event,
  limit,
  scheduled = false,
  onOpenFighter,
}: {
  org: OrgConfig
  event: OrgEvent
  limit: number
  scheduled?: boolean
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
          <OrgFightRow key={fight.fight_url ?? index} org={org.id} fight={fight} scheduled={scheduled} onOpenFighter={onOpenFighter} />
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
  onOpen,
}: {
  division: string
  holders: { fighter: string; status: string | null }[]
  lookup: (name: string) => { image_url: string | null } | undefined
  onOpen: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const champion = holders.find((entry) => entry.status !== 'interim') ?? null
  const interim = holders.find((entry) => entry.status === 'interim') ?? null
  return (
    <div className="metric-tile flex h-full items-center gap-3 rounded-2xl px-3 py-3">
      <FighterAvatar name={champion?.fighter ?? division} imageUrl={champion ? (lookup(champion.fighter)?.image_url ?? null) : null} highlight={Boolean(champion)} className="h-14 w-12" />
      <div className="min-w-0 flex-1">
        <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{getDivisionName(division, i18n.language)}</p>
        {champion ? (
          <button type="button" onClick={() => onOpen(champion.fighter)} className="flex max-w-full items-center gap-1.5 text-left text-base font-bold text-[var(--text-main)]">
            <Crown className="h-3.5 w-3.5 shrink-0 text-[var(--accent-red)]" aria-hidden="true" />
            <span className="truncate">{champion.fighter}</span>
          </button>
        ) : (
          <p className="text-base font-bold text-[var(--text-muted)]">{L(i18n.language, 'Cinturão Vago', 'Vacant', 'Ceinture vacante')}</p>
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
