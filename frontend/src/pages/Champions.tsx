import { createContext, useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Crown, Flame, Layers, Shield, ThumbsDown, Trophy } from 'lucide-react'

import { L, localeTag, uiLang } from '../i18n/lang'
import { FighterAvatar } from '../shared/components/FighterAvatar'
import { FighterBadges, FlagList } from '../shared/components/FighterBadges'
import { badgesForRankings } from '../shared/data/badges'
import { FighterProfileModal } from '../shared/components/FighterProfileModal'
import { ChampionBelt } from '../shared/components/ChampionBelt'
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton'
import { SectionHeading } from '../shared/components/SectionHeading'
import { divisionLimit, divisionOrder, getDivisionName } from '../shared/data/divisions'
import { useChampions } from '../shared/hooks/useChampions'
import { useFighterImages, getFighterImageUrl, normalizeFighterName } from '../shared/hooks/useFighterImages'
import { useFighters } from '../shared/hooks/useFighters'
import type { ChampionSummary, RecordCategory, RecordEntry, TitleFight, TitleReign } from '../shared/types/api'

type Tab = 'positive' | 'negative' | 'multi'

const MULTI_DIVISION_KEY = 'multi_division_champions'

/** Opens a fighter's profile on top of this page, so closing it leaves the reader exactly where they were. */
const OpenProfileContext = createContext<(name: string) => void>(() => undefined)

type ViewKey = 'current' | 'greatest' | 'records'

