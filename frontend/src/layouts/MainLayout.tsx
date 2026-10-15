import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Header } from '../shared/components/Header'
import { getHealth } from '../shared/services/api'

function formatDataDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MainLayout({ children }: { children: ReactNode }) {
  const [dataDate, setDataDate] = useState<string | null>(null)

  useEffect(() => {
    getHealth()
      .then((health) => setDataDate(health.latest_fight_date ? formatDataDate(health.latest_fight_date) : null))
      .catch(() => setDataDate(null))
  }, [])

  return (
    <div className="dashboard-shell min-h-screen text-[#FFFFFF]">
      <a
        href="#main-content"
        className="type-tech sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#D32F2F] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:uppercase focus:tracking-[0.14em] focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5 md:px-5 lg:px-6 xl:px-8">
        <Header />
        <motion.main
          id="main-content"
          className="flex-1 pt-3 sm:pt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
        <footer className="mt-5 border-t border-white/8 pt-3 text-xs text-[#999999]">
          <p className="type-tech uppercase tracking-[0.14em]">Fight Intelligence • AI sports analytics for matchup analysis</p>
          {dataDate ? <p className="mt-1.5">Data up to {dataDate}</p> : null}
          <p className="mt-1.5">
            <Link
              to="/about"
              className="underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-[#D32F2F] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D32F2F]"
            >
              Independent fan project, not affiliated with the UFC
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
