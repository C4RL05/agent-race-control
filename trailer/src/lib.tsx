import { Rect, Txt, type TxtProps } from '@motion-canvas/2d'
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
export const ICON_FONT = 'Material Symbols Outlined'

// The app icon as a node: the sports_motorsports glyph, white on a black
// rounded tile — the same drawing scripts/make-icon.mjs bakes into icon.ico.
export function appIcon(size = 128): Rect {
  return (
    <Rect
      width={size}
      height={size}
      fill={'#010409'}
      stroke={CHIP_BORDER}
      lineWidth={1.5}
      radius={size * 0.22}
    >
      <Txt
        text={'sports_motorsports'}
        fontFamily={ICON_FONT}
        fontWeight={300}
        fontSize={size * 0.68}
        fill={FG}
      />
    </Rect>
  ) as Rect
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
