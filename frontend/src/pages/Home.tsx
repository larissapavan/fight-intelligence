import { motion } from 'framer-motion'
import { Activity, ArrowRight, CircleDot, Radar, Radio, ShieldCheck, Swords, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Link } from 'react-router-dom'

import { useFighters } from '../shared/hooks/useFighters'
import { useModelInfo } from '../shared/hooks/useModelInfo'

const probabilitySeries = [
  { frame: 'R1', confidence: 51 },
  { frame: 'R2', confidence: 58 },
  { frame: 'R3', confidence: 63 },
  { frame: 'R4', confidence: 69 },
  { frame: 'R5', confidence: 72 },
]

const capabilityCards = [
  {
    title: 'Machine Learning',
    description: 'Supervised model tuned for matchup prediction, confidence scoring and feature-based interpretation.',
    icon: Radio,
  },
  {
    title: 'Fight Analytics',
    description: 'Side-by-side athlete comparisons focused on measurable edges before the fight happens.',
    icon: Radar,
  },
  {
    title: 'Prediction Confidence',
    description: 'Probability output translated into clear signals for fast reading and decision support.',
    icon: ShieldCheck,
  },
]

export function Home() {
  const { fighters, loading: fightersLoading } = useFighters()
  const { modelInfo, health, loading: modelLoading } = useModelInfo()

  const apiOnline = Boolean(health?.model_loaded)
  const fighterCountLabel = fightersLoading ? 'Loading...' : fighters.length ? `${fighters.length}` : 'Loading...'
  const accuracyLabel = modelInfo ? `${(modelInfo.metrics.accuracy * 100).toFixed(1)}%` : '74.7%'

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="page-hero overflow-hidden rounded-[20px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col justify-between gap-3"
          >
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E81B23]/18 bg-[#E81B23]/8 px-3 py-1.5">
                <Swords className="h-3.5 w-3.5 text-[#E81B23]" />
                <span className="broadcast-label text-[10px] text-[#E81B23]">Fight intelligence desk</span>
              </div>

              <div>
                <h1 className="text-3xl font-bold uppercase leading-[0.92] tracking-[0.02em] text-[#FFFFFF] sm:text-4xl md:text-5xl">
                  Predict UFC fights
                  <br />
                  with machine learning
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#E5E5E5]">
                  Compare fighters, analyze matchup data and generate AI-powered predictions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Link
                  to="/predictor"
                  className="primary-action inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white sm:px-5 sm:text-sm"
                >
                  Start prediction
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/fighters"
                  className="ghost-action inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#FFFFFF] sm:px-5 sm:text-sm"
                >
                  View fighters
                </Link>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Fights analyzed" value={health?.fights_tracked ? health.fights_tracked.toLocaleString('en-US') : '—'} icon={Activity} />
              <MiniStat label="Accuracy" value={accuracyLabel} icon={TrendingUp} />
              <MiniStat label="Fighters" value={fighterCountLabel} icon={Radio} muted={fightersLoading} />
              <StatusStat online={apiOnline} loading={modelLoading} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="surface-card rounded-[20px] p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="broadcast-label text-[10px] text-[#999999]">AI prediction</p>
                  <h2 className="mt-1 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
                    Pereira vs Gane
                  </h2>
                </div>
                <span className="rounded-full border border-[#E81B23]/20 bg-[#E81B23]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FF6B6B]">
                  Live model
                </span>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <FighterPreview corner="Red" fighter="Alex Pereira" detail="Higher striking pressure" />
                <div className="rounded-full border border-[#E81B23]/20 bg-[#E81B23]/8 px-2.5 py-1.5 text-xl font-bold uppercase tracking-[0.12em] text-[#E81B23]">
                  VS
                </div>
                <FighterPreview corner="Blue" fighter="Ciryl Gane" detail="Reach and movement" />
              </div>

              <div className="mt-3 rounded-2xl border border-white/8 bg-black/18 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="broadcast-label text-[10px] text-[#999999]">Win probability</p>
                    <p className="data-value mt-1 text-3xl font-bold text-[#FFFFFF] sm:text-4xl">72%</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="broadcast-label text-[10px] text-[#999999]">Projected winner</p>
                    <p className="mt-1 text-base font-semibold text-[#FFFFFF]">Ciryl Gane</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#262626]">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#A5151C] to-[#E81B23]" />
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="surface-card rounded-[20px] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="broadcast-label text-[10px] text-[#999999]">Probability trend</p>
                    <h3 className="mt-1 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">
                      Confidence build
                    </h3>
                  </div>
                  <TrendingUp className="h-4 w-4 text-[#E81B23]" />
                </div>
                <div className="mt-2 h-28 min-w-0 sm:h-32">
                  <ResponsiveContainer width="100%" height="100%" minWidth={240}>
                    <AreaChart data={probabilitySeries}>
                      <defs>
                        <linearGradient id="homeConfidenceFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#E81B23" stopOpacity={0.42} />
                          <stop offset="95%" stopColor="#E81B23" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="frame" tick={{ fill: '#999999', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#141414',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                          color: '#FFFFFF',
                        }}
                      />
                      <Area type="monotone" dataKey="confidence" stroke="#E81B23" strokeWidth={2.5} fill="url(#homeConfidenceFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card rounded-[20px] p-3 sm:p-4">
                <p className="broadcast-label text-[10px] text-[#999999]">Quick signals</p>
                <div className="mt-3 space-y-2">
                  <SignalRow label="Reach advantage" value="+8 cm" width="62%" color="bg-[#E81B23]" />
                  <SignalRow label="Recent momentum" value="3 wins" width="74%" color="bg-[#E81B23]" />
                  <SignalRow label="Win rate edge" value="Higher" width="58%" color="bg-[#2F5FA8]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {capabilityCards.map(({ title, description, icon: Icon }, index) => (
          <motion.article
            key={title}
            className="surface-card rounded-[20px] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-white/16"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + index * 0.06 }}
          >
            <div className="inline-flex rounded-xl bg-[#E81B23]/10 p-2.5 text-[#E81B23]">
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="mt-3 text-xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{title}</h2>
            <p className="mt-1.5 text-xs leading-5 text-[#999999]">{description}</p>
          </motion.article>
        ))}
      </section>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  muted = false,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <div className="flex items-center gap-2 text-[#E81B23]">
        <Icon className="h-3.5 w-3.5" />
        <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
      </div>
      <p className={`data-value mt-1 text-xl font-bold ${muted ? 'text-[#E5E5E5]' : 'text-[#FFFFFF]'}`}>{value}</p>
    </div>
  )
}

