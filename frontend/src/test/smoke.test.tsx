import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import { respond } from './fixtures'

// Every request goes to a tiny fake API, so the real hooks and the real api.ts run, and no network is needed.
vi.mock('axios', () => {
  const instance = {
    get: async (url: string) => ({ data: respond(url) }),
    post: async () => ({ data: respond('/predict') }),
  }
  return { default: { create: () => instance }, create: () => instance }
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** Page, a route that exercises it, and text only that page shows once its data has loaded. */
const pages: [string, string, string | RegExp][] = [
  ['Home', '/', 'Alpha One'],
  ['Fighters', '/fighters', /weight classes/i],
  ['Events', '/events', 'UFC fight cards'],
  ['Rankings', '/rankings', /divisional & pound-for-pound/i],
  ['Champions', '/champions', 'Current champions'],
  ['Record book', '/record-book', 'Total Fights'],
  ['Track record', '/track-record', /waiting for the first results/i],
  ['Head-to-head', '/head-to-head', /head-to-head history/i],
  ['Predict', '/predictor', /fighter/i],
  ['Matchup', '/matchup-intelligence', /why this matchup is interesting/i],
  ['About', '/about', /sources and credits/i],
  ['Data', '/data', /data pipeline/i],
  ['System', '/model', /how the model works/i],
]

describe('every page opens and shows its data', () => {
  it.each(pages)('%s', async (_name, path, expected) => {
    renderAt(path)
    expect(await screen.findAllByText(expected, undefined, { timeout: 10000 })).not.toHaveLength(0)
  })
})

describe('the pages that depend on the API', () => {
  it('the home page shows the model pick next to the upcoming fights', async () => {
    renderAt('/')
    expect(await screen.findByText(/Model: Gamma Three 72%/i, undefined, { timeout: 10000 })).toBeInTheDocument()
  })

  it('latest news links out to the original story', async () => {
    renderAt('/events')
    const link = await screen.findByRole('link', { name: /Alpha One retains the title/i }, { timeout: 10000 })
    expect(link).toHaveAttribute('href', 'https://www.espn.com/ufc/story/1')
  })

  it('clicking a ranked fighter opens their profile in place', async () => {
    renderAt('/rankings')
    await userEvent.click(await screen.findByRole('button', { name: /Beta Two, rank 1/i }, { timeout: 10000 }))
    await waitFor(() => expect(screen.getByRole('button', { name: /close performance profile/i })).toBeInTheDocument())
  })

  it('the multi-division tab opens a champion and lists every title fight', async () => {
    renderAt('/champions?view=records')
    await userEvent.click(await screen.findByRole('button', { name: /^multi-division champions$/i }, { timeout: 10000 }))
    await userEvent.click(await screen.findByRole('button', { name: /view title fights/i }, { timeout: 10000 }))
    expect(await screen.findByText('Won title')).toBeInTheDocument()
  })

  it('an unknown address shows the not-found page', async () => {
    renderAt('/nothing-here')
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })
})
