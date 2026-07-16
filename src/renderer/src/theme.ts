import type { ITheme } from '@xterm/xterm'

// GitHub Light / GitHub Dark, hexes pulled from @primer/primitives@7.10.0
// (dist/json/colors/{light,dark}.json) — the exact version github-vscode-theme
// pins — plus the fg/accent overrides github-vscode-theme applies on top.
// Do not tweak by eye; re-derive from the source if GitHub updates.

// The terminal-font picker (Settings menu). Both the xterm option and the
// preview's CSS (via --mono) read the selected stack. `id` is the stable key
// persisted as ui.font; `bundled` fonts are self-hosted via @fontsource
// (imported in main.ts) — the rest are Windows-native. Ligatures don't render
// (xterm draws glyph-by-glyph, box-drawing via customGlyphs), so these earn
// their place on letterforms — see the kickoff doc's resolved font item.
export interface FontOption {
  id: string
  label: string
  stack: string
  bundled: boolean
}

export const FONTS: FontOption[] = [
  {
    id: 'cascadia',
    label: 'Cascadia Mono',
    stack: '"Cascadia Mono", Consolas, monospace',
    bundled: false
  },
  { id: 'consolas', label: 'Consolas', stack: 'Consolas, monospace', bundled: false },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    bundled: true
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    stack: '"Fira Code", "Cascadia Mono", Consolas, monospace',
    bundled: true
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    stack: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
    bundled: true
  }
]

export const DEFAULT_FONT_ID = FONTS[0].id

// The sans list — shared by both the Interface (app chrome) and Preview (prose)
// pickers. Inter (default) is bundled; Segoe UI and Arial are Windows-native
// (Arial is Windows' Helvetica substitute — real Helvetica isn't free to ship);
// Roboto and IBM Plex Sans are self-hosted (main.ts). Every stack keeps
// system-ui as the fallback so non-latin titles/paths still render.
export const UI_FONTS: FontOption[] = [
  { id: 'inter', label: 'Inter', stack: "'Inter', system-ui, sans-serif", bundled: true },
  { id: 'segoe', label: 'Segoe UI', stack: "'Segoe UI', system-ui, sans-serif", bundled: false },
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif', bundled: false },
  { id: 'roboto', label: 'Roboto', stack: "'Roboto', system-ui, sans-serif", bundled: true },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    stack: "'IBM Plex Sans', system-ui, sans-serif",
    bundled: true
  }
]

export const DEFAULT_UI_FONT_ID = UI_FONTS[0].id

// Unknown/absent id (hand-edited state, a removed font) falls back to the
// list's default. `list` picks the vocabulary — FONTS (mono) or UI_FONTS (sans).
export function fontStack(id: string, list: FontOption[] = FONTS): string {
  return (list.find((f) => f.id === id) ?? list[0]).stack
}

export type Mode = 'system' | 'light' | 'dark'

export interface Chrome {
  bg: string
  bgSubtle: string
  fg: string
  fgMuted: string
  border: string
  accent: string
  success: string
  attention: string
  danger: string
}

export interface Palette {
  chrome: Chrome
  xterm: ITheme
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    chrome: {
      bg: '#ffffff',
      bgSubtle: '#f6f8fa',
      fg: '#1f2328',
      fgMuted: '#656d76',
      border: '#d0d7de',
      accent: '#0969da',
      // Status dots read from success/attention/danger. On white the Primer
      // *.fg* tones (success #1a7f37, attention #9a6700) are text colors —
      // muddy as small filled dots — so light uses the brighter *.emphasis*
      // mid-tones. danger is unchanged (its .fg and .emphasis are both
      // #cf222e). Dark keeps .fg below, already bright on its dark canvas.
      success: '#2da44e',
      attention: '#bf8700',
      danger: '#cf222e'
    },
    xterm: {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#0969da',
      cursorAccent: '#ffffff',
      selectionBackground: 'rgba(84, 174, 255, 0.4)',
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
  dark: {
    chrome: {
      bg: '#0d1117',
      bgSubtle: '#161b22',
      fg: '#e6edf3',
      fgMuted: '#7d8590',
      border: '#30363d',
      accent: '#2f81f7',
      success: '#3fb950',
      attention: '#d29922',
      danger: '#f85149'
    },
    xterm: {
      background: '#0d1117',
      foreground: '#e6edf3',
      cursor: '#2f81f7',
      cursorAccent: '#0d1117',
      selectionBackground: 'rgba(56, 139, 253, 0.4)',
      // primer 7.10 ships black/#0d1117 and brightBlack/#161b22 — invisible on
      // the #0d1117 background (a defect GitHub later fixed). Legible grays:
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#ffffff'
    }
  }
}

// Session identity dots — the same 8-color vocabulary as Claude Code's
// /color command, in GitHub mid-tones legible on both palettes. The name is
// what gets typed as `/color <name>` when the user sets a color from the tower.
export const DOT_COLORS: { name: string; hex: string }[] = [
  { name: 'blue', hex: '#388bfd' },
  { name: 'green', hex: '#3fb950' },
  { name: 'purple', hex: '#a371f7' },
  { name: 'pink', hex: '#db61a2' },
  { name: 'orange', hex: '#db6d28' },
  { name: 'cyan', hex: '#39c5cf' },
  { name: 'yellow', hex: '#d29922' },
  { name: 'red', hex: '#f85149' }
]
