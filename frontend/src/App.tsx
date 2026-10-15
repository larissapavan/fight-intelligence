import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { LoadingSkeleton } from './shared/components/LoadingSkeleton'
import { TabbedLayout, type SectionTab } from './shared/components/TabbedLayout'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { MainLayout } from './layouts/MainLayout'
import { NotFound } from './pages/NotFound'

const Predictor = lazy(() => import('./pages/Predictor').then((module) => ({ default: module.Predictor })))
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const Fighters = lazy(() => import('./pages/Fighters').then((module) => ({ default: module.Fighters })))
const Events = lazy(() => import('./pages/Events').then((module) => ({ default: module.Events })))
const Rankings = lazy(() => import('./pages/Rankings').then((module) => ({ default: module.Rankings })))
const TrackRecord = lazy(() => import('./pages/TrackRecord').then((module) => ({ default: module.TrackRecord })))
const RecordBook = lazy(() => import('./pages/RecordBook').then((module) => ({ default: module.RecordBook })))
const Champions = lazy(() => import('./pages/Champions').then((module) => ({ default: module.Champions })))
const HeadToHead = lazy(() => import('./pages/HeadToHead').then((module) => ({ default: module.HeadToHead })))
const Model = lazy(() => import('./pages/Model').then((module) => ({ default: module.Model })))
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })))
const AboutModel = lazy(() => import('./pages/AboutModel').then((module) => ({ default: module.AboutModel })))
const DataIntelligence = lazy(() =>
  import('./pages/DataIntelligence').then((module) => ({ default: module.DataIntelligence })),
)
const MatchupIntelligence = lazy(() =>
  import('./pages/MatchupIntelligence').then((module) => ({ default: module.MatchupIntelligence })),
)

const matchupTabs: SectionTab[] = [
  { to: '/predictor', label: 'Predict' },
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/matchup-intelligence', label: 'Matchup' },
]

const championsTabs: SectionTab[] = [
  { to: '/champions', label: 'Champions' },
  { to: '/record-book', label: 'Record book' },
]

const aboutTabs: SectionTab[] = [
  { to: '/about', label: 'About' },
  { to: '/data', label: 'Data' },
  { to: '/model', label: 'System' },
  { to: '/track-record', label: 'Track record' },
]

function App() {
  return (
    <MainLayout>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSkeleton className="h-[58vh] rounded-[20px]" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route element={<TabbedLayout label="Matchup tools" tabs={matchupTabs} />}>
              <Route path="/predictor" element={<Predictor />} />
              <Route path="/head-to-head" element={<HeadToHead />} />
              <Route path="/matchup-intelligence" element={<MatchupIntelligence />} />
            </Route>
            <Route path="/fighters" element={<Fighters />} />
            <Route path="/events" element={<Events />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route element={<TabbedLayout label="Champions and records" tabs={championsTabs} />}>
              <Route path="/champions" element={<Champions />} />
              <Route path="/record-book" element={<RecordBook />} />
            </Route>
            <Route element={<TabbedLayout label="About this project" tabs={aboutTabs} />}>
              <Route path="/about" element={<About />} />
              <Route path="/data" element={<DataIntelligence />} />
              <Route path="/model" element={<Model />} />
              <Route path="/track-record" element={<TrackRecord />} />
            </Route>
            <Route path="/about-model" element={<AboutModel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </MainLayout>
  )
}

export default App
