import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import { ORGS, orgFromPathname, orgPath, switchOrgPath } from '../shared/data/orgs'
import { compareDivisions, fightSummary, formatHeight, formatMethod, formatReach, formatRecord } from '../shared/data/orgFormat'
import { respond } from './fixtures'

// Every URL the fake API was asked for, so a test can tell which catalogs a page downloaded.
const api = vi.hoisted(() => ({ requested: [] as string[] }))

vi.mock('axios', () => {
  const instance = {
    get: async (url: string) => {
      api.requested.push(url)
      return { data: respond(url) }
    },
    post: async () => ({ data: respond('/predict') }),
  }
  return { default: { create: () => instance }, create: () => instance }
})

function renderAt(path: string) {
  api.requested.length = 0
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const WAIT = { timeout: 10000 }

describe('organization paths', () => {
  it('the UFC keeps the site root and every other organization gets its own prefix', () => {
    expect(orgFromPathname('/')).toBe(ORGS.ufc)
    expect(orgFromPathname('/events')).toBe(ORGS.ufc)
    expect(orgFromPathname('/pfl')).toBe(ORGS.pfl)
    expect(orgFromPathname('/pfl/fighters')).toBe(ORGS.pfl)
    expect(orgFromPathname('/pflx/fighters')).toBe(ORGS.ufc)

    expect(orgPath(ORGS.ufc)).toBe('/')
    expect(orgPath(ORGS.ufc, 'events')).toBe('/events')
    expect(orgPath(ORGS.pfl)).toBe('/pfl')
    expect(orgPath('pfl', 'rankings')).toBe('/pfl/rankings')
  })

  it('switching organization keeps the section when the other organization has it', () => {
    expect(switchOrgPath(ORGS.pfl, '/events')).toBe('/pfl/events')
    expect(switchOrgPath(ORGS.pfl, '/rankings')).toBe('/pfl/rankings')
    expect(switchOrgPath(ORGS.ufc, '/pfl/fighters')).toBe('/fighters')
    expect(switchOrgPath(ORGS.pfl, '/predictor')).toBe('/pfl')
    expect(switchOrgPath(ORGS.ufc, '/pfl')).toBe('/')
  })
})

describe('how an organization’s numbers are written', () => {
  it('method, round and time read like the UFC pages', () => {
    expect(formatMethod('U-DEC')).toBe('Unanimous Decision')
    expect(formatMethod('SUB', 'Armbar')).toBe('Submission (Armbar)')
    expect(formatMethod('DEC')).toBe('Decision')
    expect(formatMethod(null)).toBeNull()
    expect(fightSummary({ method: 'KO/TKO', method_detail: null, round: 1, time: '0:46' })).toBe('Knockout · R1 · 0:46')
    expect(fightSummary({ method: null, method_detail: null, round: null, time: null })).toBeNull()
  })

  it('height, reach and record', () => {
    expect(formatHeight(167.6)).toBe('5\'6" (168 cm)')
    expect(formatReach(175.3)).toBe('69" (175 cm)')
    expect(formatHeight(null)).toBeNull()
    expect(formatRecord({ wins: 25, losses: 8, draws: 0, no_contests: 0 })).toBe('25-8-0')
    expect(formatRecord({ wins: 25, losses: 7, draws: 1, no_contests: 1 })).toBe('25-7-1 (1 NC)')
    expect(formatRecord({ wins: null, losses: null, draws: null, no_contests: null })).toBeNull()
  })

  it('divisions sort from light to heavy, men first', () => {
    const divisions = ["Women's Flyweight", 'Heavyweight', 'Catchweight', 'Bantamweight', 'Light Heavyweight']
    expect([...divisions].sort(compareDivisions)).toEqual(['Bantamweight', 'Light Heavyweight', 'Heavyweight', "Women's Flyweight", 'Catchweight'])
  })
})

describe('the PFL pages', () => {
  it('the home page shows the next card, the champions and the latest results', async () => {
    renderAt('/pfl')
    expect(await screen.findByRole('heading', { name: 'PFL Future' }, WAIT)).toBeInTheDocument()
    expect(await screen.findByText('Lightweight title fight', undefined, WAIT)).toBeInTheDocument()
    const champions = await screen.findByRole('region', { name: 'Champions' }, WAIT)
    expect(await within(champions).findByRole('button', { name: /Riko Stone/ }, WAIT)).toBeInTheDocument()
    const latest = screen.getByRole('region', { name: 'Latest results' })
    expect(await within(latest).findByText('Submission (Armbar) · R2 · 3:10', undefined, WAIT)).toBeInTheDocument()
  })

  it('the PFL pages never download the UFC catalog', async () => {
    renderAt('/pfl/fighters')
    await screen.findByText('Dax Moore', undefined, WAIT)
    expect(api.requested.filter((url) => url === '/fighters')).toHaveLength(0)
    expect(api.requested).toContain('/orgs/pfl/fighters')
  })

  it('the fighter list shows active fighters first and the veterans only on request', async () => {
    renderAt('/pfl/fighters')
    expect(await screen.findByText('Riko Stone', undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByText('Dax Moore')).toBeInTheDocument()
    expect(screen.queryByText('Lena Ortiz')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'All time' }))
    expect(await screen.findByText('Lena Ortiz')).toBeInTheDocument()
  })

  it('a fighter can be found by name, nickname or division', async () => {
    renderAt('/pfl/fighters')
    await screen.findByText('Riko Stone', undefined, WAIT)
    await userEvent.type(screen.getByRole('textbox', { name: 'Search fighters' }), 'wall')
    expect(screen.getByText('Riko Stone')).toBeInTheDocument()
    expect(screen.queryByText('Dax Moore')).not.toBeInTheDocument()
  })

  it('opening a fighter shows the record, the build and every fight', async () => {
    renderAt('/pfl/fighters')
    await userEvent.click(await screen.findByRole('button', { name: /Riko Stone\. View profile/ }, WAIT))
    const dialog = await screen.findByRole('dialog', { name: /Riko Stone/ }, WAIT)
    expect(within(dialog).getByText('15-3-0')).toBeInTheDocument()
    expect(within(dialog).getByText('5\'9" (175 cm)')).toBeInTheDocument()
    expect(within(dialog).getByText('Champion')).toBeInTheDocument()
    expect(await within(dialog).findByText('Submission (Armbar) · R2 · 3:10', undefined, WAIT)).toBeInTheDocument()
    expect(within(dialog).getByText(/Next fight/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close fighter profile' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a profile can be opened from a link (?fighter=)', async () => {
    renderAt('/pfl/fighters?fighter=Dax%20Moore')
    expect(await screen.findByRole('dialog', { name: /Dax Moore/ }, WAIT)).toBeInTheDocument()
  })

  it('events lists the upcoming card and the archive by year', async () => {
    renderAt('/pfl/events')
    expect(await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)).toBeInTheDocument()
    expect(await screen.findByText('PFL Future', undefined, WAIT)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^2026/ }, WAIT)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^2024/ })).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(screen.getByRole('button', { name: /PFL Chicago/ }))
    expect(await screen.findByText('Submission (Armbar) · R2 · 3:10')).toBeInTheDocument()
  })

  it('searching events also looks at the fighters on the card', async () => {
    renderAt('/pfl/events')
    await screen.findByText('PFL Future', undefined, WAIT)
    await userEvent.type(screen.getByRole('textbox', { name: 'Search events' }), 'lena')
    expect(await screen.findByText('PFL Old Night')).toBeInTheDocument()
    expect(screen.queryByText('PFL Chicago')).not.toBeInTheDocument()
  })

  it('rankings show the champion first and open a profile', async () => {
    renderAt('/pfl/rankings')
    const champion = await screen.findByRole('button', { name: /Riko Stone, rank champion/ }, WAIT)
    expect(within(champion).getByText('Champion')).toBeInTheDocument()
    const contender = screen.getByRole('button', { name: /Dax Moore, rank 1/ })
    expect(within(contender).getByTitle('Up 2 places')).toBeInTheDocument()

    await userEvent.click(contender)
    expect(await screen.findByRole('dialog', { name: /Dax Moore/ }, WAIT)).toBeInTheDocument()
  })

  it('the pound-for-pound tab lists its own table', async () => {
    renderAt('/pfl/rankings')
    await userEvent.click(await screen.findByRole('button', { name: 'Pound-for-Pound' }, WAIT))
    expect(await screen.findByText('1 listed')).toBeInTheDocument()
  })
})

