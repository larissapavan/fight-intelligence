import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import { respond } from './fixtures'

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

const WAIT = { timeout: 10000 }

describe('the gyms section', () => {
  it('the UFC list shows the gyms with UFC fighters, biggest first, and can show them all', async () => {
    renderAt('/gyms')
    expect(await screen.findByRole('heading', { name: 'UFC gyms and teams' }, WAIT)).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Gyms' }, WAIT)
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/gyms/iron-gym'])
    expect(within(list).getByText('1 champion')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'All gyms' }))
    expect(within(await screen.findByRole('list', { name: 'Gyms' })).getAllByRole('link')).toHaveLength(3)
  })

  it('the PFL list only has gyms with PFL fighters and links inside /pfl', async () => {
    renderAt('/pfl/gyms')
    expect(await screen.findByRole('heading', { name: 'PFL gyms and teams' }, WAIT)).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Gyms' }, WAIT)
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/pfl/gyms/pfl-only-club', '/pfl/gyms/iron-gym'])
  })

  it('a gym search narrows the list', async () => {
    renderAt('/gyms')
    await userEvent.click(await screen.findByRole('button', { name: 'All gyms' }, WAIT))
    await userEvent.type(screen.getByRole('textbox', { name: 'Search gyms' }), 'lonely')
    expect(within(await screen.findByRole('list', { name: 'Gyms' })).getAllByRole('link')).toHaveLength(1)
  })

  it('a gym shows the fighters of the organization first, with their titles and organizations', async () => {
    renderAt('/gyms/iron-gym')
    expect(await screen.findByRole('heading', { name: 'Iron Gym' }, WAIT)).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Fighters' }, WAIT)
    expect(within(list).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Alpha One. View profile', 'Riko Stone. View profile', 'Beta Two. View profile',
    ])
    expect(within(list).getByText('Champion')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Everyone \(4\)/ }))
    expect(within(await screen.findByRole('list', { name: 'Fighters' })).getByText('Nobody Known')).toBeInTheDocument()
  })

  it('a fighter with a profile opens it; one without is only listed', async () => {
    renderAt('/gyms/iron-gym')
    await userEvent.click(await screen.findByRole('button', { name: /Everyone/ }, WAIT))
    expect(screen.queryByRole('button', { name: /Nobody Known/ })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Alpha One. View profile' }))
    expect(await screen.findByRole('button', { name: /close performance profile/i }, WAIT)).toBeInTheDocument()
  })

  it('in the PFL a gym opens the PFL profile and falls back to everyone when it has no PFL fighter', async () => {
    renderAt('/pfl/gyms/pfl-only-club')
    await userEvent.click(await screen.findByRole('button', { name: 'Dax Moore. View profile' }, WAIT))
    expect(await screen.findByRole('dialog', { name: /Dax Moore/ }, WAIT)).toBeInTheDocument()
  })

  it('the menu links to the gyms of the organization on screen', async () => {
    renderAt('/pfl/events')
    await screen.findByRole('heading', { name: 'PFL fight cards' }, WAIT)
    expect(screen.getAllByRole('link', { name: 'Gyms' }).map((link) => link.getAttribute('href'))).toContain('/pfl/gyms')
  })

  it('an unknown gym says so', async () => {
    renderAt('/gyms/nothing-here')
    expect(await screen.findByRole('heading', { name: 'Gym not found' }, WAIT)).toBeInTheDocument()
  })
})
