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

// Every chrome token the app's CSS reads, serialised as custom properties for
// one element to own. Written ONCE and used twice: the live palette on `.shell`
// and — under a `dark-` prefix, for the "Dark selected card" setting — the dark
// palette beside it, which the selected card re-points its own tokens at. The
// dots come in already resolved so Status RGB (which replaces them wholesale)
// reaches both sets through the same path. One list, so a token added here
// reaches both scopes instead of half of one.
export function chromeVars(chrome: Chrome, dots: Record<string, string>, prefix = ''): string {
  const vars: Record<string, string> = {
    bg: chrome.bg,
    'bg-subtle': chrome.bgSubtle,
    fg: chrome.fg,
    'fg-muted': chrome.fgMuted,
    border: chrome.border,
    accent: chrome.accent,
    danger: chrome.danger,
    success: chrome.success
  }
  for (const [role, hex] of Object.entries(dots)) vars[`dot-${role}`] = hex
  return Object.entries(vars)
    .map(([name, value]) => `--${prefix}${name}:${value}`)
    .join(';')
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
      // Deliberate deviation from Primer (#656d76), the same one dark makes:
      // muted ink is the theme's OWN ink at half strength, black here and white
      // there, rather than a grey picked per palette. It is a colour that
      // composites instead of a colour that is mixed once, which is what the
      // "Dark selected card" setting needs — a card that borrows the dark
      // tokens gets muted text that lands correctly on ITS ground, not on the
      // app's. Measured, it barely moves the rest: #808080 on white against
      // Primer's #656d76, and on dark it is #808080 against #848484.
      fgMuted: 'rgba(0, 0, 0, 0.5)',
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
      // xterm 6 draws its own scrollbar (the VS Code scrollable element, not a
      // native one), and left alone it derives the slider from the FOREGROUND
      // at 20/40/50% opacity — which on the dark palette is near-white, i.e. a
      // white bar, the brightest thing on the screen. Painting it from the
      // chrome tokens instead makes every scrollbar in the app the same border
      // color (the app-chrome ones come from the ::-webkit-scrollbar rules in
      // App.svelte),
      // brightening through the two existing text tones on hover and drag.
      // The hover tone stays the OPAQUE hex `fgMuted` held before it went
      // half-strength ink: this one is a canvas colour, not a CSS value, so it
      // cannot composite over the terminal ground the way the chrome token now
      // does. The two land within a couple of tones of each other anyway.
      scrollbarSliderBackground: '#d0d7de',
      scrollbarSliderHoverBackground: '#656d76',
      scrollbarSliderActiveBackground: '#1f2328',
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
      // Deliberate deviation from Primer, in two steps. (1) Dark has ONE
      // surface and it is true black — bg and bgSubtle are the same #000000,
      // not GitHub dark's #0d1117/#161b22. There is no raised plate: surfaces
      // are told apart by their BORDER, never by a fill, which is why the
      // menu/settings hovers below fill with `border` like every other hover
      // in App.svelte (a subtle fill is invisible when bgSubtle === bg).
      // (2) The greys that remain are TRUE greys: Primer's dark neutrals are
      // all blue-shifted (#30363d, #7d8590, #e6edf3), which tinted the whole
      // chrome, so each is its Primer hex re-derived at the SAME relative
      // luminance with R=G=B — the value structure stays Primer's and only
      // the cast is gone. Colour in dark is earned, never ambient: the accent,
      // the status tones and the per-directory card tint (--dir-color mixed
      // over bgSubtle in App.svelte, at whatever the card wash controls are
      // set to) are
      // the only things that lift off the canvas at all.
      bg: '#000000',
      bgSubtle: '#000000',
      fg: '#ececec',
      // Half-strength white — see the light palette's note. The true-grey
      // #848484 this replaces was itself Primer's #7d8590 re-derived, and 50%
      // white on this true-black ground lands on #808080, so the de-tinted
      // value structure survives the change.
      fgMuted: 'rgba(255, 255, 255, 0.5)',
      border: '#353535',
      accent: '#2f81f7',
      success: '#3fb950',
      attention: '#d29922',
      danger: '#f85149'
    },
    xterm: {
      background: '#000000',
      foreground: '#ececec',
      cursor: '#2f81f7',
      cursorAccent: '#000000',
      selectionBackground: 'rgba(56, 139, 253, 0.4)',
      // The dark half of the scrollbar note in the light palette above: border,
      // then the pre-half-strength fgMuted hex on hover, then fg while dragging.
      scrollbarSliderBackground: '#353535',
      scrollbarSliderHoverBackground: '#848484',
      scrollbarSliderActiveBackground: '#ececec',
      // The 16 ANSI slots stay GitHub Dark — they're the CLI's colors, not the
      // chrome's, so the de-tinting above deliberately stops here. Exception,
      // as before: primer 7.10 ships black/#0d1117 and brightBlack/#161b22,
      // near invisible on this background (a defect GitHub later fixed) and
      // worse on true black. Legible grays:
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

// Session identity colors — the card washes and edges, and the swatch menu on a
// card title. The VOCABULARY is fixed by Claude Code's /color command and must
// stay these eight names: the name is typed verbatim as `/color <name>` when
// the user pushes a folder's color into a session, so a name off this list
// would be a command Claude rejects.
//
// The HEXES are the Macintosh default 16-color palette (2026-09-11), replacing
// the GitHub mid-tones that shipped before it — exact values off the Mac OS
// 9.0.4 System file's clut resource (lospec.com/palette-list/macintosh-default-
// 16-color), not eyeballed, same rule as the Primer hexes above. Eight of our
// names land on eight of its sixteen entries one-for-one; `pink` takes Mac's
// magenta, the nearest thing the palette has, and the six the app has no name
// for (white, dark green, brown, tan, and the three greys, plus black) are
// simply unused — this is a re-point of the colors we already offer, not a
// bigger menu. They are far more saturated than the tones they replace, which
// is the point: at a 10% wash they are still unmistakably a hue, and at 100%
// the card is the raw palette entry.
export const DOT_COLORS: { name: string; hex: string }[] = [
  { name: 'blue', hex: '#0000d4' },
  { name: 'green', hex: '#1fb714' },
  { name: 'purple', hex: '#4600a5' },
  { name: 'pink', hex: '#f20884' },
  { name: 'orange', hex: '#ff6402' },
  { name: 'cyan', hex: '#02abea' },
  { name: 'yellow', hex: '#fcf305' },
  { name: 'red', hex: '#dd0806' }
]
