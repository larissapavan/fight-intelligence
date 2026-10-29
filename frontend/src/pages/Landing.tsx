import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../i18n/lang'
import { ORGS, orgPath, type OrgId } from '../shared/data/orgs'
import { AnimatedCounter } from '../shared/components/editorial/AnimatedCounter'

interface OrgCardInfo {
  id: OrgId
  watermark: string
  shortName: string
  fullName: string
  accentColor: string
  hoverBorder: string
  gloveImage: string
  metrics: [
    { label: string; value: string },
    { label: string; value: string },
  ]
}

const ORG_CARDS: OrgCardInfo[] = [
  {
    id: 'ufc',
    watermark: '01',
    shortName: 'UFC',
    fullName: 'Ultimate Fighting Championship',
    accentColor: '#E11D48',
    hoverBorder: 'hover:border-[#E11D48]',
    gloveImage: '/mma-glove-ufc.png',
    metrics: [
      { label: 'Divisões', value: '12' },
      { label: 'Lutas', value: '8.9k+' },
    ],
  },
  {
    id: 'pfl',
    watermark: '02',
    shortName: 'PFL',
    fullName: 'Professional Fighters League',
    accentColor: '#2563EB',
    hoverBorder: 'hover:border-[#2563EB]',
    gloveImage: '/mma-glove-pfl.png',
    metrics: [
      { label: 'Divisões', value: '10' },
      { label: 'Estrutura', value: 'Torneio' },
    ],
  },
  {
    id: 'one',
    watermark: '03',
    shortName: 'ONE',
    fullName: 'ONE Championship',
    accentColor: '#F59E0B',
    hoverBorder: 'hover:border-[#F59E0B]',
    gloveImage: '/mma-glove-one.png',
    metrics: [
      { label: 'Divisões', value: '10' },
      { label: 'Artes', value: 'MMA + Muay Thai' },
    ],
  },
  {
    id: 'bellator',
    watermark: '04',
    shortName: 'BELLATOR',
    fullName: 'Bellator MMA (Arquivo Histórico)',
    accentColor: '#10B981',
    hoverBorder: 'hover:border-[#10B981]',
    gloveImage: '/mma-glove-bellator.png',
    metrics: [
      { label: 'Divisões', value: '10' },
      { label: 'Campeões', value: '71' },
    ],
  },
  {
    id: 'zuffa',
    watermark: '05',
    shortName: 'ZUFFA BOXING',
    fullName: 'Zuffa Boxing Promotions',
    accentColor: '#E2E8F0',
    hoverBorder: 'hover:border-[#E2E8F0]',
    gloveImage: '/boxing-glove-3d.png',
    metrics: [
      { label: 'Divisões', value: '8' },
      { label: 'Duração', value: '10–12 Rounds' },
    ],
  },
]

