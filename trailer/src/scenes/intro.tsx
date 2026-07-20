import { makeScene2D, Rect, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeInCubic,
  easeOutBack,
  easeOutExpo,
  waitFor
} from '@motion-canvas/core'
import { ACCENT, BG, DISPLAY, MUTED, MONO, appIcon, rise } from '../lib'

// Beat 1 (0:00–0:04) — the name, a speed line, the one-line pitch.
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
    { width: 1520, height: 150, y: -20 }
  )
  const line = createRef<Rect>()
  const sub = createRef<Txt>()
  const icon = appIcon(211)
  icon.position([0, -240])
  icon.scale(0.6)
  icon.opacity(0)

  view.add(icon)
  view.add(title.node)
  view.add(<Rect ref={line} width={0} height={4} y={80} fill={ACCENT} radius={2} />)
  view.add(
    <Txt
      ref={sub}
      text={'a terminal cockpit for Claude Code on native Windows'}
      fontFamily={MONO}
      fontSize={34}
      fill={MUTED}
      y={160}
      opacity={0}
    />
  )

  yield* waitFor(0.2)
  yield* all(
    icon.opacity(1, 0.45),
    icon.scale(1, 0.6, easeOutBack),
    line().width(620, 0.6, easeOutExpo),
    delay(0.15, title.in(0.7)),
    delay(0.15, title.txt().letterSpacing(2, 0.9, easeOutExpo)),
    delay(0.5, sub().opacity(1, 0.5))
  )
  yield* waitFor(2.3)
  yield* all(
    title.out(0.4),
    icon.opacity(0, 0.4),
    line().width(0, 0.45, easeInCubic),
    sub().opacity(0, 0.35)
  )
})
