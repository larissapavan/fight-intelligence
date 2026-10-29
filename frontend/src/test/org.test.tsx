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

    expect(orgPath(ORGS.ufc)).toBe('/home')  // the site root is the page that chooses an organization
    expect(orgPath(ORGS.ufc, 'events')).toBe('/events')
    expect(orgPath(ORGS.pfl)).toBe('/pfl')
    expect(orgPath('pfl', 'rankings')).toBe('/pfl/rankings')
  })

  it('switching organization keeps the section when the other organization has it', () => {
    expect(switchOrgPath(ORGS.pfl, '/events')).toBe('/pfl/events')
    expect(switchOrgPath(ORGS.pfl, '/rankings')).toBe('/pfl/rankings')
    expect(switchOrgPath(ORGS.ufc, '/pfl/fighters')).toBe('/fighters')
    expect(switchOrgPath(ORGS.pfl, '/predictor')).toBe('/pfl')
    expect(switchOrgPath(ORGS.ufc, '/pfl')).toBe('/home')
    expect(switchOrgPath(ORGS.pfl, '/')).toBe('/pfl')  // from the chooser there is no section to keep
  })
})

describe('one history for a fighter who fought in several organizations', () => {
  it('the UFC profile lists the fights elsewhere, newest first, and says they are not counted in the UFC numbers', async () => {
    renderAt('/fighters?fighter=Alpha%20One')
    const panel = await screen.findByRole('region', { name: 'Fights in other organizations' }, WAIT)
    expect(within(panel).getByText(/Also fought in the Bellator · 12-4-0 there/)).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem')).toHaveLength(4)  // the newest four first
    expect(within(panel).getByText(/UFC record, trends and the model's picks above count UFC fights only/)).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: 'Show all 6 Bellator fights' }))
    expect(within(panel).getAllByRole('listitem')).toHaveLength(6)
  })
})

describe('the page that chooses an organization', () => {
  it('lists every organization with a way in, and says which one has predictions', async () => {
    renderAt('/')
    const list = await screen.findByRole('list', { name: 'Organizations' }, WAIT)
    const links = within(list).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/home', '/pfl', '/one', '/bellator', '/zuffa'])
    expect(within(list).getAllByText('Win predictions')).toHaveLength(2)  // only the UFC
    expect(within(list).getByText('Archive')).toBeInTheDocument()  // Bellator
  })

  it('has no switcher, section menu or fighter search until an organization is chosen', async () => {
    renderAt('/')
    await screen.findByRole('list', { name: 'Organizations' }, WAIT)
    expect(screen.queryByRole('group', { name: 'Organization' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Fighters' })).not.toBeInTheDocument()
  })

  it('opens at once, without waiting for the API to wake up', async () => {
    renderAt('/')
    expect(screen.getByRole('list', { name: 'Organizations' })).toBeInTheDocument()  // synchronously: no loading screen first
  })

  it('choosing one opens its home page, where the switcher and the logo lead back', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Open Professional Fighters League' }, WAIT))
    expect(await screen.findByText(/PFL fight intelligence/i, undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Organization' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fight Intelligence home' })).toHaveAttribute('href', '/')
  })

  it('the UFC home page is still reachable and its other pages keep their addresses', async () => {
    renderAt('/home')
    expect(await screen.findAllByText('Alpha One', undefined, WAIT)).not.toHaveLength(0)
    const nav = screen.getByRole('group', { name: 'Organization' })
    expect(within(nav).getByRole('link', { name: 'UFC' })).toHaveAttribute('href', '/home')
    expect(screen.getAllByRole('link', { name: 'Events' })[0]).toHaveAttribute('href', '/events')
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

  it('a fighter who also fought in the UFC links to the UFC profile', async () => {
    renderAt('/pfl/fighters')
    await userEvent.click(await screen.findByRole('button', { name: /Riko Stone\. View profile/ }, WAIT))
    const dialog = await screen.findByRole('dialog', { name: /Riko Stone/ }, WAIT)
    expect(within(dialog).getByRole('link', { name: /open the UFC profile/i })).toHaveAttribute('href', '/fighters?fighter=Riko%20Stone')
  })

  it('a fighter who never fought in the UFC has no such link', async () => {
    renderAt('/pfl/fighters')
    await userEvent.click(await screen.findByRole('button', { name: /Dax Moore\. View profile/ }, WAIT))
    const dialog = await screen.findByRole('dialog', { name: /Dax Moore/ }, WAIT)
    expect(within(dialog).queryByRole('link', { name: /open the UFC profile/i })).not.toBeInTheDocument()
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
  it('says it is an archive instead of announcing a next card and shows archive sections and title history', async () => {
    renderAt('/bellator')
    expect(await screen.findByRole('note', undefined, WAIT)).toHaveTextContent(/last event in 2023/i)
    expect(screen.queryByRole('region', { name: 'Next event' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Archive sections' }, WAIT)).toBeInTheDocument()
    const history = await screen.findByRole('region', { name: 'Title history' }, WAIT)
    expect(await within(history).findByText(/def\. Dax Moore/i, undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByText(/Archive built from ESPN and Wikipedia/)).toBeInTheDocument()
  })

  it('lists everyone who ever fought there without an active-only filter', async () => {
    renderAt('/bellator/fighters')
    expect(await screen.findByText('Lena Ortiz', undefined, WAIT)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('has no rankings page: no menu entry, no route, and the final champions sit on the home page', async () => {
    renderAt('/bellator')
    const champions = await screen.findByRole('region', { name: 'Champions' }, WAIT)
    expect(await within(champions).findByRole('button', { name: /Riko Stone/ }, WAIT)).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).not.toContain('/bellator/rankings')
  })

  it('an address that does not exist for it is the not-found page', async () => {
    renderAt('/bellator/rankings')
    expect(await screen.findByRole('heading', { name: /page not found/i }, WAIT)).toBeInTheDocument()
  })

  it('switching from the UFC rankings to Bellator lands on its home page', () => {
    expect(switchOrgPath(ORGS.bellator, '/rankings')).toBe('/bellator')
    expect(switchOrgPath(ORGS.pfl, '/rankings')).toBe('/pfl/rankings')
  })

  it('is one more choice in the switcher, keeping the section', async () => {
    renderAt('/events')
    await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)
    const switcher = screen.getAllByRole('group', { name: 'Organization' })[0]
    expect(within(switcher).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/events', '/pfl/events', '/one/events', '/bellator/events', '/zuffa/events'])
  })
})

describe('ONE Championship and Zuffa Boxing', () => {
  it('renders upcoming cards, champions, rankings and past events on /one', async () => {
    renderAt('/one')
    expect(await screen.findByRole('heading', { name: 'ONE Fight Night 49: Gabriel vs. Magomedov' }, WAIT)).toBeInTheDocument()
    const champions = await screen.findByRole('region', { name: 'Champions' }, WAIT)
    expect(await within(champions).findByRole('button', { name: /Riko Stone/ }, WAIT)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Rankings' })[0]).toHaveAttribute('href', '/one/rankings')
    expect(screen.getAllByRole('link', { name: 'Champions' })[0]).toHaveAttribute('href', '/one/champions')
  })

  it('renders upcoming cards, champions, rankings and past events on /zuffa', async () => {
    renderAt('/zuffa')
    expect(await screen.findByRole('heading', { name: 'Zuffa Boxing 12: Billam-Smith vs. Clarke' }, WAIT)).toBeInTheDocument()
    const champions = await screen.findByRole('region', { name: 'Champions' }, WAIT)
    expect(await within(champions).findByRole('button', { name: /Riko Stone/ }, WAIT)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Rankings' })[0]).toHaveAttribute('href', '/zuffa/rankings')
    expect(screen.getByRole('region', { name: 'Latest results' })).toBeInTheDocument()
  })
})

describe('the organization switcher', () => {
  it('moves to the same section of the other organization', async () => {
    renderAt('/events')
    await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)
    const switcher = screen.getAllByRole('group', { name: 'Organization' })[0]
    await userEvent.click(within(switcher).getByRole('link', { name: 'PFL' }))
    expect(await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)).toBeInTheDocument()
    expect(document.documentElement.dataset.org).toBe('pfl')

    await userEvent.click(within(screen.getAllByRole('group', { name: 'Organization' })[0]).getByRole('link', { name: 'UFC' }))
    expect(await screen.findByRole('heading', { name: 'UFC fight cards' }, WAIT)).toBeInTheDocument()
    expect(document.documentElement.dataset.org).toBe('ufc')
  })

  it('the PFL menu has only the sections the PFL has', async () => {
    renderAt('/pfl/events')
    await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toContain('/pfl/fighters')
    expect(links).toContain('/pfl/rankings')
    expect(links).toContain('/pfl/champions')
    expect(links).not.toContain('/predictor')
    expect(links).not.toContain('/champions')
  })

  it('the PFL and Bellator champions pages show current/final champions, division history and greatest champions', async () => {
    renderAt('/pfl/champions')
    expect(await screen.findByRole('heading', { name: 'PFL champions' }, WAIT)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Riko Stone/ }, WAIT)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Greatest Champions' }))
    expect(await screen.findByText(/All-Time Greatest Champions Leaderboard/i, undefined, WAIT)).toBeInTheDocument()
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
