import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { LoadingSkeleton } from './shared/components/LoadingSkeleton'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { MainLayout } from './layouts/MainLayout'
import { NotFound } from './pages/NotFound'

const Predictor = lazy(() => import('./pages/Predictor').then((module) => ({ default: module.Predictor })))
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const Fighters = lazy(() => import('./pages/Fighters').then((module) => ({ default: module.Fighters })))
const Events = lazy(() => import('./pages/Events').then((module) => ({ default: module.Events })))
const Rankings = lazy(() => import('./pages/Rankings').then((module) => ({ default: module.Rankings })))
const Champions = lazy(() => import('./pages/Champions').then((module) => ({ default: module.Champions })))
const HeadToHead = lazy(() => import('./pages/HeadToHead').then((module) => ({ default: module.HeadToHead })))
const Model = lazy(() => import('./pages/Model').then((module) => ({ default: module.Model })))
const AboutModel = lazy(() => import('./pages/AboutModel').then((module) => ({ default: module.AboutModel })))
const DataIntelligence = lazy(() =>
  import('./pages/DataIntelligence').then((module) => ({ default: module.DataIntelligence })),
)
const MatchupIntelligence = lazy(() =>
  import('./pages/MatchupIntelligence').then((module) => ({ default: module.MatchupIntelligence })),
)

function App() {
  return (
    <MainLayout>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSkeleton className="h-[58vh] rounded-[20px]" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/predictor" element={<Predictor />} />
            <Route path="/fighters" element={<Fighters />} />
            <Route path="/events" element={<Events />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/champions" element={<Champions />} />
            <Route path="/head-to-head" element={<HeadToHead />} />
            <Route path="/matchup-intelligence" element={<MatchupIntelligence />} />
            <Route path="/model" element={<Model />} />
            <Route path="/data" element={<DataIntelligence />} />
            <Route path="/about" element={<AboutModel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </MainLayout>
  )
}

export default App