export function Champions() {
  const { t, i18n } = useTranslation()
  const { data, loading, error } = useChampions()
  const [tab, setTab] = useState<Tab>('positive')
  const multiDivision = data?.records.find((category) => category.key === MULTI_DIVISION_KEY)
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('view')
  const validViews: ViewKey[] = ['current', 'greatest', 'records']
  const view: ViewKey = validViews.includes(requested as ViewKey) ? (requested as ViewKey) : 'current'
  const chooseView = (next: ViewKey) => setSearchParams(next === 'current' ? {} : { view: next }, { replace: true })
  const [profileName, setProfileName] = useState<string | null>(null)

  const views = [
    { key: 'current' as const, label: t('champions.current'), short: t('champions.current') },
    { key: 'greatest' as const, label: t('champions.greatest'), short: t('champions.greatest') },
    { key: 'records' as const, label: t('champions.records'), short: t('champions.records') },
  ]

  return (
    <OpenProfileContext.Provider value={setProfileName}>
      <div className="space-y-3 sm:space-y-4">
        <section className="page-hero rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
          <SectionHeading
            level={1}
            eyebrow={t('champions.eyebrow')}
            title={t('champions.title')}
            description={t('champions.description')}
          />

          <div
            role="tablist"
            aria-label={L(i18n.language, 'Escolha a visualização', 'Choose what to see', 'Choisir la vue')}
            className="mt-4 inline-flex max-w-full overflow-x-auto border-2 border-[var(--rule)] bg-[var(--card-bg)] chip-scroll"
          >
            {views.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`champions-tab-${item.key}`}
                aria-selected={view === item.key}
                aria-controls="champions-panel"
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
        </section>

        {error ? (
          <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm font-semibold text-[var(--text-red)]">{error}</p>
        ) : null}

        {loading || !data ? (
          <section className="grid gap-2.5 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-[90px]" />
            ))}
          </section>
        ) : (
          <div id="champions-panel" role="tabpanel" aria-labelledby={`champions-tab-${view}`} className="space-y-3 sm:space-y-4">
            {view === 'current' ? <CurrentChampionsSection reigns={data.current_champions} history={data.reigns ?? []} /> : null}
            {view === 'greatest' ? <GreatestChampionsSection champions={data.greatest_champions} /> : null}
            {view === 'records' ? (
              <section>
                <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-0.5 chip-scroll">
                  <TabButton active={tab === 'positive'} onClick={() => setTab('positive')}>
                    {t('champions.positive')}
                  </TabButton>
                  <TabButton active={tab === 'negative'} onClick={() => setTab('negative')}>
                    {t('champions.negative')}
                  </TabButton>
                  <TabButton active={tab === 'multi'} onClick={() => setTab('multi')}>
                    {t('champions.multi')}
                  </TabButton>
                </div>

                {tab === 'multi' ? (
                  multiDivision ? <MultiDivisionSection category={multiDivision} current={data.current_champions} /> : null
                ) : (
                  <div className="grid gap-2.5">
                    {data.records
                      .filter((category) => category.kind === tab && category.key !== MULTI_DIVISION_KEY)
                      .map((category) => (
                        <RecordCard key={category.key} category={category} />
                      ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
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
    </OpenProfileContext.Provider>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active ? 'bg-[#FFFFFF] text-[#050505]' : 'text-[var(--text-muted)] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function formatFightDate(date: string | null | undefined, lang: string = 'en-US') {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(localeTag(lang), { year: 'numeric', month: 'short', day: 'numeric' })
}

const RESULT_METHODS: Record<string, { en: string; pt: string; fr: string }> = {
  'KO/TKO': { en: 'KO/TKO', pt: 'nocaute (KO/TKO)', fr: 'KO/TKO' },
  SUB: { en: 'submission', pt: 'finalização', fr: 'soumission' },
  'U-DEC': { en: 'unanimous decision', pt: 'decisão unânime', fr: 'décision unanime' },
  'S-DEC': { en: 'split decision', pt: 'decisão dividida', fr: 'décision partagée' },
  'M-DEC': { en: 'majority decision', pt: 'decisão majoritária', fr: 'décision majoritaire' },
  DQ: { en: 'disqualification', pt: 'desqualificação', fr: 'disqualification' },
}

function describeLastFight(fight: NonNullable<TitleReign['last_fight']>, lang: string = 'en-US') {
  const outcome = fight.result === 'win' ? L(lang, 'Vitória', 'Win', 'Victoire') : fight.result === 'loss' ? L(lang, 'Derrota', 'Loss', 'Défaite') : L(lang, 'Sem resultado', 'No result', 'Sans résultat')
  const methodObj = fight.method ? RESULT_METHODS[fight.method] : null
  const methodStr = methodObj ? L(lang, methodObj.pt, methodObj.en, methodObj.fr) : fight.method
  const method = methodStr ? L(lang, ` por ${methodStr}`, ` by ${methodStr}`, ` par ${methodStr}`) : ''
  const round = fight.round ? ` (R${fight.round})` : ''
  const date = formatFightDate(fight.date, lang)
  return `${outcome}${method}${round}${date ? ` · ${date}` : ''}`
}

type CompactStat = { label: string; value: string }

function CompactChampionCard({
  name,
  imageUrl,
  badge,
  subtitle,
  current = false,
  stats,
  onClick,
  ariaLabel,
  expanded,
  controls,
}: {
  name: string
  imageUrl: string | null
  badge?: React.ReactNode
  subtitle: string
  current?: boolean
  stats: CompactStat[]
  onClick: () => void
  ariaLabel: string
  expanded?: boolean
  controls?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      className="surface-card flex w-full min-w-0 cursor-pointer text-left items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-neutral-800/60 focus-visible:bg-neutral-800/60 focus-visible:outline-none"
    >
      <div className="relative shrink-0">
        <FighterAvatar name={name} className="h-12 w-12" imageUrl={imageUrl} />
        {badge}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm sm:text-base font-bold text-[var(--text-main)]" title={name}>
            {name}
          </p>
          {current ? (
            <span className="type-tech shrink-0 rounded-full border border-[var(--rule)] bg-[#F2C230] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#0E0E0E]">
              {t('rankings.champion')}
            </span>
          ) : null}
        </div>
        <p className="theme-muted mt-0.5 truncate text-xs" title={subtitle}>{subtitle}</p>
        <p className="theme-muted mt-0.5 truncate text-[11px] sm:hidden">{stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(' · ')}</p>
      </div>

      <div className="theme-muted hidden shrink-0 items-center gap-2.5 sm:gap-4 text-right text-[11px] sm:flex">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
      {expanded !== undefined ? (
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-[var(--text-main)] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      ) : null}
    </button>
  )
}

function RankBadge({ rank, goat = false }: { rank: number; goat?: boolean }) {
  if (goat) {
    return (
      <span className="type-num absolute -bottom-1 -left-1 grid h-5 place-items-center rounded-md border border-[var(--rule)] bg-[#F2C230] px-1 text-[11px] font-bold leading-none tracking-[0.04em] text-[#0E0E0E]">
        GOAT
      </span>
    )
  }
  return (
    <span
      className={`type-num absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-md border px-1 text-[11px] leading-none ${
        rank === 1 ? 'border-[var(--rule)] bg-[#C8102E] text-white' : 'border-[var(--rule)] bg-[var(--rule)] text-[var(--card-bg)]'
      }`}
    >
      {rank === 1 ? <Trophy className="h-3 w-3" /> : rank}
    </span>
  )
}

function CurrentChampionsSection({ reigns, history }: { reigns: TitleReign[]; history: TitleReign[] }) {
  const { t, i18n } = useTranslation()
  const openProfile = useContext(OpenProfileContext)
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])
  const ordered = useMemo(() => [...reigns].sort((a, b) => divisionOrder(a.division) - divisionOrder(b.division)), [reigns])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Crown className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{t('champions.current')}</h2>
        <span className="theme-muted text-xs">({reigns.length})</span>
      </div>

      <div className="grid gap-2.5">
        {ordered.map((reign) => {
          const profile = profileByName.get(normalizeFighterName(reign.champion))
          const record = profile ? `${profile.wins ?? 0}-${profile.losses ?? 0}-${profile.draws ?? 0}` : null
          const limit = divisionLimit(reign.division)
          const last = reign.last_fight
          const divisionLabel = getDivisionName(reign.division, i18n.language)

          return (
            <div key={reign.division}>
              <button
                type="button"
                onClick={() => openProfile(reign.champion)}
                aria-label={L(i18n.language, `${reign.champion}, campeão peso ${divisionLabel}. Ver perfil`, `${reign.champion}, ${reign.division} champion. View profile`, `${reign.champion}, champion ${reign.division}. Voir le profil`)}
                className="metric-tile group grid w-full min-w-0 cursor-pointer text-left grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[170px_auto_1fr_auto] md:gap-x-6"
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <p className="text-base font-bold uppercase leading-tight tracking-wide text-[var(--text-main)]">{divisionLabel}</p>
                  {limit ? <p className="theme-muted mt-0.5 text-xs font-semibold">{limit}</p> : null}
                </div>

                <FighterAvatar
                  name={reign.champion}
                  imageUrl={getFighterImageUrl(reign.champion, imageByName, profile?.image_url)}
                  highlight
                  className="h-28 w-24 sm:h-32 sm:w-28"
                />

                <div className="min-w-0">
                  {profile?.nickname ? (
                    <p className="broadcast-label truncate text-[11px] text-[var(--text-muted)]">&ldquo;{profile.nickname}&rdquo;</p>
                  ) : null}
                  <p className="type-display mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-bold uppercase leading-none text-[var(--text-main)] sm:text-3xl">
                    {profile ? <FlagList fighter={profile} className="h-4 w-6" /> : null}
                    <span className="min-w-0 break-words">{reign.champion}</span>
                  </p>
                  <FighterBadges badges={badgesForRankings(profile?.badges)} className="mt-1.5" />
                  {record ? (
                    <p className="mt-1.5 text-sm text-[var(--text-main)]">
                      <span className="font-bold">{record}</span> <span className="theme-muted">(W-L-D)</span>
                    </p>
                  ) : null}
                  {last ? (
                    <p className="mt-1 text-[13px] leading-5 text-[var(--text-main)]">
                      <span className="font-bold">{L(i18n.language, 'Última luta', 'Last fight', 'Dernier combat')}:</span> {reign.champion} vs. {last.opponent}
                      <span className="theme-muted block text-xs sm:inline sm:before:content-['_·_']">{describeLastFight(last, i18n.language)}</span>
                    </p>
                  ) : null}
                  <p className="theme-muted mt-1 text-xs">
                    {reign.days_held ?? '—'} {t('champions.daysHeld')} · {reign.defenses_count}{' '}
                    {t('champions.defenses')}
                  </p>
                </div>

                <span className="ghost-action col-span-2 inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-main)] transition group-hover:!bg-[#F2C230] group-hover:text-[#0E0E0E] md:col-span-1">
                  {t('common.viewProfile')}
                </span>
              </button>
              <DivisionHistory division={reign.division} reigns={history} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

const END_LABELS: Record<string, string> = {
  lost_title_fight: 'Lost the belt',
  vacated: 'Vacated',
  stripped: 'Stripped',
  unified: 'Unified with the undisputed belt',
}

const END_LABELS_PT: Record<string, string> = {
  lost_title_fight: 'Perdeu o cinturão',
  vacated: 'Vagou o cinturão',
  stripped: 'Destituído do cinturão',
  unified: 'Unificado ao cinturão linear',
}

const END_LABELS_FR: Record<string, string> = {
  lost_title_fight: 'A perdu la ceinture',
  vacated: 'Titre laissé vacant',
  stripped: 'Titre retiré',
  unified: 'Unifié avec la ceinture incontestée',
}

function ordinal(value: number, language: string | boolean = false) {
  const lang = uiLang(language)
  if (lang === 'pt') return `${value}º`
  if (lang === 'fr') return value === 1 ? '1er' : `${value}e`
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
  return `${value}${suffix}`
}

function endReasonLabel(reason: string, language: string | boolean) {
  const lang = uiLang(language)
  if (lang === 'pt') return END_LABELS_PT[reason] ?? reason
  if (lang === 'fr') return END_LABELS_FR[reason] ?? reason
  return END_LABELS[reason] ?? null
}

function translateWonHow(wonHow: string | null | undefined, language: string | boolean): string | null {
  if (!wonHow) return null
  const lang = uiLang(language)
  if (lang === 'en') return wonHow
  if (lang === 'fr') return translateWonHowFr(wonHow)
  let text = wonHow.trim()
  if (/^promoted to undisputed champion$/i.test(text)) {
    return 'Promovido a campeão linear'
  }
  if (/^promoted to champion$/i.test(text)) {
    return 'Promovido a campeão'
  }
  if (/^awarded title$/i.test(text)) {
    return 'Cinturão concedido'
  }
  text = text.replace(/^def\.\s*/i, 'Venceu ')
  text = text.replace(/\binterim champion\b/i, 'o campeão interino')
  text = text.replace(/\bfor interim title\b/i, 'pelo cinturão interino')
  text = text.replace(/\bfor undisputed title\b/i, 'pelo cinturão linear')
  return text
}

function translateWonHowFr(wonHow: string): string {
  let text = wonHow.trim()
  if (/^promoted to undisputed champion$/i.test(text)) return 'Promu champion incontesté'
  if (/^promoted to champion$/i.test(text)) return 'Promu champion'
  if (/^awarded title$/i.test(text)) return 'Titre attribué'
  text = text.replace(/^def\.\s*/i, 'Victoire contre ')
  text = text.replace(/\binterim champion\b/i, 'le champion intérimaire')
  text = text.replace(/\bfor interim title\b/i, 'pour le titre intérimaire')
  text = text.replace(/\bfor undisputed title\b/i, 'pour le titre incontesté')
  return text
}

function DivisionHistory({ division, reigns }: { division: string; reigns: TitleReign[] }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const openProfile = useContext(OpenProfileContext)
  const history = useMemo(
    () => reigns.filter((reign) => reign.division === division).sort((a, b) => (b.date_won ?? '').localeCompare(a.date_won ?? '')),
    [reigns, division],
  )
  if (!history.length) return null

  const panelId = `history-${division.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const holders = new Set(history.map((reign) => reign.champion)).size
  const divisionLabel = getDivisionName(division, i18n.language)

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="ghost-action inline-flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-main)] transition hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        <span>
          {divisionLabel} {L(i18n.language, '• Histórico de campeões', 'title history', 'historique des titres')}
          <span className="theme-muted ml-2 font-semibold normal-case tracking-normal">
            {history.length} {history.length === 1 ? L(i18n.language, 'reinado', 'reign', 'règne') : L(i18n.language, 'reinados', 'reigns', 'règnes')} · {holders} {holders === 1 ? L(i18n.language, 'campeão', 'champion', 'champion') : L(i18n.language, 'campeões', 'champions', 'champions')}
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <section id={panelId} aria-label={L(i18n.language, `${divisionLabel}: todos os campeões`, `${divisionLabel}: every champion`, `${divisionLabel} : tous les champions`)} className="fade-up mt-1.5 min-w-0 border-2 border-[var(--rule)] bg-[var(--surface-3)] p-3 sm:p-4">
          <ol>
            {history.map((reign) => (
              <ReignRow key={`${reign.date_won}-${reign.champion}-${reign.title_type}`} reign={reign} onOpen={openProfile} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}

function ReignRow({ reign, onOpen }: { reign: TitleReign; onOpen: (name: string) => void }) {
  const { i18n } = useTranslation()
  const date = formatFightDate(reign.date_won, i18n.language)
  const interim = reign.title_type === 'interim'
  const held = reign.days_held != null ? `${reign.days_held.toLocaleString(localeTag(i18n.language))} ${L(i18n.language, 'dias', 'days', 'jours')}` : null
  const defenses = `${reign.defenses_count} ${reign.defenses_count === 1 ? L(i18n.language, 'defesa', 'defense', 'défense') : L(i18n.language, 'defesas', 'defenses', 'défenses')}`
  const ended = reign.is_current ? L(i18n.language, 'Campeão atual', 'Current champion', 'Champion actuel') : endReasonLabel(reign.end_reason, i18n.language)

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2.5 border-l-2 border-[var(--rule)] py-1.5 pl-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-3.5">
      <div className="pt-0.5">
        <p className="type-display text-lg leading-none text-[var(--text-main)] sm:text-xl">{reign.date_won?.slice(0, 4) ?? '—'}</p>
        <p className="theme-muted mt-0.5 text-[11px] font-semibold uppercase leading-tight">{date?.replace(/,\s*\d{4}$/, '')}</p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onOpen(reign.champion)}
            className="min-w-0 break-words text-left text-sm font-bold text-[var(--text-main)] underline-offset-2 hover:underline"
          >
            {reign.champion}
          </button>
          {reign.is_current ? (
            <span className="bg-[#F2C230] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0E0E0E]">
              {L(i18n.language, 'Atual', 'Current', 'Actuel')}
            </span>
          ) : null}
          {interim ? (
            <span className="border border-[var(--rule)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-main)]">
              {L(i18n.language, 'Interino', 'Interim', 'Intérimaire')}
            </span>
          ) : null}
          {reign.fighter_reign_index > 1 ? (
            <span className="theme-muted text-[11px] font-bold uppercase tracking-[0.1em]">
              {ordinal(reign.fighter_reign_index, i18n.language)} {L(i18n.language, 'reinado', 'reign', 'règne')}
            </span>
          ) : null}
        </div>
        <p className="theme-muted mt-0.5 text-[11px] leading-4">
          {[translateWonHow(reign.won_how, i18n.language), reign.event].filter(Boolean).join(' · ') || L(i18n.language, 'Conquista do cinturão', 'Title win', 'Conquête du titre')}
        </p>
        <p className="theme-muted text-[11px] leading-4">
          {[held, defenses, ended].filter(Boolean).join(' · ')}
        </p>
      </div>
    </li>
  )
}

function GreatestChampionsSection({ champions }: { champions: ChampionSummary[] }) {
  const { t, i18n } = useTranslation()
  const openProfile = useContext(OpenProfileContext)
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{t('champions.greatest')}</h2>
        <span className="theme-muted text-xs">
          {L(i18n.language, 'por tempo total como campeão', 'by total time as champion', 'par temps total en tant que champion')}
        </span>
      </div>

      <div className="grid gap-1.5 lg:grid-cols-2 lg:gap-2.5">
        {champions.map((champion, index) => (
          <CompactChampionCard
            key={champion.champion}
            name={champion.champion}
            imageUrl={getFighterImageUrl(champion.champion, imageByName, profileByName.get(normalizeFighterName(champion.champion))?.image_url)}
            badge={<RankBadge rank={index + 1} goat={index === 0} />}
            subtitle={champion.divisions.map((div) => getDivisionName(div, i18n.language)).join(' · ')}
            current={champion.is_current_champion}
            stats={[
              { label: L(i18n.language, 'Dias', 'Days', 'Jours'), value: champion.total_days_as_champion.toLocaleString(localeTag(i18n.language)) },
              { label: L(i18n.language, 'Defesas', 'Defenses', 'Défenses'), value: String(champion.total_defenses) },
              { label: L(i18n.language, 'Reinados', 'Reigns', 'Règnes'), value: String(champion.total_reigns) },
            ]}
            onClick={() => openProfile(champion.champion)}
            ariaLabel={L(i18n.language, `${champion.champion}, ver perfil`, `${champion.champion}, view profile`, `${champion.champion}, voir le profil`)}
          />
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[48px] text-right">
      <p className="data-value text-sm sm:text-base font-bold text-[var(--text-main)] leading-none">{value}</p>
      <p className="broadcast-label text-[10px] text-[var(--text-muted)] tracking-wider mt-0.5 whitespace-nowrap">{label}</p>
    </div>
  )
}

const RECORD_LABELS_PT: Record<string, string> = {
  most_defenses_single_reign: 'Mais defesas em um único reinado',
  longest_reign: 'Reinado mais longo',
  most_cumulative_defenses: 'Mais defesas de cinturão na carreira',
  most_title_reigns: 'Mais vezes campeão',
  multi_division_champions: 'Campeões em mais de uma categoria',
  shortest_reign: 'Reinado mais curto',
  most_times_stripped: 'Mais títulos perdidos fora do octógono (destituído)',
  most_title_losses: 'Mais derrotas em disputas de cinturão',
}

const RECORD_UNITS_PT: Record<string, string> = {
  defenses: 'defesas',
  days: 'dias',
  reigns: 'reinados',
  divisions: 'categorias',
  times: 'vezes',
}

const RECORD_LABELS_FR: Record<string, string> = {
  most_defenses_single_reign: 'Plus de défenses sur un seul règne',
  longest_reign: 'Règne le plus long',
  most_cumulative_defenses: 'Plus de défenses de titre en carrière',
  most_title_reigns: 'Plus de règnes',
  multi_division_champions: 'Champions dans plusieurs catégories',
  shortest_reign: 'Règne le plus court',
  most_times_stripped: 'Plus de titres retirés hors de l’octogone',
  most_title_losses: 'Plus de défaites en combat de titre',
}

const RECORD_UNITS_FR: Record<string, string> = {
  defenses: 'défenses',
  days: 'jours',
  reigns: 'règnes',
  divisions: 'catégories',
  times: 'fois',
}

function getRecordCategoryLabel(category: RecordCategory, language: string | boolean): string {
  const lang = uiLang(language)
  if (lang === 'pt') return RECORD_LABELS_PT[category.key] ?? category.label
  if (lang === 'fr') return RECORD_LABELS_FR[category.key] ?? category.label
  return category.label
}

function getRecordUnit(unit: string, language: string | boolean): string {
  const lang = uiLang(language)
  if (lang === 'pt') return RECORD_UNITS_PT[unit] ?? unit
  if (lang === 'fr') return RECORD_UNITS_FR[unit] ?? unit
  return unit
}

function RecordCard({ category }: { category: RecordCategory }) {
  const { i18n } = useTranslation()
  const Icon = category.kind === 'positive' ? Flame : ThumbsDown
  const [open, setOpen] = useState(false)
  const panelId = `record-${category.key}`
  const label = getRecordCategoryLabel(category, i18n.language)

  return (
    <section className="surface-card overflow-hidden rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition duration-150 hover:bg-[var(--bg-surface-subtle)] sm:px-4"
      >
        <Icon className={`h-4 w-4 shrink-0 ${category.kind === 'positive' ? 'text-[#C8102E]' : 'text-[var(--text-muted)]'}`} />
        <h3 className="broadcast-label text-xs text-[var(--text-main)]">{label}</h3>
        <span className="theme-muted text-xs">({category.entries.length})</span>
        <ChevronDown className={`theme-muted ml-auto h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-[var(--line-soft)] px-3 py-3 sm:px-4">
          {category.entries.length ? (
            <div className="lg:columns-2 lg:gap-x-8">
              {category.entries.map((entry) => (
                <div key={`${entry.rank}-${entry.champion}`} className="break-inside-avoid">
                  <RecordRow entry={entry} unit={getRecordUnit(category.unit, i18n.language)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{L(i18n.language, 'Nenhum registro nesta categoria.', 'No entries in this category.', 'Aucune entrée dans cette catégorie.')}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function RecordRow({ entry, unit }: { entry: RecordCategory['entries'][number]; unit: string }) {
  const { i18n } = useTranslation()
  const openProfile = useContext(OpenProfileContext)
  const divisionLabel = entry.division ? getDivisionName(entry.division, i18n.language) : null
  const formattedValue = typeof entry.value === 'number' ? entry.value.toLocaleString(localeTag(i18n.language)) : entry.value

  return (
    <button
      type="button"
      onClick={() => openProfile(entry.champion)}
      aria-label={L(i18n.language, `${entry.champion}, ${entry.rank}º lugar. Ver perfil`, `${entry.champion}, rank ${entry.rank}. View profile`, `${entry.champion}, rang ${entry.rank}. Voir le profil`)}
      className="flex w-full cursor-pointer items-center text-left gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F2C230]/40 focus-visible:bg-[#F2C230]/40 focus-visible:outline-none"
    >
      <span className="type-num w-4 shrink-0 text-right text-[11px] text-[var(--text-muted)]">{entry.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-main)]">{entry.champion}</p>
        {divisionLabel ? <p className="theme-muted truncate text-[11px] leading-tight">{divisionLabel}</p> : null}
      </div>
      <span className="data-value shrink-0 text-sm font-bold text-[var(--text-main)]">
        {formattedValue} <span className="theme-muted text-[11px] font-normal">{unit}</span>
      </span>
    </button>
  )
}

function MultiDivisionSection({ category, current }: { category: RecordCategory; current: TitleReign[] }) {
  const { i18n } = useTranslation()
  const { fighters } = useFighters()
  const { imageByName } = useFighterImages()
  const profileByName = useMemo(() => new Map(fighters.map((fighter) => [normalizeFighterName(fighter.name), fighter])), [fighters])
  const [openName, setOpenName] = useState<string | null>(null)
  const label = getRecordCategoryLabel(category, i18n.language)

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
        <Layers className="h-4 w-4 text-[#C8102E]" />
        <h2 className="broadcast-label text-xs text-[var(--text-main)]">{label}</h2>
        <span className="theme-muted text-xs">({category.entries.length})</span>
      </div>

      <div className="grid items-start gap-1.5 lg:grid-cols-2 lg:gap-2.5">
        {category.entries.map((entry) => {
          const profile = profileByName.get(normalizeFighterName(entry.champion))
          const divisions = (entry.division ?? '')
            .split(', ')
            .filter(Boolean)
            .map((div) => getDivisionName(div, i18n.language))
          const fights = entry.title_fights ?? []
          const isOpen = openName === entry.champion
          const holdsBelt = current.some((reign) => normalizeFighterName(reign.champion) === normalizeFighterName(entry.champion))
          const panelId = `title-fights-${entry.rank}`

          return (
            <div key={entry.champion} className="min-w-0">
              <CompactChampionCard
                name={entry.champion}
                imageUrl={getFighterImageUrl(entry.champion, imageByName, profile?.image_url)}
                badge={<RankBadge rank={entry.rank} />}
                subtitle={divisions.join(' · ')}
                current={holdsBelt}
                stats={[
                  { label: L(i18n.language, 'Disputas', 'Fights', 'Combats'), value: String(fights.length) },
                  { label: L(i18n.language, 'Cinturões', 'Belts', 'Ceintures'), value: String(fights.filter((fight) => fight.role === 'won_title').length) },
                  { label: L(i18n.language, 'Defesas', 'Defenses', 'Défenses'), value: String(fights.filter((fight) => fight.role === 'defense').length) },
                ]}
                onClick={() => setOpenName(isOpen ? null : entry.champion)}
                ariaLabel={L(
                  i18n.language,
                  `${entry.champion}, ${isOpen ? 'ocultar' : 'ver'} disputas de cinturão`,
                  `${entry.champion}, ${isOpen ? 'hide' : 'view'} title fights`,
                  `${entry.champion}, ${isOpen ? 'masquer' : 'voir'} les combats de titre`,
                )}
                expanded={isOpen}
                controls={panelId}
              />
              <div id={panelId}>{isOpen ? <ChampionTimeline entry={entry} /> : null}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const ROLE_STYLES: Record<TitleFight['role'], string> = {
  won_title: 'bg-[#F2C230] text-[#0E0E0E]',
  defense: 'bg-[#1F4E9C] text-white',
  lost_title: 'bg-[#C8102E] text-white',
  challenge: 'border border-[var(--rule)] text-[var(--text-main)]',
  other: 'border border-dashed border-[var(--rule)] text-[var(--text-main)]',
}

const RESULT_STYLES: Record<TitleFight['result'], { letter: string; className: string; name: string }> = {
  win: { letter: 'W', className: 'bg-[var(--rule)] text-[var(--card-bg)]', name: 'Win' },
  loss: { letter: 'L', className: 'bg-[#C8102E] text-white', name: 'Loss' },
  draw: { letter: 'D', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Draw' },
  no_contest: { letter: 'NC', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'No contest' },
}

const RESULT_STYLES_PT: Record<TitleFight['result'], { letter: string; className: string; name: string }> = {
  win: { letter: 'V', className: 'bg-[var(--rule)] text-[var(--card-bg)]', name: 'Vitória' },
  loss: { letter: 'D', className: 'bg-[#C8102E] text-white', name: 'Derrota' },
  draw: { letter: 'E', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Empate' },
  no_contest: { letter: 'SR', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Sem resultado' },
}

const RESULT_STYLES_FR: Record<TitleFight['result'], { letter: string; className: string; name: string }> = {
  win: { letter: 'V', className: 'bg-[var(--rule)] text-[var(--card-bg)]', name: 'Victoire' },
  loss: { letter: 'D', className: 'bg-[#C8102E] text-white', name: 'Défaite' },
  draw: { letter: 'N', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Nul' },
  no_contest: { letter: 'NC', className: 'border-2 border-[var(--rule)] text-[var(--text-main)]', name: 'Sans décision' },
}

function resultStyle(result: TitleFight['result'], language: string | boolean) {
  const lang = uiLang(language)
  if (lang === 'pt') return RESULT_STYLES_PT[result]
  if (lang === 'fr') return RESULT_STYLES_FR[result]
  return RESULT_STYLES[result]
}

function translateFightRole(label: string, language: string | boolean): string {
  const lang = uiLang(language)
  if (lang === 'en') return label
  if (lang === 'fr') return translateFightRoleFr(label)
  const lower = label.toLowerCase().trim()
  if (lower === 'won interim title' || (lower.includes('interim') && lower.includes('won'))) {
    return 'Conquistou o Cinturão Interino'
  }
  if (lower === 'won title' || lower.includes('won undisputed') || (lower.includes('won') && !lower.includes('interim'))) {
    return 'Conquistou o Cinturão'
  }
  if (lower.startsWith('title defense #')) {
    const num = label.replace(/^[^\d]+/, '')
    return `Defesa de Cinturão #${num}`
  }
  if (lower.includes('defended') || lower.includes('title defense')) {
    return 'Defesa de Cinturão'
  }
  if (lower === 'lost title' || lower.includes('lost title') || lower.includes('lost undisputed')) {
    return 'Perdeu o Cinturão'
  }
  if (lower.includes('title shot, lost') || lower.includes('challenged')) {
    return 'Derrota em Disputa de Cinturão'
  }
  if (lower === 'title fight win') {
    return 'Vitória em Disputa de Cinturão'
  }
  if (lower.includes('draw')) {
    return 'Empate em Disputa de Cinturão'
  }
  if (lower.includes('no contest')) {
    return 'Sem Resultado em Disputa de Cinturão'
  }
  return label
}

function translateFightRoleFr(label: string): string {
  const lower = label.toLowerCase().trim()
  if (lower === 'won interim title' || (lower.includes('interim') && lower.includes('won'))) {
    return 'A remporté la ceinture intérimaire'
  }
  if (lower === 'won title' || lower.includes('won undisputed') || (lower.includes('won') && !lower.includes('interim'))) {
    return 'A remporté la ceinture'
  }
  if (lower.startsWith('title defense #')) {
    const num = label.replace(/^[^\d]+/, '')
    return `Défense de titre n°${num}`
  }
  if (lower.includes('defended') || lower.includes('title defense')) {
    return 'Défense de titre'
  }
  if (lower === 'lost title' || lower.includes('lost title') || lower.includes('lost undisputed')) {
    return 'A perdu la ceinture'
  }
  if (lower.includes('title shot, lost') || lower.includes('challenged')) {
    return 'Défaite en combat de titre'
  }
  if (lower === 'title fight win') {
    return 'Victoire en combat de titre'
  }
  if (lower.includes('draw')) {
    return 'Nul en combat de titre'
  }
  if (lower.includes('no contest')) {
    return 'Sans décision en combat de titre'
  }
  return label
}

function translateMethod(method: string | null | undefined, language: string | boolean): string | null {
  if (!method) return null
  const lang = uiLang(language)
  if (lang === 'en') return method
  if (lang === 'fr') return translateMethodFr(method)
  const m = method.trim()
  const lower = m.toLowerCase()
  if (lower.startsWith('ko') || lower.startsWith('tko') || lower.includes('ko/tko')) return 'Nocaute / TKO'
  if (lower.startsWith('sub')) {
    const detail = m.replace(/^submission\s*/i, '').trim()
    if (detail) {
      const cleanDetail = detail.replace(/^\(/, '').replace(/\)$/, '').trim()
      const ptDetails: Record<string, string> = {
        'rear naked choke': 'Mata-leão',
        'rear-naked choke': 'Mata-leão',
        'guillotine choke': 'Guilhotina',
        'guillotine': 'Guilhotina',
        'armbar': 'Chave de braço (Armbar)',
        'triangle choke': 'Triângulo',
        'triangle armbar': 'Triângulo com chave de braço',
        'kimura': 'Kimura',
        'americana': 'Americana',
        'kneebar': 'Chave de joelho',
        'ankle lock': 'Chave de tornozelo',
        'heel hook': 'Chave de calcanhar',
        "d'arce choke": "D'Arce Choke",
        'darce choke': "D'Arce Choke",
        'anaconda choke': 'Triângulo de mão (Anaconda)',
        'von flue choke': 'Von Flue Choke',
        'neck crank': 'Manivela de pescoço',
      }
      const translatedSub = ptDetails[cleanDetail.toLowerCase()] ?? cleanDetail
      return `Finalização (${translatedSub})`
    }
    return 'Finalização'
  }
  if (lower.includes('unanimous') || /^u-dec$/i.test(m)) return 'Decisão Unânime'
  if (lower.includes('split') || /^s-dec$/i.test(m)) return 'Decisão Dividida'
  if (lower.includes('majority') || /^m-dec$/i.test(m)) return 'Decisão Majoritária'
  if (lower.includes('decision') || /^dec$/i.test(m)) return 'Decisão'
  if (lower.includes('disqualification') || /^dq$/i.test(m)) return 'Desqualificação'
  if (lower.includes('no contest') || /^nc$/i.test(m)) return 'Sem Resultado'
  return method
}

function translateMethodFr(method: string): string {
  const m = method.trim()
  const lower = m.toLowerCase()
  if (lower.startsWith('ko') || lower.startsWith('tko') || lower.includes('ko/tko')) return 'KO/TKO'
  if (lower.startsWith('sub')) {
    const detail = m.replace(/^submission\s*/i, '').trim()
    if (detail) {
      const cleanDetail = detail.replace(/^\(/, '').replace(/\)$/, '').trim()
      const frDetails: Record<string, string> = {
        'rear naked choke': 'étranglement arrière',
        'rear-naked choke': 'étranglement arrière',
        'guillotine choke': 'guillotine',
        'guillotine': 'guillotine',
        'armbar': 'clé de bras',
        'triangle choke': 'triangle',
        'triangle armbar': 'triangle avec clé de bras',
        'kimura': 'kimura',
        'americana': 'americana',
        'kneebar': 'clé de genou',
        'ankle lock': 'clé de cheville',
        'heel hook': 'crochetage de talon',
        "d'arce choke": "étranglement D'Arce",
        'darce choke': "étranglement D'Arce",
        'anaconda choke': 'anaconda',
        'von flue choke': 'Von Flue',
        'neck crank': 'crank cervical',
      }
      const translatedSub = frDetails[cleanDetail.toLowerCase()] ?? cleanDetail
      return `Soumission (${translatedSub})`
    }
    return 'Soumission'
  }
  if (lower.includes('unanimous') || /^u-dec$/i.test(m)) return 'Décision unanime'
  if (lower.includes('split') || /^s-dec$/i.test(m)) return 'Décision partagée'
  if (lower.includes('majority') || /^m-dec$/i.test(m)) return 'Décision majoritaire'
  if (lower.includes('decision') || /^dec$/i.test(m)) return 'Décision'
  if (lower.includes('disqualification') || /^dq$/i.test(m)) return 'Disqualification'
  if (lower.includes('no contest') || /^nc$/i.test(m)) return 'Sans décision'
  return method
}

function ChampionTimeline({ entry }: { entry: RecordEntry }) {
  const { i18n } = useTranslation()
  const openProfile = useContext(OpenProfileContext)
  const fights = entry.title_fights ?? []
  const stats = [
    { label: L(i18n.language, 'Disputas de cinturão', 'Title fights', 'Combats de titre'), value: fights.length },
    { label: L(i18n.language, 'Cinturões conquistados', 'Belts won', 'Ceintures gagnées'), value: fights.filter((fight) => fight.role === 'won_title').length },
    { label: L(i18n.language, 'Defesas', 'Defenses', 'Défenses'), value: fights.filter((fight) => fight.role === 'defense').length },
    { label: L(i18n.language, 'Derrotas', 'Losses', 'Défaites'), value: fights.filter((fight) => fight.result === 'loss').length },
  ]

  return (
    <section aria-label={L(i18n.language, `${entry.champion}: todas as disputas de cinturão`, `${entry.champion}: every title fight`, `${entry.champion} : chaque combat de titre`)} className="fade-up mt-2 min-w-0 border-2 border-[var(--rule)] bg-[var(--surface-3)] p-3 sm:p-4">
      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="metric-tile px-3 py-2">
            <dd className="type-display text-2xl leading-none text-[var(--text-main)]">{stat.value}</dd>
            <dt className="theme-muted mt-1 text-[11px] font-bold uppercase tracking-[0.14em]">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {fights.length ? (
        <ol className="mt-4">
          {fights.map((fight, index) => (
            <TitleFightRow key={`${fight.date}-${fight.opponent}`} fight={fight} previous={fights[index - 1]} />
          ))}
        </ol>
      ) : (
        <p className="theme-muted mt-4 text-sm">{L(i18n.language, 'Nenhuma disputa de cinturão encontrada no histórico.', 'No title fights found in the fight history.', 'Aucun combat de titre dans l’historique.')}</p>
      )}

      <button
        type="button"
        onClick={() => openProfile(entry.champion)}
        className="ghost-action mt-4 inline-flex w-full items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-main)] transition hover:!bg-[#F2C230] hover:text-[#0E0E0E]"
      >
        {L(i18n.language, 'Ver perfil completo', 'View full profile', 'Voir le profil complet')}
      </button>
    </section>
  )
}

function TitleFightRow({ fight, previous }: { fight: TitleFight; previous: TitleFight | undefined }) {
  const { i18n } = useTranslation()
  const date = formatFightDate(fight.date, i18n.language)
  const translatedMethod = translateMethod(fight.method, i18n.language)
  const outcome = [translatedMethod, fight.round ? `R${fight.round}` : null].filter(Boolean).join(' · ')
  const result = resultStyle(fight.result, i18n.language)
  const newDivision = fight.division && fight.division !== previous?.division
  const divisionLabel = fight.division ? getDivisionName(fight.division, i18n.language) : null

  return (
    <>
      {newDivision && divisionLabel ? (
        <li aria-hidden className="mb-1.5 mt-3 flex items-center gap-2 first:mt-0">
          <span className="broadcast-label shrink-0 text-[11px] text-[var(--text-main)]">{divisionLabel}</span>
          <span className="h-0.5 flex-1 bg-[var(--rule)]" />
        </li>
      ) : null}
      <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2.5 border-l-2 border-[var(--rule)] py-1.5 pl-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-3.5">
        <div className="pt-0.5">
          <p className="type-display text-lg leading-none text-[var(--text-main)] sm:text-xl">{fight.date?.slice(0, 4) ?? '—'}</p>
          <p className="theme-muted mt-0.5 text-[11px] font-semibold uppercase leading-tight">{date?.replace(/,\s*\d{4}$/, '')}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] ${ROLE_STYLES[fight.role]}`}>
              {fight.role === 'won_title' ? <ChampionBelt className="h-3 w-6" /> : null}
              {fight.role === 'defense' ? <Shield className="h-3 w-3" /> : null}
              {translateFightRole(fight.label, i18n.language)}
            </span>
            {fight.title_type === 'interim' && !/interim/i.test(fight.label) ? (
              <span className="border border-[var(--rule)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-main)]">
                {L(i18n.language, 'Interino', 'Interim', 'Intérimaire')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-main)]">
            <span className={`type-num grid h-5 min-w-5 shrink-0 place-items-center px-1 text-[11px] leading-none ${result.className}`} title={result.name}>
              <span className="sr-only">{result.name}</span>
              <span aria-hidden>{result.letter}</span>
            </span>
            <span className="min-w-0 break-words">vs. {fight.opponent}</span>
          </p>
          <p className="theme-muted mt-0.5 text-[11px] leading-4">{[outcome, fight.event].filter(Boolean).join(' · ')}</p>
        </div>
      </li>
    </>
  )
}
