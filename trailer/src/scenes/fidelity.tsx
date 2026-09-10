import { makeScene2D, Txt } from '@motion-canvas/2d'
import { all, createRef, delay, fadeTransition, linear, waitFor } from '@motion-canvas/core'
import { BG, MONO, MUTED, body, headline, reveal } from '../lib'

// Beat 4 — the ethos, centred and alone. No screenshot: the claim is about
// what ISN'T there, and a picture of an unmodified terminal looks like a
// picture of a terminal.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const brow = createRef<Txt>()
  const mono = createRef<Txt>()

  view.add(
    <Txt
      ref={brow}
      text={'FULL FIDELITY'}
      fontFamily={MONO}
      fontSize={21}
      fontWeight={700}
      letterSpacing={5}
      fill={MUTED}
      y={-161}
    />
  )
  const head = headline('The real CLI.\nIn a real ConPTY.', 0, -55, {
    textAlign: 'center',
    offset: [0, 0]
  })
  view.add(head)
  view.add(<Txt ref={mono} text={''} fontFamily={MONO} fontSize={30} fill={MUTED} y={77} />)
  const sub = body('If it works in Windows Terminal, it works here.', 0, 149, {
    textAlign: 'center',
    offset: [0, 0]
  })
  view.add(sub)

  const inBrow = reveal(brow(), 16)
  const inHead = reveal(head, 26)
  const inSub = reveal(sub, 18)

  yield* fadeTransition(0.3)
  yield* all(inBrow.in(0.5), delay(0.1, inHead.in(0.7)))
  yield* all(
    mono().text('no wrapper  ·  no SDK  ·  no rewritten bytes', 1.15, linear),
    delay(0.5, inSub.in(0.55))
  )
  yield* waitFor(2.75)
  yield* all(inBrow.out(0.3), inHead.out(0.35), inSub.out(0.3), mono().opacity(0, 0.3))
})
