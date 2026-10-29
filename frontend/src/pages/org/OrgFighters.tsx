import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Flame,
  Footprints,
  Hammer,
  HandFist,
  Radio,
  Ruler,
  Search,
  Shield,
  Swords,
  Target,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FighterAvatar } from '../../shared/components/FighterAvatar'
import { FlagIcon } from '../../shared/components/FlagIcon'
import { ChampionBelt } from '../../shared/components/ChampionBelt'
import { LoadingSkeleton } from '../../shared/components/LoadingSkeleton'
import { MiniStat } from '../../shared/components/MiniStat'
import { OrgFighterModal } from '../../shared/components/OrgFighterModal'
import { SectionHeading } from '../../shared/components/SectionHeading'
import { L, localeTag } from '../../i18n/lang'
import { getDivisionName } from '../../shared/data/divisions'
import { compareDivisions, formatHeight, formatReach, formatRecord } from '../../shared/data/orgFormat'
import { normalizeFighterName } from '../../shared/hooks/useFighterImages'
import { useOrg } from '../../shared/hooks/useOrg'
import { useOrgFighters } from '../../shared/hooks/useOrgData'
import type { OrgFighter } from '../../shared/types/api'

const PAGE_SIZE = 24

type Status = 'active' | 'all'

function getDivisionIcon(division: string): LucideIcon {
  const d = division.toLowerCase()
  if (d.includes('straw') || d.includes('atom')) return Zap
  if (d.includes('fly')) return Footprints
  if (d.includes('bantam')) return Target
  if (d.includes('feather')) return Flame
  if (d.includes('lightweight')) return Shield
  if (d.includes('welter')) return Swords
  if (d.includes('middle')) return HandFist
  if (d.includes('light heavy')) return Hammer
  if (d.includes('heavy')) return Dumbbell
  return Swords
}

