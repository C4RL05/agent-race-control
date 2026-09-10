import { makeScene2D, Txt } from '@motion-canvas/2d'
import { all, createRef, delay, easeOutExpo, easeOutQuint, waitFor } from '@motion-canvas/core'
import { BG, DISPLAY, MONO, MUTED, appIcon, rise } from '../lib'

// Beat 1 — the name. The icon settles, the wordmark climbs out of its mask
// with its tracking closing behind it, and the line under it says what it
// is. No rule between the two: the wordmark is the graphic here, and a bar
// across the middle of a title card is furniture, not hierarchy.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const title = rise(
    {
      text: 'agent race control',
      fontFamily: DISPLAY,
      fontSize: 104,
      fontWeight: 700,
      letterSpacing: 14
    },
    { width: 1520, height: 150, y: 50 }
  )
  const sub = createRef<Txt>()
  const icon = appIcon(208)
  icon.position([0, -180])
  icon.scale(0.82)
  icon.opacity(0)

  view.add(icon)
  view.add(title.node)
  view.add(
    <Txt
      ref={sub}
      text={'One window for every coding-agent session on Windows'}
      fontFamily={MONO}
      fontSize={32}
      fill={MUTED}
      y={180}
      opacity={0}
    />
  )

  yield* all(
    icon.opacity(1, 0.5),
    icon.scale(1, 0.7, easeOutQuint),
    delay(0.15, title.in(0.85)),
    delay(0.15, title.txt().letterSpacing(2, 1.1, easeOutExpo)),
    delay(0.6, sub().opacity(1, 0.6))
  )
  yield* waitFor(1.7)
  yield* all(title.out(0.4), icon.opacity(0, 0.4), sub().opacity(0, 0.35))
})