function StatusStat({ online, loading }: { online: boolean; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/18 px-3 py-2">
      <div className="flex items-center gap-2">
        <CircleDot className={`h-3.5 w-3.5 ${online ? 'fill-[#E81B23] text-[#E81B23] animate-pulse' : 'fill-[#999999] text-[#999999]'}`} />
        <p className="broadcast-label text-[10px] text-[#999999]">API status</p>
      </div>
      <div className="mt-1 inline-flex rounded-full border border-white/8 px-2.5 py-0.5">
        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${loading ? 'text-[#CCCCCC]' : online ? 'text-[#E81B23]' : 'text-[#999999]'}`}>
          {loading ? 'Checking...' : online ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  )
}

function FighterPreview({
  corner,
  fighter,
  detail,
}: {
  corner: 'Red' | 'Blue'
  fighter: string
  detail: string
}) {
  const accent = corner === 'Red' ? '#E81B23' : '#2F5FA8'

  return (
    <div className="rounded-2xl border border-white/6 bg-black/16 p-2.5">
      <p className="broadcast-label text-[10px]" style={{ color: accent }}>
        {corner} corner
      </p>
      <h3 className="mt-1.5 text-base font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">{fighter}</h3>
      <p className="mt-1 text-xs leading-4 text-[#999999]">{detail}</p>
    </div>
  )
}

function SignalRow({
  label,
  value,
  width,
  color,
}: {
  label: string
  value: string
  width: string
  color: string
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/18 p-2.5">
      <div className="flex items-center justify-between gap-4">
        <p className="broadcast-label text-[10px] text-[#999999]">{label}</p>
        <span className="text-xs font-semibold text-[#FFFFFF]">{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#262626]">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  )
}
