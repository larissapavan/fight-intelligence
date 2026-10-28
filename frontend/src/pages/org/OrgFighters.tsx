import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, localeTag } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { compareDivisions, formatDate, formatRecord } from '../../shared/data/orgFormat'
import { normalizeFighterName } from '../../shared/hooks/useFighterImages'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgFighters } from '../../shared/hooks/useOrgData'
import type { OrgFighter } from '../../shared/types/api'

const PAGE_SIZE = 48

type Status = 'active' | 'all'

/** Champions first, then the ranked, then the rest by name. */
function compareFighters(a: OrgFighter, b: OrgFighter) {
  return (
    Number(b.belt) - Number(a.belt) ||
    Number(Boolean(b.ranking)) - Number(Boolean(a.ranking)) ||
    Number(b.is_active) - Number(a.is_active) ||
    a.name.localeCompare(b.name)
  )
}

export function OrgFighters() {
  const { i18n } = useTranslation()
  const org = useOrg()
  const { fighters, loading, error } = useOrgFighters(org.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const allDivisionsLabel = L(i18n.language, 'Todas as categorias', 'All divisions', 'Toutes les catégories')
  const [division, setDivision] = useState('ALL')
  // An organization that closed has few active fighters left: show everyone who ever fought in it.
  const [status, setStatus] = useState<Status>(org.archived ? 'all' : 'active')
  const [shown, setShown] = useState(PAGE_SIZE)
  const profileName = searchParams.get('fighter')

  const divisions = useMemo(
    () => Array.from(new Set(fighters.map((fighter) => fighter.division).filter((value): value is string => Boolean(value)))).sort(compareDivisions),
    [fighters],
  )

  const matches = useMemo(() => {
    const term = normalizeFighterName(query)
    return fighters
      .filter((fighter) => status === 'all' || fighter.is_active || term !== '')
      .filter((fighter) => division === 'ALL' || fighter.division === division)
      .filter(
        (fighter) =>
          !term ||
          normalizeFighterName(fighter.name).includes(term) ||
          normalizeFighterName(fighter.nickname ?? '').includes(term) ||
          normalizeFighterName(fighter.camp ?? '').includes(term),
      )
      .sort(compareFighters)
  }, [fighters, query, division, status])

  const activeCount = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])

  const openProfile = (name: string) => setSearchParams({ fighter: name })
  const closeProfile = () => setSearchParams({})
  const reset = () => setShown(PAGE_SIZE)

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            level={1}
            eyebrow={L(i18n.language, `Atletas do ${org.shortName}`, `${org.shortName} roster`, `Athlètes ${org.shortName}`)}
            title={L(i18n.language, `Lutadores do ${org.shortName}`, `${org.shortName} fighters`, `Combattants ${org.shortName}`)}
            description={L(
              i18n.language,
              `Todos os atletas que já pisaram no cage do ${org.shortName}, com cartel completo, histórico de lutas e academia. Lutadores ativos em destaque.`,
              `Every fighter who has stepped into the ${org.shortName} cage, with record, build, camp and their fights. Active fighters first.`,
              `Tous les athlètes qui sont déjà montés dans la cage ${org.shortName}, avec palmarès, historique et salle. Les combattants actifs en premier.`,
            )}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile label={L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')} value={fighters.length.toLocaleString(localeTag(i18n.language))} />
            <Tile label={L(i18n.language, 'Em atividade', 'Active', 'En activité')} value={activeCount.toLocaleString(localeTag(i18n.language))} />
            <Tile label={L(i18n.language, 'Categorias', 'Divisions', 'Catégories')} value={`${divisions.length}`} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_220px_auto]">
          <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-[var(--accent-red)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                reset()
              }}
              placeholder={L(i18n.language, 'Buscar por nome, apelido ou academia...', 'Search by name, nickname or camp', 'Chercher par nom, surnom ou salle...')}
              aria-label={L(i18n.language, 'Buscar lutadores', 'Search fighters', 'Chercher des combattants')}
              className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <select
            value={division}
            onChange={(event) => {
              setDivision(event.target.value)
              reset()
            }}
            aria-label={L(i18n.language, 'Filtrar por categoria', 'Filter by division', 'Filtrer par catégorie')}
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="ALL">{allDivisionsLabel}</option>
            {divisions.map((value) => (
              <option key={value} value={value}>
                {getDivisionName(value, i18n.language)}
              </option>
            ))}
          </select>
          <div role="group" aria-label={L(i18n.language, 'Status', 'Status', 'Statut')} className="inline-flex border-2 border-[var(--rule)] bg-[var(--card-bg)]">
            {(['active', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value)
                  reset()
                }}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  status === value ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
                }`}
              >
                {value === 'active' ? L(i18n.language, 'Ativos', 'Active', 'Actifs') : L(i18n.language, 'Todos', 'All time', 'Tous')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2000px]:grid-cols-5">
          {Array.from({ length: 9 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[96px]" />
          ))}
        </section>
      ) : matches.length ? (
        <section aria-label="Fighters" className="space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            {L(
              i18n.language,
              `Exibindo ${Math.min(shown, matches.length).toLocaleString('pt-BR')} de ${matches.length.toLocaleString('pt-BR')}`,
              `Showing ${Math.min(shown, matches.length).toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')}`,
              `Affichage de ${Math.min(shown, matches.length).toLocaleString(localeTag(i18n.language))} sur ${matches.length.toLocaleString(localeTag(i18n.language))}`,
            )}
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2000px]:grid-cols-5">
            {matches.slice(0, shown).map((fighter) => (
              <li key={fighter.name}>
                <FighterCard fighter={fighter} onOpen={openProfile} />
              </li>
            ))}
          </ul>
          {shown < matches.length ? (
            <button
              type="button"
              onClick={() => setShown((count) => count + PAGE_SIZE)}
              className="ghost-action mx-auto block px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-main)]"
            >
              {L(i18n.language, 'Carregar mais lutadores', 'Show more fighters', 'Afficher plus de combattants')}
            </button>
          ) : null}
        </section>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">
            {L(i18n.language, 'Nenhum lutador encontrado', 'No fighters found', 'Aucun combattant trouvé')}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {L(i18n.language, 'Tente ajustar os termos de busca ou o filtro de categoria.', 'Adjust the search or the filters.', 'Ajustez la recherche ou les filtres.')}
          </p>
        </div>
      )}

      {profileName ? <OrgFighterModal key={profileName} org={org} name={profileName} onClose={closeProfile} onSelectFighter={openProfile} /> : null}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3 py-2.5">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
    </div>
  )
}

