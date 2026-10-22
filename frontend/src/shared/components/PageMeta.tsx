import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'Fight Intelligence'
const DEFAULT_DESCRIPTION =
  'Fight stats, rankings and results for the UFC, the PFL and the Bellator archive, plus UFC win predictions with the reasons behind each one.'

const GYM_PAGE = /^(\/pfl|\/bellator)?\/gyms\/[^/]+$/
const GYM_DETAIL = { title: 'Gym', description: 'Who trains at this gym: its fighters, champions and records.' }

const PAGES: Record<string, { title: string; description: string }> = {
  '/home': { title: 'UFC', description: 'The next UFC card with the model\'s picks, who is on a streak and the latest headlines.' },
  '/predictor': { title: 'Predict a fight', description: 'Pick two UFC fighters and get a win probability with the stats that drove it.' },
  '/head-to-head': { title: 'Head-to-head history', description: 'Every time two UFC fighters have met, who won and how, plus their common opponents.' },
  '/matchup-intelligence': { title: 'Matchup analysis', description: 'Striking, grappling and physical numbers for any two UFC fighters, and the factors the model weighed most.' },
  '/fighters': { title: 'Fighters', description: 'UFC fighter profiles by weight class: records, career timelines, origins and similar fighters.' },
  '/events': { title: 'Events', description: 'The full UFC event archive with results, plus upcoming cards and the model\'s picks.' },
  '/rankings': { title: 'Rankings', description: 'The official UFC divisional and pound-for-pound rankings with fighter photos.' },
  '/champions': { title: 'Champions', description: 'Current UFC champions, the greatest reigns and title-fight records, including multi-division champions.' },
  '/record-book': { title: 'Record book', description: 'The UFC\'s all-time career leaders in 32 stats: fights, time, striking and grappling.' },
  '/about': { title: 'About', description: 'Who makes this, where the data comes from and what its limits are.' },
  '/data': { title: 'Data', description: 'How raw UFC data becomes the dataset the model predicts from.' },
  '/model': { title: 'System', description: 'The prediction model, how it was trained and how it compares with simpler ones.' },
  '/track-record': { title: 'Track record', description: 'How the model\'s picks hold up against real fights: saved before the event, checked after.' },
  '/pfl': { title: 'PFL', description: 'Professional Fighters League: the next card, the champions and the latest results.' },
  '/pfl/fighters': { title: 'PFL fighters', description: 'PFL fighter profiles: records, builds, camps and every fight.' },
  '/pfl/events': { title: 'PFL events', description: 'The full PFL event archive with results, plus upcoming cards.' },
  '/gyms': { title: 'Gyms', description: 'Where UFC fighters train: every gym and team with its fighters, champions and records.' },
  '/pfl/gyms': { title: 'PFL gyms', description: 'Where PFL fighters train: every gym and team with its fighters and records.' },
  '/bellator': { title: 'Bellator', description: 'The Bellator archive: every event from 2009 to 2023, its fighters and the champions it ended with.' },
  '/bellator/fighters': { title: 'Bellator fighters', description: 'Bellator fighter profiles: records, builds, camps and every fight.' },
  '/bellator/events': { title: 'Bellator events', description: 'Every Bellator event from 2009 to 2023 with results.' },
  '/bellator/gyms': { title: 'Bellator gyms', description: 'Where Bellator fighters train: every gym and team with its fighters.' },
  '/pfl/rankings': { title: 'PFL rankings', description: 'The official PFL divisional and pound-for-pound rankings.' },
  '/about-model': { title: 'About the model', description: 'A full-stack applied AI project: data pipeline, model and API.' },
}

function setMeta(selector: string, value: string) {
  document.querySelector(selector)?.setAttribute('content', value)
}

/** Keeps the tab title and the description/share tags in step with the page being viewed (the app is a single page). */
export function PageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
    const page = PAGES[path] ?? (GYM_PAGE.test(path) ? GYM_DETAIL : undefined)
    const title = page ? `${page.title} · ${SITE}` : path === '/' ? SITE : `Page not found · ${SITE}`
    const description = page?.description ?? DEFAULT_DESCRIPTION

    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[name="twitter:title"]', title)
    setMeta('meta[name="twitter:description"]', description)
  }, [pathname])

  return null
}
