import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../i18n/lang'
import { Header } from '../shared/components/Header'
import { ScrollToTop } from '../shared/components/ScrollToTop'
import { PageMeta } from '../shared/components/PageMeta'
import { isLandingPath } from '../shared/data/orgs'
import { useOrg } from '../shared/hooks/useOrg'
import { ServerLoadingState } from '../shared/components/ServerLoadingState'
import { getOrgDataInfo, waitForHealth } from '../shared/services/api'

function formatDataDate(iso: string, locale = 'pt-BR') {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MainLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'pt-BR'
  const [dataDate, setDataDate] = useState<string | null>(null)
  const [orgDataDate, setOrgDataDate] = useState<{ org: string; date: string | null } | null>(null)
  const [apiState, setApiState] = useState<'pending' | 'slow' | 'ready' | 'down'>('pending')
  const org = useOrg()
  const landing = isLandingPath(useLocation().pathname)

  // Each organization has its own accent color (see index.css); the attribute is what the stylesheet reads.
  useEffect(() => {
    document.documentElement.dataset.org = org.id
  }, [org.id])

  // The footer says how fresh the data of the organization on screen is (the health check only knows the UFC's).
  useEffect(() => {
    if (org.id === 'ufc') return
    let active = true
    getOrgDataInfo(org.id)
      .then((info) => active && setOrgDataDate({ org: org.id, date: info.last_updated ? formatDataDate(info.last_updated, locale) : null }))
      .catch(() => active && setOrgDataDate({ org: org.id, date: null }))
    return () => {
      active = false
    }
  }, [org.id, locale])

  useEffect(() => {
    // The free hosting tier puts the API to sleep when idle, so the first visit can wait a while for it to wake up.
    const slowTimer = window.setTimeout(() => setApiState((state) => (state === 'pending' ? 'slow' : state)), 2500)
    waitForHealth()
      .then((health) => {
        setDataDate(health.latest_fight_date ? formatDataDate(health.latest_fight_date, locale) : null)
        setApiState('ready')
      })
      .catch(() => {
        setDataDate(null)
        setApiState('down')
      })
    return () => window.clearTimeout(slowTimer)
  }, [locale])

  const footerDate = landing ? null : org.id === 'ufc' ? dataDate : orgDataDate?.org === org.id ? orgDataDate.date : null

  return (
    <div
      className="dashboard-shell w-full max-w-full min-h-screen transition-colors duration-200 bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col overflow-x-hidden"
    >
      <a
        href="#main-content"
        className="type-tech sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#C8102E] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:uppercase focus:tracking-[0.14em] focus:text-white"
      >
        {t('common.skipToContent', 'Skip to content')}
      </a>
      {/* Pinned Sticky Header: Always visible across all scroll positions */}
      <div className="sticky top-0 z-50 w-full bg-[var(--bg-app)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]/40 px-2 py-1.5 sm:px-[clamp(0.75rem,1.4vw,2rem)] sm:py-2">
        <div className="mx-auto w-full max-w-[min(100%,2560px)]">
          <Header />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[min(100%,2560px)] flex-1 flex-col px-[clamp(0.75rem,1.4vw,2rem)]">
        <ScrollToTop />
        <PageMeta />
        {apiState === 'down' ? (
          <p role="status" className="mt-3 border border-[var(--border-subtle)] bg-[#C8102E] px-3 py-2 text-sm font-semibold text-white rounded-lg">
            {t('common.serverDown', 'The server is not answering right now. Give it a minute and reload the page.')}
          </p>
        ) : null}
        <motion.main
          id="main-content"
          className={
            landing
              ? 'flex-1 flex flex-col w-full max-w-full my-1.5 sm:my-2'
              : 'flex-1 border-t border-[var(--border-subtle)] mt-3 pt-3 sm:mt-5 sm:pt-6 w-full max-w-full min-w-0'
          }
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* The chooser needs no data, so it opens at once while the API wakes up in the background. */}
          {(apiState === 'pending' || apiState === 'slow') && !landing ? (
            <ServerLoadingState waking={apiState === 'slow'} />
          ) : (
            children
          )}
        </motion.main>
        {landing ? (
          <footer
            className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-2 py-1 text-[11px] transition-colors text-[var(--text-muted)]"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Vektor MMA • {t('footer.tagline', 'AI sports analytics for matchup analysis')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Link
                to="/about"
                className="underline underline-offset-2 decoration-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                {t('footer.disclaimer', {
                  org: L(i18n.language, 'nenhuma dessas organizações', 'any of these organizations', 'ces organisations'),
                  defaultValue: 'Independent personal project, not affiliated with any of these organizations',
                })}
              </Link>
            </div>
          </footer>
        ) : (
          <footer className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="type-tech text-xs uppercase tracking-[0.14em]">
                  {t('footer.tagline', 'Vektor MMA • AI sports analytics for matchup analysis')}
                </p>
                {footerDate ? (
                  <p className="mt-1.5">{t('footer.dataUpTo', { date: footerDate, defaultValue: `Data up to ${footerDate}` })}</p>
                ) : null}
                <p className="mt-1.5">
                  <Link
                    to="/about"
                    className="underline decoration-[var(--rule)] decoration-1 underline-offset-4 transition hover:text-[#C8102E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
                  >
                    {t('footer.disclaimer', {
                      org: landing
                        ? L(i18n.language, 'nenhuma dessas organizações', 'any of these organizations', 'ces organisations')
                        : L(
                            i18n.language,
                            org.id === 'pfl' ? `a ${org.shortName}` : `o ${org.shortName}`,
                            `the ${org.shortName}`,
                            org.id === 'ufc' ? `l’${org.shortName}` : org.id === 'pfl' ? `la ${org.shortName}` : `le ${org.shortName}`,
                          ),
                      defaultValue: `Independent personal project, not affiliated with ${landing ? 'any of these organizations' : `the ${org.shortName}`}`,
                    })}
                  </Link>
                </p>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
