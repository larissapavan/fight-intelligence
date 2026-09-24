import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { Header } from '../shared/components/Header'

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell min-h-screen text-[#FFFFFF]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5 lg:px-6">
        <Header />
        <motion.main className="flex-1 pt-3 sm:pt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {children}
        </motion.main>
        <footer className="mt-5 border-t border-white/8 pt-3 text-xs text-[#999999]">
          <p className="uppercase tracking-[0.14em]">UFC Fight Predictor • AI sports analytics for matchup analysis</p>
        </footer>
      </div>
    </div>
  )
}
