import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Crown, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { L, localeTag } from '../i18n/lang'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { orgPath } from '../shared/data/orgs'
import { useGyms } from '../shared/hooks/useGyms'
import { useOrg } from '../shared/hooks/useOrg'
import { normalizeFighterName } from '../shared/hooks/useFighterImages'
import type { GymSummary } from '../shared/types/api'

const PAGE_SIZE = 40

type Scope = 'org' | 'all'
type Sort = 'org' | 'size' | 'champions' | 'name'

export function Gyms() {
  const { t, i18n } = useTranslation()
  const org = useOrg()
  const { gyms, loading, error } = useGyms()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('org')
  const [sort, setSort] = useState<Sort>('org')
  const [shown, setShown] = useState(PAGE_SIZE)

  const inOrg = (gym: GymSummary) => gym.orgs[org.id] ?? 0
  const orgGyms = useMemo(() => gyms.filter((gym) => (gym.orgs[org.id] ?? 0) > 0), [gyms, org.id])
  const orgFighters = useMemo(() => orgGyms.reduce((sum, gym) => sum + (gym.orgs[org.id] ?? 0), 0), [orgGyms, org.id])

  const matches = useMemo(() => {
    const term = normalizeFighterName(query)
    const count = (gym: GymSummary) => gym.orgs[org.id] ?? 0
    const order: Record<Sort, (a: GymSummary, b: GymSummary) => number> = {
      org: (a, b) => count(b) - count(a) || b.fighters_count - a.fighters_count,
      size: (a, b) => b.fighters_count - a.fighters_count,
      champions: (a, b) => b.champions - a.champions || count(b) - count(a),
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return (scope === 'org' ? orgGyms : gyms)
      .filter((gym) => !term || normalizeFighterName(gym.name).includes(term))
      .sort((a, b) => order[sort](a, b) || a.name.localeCompare(b.name))
  }, [gyms, orgGyms, query, scope, sort, org.id])

  const reset = () => setShown(PAGE_SIZE)

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr] xl:items-end">
          <SectionHeading
            level={1}
            eyebrow={t('gyms.eyebrow')}
            title={`${org.shortName} ${t('gyms.title')}`}
            description={t('gyms.description')}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile label={t('gyms.totalGyms')} value={gyms.length.toLocaleString(localeTag(i18n.language))} />
            <Tile label={t('gyms.withOrgFighters')} value={orgGyms.length.toLocaleString(localeTag(i18n.language))} />
            <Tile label={t('gyms.fightersPlaced')} value={orgFighters.toLocaleString(localeTag(i18n.language))} />
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_200px_auto]">
          <div className="soft-input flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-[var(--accent-red)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                reset()
              }}
              placeholder={t('gyms.searchPlaceholder')}
              aria-label={L(i18n.language, 'Buscar academias', 'Search gyms', 'Rechercher des salles')}
              className="theme-text w-full bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label={L(i18n.language, 'Ordenar academias', 'Sort gyms', 'Trier les salles')}
            className="soft-input theme-text rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="org">{t('gyms.mostFighters')}</option>
            <option value="size">{t('gyms.biggestRoster')}</option>
            <option value="champions">{t('gyms.mostChampions')}</option>
            <option value="name">{t('gyms.name')}</option>
          </select>
          <div role="group" aria-label={L(i18n.language, 'Filtrar academias', 'Which gyms', 'Quelles salles')} className="inline-flex border-2 border-[var(--rule)] bg-[var(--card-bg)]">
            {(['org', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => {
                  setScope(value)
                  reset()
                }}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  scope === value ? 'bg-[var(--rule)] text-[var(--card-bg)]' : 'text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
                }`}
              >
                {value === 'org' ? org.shortName : t('gyms.allGyms')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p> : null}

      {loading ? (
        <section className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : matches.length ? (
        <section className="space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            {L(
              i18n.language,
              `Exibindo ${Math.min(shown, matches.length).toLocaleString('pt-BR')} de ${matches.length.toLocaleString('pt-BR')}`,
              `Showing ${Math.min(shown, matches.length).toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')}`,
              `Affichage de ${Math.min(shown, matches.length).toLocaleString(localeTag(i18n.language))} sur ${matches.length.toLocaleString(localeTag(i18n.language))}`,
            )}
          </p>
          <ul aria-label={L(i18n.language, 'Academias', 'Gyms', 'Salles')} className="grid gap-2.5 md:grid-cols-2">
            {matches.slice(0, shown).map((gym) => (
              <li key={gym.slug}>
                <GymRow gym={gym} orgName={org.shortName} to={`${orgPath(org, 'gyms')}/${gym.slug}`} inOrg={inOrg(gym)} />
              </li>
            ))}
          </ul>
          {shown < matches.length ? (
            <button
              type="button"
              onClick={() => setShown((count) => count + PAGE_SIZE)}
              className="ghost-action mx-auto block px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-main)]"
            >
              {L(i18n.language, 'Mostrar mais academias', 'Show more gyms', 'Afficher plus de salles')}
            </button>
          ) : null}
        </section>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-7 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">{t('gyms.noGymsFound')}</p>
        </div>
      )}
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

function GymRow({ gym, orgName, to, inOrg }: { gym: GymSummary; orgName: string; to: string; inOrg: number }) {
  const { i18n } = useTranslation()

  return (
    <Link
      to={to}
      className="metric-tile flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-[var(--text-main)]">{gym.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>
            <span className="font-semibold text-[var(--text-main)]">{inOrg}</span> {orgName} {inOrg === 1 ? L(i18n.language, 'lutador', 'fighter', 'lutteur') : L(i18n.language, 'lutadores', 'fighters', 'lutteurs')}
          </span>
          <span>{gym.fighters_count} {L(i18n.language, 'atletas', 'listed', 'inscrits')}</span>
          {gym.champions > 0 ? (
            <span className="inline-flex items-center gap-1 border-2 border-[var(--rule)] bg-[#F2C230] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[#0E0E0E]">
              <Crown className="h-3 w-3" aria-hidden="true" />
              {gym.champions} {gym.champions === 1 ? L(i18n.language, 'campeão', 'champion', 'champion') : L(i18n.language, 'campeões', 'champions', 'champions')}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
    </Link>
  )
}
