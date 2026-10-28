import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import { edgeLabel, formatProbability } from '../shared/data/probability'
import { searchFighters } from '../shared/data/searchFighters'
import type { FighterProfile } from '../shared/types/api'
import { alpha, beta, respond } from './fixtures'

// A bigger catalog than the shared fake API has (one division with more fighters than fit on a page), and a count of
// how many times the catalog is requested.
const api = vi.hoisted(() => ({ fighterRequests: 0, extraFighters: 0 }))

vi.mock('axios', () => {
  const instance = {
    get: async (url: string) => {
      if (url === '/fighters') {
        api.fighterRequests += 1
        const extra = Array.from({ length: api.extraFighters }, (_, index) => ({
          ...alpha,
          name: `Runner ${String(index + 1).padStart(2, '0')}`,
          nickname: null,
          win_rate: 0.5 - index / 1000,
          fighter_url: null,
        }))
        return { data: [alpha, beta, ...extra] }
      }
      return { data: respond(url) }
    },
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

describe('probability on screen', () => {
  it('rounds in the middle and does not claim more than the model can back at the ends', () => {
    expect(formatProbability(0.634)).toBe('63%')
    expect(formatProbability(0.5)).toBe('50%')
    expect(formatProbability(0.9)).toBe('90%+')
    expect(formatProbability(0.987)).toBe('90%+')
    expect(formatProbability(0.1)).toBe('<10%')
    expect(formatProbability(0.013)).toBe('<10%')
    expect(formatProbability(0.1001)).toBe('10%')
  })

  it('names the size of the favorite\'s edge', () => {
    expect(edgeLabel(0.52)).toBe('Toss-up')
    expect(edgeLabel(0.6)).toBe('Slight edge')
    expect(edgeLabel(0.72)).toBe('Clear edge')
    expect(edgeLabel(0.85)).toBe('Strong edge')
  })
})

describe('searching fighters by name', () => {
  const people = [
    { ...alpha, name: 'Jon Jones', nickname: 'Bones', total_fights: 28 },
    { ...alpha, name: 'Jon Fitch', nickname: null, total_fights: 40 },
    { ...alpha, name: 'Ciryl Gane', nickname: 'Bon Gamin', total_fights: 14 },
    { ...alpha, name: 'Błachowicz Jan', nickname: null, total_fights: 20 },
  ] as FighterProfile[]

  it('puts names that start with the text first, then the ones with more fights', () => {
    expect(searchFighters(people, 'jon').map((f) => f.name)).toEqual(['Jon Fitch', 'Jon Jones'])
    expect(searchFighters(people, 'jones').map((f) => f.name)).toEqual(['Jon Jones'])
  })

  it('finds a nickname, ignores accents and case, and returns nothing for an empty box', () => {
    expect(searchFighters(people, 'bones').map((f) => f.name)).toEqual(['Jon Jones'])
    expect(searchFighters(people, 'BLACHOWICZ').map((f) => f.name)).toEqual(['Błachowicz Jan'])
    expect(searchFighters(people, '   ')).toEqual([])
  })
})

describe('one h1 per page', () => {
  const pages: [string, string, string | RegExp][] = [
    ['Landing', '/', /pick an organization/i],
    ['UFC home', '/home', 'Alpha One'],
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

  it.each(pages)('%s', async (_name, path, expected) => {
    renderAt(path)
    await screen.findAllByText(expected, undefined, { timeout: 10000 })
    await screen.findByRole('heading', { level: 1 }, { timeout: 10000 })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })
})

describe('the fighter catalog is requested once', () => {
  it('however many parts of the home page use it', async () => {
    api.fighterRequests = 0
    api.extraFighters = 0
    renderAt('/home')
    await screen.findAllByText('Alpha One', undefined, { timeout: 10000 })
    await waitFor(() => expect(api.fighterRequests).toBeGreaterThan(0))
    expect(api.fighterRequests).toBe(1)
  })
})

describe('the fighters page', () => {
  it('shows a page of fighters at a time and adds more on request', async () => {
    api.extraFighters = 40 // 42 in the lightweight division in total
    renderAt('/fighters')
    expect(await screen.findByText(/Showing 24 of 42/, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.queryByText('Runner 40')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show 18 more/i }))
    expect(await screen.findByText('Runner 40')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show .* more/i })).not.toBeInTheDocument()
  })

  it('"show all" lists everyone, and a new search starts the list over', async () => {
    api.extraFighters = 40
    renderAt('/fighters')
    await userEvent.click(await screen.findByRole('button', { name: /show all 42/i }, { timeout: 10000 }))
    expect(await screen.findByText('Runner 40')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: /search fighter or nickname/i }), 'Runner')
    expect(await screen.findByText(/Showing 24 of 40/)).toBeInTheDocument()
  })

  it('keeps the stance and badge filters behind a toggle on small screens', async () => {
    api.extraFighters = 0
    renderAt('/fighters')
    const toggle = await screen.findByRole('button', { name: /^filters/i }, { timeout: 10000 })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('fighter-extra-filters')).toHaveClass('hidden')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('fighter-extra-filters')).toHaveClass('grid')
  })
})

