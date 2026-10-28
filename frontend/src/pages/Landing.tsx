import { ArrowRight, Archive, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../i18n/lang'
import { SectionHeading } from '../shared/components/SectionHeading'
import { ORG_LIST, orgPath, type OrgConfig, type OrgId } from '../shared/data/orgs'

/** What each organization has, in the reader's words; the facts that differ (predictions, archive) come from the org config. */
const SECTIONS_OF: Record<OrgId, string[]> = {
  ufc: ['Rankings', 'Champions', 'Fighters', 'Events', 'Gyms'],
  pfl: ['Rankings', 'Fighters', 'Events', 'Gyms'],
  bellator: ['Fighters', 'Events', 'Gyms'],
}

/** Each organization's own color, so the cards tell them apart before the page does (the UFC red, the PFL blue, Bellator green). */
const ACCENT: Record<OrgId, string> = { ufc: '#C8102E', pfl: '#1F4E9C', bellator: '#2E7D4F' }

/** The first page of the site: which organization do you want? Each one has its own pages under its own address. */
export function Landing() {
  const { t } = useTranslation()

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="page-hero rounded-[20px] px-3 py-4 sm:px-5 sm:py-6">
        <SectionHeading
          level={1}
          eyebrow={t('landing.eyebrow', 'Fight Intelligence')}
          title={t('landing.title', 'Pick an organization')}
          description={t(
            'landing.description',
            'Stats, rankings and results for the UFC, the PFL and the Bellator archive. Only the UFC has win predictions, because the model learned from UFC fights.'
          )}
        />
      </section>

      <ul aria-label={t('landing.orgsAria', 'Organizations')} className="grid gap-3 md:grid-cols-3">
        {ORG_LIST.map((org) => (
          <li key={org.id}>
            <OrgCard org={org} />
          </li>
        ))}
      </ul>

      <p className="theme-muted text-xs leading-5">
        {t(
          'landing.footerNotice',
          'You can switch organization at any time from the strip at the top of every page. Independent personal project, not affiliated with any of these organizations.'
        )}
      </p>
    </div>
  )
}

function OrgCard({ org }: { org: OrgConfig }) {
  const { t, i18n } = useTranslation()

  const tagline = t(`landing.taglines.${org.id}`, { defaultValue: org.tagline })
  const source = org.sourceName === 'ESPN and Wikipedia'
    ? L(i18n.language, 'ESPN e Wikipedia', 'ESPN and Wikipedia', 'ESPN et Wikipedia')
    : org.sourceName

  return (
    <Link
      to={orgPath(org)}
      aria-label={t('landing.open', { name: org.name, defaultValue: `Open ${org.name}` })}
      style={{ borderTopColor: ACCENT[org.id] }}
      className="surface-card group flex h-full flex-col gap-3 border-t-[10px] p-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rule)]"
    >
      <div>
        <p className="type-tech text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{org.name}</p>
        <p className="poster-display mt-1 text-5xl leading-none text-[var(--text-main)]">{org.shortName}</p>
      </div>

      <p className="text-sm leading-6 text-[var(--text-main)]">{tagline}</p>

      <div className="flex flex-wrap gap-1.5">
        {org.hasPredictions ? (
          <span className="inline-flex items-center gap-1 border-2 border-[var(--rule)] bg-[#F2C230] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#0E0E0E]">
            <Sparkles aria-hidden className="h-3.5 w-3.5" /> {t('landing.winPredictions', 'Win predictions')}
          </span>
        ) : null}
        {org.archived ? (
          <span className="inline-flex items-center gap-1 border-2 border-[var(--rule)] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-main)]">
            <Archive aria-hidden className="h-3.5 w-3.5" /> {t('landing.archive', 'Archive')}
          </span>
        ) : null}
        {SECTIONS_OF[org.id].map((section) => (
          <span key={section} className="border border-[var(--rule)]/50 px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {t(`landing.sections.${section}`, section)}
          </span>
        ))}
      </div>

      <p className="theme-muted text-xs">
        {t('landing.dataFrom', { source, defaultValue: `Data from ${source}` })}
      </p>

      <span className="primary-action mt-auto inline-flex w-fit items-center gap-1.5 px-4 py-2.5 text-xs uppercase" style={{ background: ACCENT[org.id] }}>
        {t('landing.enter', { name: org.shortName, defaultValue: `Enter ${org.shortName}` })}
        <ArrowRight aria-hidden className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
