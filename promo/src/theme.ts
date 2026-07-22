/**
 * Design tokens mirrored from the real app.
 *
 * Source of truth: src/shared/themes.ts and src/renderer/src/styles.css.
 * Sizes are the app's values multiplied by SCALE — the desktop UI runs at a
 * 13px body, which is unreadable at 1080p, so the promo redraws the same
 * design language larger and slightly less dense.
 */

export const SCALE = 1.4

export interface Theme {
  id: string
  name: string
  appearance: 'dark' | 'light'
  bg: string
  surface: string
  text: string
  textDim: string
  accent: string
  pane: string
  /** Five terminal hues shown on the theme cards in Settings. */
  swatches: [string, string, string, string, string]
}

/** The subset the Customization beat cycles through, verbatim from themes.ts. */
export const THEMES: Theme[] = [
  {
    id: 'vibe-dark',
    name: 'Vibe Dark',
    appearance: 'dark',
    bg: '#0a0d10',
    surface: '#141920',
    text: '#e6e3dc',
    textDim: '#8b939d',
    accent: '#d97757',
    pane: '#090c0f',
    swatches: ['#f47067', '#57ab5a', '#c69026', '#539bf5', '#b083f0'],
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    appearance: 'dark',
    bg: '#16161e',
    surface: '#1a1b26',
    text: '#a9b1d6',
    textDim: '#565f89',
    accent: '#7aa2f7',
    pane: '#16161e',
    swatches: ['#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7'],
  },
  {
    id: 'dracula',
    name: 'Dracula',
    appearance: 'dark',
    bg: '#1e1f29',
    surface: '#282a36',
    text: '#f8f8f2',
    textDim: '#8b93b5',
    accent: '#bd93f9',
    pane: '#232430',
    swatches: ['#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6'],
  },
  {
    id: 'nord',
    name: 'Nord',
    appearance: 'dark',
    bg: '#242933',
    surface: '#2e3440',
    text: '#d8dee9',
    textDim: '#7b88a1',
    accent: '#88c0d0',
    pane: '#272c36',
    swatches: ['#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead'],
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    appearance: 'light',
    bg: '#f6f8fa',
    surface: '#ffffff',
    text: '#24292f',
    textDim: '#57606a',
    accent: '#0969da',
    pane: '#ffffff',
    swatches: ['#cf222e', '#116329', '#4d2d00', '#0969da', '#8250df'],
  },
  {
    id: 'one-light',
    name: 'One Light',
    appearance: 'light',
    bg: '#ececed',
    surface: '#fafafa',
    text: '#383a42',
    textDim: '#696c77',
    accent: '#4078f2',
    pane: '#fafafa',
    swatches: ['#e45649', '#50a14f', '#c18401', '#4078f2', '#a626a4'],
  },
]

export const themeById = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0]

/** Glass levels, verbatim from themes.ts — alpha applied to surfaces + blur px. */
export interface Glass {
  id: string
  name: string
  app: number
  surface: number
  pane: number
  blur: number
}

export const GLASS_LEVELS: Glass[] = [
  { id: 'off', name: 'Off', app: 1, surface: 1, pane: 1, blur: 0 },
  { id: 'subtle', name: 'Subtle', app: 0.8, surface: 0.86, pane: 0.9, blur: 14 },
  { id: 'standard', name: 'Standard', app: 0.4, surface: 0.55, pane: 0.55, blur: 28 },
  { id: 'heavy', name: 'Heavy', app: 0.16, surface: 0.3, pane: 0.32, blur: 38 },
]

export const glassById = (id: string): Glass =>
  GLASS_LEVELS.find((g) => g.id === id) ?? GLASS_LEVELS[2]

export function rgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Everything the UI kit needs to paint itself, resolved from theme + glass. */
export interface Skin {
  theme: Theme
  glass: Glass
  appBg: string
  surface: string
  surfaceSoft: string
  surfaceStrong: string
  /**
   * Backing for modals and hover cards. Floored well above the glass level:
   * at Heavy glass a faithful surface alpha lets the terminal text behind
   * bleed through and fight the modal's own content on video.
   */
  modalSurface: string
  paneBg: string
  border: string
  highlight: string
  hover: string
  inputBg: string
  text: string
  textDim: string
  accent: string
  accentContrast: string
  blur: number
  dark: boolean
}

export function makeSkin(themeId: string, glassId: string): Skin {
  const theme = themeById(themeId)
  const glass = glassById(glassId)
  const dark = theme.appearance === 'dark'
  return {
    theme,
    glass,
    appBg: rgba(theme.bg, glass.app),
    surface: rgba(theme.surface, glass.surface),
    surfaceSoft: rgba(theme.surface, Math.max(0.12, glass.surface - 0.1)),
    surfaceStrong: rgba(theme.surface, Math.min(1, glass.surface + 0.25)),
    modalSurface: rgba(theme.surface, Math.max(0.92, glass.surface + 0.25)),
    paneBg: rgba(theme.pane, glass.pane),
    border: dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.12)',
    highlight: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.55)',
    hover: dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    inputBg: dark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.6)',
    text: theme.text,
    textDim: theme.textDim,
    accent: theme.accent,
    accentContrast: dark ? '#14100e' : '#ffffff',
    blur: glass.blur,
    dark,
  }
}

/** Agent hues + glyphs — styles.css:24-26 and renderer/kinds.ts. */
export const KIND = {
  claude: { label: 'claude', symbol: '✳', color: '#d97757' },
  codex: { label: 'codex', symbol: '⬡', color: '#56b6c2' },
  shell: { label: 'shell', symbol: '❯', color: '#6e7681' },
} as const

export type Kind = keyof typeof KIND

export const STATUS = {
  ok: '#57ab5a',
  warn: '#c69026',
  danger: '#f47067',
} as const

export const MONO =
  "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, 'Cascadia Mono', monospace"
export const UI =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"

/** Layout constants — app px × SCALE, rounded to whole pixels. */
export const L = {
  canvas: { w: 1920, h: 1080 },
  /** The app window's rect on the 1920×1080 canvas. */
  window: { x: 90, y: 70, w: 1740, h: 940, radius: 16 },
  sidebar: 380, // 272 × 1.4
  topbar: 62, // 44 × 1.4
  paneHeader: 36, // 26 × 1.4
  font: {
    body: 18, // 13 × 1.4
    small: 16,
    tiny: 14,
    label: 15,
    h2: 26,
    h3: 22,
  },
} as const