function FighterCard({ fighter, onOpen }: { fighter: OrgFighter; onOpen: (name: string) => void }) {
  const { i18n } = useTranslation()
  const record = formatRecord(fighter)
  const interim = fighter.title_status === 'interim'
  return (
    <button
      type="button"
      onClick={() => onOpen(fighter.name)}
      aria-label={L(i18n.language, `${fighter.name}. Ver perfil`, `${fighter.name}. View profile`, `${fighter.name}. Voir le profil`)}
      className="metric-tile flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]"
    >
      <FighterAvatar name={fighter.name} imageUrl={fighter.image_url} highlight={fighter.belt} className="h-16 w-14" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          {fighter.country_code ? <FlagIcon code={fighter.country_code} country={fighter.country} /> : null}
          <span className="truncate text-base font-bold text-[var(--text-main)]">{fighter.name}</span>
        </span>
        {fighter.nickname ? <span className="block truncate text-xs italic text-[var(--text-muted)]">“{fighter.nickname}”</span> : null}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
          {record ? <span className="font-semibold text-[var(--text-main)]">{record}</span> : null}
          {fighter.division ? <span>{getDivisionName(fighter.division, i18n.language)}</span> : null}
          {!fighter.is_active ? <span>{L(i18n.language, 'Inativo', 'Not fighting', 'Inactif')}</span> : null}
        </span>
        {fighter.belt || fighter.ranking ? (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {fighter.belt ? (
              <span
                className={`border-2 border-[var(--rule)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] ${interim ? 'bg-[#1F4E9C] text-white' : 'bg-[#F2C230] text-[#0E0E0E]'}`}
              >
                {interim ? L(i18n.language, 'Campeão Interino', 'Interim champion', 'Champion intérimaire') : L(i18n.language, 'Campeão', 'Champion', 'Champion')}
              </span>
            ) : fighter.ranking ? (
              <span className="border-2 border-[var(--rule)] bg-[var(--surface-3)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--text-main)]">
                {fighter.ranking}
              </span>
            ) : null}
          </span>
        ) : null}
        {fighter.next_fight ? (
          <span className="mt-1.5 block truncate text-xs text-[var(--text-muted)]">
            {L(i18n.language, 'Próxima luta', 'Next', 'Prochain')}: vs {fighter.next_fight.opponent} · {formatDate(fighter.next_fight.date, false, i18n.language)}
          </span>
        ) : null}
      </span>
    </button>
  )
}
