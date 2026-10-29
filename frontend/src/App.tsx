import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ServerLoadingState } from './shared/components/ServerLoadingState'
import { TabbedLayout, type SectionTab } from './shared/components/TabbedLayout'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { GENERIC_ORGS } from './shared/data/orgs'
import { MainLayout } from './layouts/MainLayout'
import { ThemeProvider } from './shared/context/ThemeContext'
import { Landing } from './pages/Landing'
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
const AthleteDossier = lazy(() =>
  import('./pages/AthleteDossier').then((module) => ({ default: module.AthleteDossier })),
)

const Gyms = lazy(() => import('./pages/Gyms').then((module) => ({ default: module.Gyms })))
const GymDetail = lazy(() => import('./pages/GymDetail').then((module) => ({ default: module.GymDetail })))
const OrgHome = lazy(() => import('./pages/org/OrgHome').then((module) => ({ default: module.OrgHome })))
const OrgFighters = lazy(() => import('./pages/org/OrgFighters').then((module) => ({ default: module.OrgFighters })))
const OrgEvents = lazy(() => import('./pages/org/OrgEvents').then((module) => ({ default: module.OrgEvents })))
const OrgRankings = lazy(() => import('./pages/org/OrgRankings').then((module) => ({ default: module.OrgRankings })))
const OrgChampions = lazy(() => import('./pages/org/OrgChampions').then((module) => ({ default: module.OrgChampions })))
const OrgPredictor = lazy(() => import('./pages/org/OrgPredictor').then((module) => ({ default: module.OrgPredictor })))

const matchupTabs: SectionTab[] = [
  { to: '/predictor', label: 'Predict', labelKey: 'nav.predict' },
  { to: '/head-to-head', label: 'Head-to-Head', labelKey: 'nav.headToHead' },
  { to: '/matchup-intelligence', label: 'Matchup', labelKey: 'nav.matchup' },
]

const championsTabs: SectionTab[] = [
  { to: '/champions', label: 'Champions', labelKey: 'nav.champions' },
  { to: '/record-book', label: 'Record book', labelKey: 'nav.recordBook' },
]

const aboutTabs: SectionTab[] = [
  { to: '/about', label: 'About', labelKey: 'nav.about' },
  { to: '/data', label: 'Data', labelKey: 'nav.data' },
  { to: '/model', label: 'System', labelKey: 'nav.system' },
  { to: '/track-record', label: 'Track record', labelKey: 'nav.trackRecord' },
]

function App() {
  return (
    <ThemeProvider>
      <MainLayout>
        <ErrorBoundary>
          <Suspense fallback={<ServerLoadingState />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/home" element={<Home />} />
              <Route element={<TabbedLayout label="Matchup tools" tabs={matchupTabs} />}>
                <Route path="/predictor" element={<Predictor />} />
                <Route path="/head-to-head" element={<HeadToHead />} />
                <Route path="/matchup-intelligence" element={<MatchupIntelligence />} />
              </Route>
              <Route path="/fighters" element={<Fighters />} />
              <Route path="/athlete" element={<AthleteDossier />} />
              <Route path="/athlete/:name" element={<AthleteDossier />} />
              <Route path="/events" element={<Events />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/gyms" element={<Gyms />} />
              <Route path="/gyms/:slug" element={<GymDetail />} />
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
              {GENERIC_ORGS.map((org) => (
                <Route key={org.id} path={org.basePath}>
                  <Route index element={<OrgHome />} />
                  <Route path="fighters" element={<OrgFighters />} />
                  <Route path="events" element={<OrgEvents />} />
                  {org.hasRankings ? <Route path="rankings" element={<OrgRankings />} /> : null}
                  {org.hasChampions ? <Route path="champions" element={<OrgChampions />} /> : null}
                  {org.hasPredictions ? <Route path="predictor" element={<OrgPredictor />} /> : null}
                  <Route path="gyms" element={<Gyms />} />
                  <Route path="gyms/:slug" element={<GymDetail />} />
                </Route>
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </ThemeProvider>
  )
}

export default App
