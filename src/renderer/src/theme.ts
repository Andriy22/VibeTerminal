import { glassById, themeById } from '@shared/themes'

function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Restyle the whole app from the selected theme + glass level by rewriting
 * the CSS variables everything is built on.
 */
export function applyTheme(themeId?: string, glassId?: string): void {
  const theme = themeById(themeId)
  const glass = glassById(glassId)
  const dark = theme.appearance === 'dark'
  const s = document.documentElement.style

  s.setProperty('--app-bg', rgba(theme.ui.bg, glass.app))
  s.setProperty('--glass', rgba(theme.ui.surface, glass.surface))
  s.setProperty('--glass-soft', rgba(theme.ui.surface, Math.max(0.12, glass.surface - 0.1)))
  s.setProperty('--glass-strong', rgba(theme.ui.surface, Math.min(1, glass.surface + 0.25)))
  s.setProperty('--glass-border', dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.12)')
  s.setProperty(
    '--glass-highlight',
    dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.55)'
  )
  s.setProperty('--pane-bg', rgba(theme.pane, glass.pane))
  s.setProperty('--blur', `${glass.blur}px`)
  s.setProperty('--text', theme.ui.text)
  s.setProperty('--text-dim', theme.ui.textDim)
  s.setProperty('--accent', theme.ui.accent)
  s.setProperty('--accent-contrast', dark ? '#14100e' : '#ffffff')
  s.setProperty('--input-bg', dark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.6)')
  s.setProperty('--hover', dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
  s.setProperty('--hover-strong', dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.09)')
  s.setProperty('--scroll-thumb', dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.2)')
}
