import { makeScene2D, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  fadeTransition,
  linear,
  waitFor
} from '@motion-canvas/core'
import { BG, MUTED, MONO, SANS, rise } from '../lib'

// Beat 3 (0:10–0:13.5) — the ethos, stated plainly on an empty canvas.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const head = rise(
    { text: 'Full-fidelity Claude Code.', fontSize: 72, fontWeight: 700 },
    { width: 1200, height: 100, y: -90 }
  )
  const mono = createRef<Txt>()
  const sub = createRef<Txt>()

  view.add(head.node)
  view.add(
    <Txt ref={mono} text={''} fontFamily={MONO} fontSize={34} fill={MUTED} y={10} />
  )
  view.add(
    <Txt
      ref={sub}
      text={'If it works in Windows Terminal, it works here.'}
      fontFamily={SANS}
      fontSize={36}
      fill={MUTED}
      y={110}
      opacity={0}
    />
  )

  yield* fadeTransition(0.35)
  yield* head.in(0.55)
  yield* all(
    mono().text('no wrapper · no SDK · the real CLI in a real ConPTY', 1.0, linear),
    sub().opacity(1, 0.5)
  )
  yield* waitFor(1.2)
  yield* all(head.out(0.4), mono().opacity(0, 0.35), sub().opacity(0, 0.35))
})