/** Champions first, then the ranked, then by name. */
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
  const [division, setDivision] = useState('ALL')
  const isArchived = Boolean(org.archived)
  const [status, setStatus] = useState<Status>(isArchived ? 'all' : 'active')
  const [shown, setShown] = useState(PAGE_SIZE)
  const profileName = searchParams.get('fighter')

  const divisions = useMemo(
    () =>
      Array.from(
        new Set(
          fighters
            .map((fighter) => fighter.division)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(compareDivisions),
    [fighters],
  )

  const activeCount = useMemo(() => fighters.filter((fighter) => fighter.is_active).length, [fighters])
  const championsCount = useMemo(() => fighters.filter((fighter) => fighter.belt).length, [fighters])

  // Map fighters to divisions
  const matches = useMemo(() => {
    const term = normalizeFighterName(query)
    return fighters
      .filter((fighter) => isArchived || status === 'all' || fighter.is_active || term !== '')
      .filter((fighter) => division === 'ALL' || fighter.division === division)
      .filter(
        (fighter) =>
          !term ||
          normalizeFighterName(fighter.name).includes(term) ||
          normalizeFighterName(fighter.nickname ?? '').includes(term) ||
          normalizeFighterName(fighter.camp ?? '').includes(term) ||
          normalizeFighterName(fighter.division ?? '').includes(term),
      )
      .sort(compareFighters)
  }, [fighters, query, division, status, isArchived])

  // Counts by division under current filters
  const divisionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    const term = normalizeFighterName(query)
    const baseFighters = fighters.filter(
      (f) => isArchived || status === 'all' || f.is_active || term !== '',
    )
    for (const d of divisions) {
      counts.set(d, baseFighters.filter((f) => f.division === d).length)
    }
    return counts
  }, [fighters, divisions, query, status, isArchived])

  const openProfile = (name: string) => setSearchParams({ fighter: name })
  const closeProfile = () => setSearchParams({})
  const reset = () => setShown(PAGE_SIZE)

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-5 sm:py-5">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <SectionHeading
            level={1}
            eyebrow={L(i18n.language, `Atletas do ${org.shortName}`, `${org.shortName} roster`, `Athlètes ${org.shortName}`)}
            title={L(i18n.language, `Lutadores do ${org.shortName}`, `${org.shortName} fighters`, `Combattants ${org.shortName}`)}
            description={
              isArchived
                ? L(
                    i18n.language,
                    `Arquivo histórico completo de atletas que lutaram no ${org.shortName} (2009–2023), com cartel, envergadura, academia e histórico detalhado.`,
                    `Historical archive of every fighter who stepped into the ${org.shortName} cage (2009–2023), with record, camp and bout history.`,
                    `Archives complètes de tous les athlètes ayant combattu au ${org.shortName} (2009–2023), avec palmarès, salle et combats.`,
                  )
                : L(
                    i18n.language,
                    `Todos os atletas cadastrados do ${org.shortName}, com cartel completo, dados físicos, volume de golpes e academia. Lutadores ativos em destaque.`,
                    `Every fighter on the ${org.shortName} roster, with record, physical stats, striking telemetry and camps. Active fighters first.`,
                    `Tous les athlètes répertoriés à ${org.shortName}, avec palmarès, mensurations, frappes et salles. Combattants actifs en tête.`,
                  )
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile
              label={L(i18n.language, 'Lutadores', 'Fighters', 'Combattants')}
              value={fighters.length.toLocaleString(localeTag(i18n.language))}
            />
            {isArchived ? (
              <Tile
                label={L(i18n.language, 'Últimos Campeões', 'Final Champions', 'Derniers champions')}
                value={championsCount.toLocaleString(localeTag(i18n.language))}
              />
            ) : (
              <Tile
                label={L(i18n.language, 'Em atividade', 'Active', 'En activité')}
                value={activeCount.toLocaleString(localeTag(i18n.language))}
              />
            )}
            <Tile
              label={L(i18n.language, 'Categorias', 'Divisions', 'Catégories')}
              value={`${divisions.length}`}
            />
          </div>
        </div>

        {/* Search & Status Bar */}
        <div className="mt-4 grid gap-2.5 md:grid-cols-[1fr_auto]">
          <div className="soft-input flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--accent-red)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                reset()
              }}
              placeholder={L(
                i18n.language,
                'Buscar por nome, apelido, categoria ou academia...',
                'Search by name, nickname or camp',
                'Chercher par nom, surnom ou salle...',
              )}
              aria-label={L(i18n.language, 'Buscar lutadores', 'Search fighters', 'Chercher des combattants')}
              className="theme-text w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {!isArchived ? (
            <div
              role="group"
              aria-label={L(i18n.language, 'Status', 'Status', 'Statut')}
              className="inline-flex max-w-full overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1"
            >
              <button
                type="button"
                aria-label={L(i18n.language, 'Ativos', 'Active', 'Actifs')}
                aria-pressed={status === 'active'}
                onClick={() => {
                  setStatus('active')
                  reset()
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  status === 'active'
                    ? 'bg-[var(--rule)] text-[var(--card-bg)] shadow-sm'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Radio className="h-3 w-3" />
                <span>{L(i18n.language, 'Ativos', 'Active', 'Actifs')}</span>
                <span
                  aria-hidden="true"
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    status === 'active' ? 'bg-[var(--tape)] text-[#0E0E0E]' : 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {activeCount}
                </span>
              </button>

              <button
                type="button"
                aria-label={L(i18n.language, 'Todos', 'All time', 'Tous')}
                aria-pressed={status === 'all'}
                onClick={() => {
                  setStatus('all')
                  reset()
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  status === 'all'
                    ? 'bg-[var(--rule)] text-[var(--card-bg)] shadow-sm'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <span>{L(i18n.language, 'Todos', 'All time', 'Tous')}</span>
                <span
                  aria-hidden="true"
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    status === 'all' ? 'bg-[var(--tape)] text-[#0E0E0E]' : 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {fighters.length}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">
          {error}
        </p>
      ) : null}

      {/* UFC-Style Horizontal Weight Class Bar */}
      {divisions.length > 0 && !loading ? (
        <OrgWeightClassBar
          divisions={divisions}
          counts={divisionCounts}
          activeDivision={division}
          totalCount={fighters.length}
          onSelect={(d) => {
            setDivision(d)
            reset()
          }}
        />
      ) : null}

      {/* Division Spotlight Header */}
      {division !== 'ALL' && !loading ? (
        <div className="surface-card flex items-center justify-between rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-red)]/15 text-[var(--accent-red)]">
              {(() => {
                const Icon = getDivisionIcon(division)
                return <Icon className="h-5 w-5" />
              })()}
            </div>
            <div>
              <p className="broadcast-label text-[10px] text-[var(--text-muted)]">
                {L(i18n.language, 'Categoria Ativa', 'Active Division', 'Catégorie active')}
              </p>
              <h2 className="text-lg font-bold uppercase tracking-wide text-[var(--text-main)]">
                {getDivisionName(division, i18n.language)}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDivision('ALL')}
            className="text-xs font-bold uppercase tracking-wider text-[var(--accent-red)] hover:underline"
          >
            {L(i18n.language, 'Ver todas as categorias', 'View all divisions', 'Voir toutes')}
          </button>
        </div>
      ) : null}

      {/* Fighters Grid */}
      {loading ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2000px]:grid-cols-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[240px] rounded-[18px]" />
          ))}
        </section>
      ) : matches.length ? (
        <section aria-label="Fighters" className="space-y-4">
          <p className="text-xs font-semibold text-[var(--text-muted)]">
            {L(
              i18n.language,
              `Exibindo ${Math.min(shown, matches.length).toLocaleString('pt-BR')} de ${matches.length.toLocaleString('pt-BR')} atletas`,
              `Showing ${Math.min(shown, matches.length).toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')} fighters`,
              `Affichage de ${Math.min(shown, matches.length).toLocaleString(localeTag(i18n.language))} sur ${matches.length.toLocaleString(localeTag(i18n.language))} combattants`,
            )}
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2000px]:grid-cols-6">
            {matches.slice(0, shown).map((fighter) => (
              <FighterCard
                key={fighter.name}
                fighter={fighter}
                archived={isArchived}
                onOpen={openProfile}
              />
            ))}
          </div>

          {shown < matches.length ? (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShown((count) => count + PAGE_SIZE)}
                className="primary-action inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white"
              >
                {L(
                  i18n.language,
                  `Carregar mais ${Math.min(PAGE_SIZE, matches.length - shown)}`,
                  `Show ${Math.min(PAGE_SIZE, matches.length - shown)} more`,
                  `Afficher plus`,
                )}
              </button>
              <button
                type="button"
                onClick={() => setShown(matches.length)}
                className="ghost-action theme-text inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em]"
              >
                {L(
                  i18n.language,
                  `Mostrar todos (${matches.length.toLocaleString('pt-BR')})`,
                  `Show all (${matches.length.toLocaleString('en-US')})`,
                  `Tout afficher`,
                )}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="surface-card rounded-[20px] px-4 py-8 text-center">
          <p className="type-display text-2xl font-bold uppercase tracking-[0.03em] text-[var(--text-main)]">
            {L(i18n.language, 'Nenhum lutador encontrado', 'No fighters found', 'Aucun combattant trouvé')}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {L(
              i18n.language,
              'Tente ajustar os termos de busca ou mudar os filtros de categoria.',
              'Adjust the search or filter to explore other fighter profiles.',
              'Ajustez la recherche ou les filtres pour trouver un autre profil.',
            )}
          </p>
        </div>
      )}

      {profileName ? (
        <OrgFighterModal
          key={profileName}
          org={org}
          name={profileName}
          onClose={closeProfile}
          onSelectFighter={openProfile}
        />
      ) : null}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-xl px-3.5 py-3">
      <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="data-value mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
    </div>
  )
}

