import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Header } from '../shared/components/Header'
import { PageMeta } from '../shared/components/PageMeta'
import { useOrg } from '../shared/hooks/useOrg'
import { ServerLoadingState } from '../shared/components/ServerLoadingState'
import { getOrgDataInfo, waitForHealth } from '../shared/services/api'

function formatDataDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MainLayout({ children }: { children: ReactNode }) {
  const [dataDate, setDataDate] = useState<string | null>(null)
  const [orgDataDate, setOrgDataDate] = useState<{ org: string; date: string | null } | null>(null)
  const [apiState, setApiState] = useState<'pending' | 'slow' | 'ready' | 'down'>('pending')
  const org = useOrg()

  // Each organization has its own accent color (see index.css); the attribute is what the stylesheet reads.
  useEffect(() => {
    document.documentElement.dataset.org = org.id
  }, [org.id])

  // The footer says how fresh the data of the organization on screen is (the health check only knows the UFC's).
  useEffect(() => {
    if (org.id === 'ufc') return
    let active = true
    getOrgDataInfo(org.id)
      .then((info) => active && setOrgDataDate({ org: org.id, date: info.last_updated ? formatDataDate(info.last_updated) : null }))
      .catch(() => active && setOrgDataDate({ org: org.id, date: null }))
    return () => {
      active = false
    }
  }, [org.id])

  useEffect(() => {
    // The free hosting tier puts the API to sleep when idle, so the first visit can wait a while for it to wake up.
    const slowTimer = window.setTimeout(() => setApiState((state) => (state === 'pending' ? 'slow' : state)), 2500)
    waitForHealth()
      .then((health) => {
        setDataDate(health.latest_fight_date ? formatDataDate(health.latest_fight_date) : null)
        setApiState('ready')
      })
      .catch(() => {
        setDataDate(null)
        setApiState('down')
      })
    return () => window.clearTimeout(slowTimer)
  }, [])

  const footerDate = org.id === 'ufc' ? dataDate : orgDataDate?.org === org.id ? orgDataDate.date : null

  return (
    <div className="dashboard-shell min-h-screen text-[#FFFFFF]">
      <a
        href="#main-content"
        className="type-tech sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#C8102E] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:uppercase focus:tracking-[0.14em] focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5 md:px-5 lg:px-6 xl:px-8">
        <PageMeta />
        <Header />
        {apiState === 'down' ? (
          <p role="status" className="mt-3 border-2 border-[var(--rule)] bg-[#C8102E] px-3 py-2 text-sm font-semibold text-white">
            The server is not answering right now. Give it a minute and reload the page.
          </p>
        ) : null}
        <motion.main
          id="main-content"
          className="flex-1 border-t border-white/[0.06] mt-4 pt-5 sm:mt-5 sm:pt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {apiState === 'pending' || apiState === 'slow' ? (
            <ServerLoadingState waking={apiState === 'slow'} />
          ) : (
            children
          )}
        </motion.main>
        <footer className="mt-6 border-[3px] border-[var(--rule)] bg-[var(--card-bg)] px-4 py-3 text-sm font-medium text-[var(--text-main)] shadow-[5px_5px_0_var(--hard)]">
          <p className="type-tech text-xs uppercase tracking-[0.14em]">Fight Intelligence • AI sports analytics for matchup analysis</p>
          {footerDate ? <p className="mt-1.5">Data up to {footerDate}</p> : null}
          <p className="mt-1.5">
            <Link
              to="/about"
              className="underline decoration-[var(--rule)] decoration-2 underline-offset-4 transition hover:bg-[#F2C230] hover:text-[#0E0E0E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
            >
              Independent fan project, not affiliated with the {org.shortName}
            </Link>
          </p>
          <p className="mt-1.5">
            <a
              href="/feed.xml"
              className="underline decoration-[var(--rule)] decoration-2 underline-offset-4 transition hover:bg-[#F2C230] hover:text-[#0E0E0E] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
            >
              RSS feed: new picks and results
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
