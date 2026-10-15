import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'Fight Intelligence'
const DEFAULT_DESCRIPTION = 'Predict UFC fights with machine learning and see exactly why. Fighter stats, rankings and champions.'

const PAGES: Record<string, { title: string; description: string }> = {
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
    const page = PAGES[path]
    const title = page ? `${page.title} · ${SITE}` : path === '/' || path === '/home' ? SITE : `Page not found · ${SITE}`
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