describe('the Bellator archive', () => {
  it('says it is an archive instead of announcing a next card', async () => {
    renderAt('/bellator')
    expect(await screen.findByRole('note', undefined, WAIT)).toHaveTextContent(/last event in 2023/i)
    expect(screen.queryByRole('region', { name: 'Next event' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Latest results' }, WAIT)).toBeInTheDocument()
    expect(screen.getByText(/Archive built from ESPN and Wikipedia/)).toBeInTheDocument()
  })

  it('lists everyone who ever fought there, not only the active ones', async () => {
    renderAt('/bellator/fighters')
    expect(await screen.findByText('Lena Ortiz', undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the rankings page presents the final champions', async () => {
    renderAt('/bellator/rankings')
    expect(await screen.findByText(/Bellator kept no rankings/, undefined, WAIT)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Riko Stone, rank champion/ }, WAIT)).toBeInTheDocument()
  })

  it('is one more choice in the switcher, keeping the section', async () => {
    renderAt('/events')
    await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)
    const switcher = screen.getAllByRole('navigation', { name: 'Organization' })[0]
    expect(within(switcher).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/events', '/pfl/events', '/bellator/events'])
  })
})

describe('the organization switcher', () => {
  it('moves to the same section of the other organization', async () => {
    renderAt('/events')
    await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)
    const switcher = screen.getAllByRole('navigation', { name: 'Organization' })[0]
    await userEvent.click(within(switcher).getByRole('link', { name: 'PFL' }))
    expect(await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)).toBeInTheDocument()
    expect(document.documentElement.dataset.org).toBe('pfl')

    await userEvent.click(within(screen.getAllByRole('navigation', { name: 'Organization' })[0]).getByRole('link', { name: 'UFC' }))
    expect(await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)).toBeInTheDocument()
    expect(document.documentElement.dataset.org).toBe('ufc')
  })

  it('the PFL menu has only the sections the PFL has', async () => {
    renderAt('/pfl/events')
    await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toContain('/pfl/fighters')
    expect(links).toContain('/pfl/rankings')
    expect(links).not.toContain('/predictor')
    expect(links).not.toContain('/champions')
  })

  it('the header search finds PFL fighters on PFL pages', async () => {
    renderAt('/pfl')
    await screen.findByRole('heading', { name: 'PFL Future' }, WAIT)
    await userEvent.click(screen.getByRole('button', { name: 'Search fighters' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Find a fighter by name' }), 'dax')
    await userEvent.click(within(await screen.findByRole('option', { name: /Dax Moore/ })).getByRole('button'))
    expect(await screen.findByRole('dialog', { name: /Dax Moore/ }, WAIT)).toBeInTheDocument()
  })

  it('the footer says the data belongs to the organization on screen', async () => {
    renderAt('/pfl/events')
    expect(await screen.findByText(/not affiliated with the PFL/, undefined, WAIT)).toBeInTheDocument()
    expect(await screen.findByText(/Data up to Oct 17, 2026/, undefined, WAIT)).toBeInTheDocument()
  })
})
