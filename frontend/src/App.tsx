import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { LoadingSkeleton } from './shared/components/LoadingSkeleton'
import { MainLayout } from './layouts/MainLayout'

const Predictor = lazy(() => import('./pages/Predictor').then((module) => ({ default: module.Predictor })))
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const Fighters = lazy(() => import('./pages/Fighters').then((module) => ({ default: module.Fighters })))
const Events = lazy(() => import('./pages/Events').then((module) => ({ default: module.Events })))
const Rankings = lazy(() => import('./pages/Rankings').then((module) => ({ default: module.Rankings })))
const HeadToHead = lazy(() => import('./pages/HeadToHead').then((module) => ({ default: module.HeadToHead })))
const Model = lazy(() => import('./pages/Model').then((module) => ({ default: module.Model })))
const AboutModel = lazy(() => import('./pages/AboutModel').then((module) => ({ default: module.AboutModel })))

function App() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingSkeleton className="h-[58vh] rounded-[20px]" />}>
        <Routes>
          <Route path="/" element={<Predictor />} />
          <Route path="/home" element={<Home />} />
          <Route path="/predictor" element={<Predictor />} />
          <Route path="/fighters" element={<Fighters />} />
          <Route path="/events" element={<Events />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/head-to-head" element={<HeadToHead />} />
          <Route path="/model" element={<Model />} />
          <Route path="/about" element={<AboutModel />} />
        </Routes>
      </Suspense>
    </MainLayout>
  )
}

export default App
