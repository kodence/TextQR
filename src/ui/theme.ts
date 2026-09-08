export type Theme = 'system' | 'light' | 'dark'

export const THEME_KEY = 'textqr.theme'

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Applies the theme by stamping `data-theme` on the root element (removed for
 * "system", which lets `prefers-color-scheme` decide) and remembers the choice.
 * index.html runs the same logic inline before first paint to avoid a flash.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage unavailable (private mode, blocked). The theme still applies for this page.
  }
}
