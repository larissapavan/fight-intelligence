import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Crown, Sparkles, Trophy, Zap } from 'lucide-react'

import { L, localeTag, uiLang } from '../i18n/lang'
import { DivisionMatrixCard } from '../shared/components/DivisionMatrixCard'
import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { badgesForRankings } from '../shared/data/badges'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { getDivisionName } from '../shared/data/divisions'
import { getFighterImageUrl, normalizeFighterName, useFighterImages } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import { useRankings } from '../shared/hooks/useRankings'
import { getEloRankings } from '../shared/services/api'
import type { EloRankingEntry, FighterProfile, RankingCategory, RankingEntry } from '../shared/types/api'

type Tab = 'division' | 'p4p' | 'elo'

export function Rankings() {
  const { t } = useTranslation()
  const { rankings, loading, error } = useRankings()
  const [tab, setTab] = useState<Tab>('division')

  const divisions = useMemo(() => rankings.filter((category) => !category.is_p4p), [rankings])
  const p4pCategories = useMemo(() => rankings.filter((category) => category.is_p4p), [rankings])

  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const activeDivision = divisions.find((category) => category.category === selectedDivision) ?? divisions[0] ?? null

  const [selectedP4p, setSelectedP4p] = useState<string | null>(null)
  const activeP4p = p4pCategories.find((category) => category.category === selectedP4p) ?? p4pCategories[0] ?? null

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <SectionHeading
          level={1}
          eyebrow={t('rankings.eyebrow')}
          title={t('rankings.title')}
          description={t('rankings.description')}
        />

        <div className="mt-4 inline-flex max-w-full overflow-x-auto chip-scroll rounded-full border border-white/14 bg-white/[0.04] p-1">
          <TabButton active={tab === 'division'} onClick={() => setTab('division')}>
            {t('rankings.categoryRanking')}
          </TabButton>
          <TabButton active={tab === 'p4p'} onClick={() => setTab('p4p')}>
            {t('rankings.p4p')}
          </TabButton>
          <TabButton active={tab === 'elo'} onClick={() => setTab('elo')}>
            {t('rankings.eloRating')}
          </TabButton>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p>
      ) : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : tab === 'division' ? (
        <DivisionView divisions={divisions} active={activeDivision} onSelect={setSelectedDivision} />
      ) : tab === 'p4p' ? (
        <P4pView categories={p4pCategories} active={activeP4p} onSelect={setSelectedP4p} />
      ) : (
        <EloView divisions={divisions} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition sm:text-[13px] ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#CCCCCC] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function DivisionView({
  divisions,
  active,
  onSelect,
}: {
  divisions: RankingCategory[]
  active: RankingCategory | null
  onSelect: (category: string) => void
}) {
  const { t, i18n } = useTranslation()

  if (!active) {
    return (
      <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[#999999]">
        {t('rankings.rankingsUnavailable')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-[18px] border-white/14 p-3.5">
        <label htmlFor="ranking-division" className="broadcast-label mb-2 block text-xs text-[#CCCCCC]">
          {t('rankings.division')}
        </label>
        <select
          id="ranking-division"
          value={active.category}
          onChange={(event) => onSelect(event.target.value)}
          className="soft-input theme-text w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        >
          {divisions.map((division) => (
            <option key={division.category} value={division.category}>
              {getDivisionName(division.category, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <RankingList entries={active.entries} />

      <DivisionMatrixCard key={active.category} category={active.category} />
    </div>
  )
}

function P4pView({
  categories,
  active,
  onSelect,
}: {
  categories: RankingCategory[]
  active: RankingCategory | null
  onSelect: (category: string) => void
}) {
  const { t, i18n } = useTranslation()

  if (!active) {
    return (
      <div className="surface-card rounded-[20px] px-4 py-7 text-center text-sm text-[#999999]">
        {t('rankings.rankingsUnavailable')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap gap-2 rounded-[18px] border-white/14 p-3">
        {categories.map((category) => {
          const lang = uiLang(i18n.language)
          const label = lang === 'pt'
            ? category.category
                .replace("Men's Pound-for-Pound", 'Peso por Peso Masculino')
                .replace("Women's Pound-for-Pound", 'Peso por Peso Feminino')
                .replace('Pound-for-Pound', 'Peso por Peso')
            : lang === 'fr'
              ? category.category
                  .replace("Men's Pound-for-Pound", 'Toutes catégories hommes')
                  .replace("Women's Pound-for-Pound", 'Toutes catégories femmes')
                  .replace('Pound-for-Pound', 'Toutes catégories')
              : category.category.replace('Pound-for-Pound ', '')
          return (
            <button
              key={category.category}
              type="button"
              onClick={() => onSelect(category.category)}
              className={`ghost-action inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                category.category === active.category ? 'ring-1 ring-[#C8102E]/45' : ''
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
              {label}
            </button>
          )
        })}
      </div>

      <RankingList entries={active.entries} />
    </div>
  )
}

function EloView({ divisions }: { divisions: RankingCategory[] }) {
  const { t, i18n } = useTranslation()
  const [selectedDivision, setSelectedDivision] = useState<string>('all')
  const [activeOnly, setActiveOnly] = useState<boolean>(true)
  const [eloEntries, setEloEntries] = useState<EloRankingEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()

  useEffect(() => {
    let cancelled = false
    getEloRankings(selectedDivision === 'all' ? undefined : selectedDivision, activeOnly, 50)
      .then((data) => {
        if (!cancelled) {
          setEloEntries(data)
          setError(null)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setError(L(i18n.language, 'Falha ao carregar ranking Elo.', 'Failed to load Elo rankings.', 'Impossible de charger le classement Elo.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDivision, activeOnly, i18n.language])

  const profileFor = useMemo(() => {
    const index = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string) => index.get(normalizeFighterName(name))
  }, [fighters])

  const imageUrlFor = useMemo(() => {
    const profileByName = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string, fallbackUrl: string | null) =>
      getFighterImageUrl(name, imageByName, profileByName.get(normalizeFighterName(name))?.image_url || fallbackUrl)
  }, [fighters, imageByName])

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-col sm:flex-row gap-3 rounded-[18px] border-white/14 p-3.5 justify-between items-start sm:items-center">
        <div className="w-full sm:w-72">
          <label htmlFor="elo-division-select" className="broadcast-label mb-1.5 block text-xs text-[#CCCCCC]">
            {t('rankings.division')}
          </label>
          <select
            id="elo-division-select"
            value={selectedDivision}
            onChange={(e) => { setSelectedDivision(e.target.value); setLoading(true) }}
            className="soft-input theme-text w-full rounded-xl px-3 py-2 text-sm outline-none"
          >
            <option value="all">{t('rankings.allDivisions')}</option>
            {divisions.map((d) => (
              <option key={d.category} value={d.category}>
                {getDivisionName(d.category, i18n.language)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="inline-flex max-w-full overflow-x-auto chip-scroll rounded-full border border-white/14 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => { setActiveOnly(true); setLoading(true) }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                activeOnly ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#CCCCCC] hover:text-white'
              }`}
            >
              {t('rankings.activeOnly')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveOnly(false); setLoading(true) }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                !activeOnly ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[#CCCCCC] hover:text-white'
              }`}
            >
              {t('rankings.allTime')}
            </button>
          </div>
        </div>
      </div>

      <div className="surface-card rounded-[16px] border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-[#AAAAAA] flex items-center gap-2.5">
        <Zap className="h-5 w-5 text-[#F2C230] shrink-0" />
        <span>{t('rankings.eloSubtitle')}</span>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p>
      ) : null}

      {loading ? (
        <section className="grid gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-[64px]" />
          ))}
        </section>
      ) : (
        <section aria-label={L(i18n.language, 'Rankings Elo', 'Elo Rankings', 'Classements Elo')} className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 px-1 pb-2">
            <h2 className="broadcast-label text-xs text-[var(--text-main)]">
              {L(i18n.language, 'Top Lutadores por Elo', 'Top Fighters by Elo', 'Meilleurs lutteurs par Elo')}
            </h2>
            <span className="text-xs text-[#CCCCCC]">
              {eloEntries.length} {L(i18n.language, 'atletas', 'listed', 'listés')}
            </span>
          </div>

          <div className="grid gap-2.5">
            {eloEntries.map((entry) => {
              const prof = profileFor(entry.name)
              const imgUrl = imageUrlFor(entry.name, entry.image_url)
              const isTop = entry.rank === 1
              return (
                <button
                  key={`${entry.name}-${entry.rank}`}
                  type="button"
                  onClick={() => setProfileName(entry.name)}
                  aria-label={L(i18n.language, `${entry.name}, Elo ${entry.elo}. Ver perfil`, `${entry.name}, Elo ${entry.elo}`, `${entry.name}, Elo ${entry.elo}. Voir le profil`)}
                  className="metric-tile flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 cursor-pointer text-left transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F2C230]"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
                      isTop ? 'bg-[#F2C230] text-[#050505]' : 'bg-[var(--surface-3)] text-[var(--text-main)]'
                    }`}
                  >
                    {isTop ? <Crown className="h-4 w-4" /> : entry.rank}
                  </span>

                  <FighterAvatar name={entry.name} imageUrl={imgUrl} highlight={isTop || entry.belt} className="h-12 w-12" />

                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--text-main)]">
                      {prof ? <FlagList fighter={prof} /> : null}
                      <span className="min-w-0 truncate">{entry.name}</span>
                      {entry.belt ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[#F2C230] px-1.5 py-0.5 text-[10px] font-bold text-[#0E0E0E]">
                          <Trophy className="h-3 w-3" />
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#CCCCCC]">
                      <span className="text-[var(--text-muted)]">{entry.division ? getDivisionName(entry.division, i18n.language) : 'UFC'}</span>
                      <span>{entry.wins}-{entry.losses}-{entry.draws} ({entry.fights} {L(i18n.language, 'lutas no UFC', 'UFC fights', 'combats UFC')})</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <Zap className="h-4 w-4 text-[#F2C230]" />
                      <span className="text-lg font-bold text-[var(--text-main)] tabular-nums tracking-wide">
                        {entry.elo}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#999999] tabular-nums">
                      {L(i18n.language, 'Pico:', 'Peak:', 'Pic :')} <span className="text-[#CCCCCC]">{entry.peak_elo}</span>
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {eloEntries.length === 0 ? (
            <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[#999999]">
              {L(i18n.language, 'Nenhum atleta encontrado para esta seleção de Elo.', 'No fighters found for this Elo selection.', 'Aucun lutteur pour cette sélection Elo.')}
            </div>
          ) : null}
        </section>
      )}

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

function RankingList({ entries }: { entries: RankingEntry[] }) {
  const { i18n } = useTranslation()
  const { fighters } = useFighters()
  const [profileName, setProfileName] = useState<string | null>(null)
  const { imageByName } = useFighterImages()
  const profileFor = useMemo(() => {
    const index = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string) => index.get(normalizeFighterName(name))
  }, [fighters])
  const imageUrlFor = useMemo(() => {
    const profileByName = new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter]))
    return (name: string) => getFighterImageUrl(name, imageByName, profileByName.get(normalizeFighterName(name))?.image_url)
  }, [fighters, imageByName])

  const champion = entries.find((entry) => entry.rank === 0)
  const contenders = entries.filter((entry) => entry.rank > 0)

  return (
    <section aria-label={L(i18n.language, 'Atletas ranqueados', 'Ranked athletes', 'Athlètes classés')} className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-white/10 px-1 pb-2">
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">
          {L(i18n.language, 'Lutadores Ranqueados', 'Ranked athletes', 'Lutteurs classés')}
        </h2>
        <span className="text-xs text-[#CCCCCC]">
          {contenders.length + (champion ? 1 : 0)} {L(i18n.language, 'atletas', 'listed', 'listés')}
        </span>
      </div>
      <div className="grid gap-2.5">
      {champion ? (
        <RankingRow
          entry={champion}
          imageUrl={imageUrlFor(champion.fighter)}
          profile={profileFor(champion.fighter)}
          onOpenProfile={setProfileName}
          isChampion
        />
      ) : null}
      {contenders.map((entry) => (
        <RankingRow
          key={entry.fighter}
          entry={entry}
          imageUrl={imageUrlFor(entry.fighter)}
          profile={profileFor(entry.fighter)}
          onOpenProfile={setProfileName}
        />
      ))}
      {!champion && contenders.length === 0 ? (
        <div className="surface-card rounded-[18px] px-4 py-6 text-center text-sm text-[#999999]">
          {L(i18n.language, 'Nenhum atleta ranqueado nesta categoria.', 'No ranked athletes in this category.', 'Aucun athlète classé dans cette catégorie.')}
        </div>
      ) : null}
      </div>

      {profileName ? (
        <FighterProfileModal
          key={profileName}
          name={profileName}
          onClose={() => setProfileName(null)}
          onSelectFighter={setProfileName}
        />
      ) : null}
    </section>
  )
}

function RankingRow({
  entry,
  imageUrl,
  profile,
  onOpenProfile,
  isChampion = false,
}: {
  entry: RankingEntry
  imageUrl: string | null
  profile?: FighterProfile
  onOpenProfile: (name: string) => void
  isChampion?: boolean
}) {
  const { t, i18n } = useTranslation()

  const content = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
          isChampion ? 'bg-[#C8102E] text-white' : 'bg-[var(--surface-3)] text-[var(--text-main)]'
        }`}
      >
        {isChampion ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <FighterAvatar name={entry.fighter} imageUrl={imageUrl} highlight={isChampion} className="h-12 w-12" />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--text-main)]">
          {profile ? <FlagList fighter={profile} /> : null}
          <span className="min-w-0 truncate">{entry.fighter}</span>
        </p>
        {profile ? <FighterBadges badges={badgesForRankings(profile.badges)} className="mt-1" /> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#CCCCCC]">
          {isChampion ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#0E0E0E]">
              <Trophy className="h-3.5 w-3.5" /> {t('rankings.champion')}
            </span>
          ) : null}
          {entry.win_rate !== null ? <span>{L(i18n.language, 'Taxa de vitória', 'Win rate', 'Taux de victoire')}: {(entry.win_rate * 100).toFixed(1)}%</span> : null}
          {entry.last_fight ? <span>{L(i18n.language, 'Última luta', 'Last fight', 'Dernier combat')}: {formatDate(entry.last_fight, i18n.language)}</span> : null}
        </div>
      </div>

      <RankChangeBadge change={entry.rank_change} />
    </>
  )

  const base = 'metric-tile flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3'

  return profile ? (
    <button
      type="button"
      onClick={() => onOpenProfile(profile.name)}
      aria-label={
        L(
          i18n.language,
          `${entry.fighter}, ${entry.rank === 0 ? 'campeão' : `${entry.rank}º lugar`}. Ver perfil`,
          `${entry.fighter}, rank ${entry.rank || 'champion'}. View profile`,
          `${entry.fighter}, ${entry.rank === 0 ? 'champion' : `rang ${entry.rank}`}. Voir le profil`,
        )
      }
      className={`${base} cursor-pointer text-left transition hover:!bg-[#F2C230]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C230]`}
    >
      {content}
    </button>
  ) : (
    <article className={base}>{content}</article>
  )
}

function RankChangeBadge({ change }: { change: string | null }) {
  if (!change) return null

  if (change === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
        <ArrowUp className="h-3 w-3" />
      </span>
    )
  }

  if (change === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#C8102E]/20 bg-[#C8102E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C8102E]">
        <ArrowDown className="h-3 w-3" />
      </span>
    )
  }

  return (
    <span className="type-tech rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-[#999999]">
      {change}
    </span>
  )
}

function formatDate(date: string, lang: string = 'en-US'): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(localeTag(lang), { year: 'numeric', month: 'short', day: 'numeric' })
}
