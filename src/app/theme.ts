import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tea-business-theme'
const THEME_EVENT = 'tea-business-theme-change'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function getPreferredTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY)
    if (isTheme(storedTheme)) return storedTheme
  } catch {
    // The UI can still follow the operating-system preference when storage is unavailable.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Theme selection remains active for the current session.
  }

  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }))
}

export function initializeTheme() {
  applyTheme(getPreferredTheme())
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getPreferredTheme())

  useEffect(() => {
    function handleThemeChange(event: Event) {
      setThemeState((event as CustomEvent<Theme>).detail)
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && isTheme(event.newValue)) {
        document.documentElement.dataset.theme = event.newValue
        document.documentElement.style.colorScheme = event.newValue
        setThemeState(event.newValue)
      }
    }

    window.addEventListener(THEME_EVENT, handleThemeChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, handleThemeChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return [theme, applyTheme]
}
