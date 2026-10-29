import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider, useTheme } from '../shared/context/ThemeContext'
import { Header } from '../shared/components/Header'

function ThemeTestConsumer() {
  const { theme, isLight, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-light">{String(isLight)}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  )
}

describe('Theme management', () => {
  it('toggles theme correctly between dark and light', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    )

    const toggleBtn = screen.getByTestId('toggle-btn')
    const themeSpan = screen.getByTestId('current-theme')

    // Initial theme is dark or light depending on storage, toggle switches it
    const initial = themeSpan.textContent
    act(() => {
      fireEvent.click(toggleBtn)
    })
    const after = themeSpan.textContent
    expect(after).not.toBe(initial)
    expect(document.documentElement.dataset.theme).toBe(after)
  })

  it('renders Header with theme switch button', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    )

    const switchBtn = screen.getByRole('button', { name: /switch to/i })
    expect(switchBtn).toBeInTheDocument()

    act(() => {
      fireEvent.click(switchBtn)
    })
  })
})
