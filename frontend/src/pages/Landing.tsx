import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { L } from '../i18n/lang'
import { ORGS, orgPath, type OrgId } from '../shared/data/orgs'
import { AnimatedCounter } from '../shared/components/editorial/AnimatedCounter'
import { SocialLinks } from '../shared/components/SocialLinks'

interface OrgMetric {
  labelPt: string
  labelEn: string
  labelFr: string
  valuePt: string
  valueEn: string
  valueFr: string
}

interface OrgStatusBadge {
  labelPt: string
  labelEn: string
  labelFr: string
  pulse?: boolean
}

interface OrgCardInfo {
  id: OrgId
  watermark: string
  shortName: string
  fullName: string
  fullNameEn?: string
  fullNameFr?: string
  accentColor: string
  hoverBorder: string
  gloveImage: string
  statusBadge: OrgStatusBadge
  metrics: [OrgMetric, OrgMetric]
}

const ORG_CARDS: OrgCardInfo[] = [
  {
    id: 'ufc',
    watermark: '01',
    shortName: 'UFC',
    fullName: 'Ultimate Fighting Championship',
    accentColor: '#E11D48',
    hoverBorder: 'border-[#E11D48]/35 hover:border-[#E11D48] hover:shadow-[0_0_30px_rgba(225,29,72,0.28),inset_0_0_15px_rgba(225,29,72,0.08)]',
    gloveImage: '/mma-glove-ufc.png',
    statusBadge: {
      labelPt: 'Previsões IA',
      labelEn: 'AI Predictions',
      labelFr: 'Pronostics IA',
      pulse: true,
    },
    metrics: [
      { labelPt: 'Divisões', labelEn: 'Divisions', labelFr: 'Divisions', valuePt: '12', valueEn: '12', valueFr: '12' },
      { labelPt: 'Lutas', labelEn: 'Bouts', labelFr: 'Combats', valuePt: '8.9k+', valueEn: '8.9k+', valueFr: '8.9k+' },
    ],
  },
  {
    id: 'pfl',
    watermark: '02',
    shortName: 'PFL',
    fullName: 'Professional Fighters League',
    accentColor: '#2563EB',
    hoverBorder: 'border-[#2563EB]/35 hover:border-[#2563EB] hover:shadow-[0_0_30px_rgba(37,99,235,0.28),inset_0_0_15px_rgba(37,99,235,0.08)]',
    gloveImage: '/mma-glove-pfl.png',
    statusBadge: {
      labelPt: 'Liga & Torneio',
      labelEn: 'Tournament',
      labelFr: 'Tournoi Actif',
      pulse: false,
    },
    metrics: [
      { labelPt: 'Divisões', labelEn: 'Divisions', labelFr: 'Divisions', valuePt: '10', valueEn: '10', valueFr: '10' },
      { labelPt: 'Formato', labelEn: 'Format', labelFr: 'Format', valuePt: 'Torneio', valueEn: 'Tournament', valueFr: 'Tournoi' },
    ],
  },
  {
    id: 'one',
    watermark: '03',
    shortName: 'ONE',
    fullName: 'ONE Championship',
    accentColor: '#F59E0B',
    hoverBorder: 'border-[#F59E0B]/35 hover:border-[#F59E0B] hover:shadow-[0_0_30px_rgba(245,158,11,0.28),inset_0_0_15px_rgba(245,158,11,0.08)]',
    gloveImage: '/mma-glove-one.png',
    statusBadge: {
      labelPt: 'Previsões IA',
      labelEn: 'AI Predictions',
      labelFr: 'Pronostics IA',
      pulse: true,
    },
    metrics: [
      { labelPt: 'Divisões', labelEn: 'Divisions', labelFr: 'Divisions', valuePt: '10', valueEn: '10', valueFr: '10' },
      { labelPt: 'Modalidades', labelEn: 'Disciplines', labelFr: 'Disciplines', valuePt: 'MMA & Muay Thai', valueEn: 'MMA & Muay Thai', valueFr: 'MMA & Muay Thai' },
    ],
  },
  {
    id: 'bellator',
    watermark: '04',
    shortName: 'BELLATOR',
    fullName: 'Bellator MMA',
    fullNameEn: 'Bellator MMA',
    fullNameFr: 'Bellator MMA',
    accentColor: '#10B981',
    hoverBorder: 'border-[#10B981]/35 hover:border-[#10B981] hover:shadow-[0_0_30px_rgba(16,185,129,0.28),inset_0_0_15px_rgba(16,185,129,0.08)]',
    gloveImage: '/mma-glove-bellator.png',
    statusBadge: {
      labelPt: 'Arquivo Histórico',
      labelEn: 'Historical Archive',
      labelFr: 'Archives',
      pulse: false,
    },
    metrics: [
      { labelPt: 'Divisões', labelEn: 'Divisions', labelFr: 'Divisions', valuePt: '10', valueEn: '10', valueFr: '10' },
      { labelPt: 'Campeões', labelEn: 'Champions', labelFr: 'Champions', valuePt: '71', valueEn: '71', valueFr: '71' },
    ],
  },
]