export function Landing() {
  const { i18n } = useTranslation()

  return (
    <div className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] dark:bg-[#08090C] dark:text-white selection:bg-[#E11D48] selection:text-white relative scroll-smooth">
      {/* Cinematic Ambient Background Lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30 dark:opacity-100">
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[#E11D48]/[0.07] blur-[150px]" />
        <div className="absolute right-0 top-1/2 h-[380px] w-[500px] rounded-full bg-[#F59E0B]/[0.04] blur-[160px]" />
        <div className="absolute left-0 bottom-0 h-[380px] w-[500px] rounded-full bg-[#2563EB]/[0.04] blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col">
        {/* =========================================================================
            1. HERO SECTION (Layout fluido e equilibrado com cabeçalho)
            ========================================================================= */}
        <section className="relative px-4 sm:px-8 lg:px-16 pt-2 sm:pt-4 lg:pt-6 pb-12 lg:pb-16 flex items-center">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Lado Esquerdo: Tipografia de Impacto & Conteúdo Editorial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 space-y-5 text-left"
            >
              {/* Título em Syne com escala tipográfica calibrada para não truncar e acomodar a luva */}
              <h1 className="font-display font-black uppercase tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-5xl text-[var(--text-primary)] dark:text-white leading-[0.94] drop-shadow-sm">
                <span className="block">FIGHT</span>
                <span className="block">INTELLIGENCE</span>
              </h1>

              {/* Subtítulo Editorial em Plus Jakarta Sans */}
              <p className="font-sans text-sm sm:text-base text-[var(--text-secondary)] dark:text-neutral-400 font-normal max-w-lg leading-relaxed">
                {L(
                  i18n.language,
                  'A ciência dos dados aplicada ao combate. Previsões por machine learning, cartéis históricos e telemetria analítica.',
                  'Data science applied to combat sports. Machine learning predictions, official records, and analytical telemetry.',
                  'La science des données appliquée au combat. Prédictions par machine learning, historiques et télémétrie analytique.',
                )}
              </p>

              {/* Botões de Ação: Scroll Suave para a Grade e Sobre o Projeto */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#organizations-grid"
                  className="group inline-flex items-center gap-3 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[#0E0E0E] hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white dark:hover:text-black px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-all duration-300 shadow-md cursor-pointer"
                >
                  <span>
                    {L(
                      i18n.language,
                      'EXPLORAR ORGANIZAÇÕES',
                      'EXPLORE ORGANIZATIONS',
                      'EXPLORER LES ORGANISATIONS',
                    )}
                  </span>
                  <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-1" />
                </a>

                <Link
                  to="/about"
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white px-4 py-2.5 font-mono text-xs uppercase tracking-widest transition-all duration-300 shadow-xs"
                >
                  <span>{L(i18n.language, 'SOBRE O PROJETO', 'ABOUT PLATFORM', 'À PROPOS')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Lado Direito: Luva Oficial de MMA Transparente com Espaço Completo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-6 relative flex flex-col items-center justify-center"
            >
              <div className="relative w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] aspect-square flex items-center justify-center p-2">
                {/* Brilho radial ambiente sutil atrás da luva */}
                <div className="absolute inset-0 rounded-full bg-[#E11D48]/[0.1] blur-3xl pointer-events-none" />

                {/* Levitação suave via Framer Motion */}
                <motion.div
                  animate={{ y: [-8, 8, -8], rotate: [-0.4, 0.4, -0.4] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="relative z-10 w-full h-full flex items-center justify-center"
                >
                  <img
                    src="/ufc-glove-hero.png"
                    alt="Official 4oz UFC Fight Glove"
                    className="h-full w-full object-contain filter drop-shadow-[0_20px_35px_rgba(225,29,72,0.25)] select-none pointer-events-none"
                  />
                </motion.div>

                {/* Sombra difusa dinâmica que responde à distância de flutuação */}
                <motion.div
                  animate={{
                    scale: [0.95, 1.15, 0.95],
                    opacity: [0.35, 0.55, 0.35],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute -bottom-2 h-6 w-48 rounded-full bg-gradient-to-r from-transparent via-[#E11D48]/40 to-transparent blur-xl pointer-events-none"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* =========================================================================
            2. BARRA DE MÉTRICAS GLOBAIS (Editorial Big Numbers)
            ========================================================================= */}
        <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 dark:border-white/10 dark:bg-[#0c0e14]/90 backdrop-blur-md py-6 px-4 sm:px-8 lg:px-16">
          <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)] dark:divide-white/10">
            {/* Métrica 1: Lutas */}
            <div className="pt-4 lg:pt-0 lg:px-6 first:pl-0 text-left">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-primary)] dark:text-white tracking-tight tabular-nums">
                  <AnimatedCounter value={8973} />
                </span>
                <span className="text-[#E11D48] font-display font-extrabold text-2xl sm:text-3xl">+</span>
              </div>
              <p className="mt-1 font-sans text-xs uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium">
                {L(i18n.language, 'Lutas Catalogadas', 'Bouts Cataloged', 'Combats Catalogués')}
              </p>
            </div>

            {/* Métrica 2: Atletas */}
            <div className="pt-4 lg:pt-0 lg:px-6 text-left">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-primary)] dark:text-white tracking-tight tabular-nums">
                  <AnimatedCounter value={2794} />
                </span>
                <span className="text-[#2563EB] font-display font-extrabold text-2xl sm:text-3xl">+</span>
              </div>
              <p className="mt-1 font-sans text-xs uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium">
                {L(i18n.language, 'Atletas Monitorados', 'Athletes Profiled', 'Athlètes Répertoriés')}
              </p>
            </div>

            {/* Métrica 3: Features ML */}
            <div className="pt-4 lg:pt-0 lg:px-6 text-left">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-primary)] dark:text-white tracking-tight tabular-nums">
                  <AnimatedCounter value={46} />
                </span>
              </div>
              <p className="mt-1 font-sans text-xs uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium">
                {L(i18n.language, 'Variáveis de ML por Combate', 'ML Features Computed', 'Variables ML / Combat')}
              </p>
            </div>

            {/* Métrica 4: Anos */}
            <div className="pt-4 lg:pt-0 lg:px-6 text-left">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-primary)] dark:text-white tracking-tight tabular-nums">
                  30
                </span>
                <span className="text-[#F59E0B] font-display font-extrabold text-2xl sm:text-3xl">+</span>
              </div>
              <p className="mt-1 font-sans text-xs uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium">
                {L(i18n.language, 'Anos de Histórico (1993–2026)', 'Years of History (1993–2026)', 'Années d’Histoire (1993–2026)')}
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. GRID DE ORGANIZAÇÕES (Cards Limpos e sem Truncamento)
            ========================================================================= */}
        <section id="organizations-grid" className="scroll-mt-28 max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 sm:py-16">
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-[#E11D48] font-bold">
              {L(i18n.language, 'LIGAS & ORGANIZAÇÕES', 'LEAGUES & ORGANIZATIONS', 'LIGUES & ORGANISATIONS')}
            </span>
            <h2 className="mt-1 font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[var(--text-primary)] dark:text-white">
              {L(i18n.language, 'Escolha uma Organização', 'Pick an Organization', 'Choisir une Organisation')}
            </h2>
          </div>

          {/* Grade de Organizações contínua sem espaço entre cards (Connected Editorial Strip) */}
          <div role="list" aria-label="Organizations" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] dark:border-white/10 dark:bg-[#0A0B10]/90 backdrop-blur-xl overflow-hidden shadow-lg grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)] dark:divide-white/10">
            {ORG_CARDS.map((card) => {
              const orgConfig = ORGS[card.id]
              return (
                <Link
                  key={card.id}
                  to={orgPath(orgConfig)}
                  aria-label={`Open ${card.fullName}`}
                  className="group relative flex flex-col justify-between p-4 sm:p-5 transition-all duration-300 hover:bg-[var(--bg-surface-hover)] dark:hover:bg-white/[0.04] cursor-pointer min-w-0 overflow-hidden"
                >
                  {/* Linha de acento sutil no topo do card ao passar o cursor */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ backgroundColor: card.accentColor }}
                  />

                  {/* Top: Header e Marca d'água */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight text-[var(--text-primary)] dark:text-white leading-tight transition-transform duration-300 group-hover:translate-x-0.5 truncate">
                          {card.shortName}
                        </h3>
                        <p className="font-sans text-[11px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium truncate mt-0.5">
                          {card.fullName}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="pointer-events-none font-display font-black text-2xl text-black/[0.08] dark:text-white/[0.06] group-hover:text-black/[0.14] dark:group-hover:text-white/[0.12] transition-colors select-none leading-none">
                          {card.watermark}
                        </span>
                        {orgConfig.hasPredictions ? (
                          <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-500">
                            {L(i18n.language, 'Previsões de vitória', 'Win predictions', 'Pronostics')}
                          </span>
                        ) : null}
                        {orgConfig.archived ? (
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-500">
                            {L(i18n.language, 'Arquivo', 'Archive', 'Archive')}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Luva 3D da Organização em TODOS os cards - Altura e Alinhamento Idênticos */}
                    <div className="relative my-3.5 h-16 sm:h-20 w-full flex items-center justify-center overflow-hidden rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
                      <div
                        className="absolute inset-0 blur-md pointer-events-none opacity-25 group-hover:opacity-45 transition-opacity"
                        style={{ backgroundColor: card.accentColor }}
                      />
                      <motion.img
                        src={card.gloveImage}
                        alt={`${card.shortName} 3D Glove`}
                        animate={{ y: [-2, 2, -2], rotate: [-1.5, 1.5, -1.5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative z-10 h-12 sm:h-14 w-auto object-contain filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.3)] select-none pointer-events-none transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                  </div>

                  {/* Bottom: Métricas e Botão de Ação rigorosamente alinhados */}
                  <div className="mt-auto">
                    <div className="my-3 grid grid-cols-2 gap-2 border-y border-[var(--border-subtle)] dark:border-white/5 py-2.5">
                      <div>
                        <span className="font-sans text-[10px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium block truncate">
                          {card.metrics[0].label}
                        </span>
                        <p className="mt-0.5 font-display font-bold text-sm sm:text-base text-[var(--text-primary)] dark:text-white tabular-nums truncate">
                          {card.metrics[0].value}
                        </p>
                      </div>
                      <div>
                        <span className="font-sans text-[10px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium block truncate">
                          {card.metrics[1].label}
                        </span>
                        <p className="mt-0.5 font-display font-bold text-sm sm:text-base text-[var(--text-primary)] dark:text-white tabular-nums truncate">
                          {card.metrics[1].value}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="inline-flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] transition-all duration-300 group-hover:bg-[#0E0E0E] group-hover:text-white group-hover:border-[#0E0E0E] dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:group-hover:bg-white dark:group-hover:text-black shadow-xs">
                        <span>{L(i18n.language, 'Entrar', 'Enter', 'Entrer')}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* =========================================================================
            4. FOOTER EDITORIAL (Sobre o Projeto & Links Rápidos)
            ========================================================================= */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 dark:border-white/10 dark:bg-[#08090C] py-8 px-4 sm:px-8 lg:px-16 mt-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)] dark:text-neutral-400 font-sans">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[var(--text-primary)] dark:text-white">Fight Intelligence</span>
              <span>•</span>
              <span>
                {L(
                  i18n.language,
                  'Plataforma de Predições e Telemetria em Esportes de Combate',
                  'Combat Sports Telemetry & Predictive Analytics',
                  'Analytique Prédictive & Télémétrie',
                )}
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
              <Link to="/about" className="hover:text-[var(--text-primary)] dark:hover:text-white transition">
                {L(i18n.language, 'Sobre', 'About', 'À propos')}
              </Link>
              <Link to="/data" className="hover:text-[var(--text-primary)] dark:hover:text-white transition">
                {L(i18n.language, 'Dados', 'Data', 'Données')}
              </Link>
              <Link to="/model" className="hover:text-[var(--text-primary)] dark:hover:text-white transition">
                {L(i18n.language, 'Sistema ML', 'ML System', 'Système ML')}
              </Link>
              <Link to="/track-record" className="hover:text-[var(--text-primary)] dark:hover:text-white transition">
                {L(i18n.language, 'Acurácia', 'Track Record', 'Historique')}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
