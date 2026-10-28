import { motion } from 'framer-motion'
import { ExternalLink, MapPin, X } from 'lucide-react'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'
import { getDivisionName } from '../data/divisions'
import { formatDate, formatHeight, formatRecord, formatReach, formatWeight, originLine } from '../data/orgFormat'
import type { OrgConfig } from '../data/orgs'
import { useOrgFighterFights, useOrgFighters } from '../hooks/useOrgData'
import { normalizeFighterName } from '../hooks/useFighterImages'
import type { OrgFighter } from '../types/api'
import { FighterAvatar } from './FighterAvatar'
import { FlagIcon } from './FlagIcon'
import { LoadingSkeleton } from './LoadingSkeleton'
import { OrgFightLine } from './OrgFightLine'
import { MiniStat } from './MiniStat'

/** A fighter of an organization other than the UFC: details, next fight and every bout, opened on top of the page. */
export function OrgFighterModal({
  org,
  name,
  onClose,
  onSelectFighter,
}: {
  org: OrgConfig
  name: string
  onClose: () => void
  onSelectFighter: (name: string) => void
}) {
  const { i18n } = useTranslation()

  const { fighters } = useOrgFighters(org.id)
  const { fights, loading, error } = useOrgFighterFights(org.id, name)
  const profile = useMemo(
    () => fighters.find((fighter) => normalizeFighterName(fighter.name) === normalizeFighterName(name)) ?? null,
    [fighters, name],
  )
  const known = useMemo(() => new Set(fighters.map((fighter) => normalizeFighterName(fighter.name))), [fighters])

  return createPortal(
    <motion.div
      className="selector-backdrop fixed inset-0 z-[95] flex items-center justify-center overflow-hidden px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.section
        role="dialog"
        aria-label={L(i18n.language, `${name}, perfil no ${org.shortName}`, `${name}, ${org.shortName} fighter profile`, `${name}, profil ${org.shortName}`)}
        className="surface-card flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] border-white/14"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FighterAvatar name={name} imageUrl={profile?.image_url ?? null} highlight={Boolean(profile?.belt)} className="h-16 w-16 sm:h-20 sm:w-20" />
            <div className="min-w-0">
              <p className="broadcast-label text-[11px] text-[var(--text-muted)]">
                {L(i18n.language, `Perfil no ${org.shortName}`, `${org.shortName} fighter profile`, `Profil ${org.shortName}`)}
              </p>
              <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.02em] text-[var(--text-main)]">
                {profile?.country_code ? <FlagIcon code={profile.country_code} country={profile.country} className="h-4 w-6" /> : null}
                <span className="min-w-0 truncate">{name}</span>
              </h2>
              {profile?.nickname ? <p className="text-sm italic text-[var(--text-muted)]">“{profile.nickname}”</p> : null}
              {profile ? <TitleLine fighter={profile} /> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="ghost-action grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-label={L(i18n.language, 'Fechar perfil do lutador', 'Close fighter profile', 'Fermer le profil du combattant')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {profile ? <Details org={org} fighter={profile} /> : null}

            {profile?.next_fight ? (
              <div className="metric-tile rounded-2xl p-3">
                <p className="broadcast-label text-[11px] text-[var(--text-muted)]">{L(i18n.language, 'Próxima luta', 'Next fight', 'Prochain combat')}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
                  vs {profile.next_fight.opponent} · {formatDate(profile.next_fight.date, true, i18n.language)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{profile.next_fight.event}</p>
              </div>
            ) : null}

            <section aria-label={L(i18n.language, `Lutas no ${org.shortName}`, `${org.shortName} fights`, `Combats ${org.shortName}`)}>
              <p className="broadcast-label mb-1.5 text-[11px] text-[var(--text-muted)]">
                {L(i18n.language, `Histórico no ${org.shortName}`, `${org.shortName} fights`, `Historique ${org.shortName}`)}
              </p>
              {loading ? (
                <div className="space-y-2">
                  <LoadingSkeleton className="h-[54px]" />
                  <LoadingSkeleton className="h-[54px]" />
                </div>
              ) : error ? (
                <p className="rounded-xl border border-[#C8102E]/25 bg-[#C8102E]/8 px-3 py-2 text-sm text-[var(--text-main)]">{error}</p>
              ) : fights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {L(i18n.language, `Nenhuma luta no ${org.shortName} registrada ainda.`, `No ${org.shortName} fights recorded yet.`, `Aucun combat ${org.shortName} enregistré pour l'instant.`)}
                </p>
              ) : (
                <ul className="space-y-2">
                  {fights.map((fight) => (
                    <OrgFightLine key={`${fight.fight_url}-${fight.opponent}`} fight={fight} knownOpponent={known.has(normalizeFighterName(fight.opponent))} onSelect={onSelectFighter} />
                  ))}
                </ul>
              )}
            </section>

            {profile?.ufc_name ? (
              <Link
                to={`/fighters?fighter=${encodeURIComponent(profile.ufc_name)}`}
                onClick={onClose}
                className="ghost-action mr-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-main)]"
              >
                {L(i18n.language, 'Ver perfil completo no UFC →', 'Also in the UFC: open the UFC profile', 'Voir le profil complet à l\'UFC →')}
              </Link>
            ) : null}

            {profile?.profile_url ? (
              <a
                href={profile.profile_url}
                target="_blank"
                rel="noreferrer"
                className="ghost-action inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-main)]"
              >
                {L(i18n.language, `Perfil oficial no ${org.sourceName}`, `Profile on ${org.sourceName}`, `Profil officiel sur ${org.sourceName}`)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

function TitleLine({ fighter }: { fighter: OrgFighter }) {
  const { i18n } = useTranslation()
  if (!fighter.ranking && !fighter.belt) return null
  const interim = fighter.title_status === 'interim'
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1">
      {fighter.belt ? (
        <span className={`border-2 border-[var(--rule)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] ${interim ? 'bg-[#1F4E9C] text-white' : 'bg-[#F2C230] text-[#0E0E0E]'}`}>
          {interim ? L(i18n.language, 'Campeão Interino', 'Interim champion', 'Champion intérimaire') : L(i18n.language, 'Campeão', 'Champion', 'Champion')}
        </span>
      ) : null}
      {fighter.ranking ? (
        <span className="border-2 border-[var(--rule)] bg-[var(--surface-3)] px-1.5 py-px text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--text-main)]">
          {fighter.ranking}
        </span>
      ) : null}
    </p>
  )
}

function Details({ org, fighter }: { org: OrgConfig; fighter: OrgFighter }) {
  const { i18n } = useTranslation()
  const origin = originLine(fighter)
  const age = fighter.age == null ? null : `${Math.round(fighter.age)}`
  const stats: [string, string | null][] = [
    [L(i18n.language, 'Cartel Pro', 'Record', 'Palmarès pro'), formatRecord(fighter)],
    [L(i18n.language, `No ${org.shortName}`, ` ${org.shortName}`, `Chez ${org.shortName}`), fighter.org_record],
    [L(i18n.language, 'Categoria', 'Division', 'Catégorie'), fighter.division ? getDivisionName(fighter.division, i18n.language) : null],
    [L(i18n.language, 'Idade', 'Age', 'Âge'), age ? L(i18n.language, `${age} anos`, `${age} years`, `${age} ans`) : null],
    [L(i18n.language, 'Altura', 'Height', 'Taille'), formatHeight(fighter.height_cm, i18n.language)],
    [L(i18n.language, 'Envergadura', 'Reach', 'Allonge'), formatReach(fighter.reach_cm, i18n.language)],
    [L(i18n.language, 'Peso', 'Weight', 'Poids'), formatWeight(fighter.weight_lbs, i18n.language)],
    [L(i18n.language, 'Status', 'Status', 'Statut'), fighter.is_active ? L(i18n.language, 'Ativo', 'Active', 'Actif') : L(i18n.language, 'Inativo', 'Not fighting', 'Inactif')],
  ]
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats
          .filter((stat): stat is [string, string] => Boolean(stat[1]))
          .map(([label, value]) => (
            <MiniStat key={label} label={label} value={value} />
          ))}
      </div>
      {origin || fighter.camp ? (
        <ul className="space-y-1 text-xs leading-5 text-[var(--text-muted)]">
          {origin ? (
            <li className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{origin}</span>
            </li>
          ) : null}
          {fighter.camp ? (
            <li>
              <span className="font-semibold text-[var(--text-main)]">{L(i18n.language, 'Equipe:', 'Camp:', 'Équipe :')}</span> {fighter.camp}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