describe('the header search', () => {
  it('finds a fighter from any page and opens their profile', async () => {
    api.extraFighters = 0
    renderAt('/events')
    await userEvent.click(await screen.findByRole('button', { name: /search fighters/i }, { timeout: 10000 }))
    await userEvent.type(screen.getByRole('combobox', { name: /find a fighter by name/i }), 'beta')

    const option = await screen.findByRole('button', { name: /Beta Two/ })
    await userEvent.click(option)

    expect(await screen.findByRole('button', { name: /close performance profile/i }, { timeout: 10000 })).toBeInTheDocument()
    // the box closes once a fighter is picked
    expect(screen.queryByRole('combobox', { name: /find a fighter by name/i })).not.toBeInTheDocument()
  })

  it('opens with the / key and closes with Escape', async () => {
    renderAt('/events')
    await screen.findByRole('button', { name: /search fighters/i }, { timeout: 10000 })
    await userEvent.keyboard('/')
    const box = await screen.findByRole('combobox', { name: /find a fighter by name/i })
    expect(box).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('combobox', { name: /find a fighter by name/i })).not.toBeInTheDocument()
  })

  it('says so when nobody matches', async () => {
    renderAt('/events')
    await userEvent.click(await screen.findByRole('button', { name: /search fighters/i }, { timeout: 10000 }))
    await userEvent.type(screen.getByRole('combobox', { name: /find a fighter by name/i }), 'zzzz')
    expect(await screen.findByText(/No fighter matches/)).toBeInTheDocument()
  })
})

describe('sharing a matchup', () => {
  it('copies a link to the pair', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    renderAt('/matchup-intelligence?a=Alpha%20One&b=Beta%20Two')
    await userEvent.click(await screen.findByRole('button', { name: /copy matchup link/i }, { timeout: 10000 }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const link = new URL(writeText.mock.calls[0][0])
    expect(link.pathname).toBe('/matchup-intelligence')
    expect(link.searchParams.get('a')).toBe('Alpha One')
    expect(link.searchParams.get('b')).toBe('Beta Two')
    expect(within(screen.getByRole('button', { name: /link copied/i })).getByRole('status')).toHaveTextContent('Link copied')
  })
})

describe('French localization (fr-FR)', () => {
  it('switches the interface to French from the language switcher', async () => {
    renderAt('/home')
    await screen.findAllByText('Alpha One', undefined, { timeout: 10000 })

    const frButtons = screen.getAllByRole('button', { name: 'FR' })
    await userEvent.click(frButtons[0])

    expect(await screen.findByText(/Pronostiquer un combat/i)).toBeInTheDocument()
    expect(screen.getByText(/Voir la carte complète/i)).toBeInTheDocument()
    expect(screen.getByText(/Projet personnel indépendant, sans affiliation avec l’UFC/i)).toBeInTheDocument()
  })
})
