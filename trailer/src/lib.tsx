import { Img, Node, Rect, Txt, type TxtProps } from '@motion-canvas/2d'
import {
  all,
  createRef,
  easeInCubic,
  easeOutExpo,
  easeOutQuint,
  type ThreadGenerator
} from '@motion-canvas/core'
import arcIcon from '../../src/renderer/src/assets/arc.png'
import heroShot from '../../images/arc-hero-dark.png'
import previewShot from '../../images/arc-preview-dark.png'
import settingsShot from '../../images/arc-settings-dark.png'
import sessionMenuShot from '../../images/arc-session-menu-dark.png'
import worktreesShot from '../../images/arc-worktrees-dark.png'
import worktreeNewShot from '../../images/arc-worktree-new-dark.png'
import reopenShot from '../../images/arc-reopen-dark.png'

// The trailer's design tokens — the app's own dark Primer palette, because
// the footage is the DARK screenshots: one world, canvas and product, rather
// than light windows pasted onto a dark card.
export const BG = '#0d1117'
export const SURFACE = '#161b22'
export const BORDER = '#30363d'
export const FG = '#f0f6fc'
export const MUTED = '#8b949e'
export const ACCENT = '#388bfd' // the app's default dir color
export const RUNNING = '#f85149'
export const WAITING = '#d29922'
export const IDLE = '#3fb950'

export const SANS = 'Inter'
export const MONO = 'JetBrains Mono'
export const DISPLAY = 'Orbitron' // the wordmark face, weight 700, lowercase
export const ICON_FONT = 'Material Symbols Outlined'

// ─── the app icon ────────────────────────────────────────────────────────
// The 16x16 pixel-art PNG the app itself scales (single source of truth,
// reached through the same fs.allow reach-up as the screenshots). smoothing
// off: nearest neighbour keeps the pixels crisp squares at any size, so
// callers pick multiples of 16.
export function appIcon(size = 128): Img {
  return (<Img src={arcIcon} width={size} smoothing={false} />) as Img
}

