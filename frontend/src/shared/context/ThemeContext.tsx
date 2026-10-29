import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'
const THEME_STORAGE_KEY = 'ufc-predictor:theme-v2'

interface ThemeContextValue {
  theme: ThemeMode
  isLight: boolean
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readThemePreference(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readThemePreference())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode)
  }

  return (
    <ThemeContext.Provider value={{ theme, isLight: theme === 'light', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    const isLight = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
    return {
      theme: isLight ? 'light' : 'dark',
      isLight,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}
