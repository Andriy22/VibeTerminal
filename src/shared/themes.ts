export interface ThemeUi {
  /** Base window background (behind everything). */
  bg: string
  /** Raised surfaces: sidebar, topbar, modals. */
  surface: string
  text: string
  textDim: string
  /** Buttons, focus rings, selection accents. */
  accent: string
}

export interface TerminalTheme {
  id: string
  name: string
  appearance: 'dark' | 'light'
  ui: ThemeUi
  /** Base color of terminal panes (alpha applied by the glass level). */
  pane: string
  colors: {
    foreground: string
    cursor: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}

export const DEFAULT_THEME_ID = 'vibe-dark'

export const THEMES: TerminalTheme[] = [
  {
    id: 'vibe-dark',
    name: 'Vibe Dark',
    appearance: 'dark',
    ui: {
      bg: '#0a0d10',
      surface: '#141920',
      text: '#e6e3dc',
      textDim: '#8b939d',
      accent: '#d97757'
    },
    pane: '#090c0f',
    colors: {
      foreground: '#e6e3dc',
      cursor: '#d97757',
      selectionBackground: 'rgba(217, 119, 87, 0.28)',
      black: '#1c2025',
      red: '#f47067',
      green: '#57ab5a',
      yellow: '#c69026',
      blue: '#539bf5',
      magenta: '#b083f0',
      cyan: '#56b6c2',
      white: '#909dab',
      brightBlack: '#545d68',
      brightRed: '#ff938a',
      brightGreen: '#6bc46d',
      brightYellow: '#daaa3f',
      brightBlue: '#6cb6ff',
      brightMagenta: '#dcbdfb',
      brightCyan: '#76e3ea',
      brightWhite: '#cdd9e5'
    }
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    appearance: 'dark',
    ui: {
      bg: '#21252b',
      surface: '#282c34',
      text: '#abb2bf',
      textDim: '#7f848e',
      accent: '#61afef'
    },
    pane: '#23272e',
    colors: {
      foreground: '#abb2bf',
      cursor: '#61afef',
      selectionBackground: 'rgba(97, 175, 239, 0.28)',
      black: '#3f4451',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#d7dae0',
      brightBlack: '#5c6370',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff'
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    appearance: 'dark',
    ui: {
      bg: '#1e1f29',
      surface: '#282a36',
      text: '#f8f8f2',
      textDim: '#8b93b5',
      accent: '#bd93f9'
    },
    pane: '#232430',
    colors: {
      foreground: '#f8f8f2',
      cursor: '#ff79c6',
      selectionBackground: 'rgba(189, 147, 249, 0.3)',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    appearance: 'dark',
    ui: {
      bg: '#16161e',
      surface: '#1a1b26',
      text: '#a9b1d6',
      textDim: '#565f89',
      accent: '#7aa2f7'
    },
    pane: '#16161e',
    colors: {
      foreground: '#a9b1d6',
      cursor: '#7aa2f7',
      selectionBackground: 'rgba(122, 162, 247, 0.28)',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5'
    }
  },
  {
    id: 'nord',
    name: 'Nord',
    appearance: 'dark',
    ui: {
      bg: '#242933',
      surface: '#2e3440',
      text: '#d8dee9',
      textDim: '#7b88a1',
      accent: '#88c0d0'
    },
    pane: '#272c36',
    colors: {
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      selectionBackground: 'rgba(136, 192, 208, 0.28)',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4'
    }
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    appearance: 'light',
    ui: {
      bg: '#f6f8fa',
      surface: '#ffffff',
      text: '#24292f',
      textDim: '#57606a',
      accent: '#0969da'
    },
    pane: '#ffffff',
    colors: {
      foreground: '#24292f',
      cursor: '#0969da',
      selectionBackground: 'rgba(9, 105, 218, 0.22)',
      black: '#24292f',
      red: '#cf222e',
      green: '#116329',
      yellow: '#4d2d00',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#57606a',
      brightRed: '#a40e26',
      brightGreen: '#1a7f37',
      brightYellow: '#633c01',
      brightBlue: '#218bff',
      brightMagenta: '#a475f9',
      brightCyan: '#3192aa',
      brightWhite: '#8c959f'
    }
  },
  {
    id: 'one-light',
    name: 'One Light',
    appearance: 'light',
    ui: {
      bg: '#ececed',
      surface: '#fafafa',
      text: '#383a42',
      textDim: '#696c77',
      accent: '#4078f2'
    },
    pane: '#fafafa',
    colors: {
      foreground: '#383a42',
      cursor: '#4078f2',
      selectionBackground: 'rgba(64, 120, 242, 0.22)',
      black: '#383a42',
      red: '#e45649',
      green: '#50a14f',
      yellow: '#c18401',
      blue: '#4078f2',
      magenta: '#a626a4',
      cyan: '#0184bc',
      white: '#a0a1a7',
      brightBlack: '#696c77',
      brightRed: '#e45649',
      brightGreen: '#50a14f',
      brightYellow: '#c18401',
      brightBlue: '#4078f2',
      brightMagenta: '#a626a4',
      brightCyan: '#0184bc',
      brightWhite: '#ffffff'
    }
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    appearance: 'light',
    ui: {
      bg: '#eee8d5',
      surface: '#fdf6e3',
      text: '#586e75',
      textDim: '#93a1a1',
      accent: '#268bd2'
    },
    pane: '#fdf6e3',
    colors: {
      foreground: '#657b83',
      cursor: '#268bd2',
      selectionBackground: 'rgba(38, 139, 210, 0.22)',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3'
    }
  }
]

export function themeById(id: string | undefined): TerminalTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export interface GlassLevel {
  id: string
  name: string
  /** Alpha applied to the app backdrop, surfaces, and panes (1 = opaque). */
  app: number
  surface: number
  pane: number
  /** backdrop-filter blur radius in px. */
  blur: number
}

export const GLASS_LEVELS: GlassLevel[] = [
  { id: 'off', name: 'Off', app: 1, surface: 1, pane: 1, blur: 0 },
  { id: 'subtle', name: 'Subtle', app: 0.8, surface: 0.86, pane: 0.9, blur: 14 },
  { id: 'standard', name: 'Standard', app: 0.4, surface: 0.55, pane: 0.55, blur: 28 },
  { id: 'heavy', name: 'Heavy', app: 0.16, surface: 0.3, pane: 0.32, blur: 38 }
]

export const DEFAULT_GLASS_ID = 'standard'

export function glassById(id: string | undefined): GlassLevel {
  return GLASS_LEVELS.find((g) => g.id === id) ?? GLASS_LEVELS[2]
}
