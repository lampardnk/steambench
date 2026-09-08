'use client'

import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

export const THEME_KEY = 'steambench.theme'

/**
 * Stamped on <html> before the first paint by the inline script in layout.tsx,
 * and again here whenever the choice changes. Both must agree, so the class
 * names live in one place.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  // "system" leaves both off, which is what globals.css keys its
  // prefers-color-scheme block on.
}

/** The script that runs before React, so a dark reader never sees a white flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='dark'||t==='light')document.documentElement.classList.add(t)}catch(e){}`

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch {
      /* private mode, or storage is blocked: system it is */
    }
  }, [])
  const choose = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, next)
    } catch {
      /* the class is already on, it just will not survive a reload */
    }
  }
  return [theme, choose]
}

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const GLYPH: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }
const TITLE: Record<Theme, string> = {
  system: 'Theme: follows your system. Click for light.',
  light: 'Theme: light. Click for dark.',
  dark: 'Theme: dark. Click to follow your system.',
}

/** One button, cycling system → light → dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      title={TITLE[theme]}
      aria-label={TITLE[theme]}
      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
    >
      <span aria-hidden>{GLYPH[theme]}</span> {theme}
    </button>
  )
}