function OrgWeightClassBar({
  divisions,
  counts,
  activeDivision,
  totalCount,
  onSelect,
}: {
  divisions: string[]
  counts: Map<string, number>
  activeDivision: string
  totalCount: number
  onSelect: (d: string) => void
}) {
  const { i18n } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    updateEdges()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateEdges, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [updateEdges])

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <EdgeFade side="left" visible={edges.left} />
      <EdgeFade side="right" visible={edges.right} />
      <ScrollButton direction="left" visible={edges.left} onClick={() => scrollBy(-240)} />
      <ScrollButton direction="right" visible={edges.right} onClick={() => scrollBy(240)} />

      <div
        ref={scrollRef}
        className="chip-scroll flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar"
      >
        <button
          type="button"
          onClick={() => onSelect('ALL')}
          aria-pressed={activeDivision === 'ALL'}
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition duration-200 ${
            activeDivision === 'ALL'
              ? 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)] shadow-sm'
              : 'border-[var(--line-soft)] bg-[var(--card-bg)] text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
          }`}
        >
          <Swords className="h-3.5 w-3.5 shrink-0" />
          <span>{L(i18n.language, 'Todas as Categorias', 'All Divisions', 'Toutes')}</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeDivision === 'ALL'
                ? 'bg-[var(--tape)] text-[#0E0E0E]'
                : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {divisions.map((d) => {
          const count = counts.get(d) ?? 0
          const isActive = activeDivision === d
          const Icon = getDivisionIcon(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isActive}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition duration-200 ${
                isActive
                  ? 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)] shadow-sm'
                  : 'border-[var(--line-soft)] bg-[var(--card-bg)] text-[var(--text-main)] hover:bg-[var(--tape)] hover:text-[#0E0E0E]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{getDivisionName(d, i18n.language)}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-[var(--tape)] text-[#0E0E0E]'
                    : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EdgeFade({ side, visible }: { side: 'left' | 'right'; visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 z-10 w-8 transition-opacity duration-200 ${
        side === 'left' ? 'left-0 bg-gradient-to-r from-[var(--canvas-bg)] to-transparent' : 'right-0 bg-gradient-to-l from-[var(--canvas-bg)] to-transparent'
      } ${visible ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}

function ScrollButton({
  direction,
  visible,
  onClick,
}: {
  direction: 'left' | 'right'
  visible: boolean
  onClick: () => void
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!visible}
      tabIndex={visible ? 0 : -1}
      className={`absolute top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] backdrop-blur-sm transition hover:text-[#F2C230] ${
        direction === 'left' ? 'left-0.5' : 'right-0.5'
      } ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function FighterCard({
  fighter,
  archived = false,
  onOpen,
}: {
  fighter: OrgFighter
  archived?: boolean
  onOpen: (name: string) => void
}) {
  const { i18n } = useTranslation()
  const record = formatRecord(fighter)
  const interim = fighter.title_status === 'interim'
  const winRate = fighter.win_rate != null ? `${Math.round(fighter.win_rate * 100)}%` : null
  const heightStr = formatHeight(fighter.height_cm, i18n.language)
  const reachStr = formatReach(fighter.reach_cm, i18n.language)
  const strAcc = fighter.sig_str_acc != null ? `${Math.round(fighter.sig_str_acc * 100)}%` : null
  const finishRate = fighter.finish_rate != null ? `${Math.round(fighter.finish_rate * 100)}%` : null

  return (
    <motion.article
      className="surface-card group flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--border-subtle)] transition duration-200 hover:-translate-y-0.5 hover:border-[#F2C230]/40"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`h-1 w-full ${fighter.belt ? 'bg-[#F2C230]' : 'bg-[var(--accent-red)]'}`} />
      <div className="flex flex-1 flex-col p-3.5">
        <div className="grid grid-cols-1 content-start justify-items-center gap-3 text-center sm:min-h-[160px] sm:grid-cols-[72px_1fr] sm:justify-items-stretch sm:text-left">
          <FighterAvatar
            name={fighter.name}
            imageUrl={fighter.image_url}
            highlight={fighter.belt}
            className="h-20 w-18 sm:h-24 sm:w-20 rounded-xl"
          />

          <div className="min-w-0 max-sm:w-full">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 max-sm:w-full">
                {fighter.division ? (
                  <p className="broadcast-label text-[11px] text-[var(--accent-red)]">
                    {getDivisionName(fighter.division, i18n.language)}
                  </p>
                ) : null}
                <h3 className="mt-0.5 flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-lg font-bold uppercase leading-tight tracking-[0.02em] text-[var(--text-main)] sm:justify-start">
                  {fighter.country_code ? <FlagIcon code={fighter.country_code} country={fighter.country} /> : null}
                  <span className="min-w-0 break-words">{fighter.name}</span>
                  {fighter.belt ? <ChampionBelt /> : null}
                </h3>
              </div>
            </div>

            <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">
              {record ? <span className="font-semibold text-[var(--text-main)]">{record}</span> : null}
              {fighter.nickname ? <span> • “{fighter.nickname}”</span> : null}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 max-sm:justify-center text-[10px]">
              {fighter.belt ? (
                <span className="rounded bg-[#F2C230] px-1.5 py-0.5 font-bold uppercase text-[#0E0E0E]">
                  {interim ? L(i18n.language, 'Interino', 'Interim', 'Intérimaire') : L(i18n.language, 'Campeão', 'Champion', 'Champion')}
                </span>
              ) : fighter.ranking ? (
                <span className="rounded border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 font-bold text-[var(--text-main)]">
                  {fighter.ranking}
                </span>
              ) : null}

              {!archived && fighter.is_active ? (
                <span className="inline-flex items-center gap-1 text-[#22c55e] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  {L(i18n.language, 'Ativo', 'Active', 'Actif')}
                </span>
              ) : !archived ? (
                <span className="text-[var(--text-muted)]">
                  {L(i18n.language, 'Inativo', 'Former', 'Inactif')}
                </span>
              ) : null}

              {fighter.camp ? (
                <span className="truncate max-w-[150px] text-[var(--text-muted)]">
                  • {fighter.camp}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 4 Performance & Build Mini Stats (UFC style) */}
        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3">
          <MiniStat
            icon={Shield}
            label={L(i18n.language, 'Aproveitamento', 'Win Rate', 'Victoires')}
            value={winRate ?? '—'}
          />
          <MiniStat
            icon={Ruler}
            label={L(i18n.language, 'Envergadura', 'Reach', 'Allonge')}
            value={reachStr ?? heightStr ?? '—'}
          />
          <MiniStat
            icon={Target}
            label={L(i18n.language, 'Precisão Golpes', 'Str. Acc', 'Préc. coups')}
            value={strAcc ?? '—'}
          />
          <MiniStat
            icon={Zap}
            label={L(i18n.language, 'Via Rápida', 'Finish Rate', 'Finitions')}
            value={finishRate ?? (fighter.org_record ? fighter.org_record : '—')}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onOpen(fighter.name)}
            aria-label={L(i18n.language, `${fighter.name}. Ver perfil`, `${fighter.name}. View profile`, `${fighter.name}. Voir le profil`)}
            className="primary-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            <Award className="h-3.5 w-3.5" />
            {L(i18n.language, 'Ver Perfil', 'View profile', 'Voir profil')}
          </button>
          {fighter.profile_url ? (
            <a
              href={fighter.profile_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={L(i18n.language, 'Perfil oficial no ONE', 'Official profile on ONE', 'Profil officiel')}
              className="ghost-action inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-main)] hover:text-[#F2C230]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}