// ─── the three session-type marks ────────────────────────────────────────
// The same geometry the tower draws (ICONS in App.svelte) — two product
// marks and Phosphor's terminal-window — inlined as data-URI SVG rather than
// cropped out of a screenshot, so they stay vector-crisp at any size. The
// root gets an explicit pixel size: an <img> rasterizes an SVG at its
// NATURAL size, so without it a 24-unit viewBox would blur at 40px.
function markSrc(box: string, path: string, evenodd: boolean, fill: string): string {
  const rule = evenodd ? ' fill-rule="evenodd"' : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="${box}">` +
    `<path d="${path}" fill="${fill}"${rule}/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const CLAUDE_PATH =
  'M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z'

const OPENAI_PATH =
  'M11.248 18.25q-.825 0-1.568-.314a4.3 4.3 0 0 1-1.32-.874 4 4 0 0 1-1.304.214 4 4 0 0 1-2.046-.544 4.27 4.27 0 0 1-1.518-1.485 4 4 0 0 1-.56-2.095q0-.48.131-1.04A4.4 4.4 0 0 1 2.04 10.71a4.07 4.07 0 0 1 .017-3.4 4.2 4.2 0 0 1 1.056-1.418 3.8 3.8 0 0 1 1.6-.842 3.9 3.9 0 0 1 .76-1.683q.593-.759 1.451-1.188a4.04 4.04 0 0 1 1.832-.429q.825 0 1.567.313.742.314 1.32.875a4 4 0 0 1 1.304-.215q1.106 0 2.046.545a4.14 4.14 0 0 1 1.501 1.485q.578.941.578 2.095 0 .48-.132 1.04.66.61 1.023 1.419.363.792.363 1.666 0 .892-.38 1.717a4.3 4.3 0 0 1-1.072 1.435 3.8 3.8 0 0 1-1.584.825 3.8 3.8 0 0 1-.775 1.683 4.06 4.06 0 0 1-1.436 1.188 4.04 4.04 0 0 1-1.832.429m-4.076-2.062q.825 0 1.435-.347l3.103-1.782a.36.36 0 0 0 .164-.313v-1.42L7.881 14.62a.67.67 0 0 1-.726 0l-3.118-1.798a.5.5 0 0 1-.017.115v.198q0 .841.396 1.551.413.693 1.139 1.089a3.2 3.2 0 0 0 1.617.412m.165-2.69a.4.4 0 0 0 .181.05q.083 0 .165-.05l1.238-.71-3.977-2.31a.7.7 0 0 1-.363-.643v-3.58q-.825.362-1.32 1.122a2.9 2.9 0 0 0-.495 1.65q0 .809.413 1.55.412.743 1.072 1.123zm3.91 3.663q.875 0 1.585-.396a2.96 2.96 0 0 0 1.534-2.64v-3.564a.32.32 0 0 0-.165-.297l-1.254-.726v4.604a.7.7 0 0 1-.363.643l-3.119 1.799a3 3 0 0 0 1.783.577m.627-6.039V8.878L10.01 7.822 8.129 8.878v2.244l1.881 1.056zM7.057 5.859a.7.7 0 0 1 .363-.644l3.119-1.798a3 3 0 0 0-1.782-.578q-.874 0-1.584.396A2.96 2.96 0 0 0 6.05 4.324a3.07 3.07 0 0 0-.396 1.551v3.547q0 .199.165.314l1.237.726zm8.383 7.887q.825-.364 1.303-1.123.495-.758.495-1.65a3.15 3.15 0 0 0-.412-1.55q-.413-.743-1.073-1.123l-3.086-1.782q-.099-.065-.181-.049a.3.3 0 0 0-.165.05l-1.238.692 3.993 2.327a.6.6 0 0 1 .264.264.64.64 0 0 1 .1.363zm-3.317-8.382a.63.63 0 0 1 .726 0l3.135 1.831v-.297q0-.792-.396-1.501a2.86 2.86 0 0 0-1.105-1.155q-.71-.43-1.65-.43-.825 0-1.436.347L8.294 5.941a.36.36 0 0 0-.165.314v1.418z'

const TERMINAL_PATH =
  'M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z'

export function mark(kind: 'claude' | 'codex' | 'shell', size: number, fill = FG): Img {
  const src =
    kind === 'claude'
      ? markSrc('0 0 24 24', CLAUDE_PATH, true, fill)
      : kind === 'codex'
        ? markSrc('0.211 0.294 19.588 19.412', OPENAI_PATH, false, fill)
        : markSrc('0 0 256 256', TERMINAL_PATH, false, fill)
  return (<Img src={src} width={size} height={size} />) as Img
}

// ─── the screenshots ─────────────────────────────────────────────────────
// The shipped doc images, imported straight from ../images — no copies. The
// pixel sizes travel with them because every layout is built from them, and
// because nothing may be scaled far past 1:1: these are 1x captures, and a
// big blow-up would show it.
export interface Shot {
  src: string
  w: number
  h: number
}

export const SHOTS = {
  hero: { src: heroShot, w: 1064, h: 925 },
  preview: { src: previewShot, w: 1064, h: 925 },
  settings: { src: settingsShot, w: 539, h: 600 },
  sessionMenu: { src: sessionMenuShot, w: 355, h: 295 },
  worktrees: { src: worktreesShot, w: 310, h: 258 },
  worktreeNew: { src: worktreeNewShot, w: 310, h: 258 },
  reopen: { src: reopenShot, w: 515, h: 272 }
} satisfies Record<string, Shot>

// A rectangle of a screenshot as a floating window: hairline border, deep
// soft shadow. The border is what separates a dark shot from the dark canvas
// behind it. `box` is in SOURCE pixels; the image slides inside the clip so
// that box lands centred, which is how a modal is lifted off the dimmed app
// content the capture caught behind it.
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function crop(shot: Shot, box: Box, scale: number, x = 0, y = 0): Rect {
  return (
    <Rect
      width={Math.round(box.w * scale)}
      height={Math.round(box.h * scale)}
      x={x}
      y={y}
      radius={12}
      clip
      stroke={BORDER}
      lineWidth={1.5}
      shadowColor={'rgba(0, 0, 0, 0.7)'}
      shadowBlur={70}
      shadowOffsetY={26}
    >
      <Img
        src={shot.src}
        width={Math.round(shot.w * scale)}
        height={Math.round(shot.h * scale)}
        x={(shot.w / 2 - (box.x + box.w / 2)) * scale}
        y={(shot.h / 2 - (box.y + box.h / 2)) * scale}
      />
    </Rect>
  ) as Rect
}

export function frame(shot: Shot, scale: number, x = 0, y = 0): Rect {
  return crop(shot, { x: 0, y: 0, w: shot.w, h: shot.h }, scale, x, y)
}

// The Settings modal inside its capture, measured off the pixels: the shot
// keeps the dimmed app content behind the panel, which at trailer size reads
// as noise around it rather than as depth.
export const SETTINGS_PANEL: Box = { x: 29, y: 30, w: 483, h: 542 }

// ─── the motion language ─────────────────────────────────────────────────
// Two transitions, and deliberately only two.
//
// `reveal` is the workhorse: everything that is not the wordmark fades up a
// short distance on easeOutQuint and leaves the same way. Small travel, no
// overshoot, no bounce — the titles are meant to arrive, not to perform.
export interface Reveal {
  node: Node
  in(duration?: number): ThreadGenerator
  out(duration?: number): ThreadGenerator
}

export function reveal(node: Node, rise = 24): Reveal {
  const base = node.y()
  node.opacity(0).y(base + rise)
  return {
    node,
    *in(duration = 0.6) {
      yield* all(node.opacity(1, duration * 0.7), node.y(base, duration, easeOutQuint))
    },
    *out(duration = 0.32) {
      yield* all(node.opacity(0, duration), node.y(base - rise * 0.6, duration, easeInCubic))
    }
  }
}

// `rise` is the masked one, and it is reserved for the WORDMARK: the line
// climbs into a clipping box and leaves through the same mask. Used twice in
// the whole trailer, at the two moments the name is on screen.
export interface Rise {
  node: Rect
  txt: () => Txt
  in(duration?: number): ThreadGenerator
  out(duration?: number): ThreadGenerator
}

export function rise(
  txtProps: TxtProps,
  box: { width: number; height: number; x?: number; y?: number; align?: 'left' | 'center' }
): Rise {
  const txt = createRef<Txt>()
  const clip = createRef<Rect>()
  const left = box.align === 'left'
  const node = (
    <Rect ref={clip} width={box.width} height={box.height} x={box.x ?? 0} y={box.y ?? 0} clip>
      <Txt
        ref={txt}
        fontFamily={SANS}
        fill={FG}
        {...txtProps}
        offset={left ? [-1, 0] : [0, 0]}
        x={left ? -box.width / 2 : 0}
        y={box.height}
      />
    </Rect>
  ) as Rect
  return {
    node,
    txt,
    *in(duration = 0.7) {
      yield* txt().y(0, duration, easeOutExpo)
    },
    *out(duration = 0.35) {
      yield* txt().y(-box.height, duration, easeInCubic)
    }
  }
}

// ─── the type scale ──────────────────────────────────────────────────────
// Three sizes and one rule: the eyebrow names the beat, the headline makes
// the claim, the body qualifies it. Left-aligned by default, because most of
// the beats hang their text off a column edge beside a screenshot.
export function eyebrow(text: string, x: number, y: number): Node {
  return (
    <Node x={x} y={y}>
      <Rect width={24} height={3} radius={2} fill={ACCENT} offset={[-1, 0]} y={1} />
      <Txt
        text={text}
        fontFamily={MONO}
        fontSize={21}
        fontWeight={700}
        letterSpacing={5}
        fill={MUTED}
        offset={[-1, 0]}
        x={40}
      />
    </Node>
  ) as Node
}

export function headline(text: string, x: number, y: number, props: TxtProps = {}): Txt {
  return (
    <Txt
      text={text}
      fontFamily={SANS}
      fontSize={62}
      fontWeight={600}
      letterSpacing={-1.2}
      lineHeight={74}
      fill={FG}
      textAlign={'left'}
      offset={[-1, 0]}
      x={x}
      y={y}
      {...props}
    />
  ) as Txt
}

export function body(text: string, x: number, y: number, props: TxtProps = {}): Txt {
  return (
    <Txt
      text={text}
      fontFamily={SANS}
      fontSize={30}
      lineHeight={44}
      fill={MUTED}
      textAlign={'left'}
      offset={[-1, 0]}
      x={x}
      y={y}
      {...props}
    />
  ) as Txt
}
