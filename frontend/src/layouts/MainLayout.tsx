import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { Header } from '../shared/components/Header'

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell min-h-screen text-[#FFFFFF]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#E81B23] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:uppercase focus:tracking-[0.14em] focus:text-white"
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
          <p className="uppercase tracking-[0.14em]">UFC Fight Intelligence • AI sports analytics for matchup analysis</p>
        </footer>
      </div>
    </div>
  )
}