export function Landing() {
  const { i18n } = useTranslation()

  return (
    <div className="w-full bg-[var(--bg-app)] text-[var(--text-primary)] dark:bg-[#0B0C10] dark:text-white selection:bg-[#E11D48] selection:text-white relative scroll-smooth flex flex-col justify-between">
      {/* Cinematic Ambient Background Lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30 dark:opacity-100">
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[#E11D48]/[0.07] blur-[150px]" />
        <div className="absolute right-0 top-1/2 h-[380px] w-[500px] rounded-full bg-[#F59E0B]/[0.04] blur-[160px]" />
        <div className="absolute left-0 bottom-0 h-[380px] w-[500px] rounded-full bg-[#2563EB]/[0.04] blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* =========================================================================
            1. HERO SECTION (Com Iluminação de Arena e Grelha Analítica - Espaçamento Compacto)
            ========================================================================= */}
        <section className="relative px-4 sm:px-8 lg:px-16 pt-2 sm:pt-3 lg:pt-4 pb-4 sm:pb-5 lg:pb-6 flex items-center overflow-hidden">
          {/* Refletores de Arena do Topo e Grelha Milimétrica Esportiva */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* Refletor Esquerdo: Tom Vermelho Volumétrico */}
            <div className="absolute -top-12 left-0 sm:left-10 w-72 sm:w-[420px] h-[400px] bg-gradient-to-br from-[#FF2E54]/20 via-[#FF2E54]/5 to-transparent blur-3xl transform -rotate-12 pointer-events-none" />
            {/* Refletor Direito: Tom Azul Cobalto Volumétrico */}
            <div className="absolute -top-12 right-0 sm:right-10 w-72 sm:w-[420px] h-[400px] bg-gradient-to-bl from-[#2563EB]/20 via-[#2563EB]/5 to-transparent blur-3xl transform rotate-12 pointer-events-none" />
            {/* Grade Milimétrica Esportiva de Alta Precisão */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.055]"
              style={{
                backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            {/* Lado Esquerdo: Tipografia de Impacto & Conteúdo Editorial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 space-y-5 text-left"
            >
              {/* Título com VEKTOR MMA */}
              <h1 className="font-display font-black uppercase tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-6xl text-[var(--text-primary)] dark:text-white leading-[0.92] drop-shadow-sm">
                <span className="block">VEKTOR <span className="text-[#FF2E54]">MMA</span></span>
              </h1>

              {/* Subtítulo Editorial em Plus Jakarta Sans */}
              <p className="font-sans text-sm sm:text-base text-[var(--text-secondary)] dark:text-neutral-400 font-normal max-w-lg leading-relaxed">
                {L(
                  i18n.language,
                  'A ciência dos dados aplicada ao combate. Previsões por machine learning, cartéis históricos e telemetria analítica com a inteligência da Vektor MMA.',
                  'Data science applied to combat sports. Machine learning predictions, official records, and analytical telemetry with Vektor MMA intelligence.',
                  'La science des données appliquée au combat. Prédictions par machine learning, historiques et télémétrie analytique avec l\'intelligence Vektor MMA.',
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
                  to="/model"
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] hover:border-[#FF2E54]/40 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white px-4 py-2.5 font-mono text-xs uppercase tracking-widest transition-all duration-300 shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#FF2E54] transition-transform duration-300 group-hover:scale-110" />
                  <span>
                    {L(
                      i18n.language,
                      'VER MODELO PREDITIVO',
                      'EXPLORE AI MODEL',
                      'MODÈLE PRÉDICTIF',
                    )}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Lado Direito: Cinturão de Campeonato Flutuante */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-6 relative flex flex-col items-center justify-center"
            >
              <div className="relative w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] aspect-square flex items-center justify-center p-2">
                {/* Brilho radial ambiente sutil atrás do cinturão */}
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
                    src="/vektor_mma_championship_belt.png"
                    alt="Cinturão de Campeonato Vektor MMA"
                    className="h-auto w-full object-contain filter drop-shadow-[0_20px_35px_rgba(225,29,72,0.25)] select-none pointer-events-none"
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
            2. BARRA DE MÉTRICAS GLOBAIS (Editorial Big Numbers - Espaçamento Otimizado)
            ========================================================================= */}
        <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 dark:border-white/10 dark:bg-[#0c0e14]/90 backdrop-blur-md py-3.5 sm:py-4 px-4 sm:px-8 lg:px-16">
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
        <section id="organizations-grid" className="scroll-mt-28 max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 pt-6 sm:pt-8 pb-3 sm:pb-4 w-full">
          <div className="mb-4 sm:mb-5">
            <span className="font-mono text-xs uppercase tracking-widest text-[#E11D48] font-bold">
              {L(i18n.language, 'LIGAS & ORGANIZAÇÕES', 'LEAGUES & ORGANIZATIONS', 'LIGUES & ORGANISATIONS')}
            </span>
            <h2 className="mt-1 font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[var(--text-primary)] dark:text-white">
              {L(i18n.language, 'Escolha uma Organização', 'Pick an Organization', 'Choisir une Organisation')}
            </h2>
          </div>

          {/* Grade de Organizações com Cards Individuais Modernos e Luvas 3D Destacadas */}
          <div
            role="list"
            aria-label="Organizations"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
          >
            {ORG_CARDS.map((card) => {
              const orgConfig = ORGS[card.id]
              return (
                <Link
                  key={card.id}
                  to={orgPath(orgConfig)}
                  aria-label={`Open ${card.fullName}`}
                  style={{ '--accent-color': card.accentColor } as React.CSSProperties}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-[var(--bg-surface)] dark:bg-[#07080C]/85 backdrop-blur-xl p-5 sm:p-5.5 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer min-w-0 overflow-hidden ${card.hoverBorder}`}
                >
                  {/* Camada Inferior: Textura Esportiva de Fibra de Carbono Micrométrica */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.07] mix-blend-luminosity"
                    style={{
                      backgroundImage: `
                        repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 4px),
                        repeating-linear-gradient(-45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 4px)
                      `,
                      backgroundSize: '6px 6px',
                    }}
                  />

                  {/* Moldura Néon Refinada no Topo do Card */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      backgroundColor: card.accentColor,
                      boxShadow: `0 0 10px ${card.accentColor}`,
                    }}
                  />

                  {/* Top: Índice e Badge de Status Alinhados */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--text-muted)] dark:text-neutral-500 tracking-wider">
                        {`// ${card.watermark}`}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider backdrop-blur-md"
                        style={{
                          backgroundColor: `${card.accentColor}18`,
                          borderColor: `${card.accentColor}40`,
                          color: card.accentColor,
                          borderWidth: 1,
                        }}
                      >
                        {card.statusBadge.pulse && (
                          <span
                            className="h-1.5 w-1.5 rounded-full animate-pulse"
                            style={{
                              backgroundColor: card.accentColor,
                              boxShadow: `0 0 6px ${card.accentColor}`,
                            }}
                          />
                        )}
                        {L(
                          i18n.language,
                          card.statusBadge.labelPt,
                          card.statusBadge.labelEn,
                          card.statusBadge.labelFr,
                        )}
                      </span>
                    </div>

                    {/* Título e Subtítulo Claros sem Truncamento */}
                    <div className="mt-3">
                      <h3 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-[var(--text-primary)] dark:text-white leading-none">
                        {card.shortName}
                      </h3>
                      <p className="font-sans text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-neutral-400 font-medium leading-snug mt-1">
                        {L(
                          i18n.language,
                          card.fullName,
                          card.fullNameEn ?? card.fullName,
                          card.fullNameFr ?? card.fullName,
                        )}
                      </p>
                    </div>

                    {/* Luva 3D da Organização com Iluminação Volumétrica Suave */}
                    <div className="relative my-4 sm:my-5 h-26 sm:h-30 w-full flex items-center justify-center">
                      {/* 1. Aura volumétrica ampla difusa */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-20 group-hover:opacity-45 transition-opacity duration-500 blur-2xl pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${card.accentColor} 0%, transparent 70%)`,
                        }}
                      />
                      {/* 2. Núcleo volumétrico suave concentrado */}
                      <div
                        className="absolute h-16 w-16 rounded-full blur-xl opacity-25 group-hover:opacity-55 transition-opacity duration-500 pointer-events-none"
                        style={{ backgroundColor: card.accentColor }}
                      />
                      {/* 3. Luva 3D Flutuante */}
                      <motion.img
                        src={card.gloveImage}
                        alt={`${card.shortName} 3D Glove`}
                        animate={{ y: [-3, 3, -3], rotate: [-1, 1, -1] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative z-10 h-22 sm:h-24 w-auto object-contain select-none pointer-events-none transition-transform duration-300 group-hover:scale-110"
                        style={{
                          filter: `drop-shadow(0 12px 24px ${card.accentColor}66)`,
                        }}
                      />
                      {/* 4. Sombra sutil de levitação no piso do card */}
                      <motion.div
                        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.2, 0.4, 0.2] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -bottom-1 h-3 w-20 rounded-full blur-md pointer-events-none"
                        style={{ backgroundColor: card.accentColor }}
                      />
                    </div>
                  </div>

                  {/* Bottom: Métricas e Botão de Ação rigorosamente alinhados */}
                  <div className="mt-auto relative z-10">
                    <div className="my-3 grid grid-cols-2 gap-2 border-y border-[var(--border-subtle)] dark:border-white/5 py-2.5">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium block">
                          {L(i18n.language, card.metrics[0].labelPt, card.metrics[0].labelEn, card.metrics[0].labelFr)}
                        </span>
                        <p className="mt-0.5 font-display font-bold text-sm sm:text-base text-[var(--text-primary)] dark:text-white tabular-nums">
                          {L(i18n.language, card.metrics[0].valuePt, card.metrics[0].valueEn, card.metrics[0].valueFr)}
                        </p>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400 font-medium block">
                          {L(i18n.language, card.metrics[1].labelPt, card.metrics[1].labelEn, card.metrics[1].labelFr)}
                        </span>
                        <p className="mt-0.5 font-display font-bold text-xs sm:text-[13px] text-[var(--text-primary)] dark:text-white leading-tight">
                          {L(i18n.language, card.metrics[1].valuePt, card.metrics[1].valueEn, card.metrics[1].valueFr)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <span
                        className="inline-flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] transition-all duration-300 group-hover:bg-[var(--accent-color)] group-hover:text-white group-hover:border-[var(--accent-color)] dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 shadow-xs"
                      >
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
            4. FOOTER EDITORIAL (Sobre o Projeto & Links Rápidos - Compacto e Elegante)
            ========================================================================= */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 dark:border-white/10 dark:bg-[#0B0C10] py-2 sm:py-2.5 px-4 sm:px-8 lg:px-16 mt-2">
          <div className="max-w-7xl mx-auto space-y-1.5 sm:space-y-2">
            {/* Linha Superior: Marca à esquerda, Navegação e Redes à direita */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="font-bold text-xs sm:text-sm text-[var(--text-primary)] dark:text-white tracking-tight">
                  Vektor MMA
                </span>
                <span className="text-[var(--text-muted)] dark:text-neutral-500">•</span>
                <span className="text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-neutral-400">
                  {L(
                    i18n.language,
                    'Telemetria e predições em esportes de combate',
                    'Combat sports analytics & AI predictions',
                    'Télémétrie et prédictions en sports de combat',
                  )}
                </span>
              </div>

              {/* Links de navegação + Redes Sociais */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                <nav
                  aria-label={L(i18n.language, 'Links do rodapé', 'Footer links', 'Liens de bas de page')}
                  className="flex items-center gap-3 sm:gap-4 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--text-secondary)] dark:text-neutral-400"
                >
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
                </nav>

                <div className="hidden sm:block h-3 w-px bg-[var(--border-subtle)] dark:bg-white/15" />

                <SocialLinks />
              </div>
            </div>

            {/* Linha Inferior: Disclaimer editorial sutil */}
            <div className="border-t border-[var(--border-subtle)]/50 dark:border-white/5 pt-1 sm:pt-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] text-[var(--text-muted)] dark:text-neutral-500 font-sans">
              <p>
                {L(
                  i18n.language,
                  'Projeto analítico independente. Não afiliado ao UFC, PFL, Bellator ou ONE Championship.',
                  'Independent analytics project. Not affiliated with UFC, PFL, Bellator, or ONE Championship.',
                  'Projet analytique indépendant. Non affilié à l’UFC, au PFL, au Bellator ou au ONE Championship.',
                )}
              </p>
              <Link
                to="/about"
                className="hover:text-[var(--text-primary)] dark:hover:text-neutral-300 underline underline-offset-2 transition whitespace-nowrap"
              >
                {L(
                  i18n.language,
                  'Metodologia do projeto →',
                  'Project methodology →',
                  'Méthodologie du projet →',
                )}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
