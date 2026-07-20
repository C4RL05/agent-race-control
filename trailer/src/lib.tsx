import { Img, Rect, Txt, type TxtProps } from '@motion-canvas/2d'
import arcIcon from '../../src/renderer/src/assets/arc.svg'
import {
  createRef,
  easeInCubic,
  easeOutExpo,
  type ThreadGenerator
} from '@motion-canvas/core'

// The trailer's design tokens — the app's own Primer-derived palette, so the
// canvas reads as the same product the screenshots show.
export const BG = '#0d1117'
export const FG = '#f0f6fc'
export const MUTED = '#8b949e'
export const ACCENT = '#388bfd' // the app's default dir color
export const CHIP_BG = '#161b22'
export const CHIP_BORDER = '#30363d'
export const RUNNING = '#f85149'
export const WAITING = '#d29922'
export const IDLE = '#3fb950'

export const SANS = 'Inter'
export const MONO = 'JetBrains Mono'
export const DISPLAY = 'Orbitron' // the wordmark face, weight 700, lowercase
export const ICON_FONT = 'Material Symbols Outlined'

// The app icon as a node: the hand-drawn helmet SVG the app itself
// rasterizes (src/renderer/src/assets/arc.svg, reached through the same
// fs.allow reach-up as the doc screenshots) — single source of truth. Its
// background is transparent, so it floats on the canvas exactly as it
// floats on the taskbar.
export function appIcon(size = 128): Img {
  // width only — Img keeps the source aspect (the SVG viewBox isn't square)
  return (<Img src={arcIcon} width={size} />) as Img
}

// Masked-rise text — the trailer's one text transition, reused everywhere so
// the motion language stays consistent: the line rises into a clipping box
// (easeOutExpo), and exits upward through the same mask.
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
    *in(duration = 0.6) {
      yield* txt().y(0, duration, easeOutExpo)
    },
    *out(duration = 0.35) {
      yield* txt().y(-box.height, duration, easeInCubic)
    }
  }
}
