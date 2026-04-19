import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'
const KEY = 'pfm-theme'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

function applyTheme(t: Theme) {
  const root = document.documentElement
  const dark =
    t === 'dark' ||
    (t === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

const initial = (localStorage.getItem(KEY) as Theme | null) ?? 'system'
applyTheme(initial)

if (initial === 'system') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if ((localStorage.getItem(KEY) as Theme) === 'system') applyTheme('system')
    })
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (t) => {
    localStorage.setItem(KEY, t)
    applyTheme(t)
    set({ theme: t })
  },
}))
