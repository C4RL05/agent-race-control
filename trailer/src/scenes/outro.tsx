import { makeScene2D, Rect, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeOutBack,
  easeOutExpo,
  fadeTransition,
  waitFor
} from '@motion-canvas/core'
import { ACCENT, BG, DISPLAY, MUTED, MONO, appIcon, rise } from '../lib'

// Beat 6 (0:24–0:30) — three kinetic words, then the card: name, line, repo.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const words = ['Close.', 'Reopen.', 'Resume.'].map((w) =>
    rise({ text: w, fontSize: 120, fontWeight: 700 }, { width: 900, height: 160 })
  )
  const title = rise(
    { text: 'agent race control', fontFamily: DISPLAY, fontSize: 88, fontWeight: 700 },
    { width: 1300, height: 130, y: -10 }
  )
  const line = createRef<Rect>()
  const url = createRef<Txt>()
  const icon = appIcon(192)
  icon.position([0, -210])
  icon.scale(0.6)
  icon.opacity(0)

  for (const w of words) view.add(w.node)
  view.add(icon)
  view.add(title.node)
  view.add(<Rect ref={line} width={0} height={4} y={75} fill={ACCENT} radius={2} />)
  view.add(
    <Txt
      ref={url}
      text={'github.com/C4RL05/agent-race-control  ·  MIT'}
      fontFamily={MONO}
      fontSize={30}
      fill={MUTED}
      y={145}
      opacity={0}
    />
  )

  yield* fadeTransition(0.3)
  yield* words[0].in(0.4)
  yield* waitFor(0.35)
  yield* words[0].out(0.28)
  yield* words[1].in(0.4)
  yield* waitFor(0.35)
  yield* words[1].out(0.28)
  yield* words[2].in(0.4)
  yield* waitFor(0.4)
  yield* words[2].out(0.3)
  yield* all(
    title.in(0.6),
    icon.opacity(1, 0.45),
    icon.scale(1, 0.6, easeOutBack),
    delay(0.1, line().width(560, 0.5, easeOutExpo)),
    delay(0.35, url().opacity(1, 0.45))
  )
  yield* waitFor(2.3)
})
