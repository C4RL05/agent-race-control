import { Layout, makeScene2D, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeOutQuint,
  fadeTransition,
  sequence,
  waitFor
} from '@motion-canvas/core'
import { BG, DISPLAY, FG, MONO, MUTED, SANS, appIcon, rise } from '../lib'

// Beat 8 — what survives a restart, then the card. The three words sit in a
// flex row so the browser measures them, not me; they arrive one at a time
// on opacity alone, which is as much motion as three words need.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const words = ['Close.', 'Reopen.', 'Resume.'].map(
    (text) =>
      (
        <Txt
          text={text}
          fontFamily={SANS}
          fontSize={88}
          fontWeight={600}
          letterSpacing={-1.5}
          fill={FG}
          opacity={0}
        />
      ) as Txt
  )
  view.add(
    <Layout layout direction={'row'} gap={46} y={-16}>
      {words}
    </Layout>
  )

  const title = rise(
    { text: 'agent race control', fontFamily: DISPLAY, fontSize: 88, fontWeight: 700 },
    { width: 1300, height: 130, y: 50 }
  )
  const url = createRef<Txt>()
  const icon = appIcon(192)
  icon.position([0, -155])
  icon.scale(0.82)
  icon.opacity(0)

  view.add(icon)
  view.add(title.node)
  view.add(
    <Txt
      ref={url}
      text={'github.com/C4RL05/agent-race-control  ·  MIT'}
      fontFamily={MONO}
      fontSize={29}
      fill={MUTED}
      y={164}
      opacity={0}
    />
  )

  yield* fadeTransition(0.3)
  yield* sequence(0.2, ...words.map((word) => word.opacity(1, 0.45)))
  yield* waitFor(0.75)
  yield* all(...words.map((word) => word.opacity(0, 0.35)))
  yield* all(
    title.in(0.7),
    icon.opacity(1, 0.55),
    icon.scale(1, 0.65, easeOutQuint),
    delay(0.4, url().opacity(1, 0.5))
  )
  yield* waitFor(1.65)
})
