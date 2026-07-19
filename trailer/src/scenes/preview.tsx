import { Img, makeScene2D, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeInCubic,
  easeOutExpo,
  fadeTransition,
  waitFor
} from '@motion-canvas/core'
import { ACCENT, BG, MUTED, SANS, rise } from '../lib'
import previewShot from '../../../images/arc-preview-light.png'

// Beat 5 (0:20–0:24) — the read-only conversation preview.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const img = createRef<Img>()
  const line1 = rise(
    { text: 'Read the conversation,', fontSize: 68, fontWeight: 700 },
    { width: 800, height: 95, x: 490, y: -240, align: 'left' }
  )
  const line2 = rise(
    { text: 'not the scrollback.', fontSize: 68, fontWeight: 700, fill: ACCENT },
    { width: 800, height: 95, x: 490, y: -150, align: 'left' }
  )
  const sub = createRef<Txt>()

  view.add(
    <Img
      ref={img}
      src={previewShot}
      scale={0.84}
      x={-580}
      y={40}
      radius={14}
      clip
      opacity={0}
      shadowColor={'rgba(0, 0, 0, 0.65)'}
      shadowBlur={70}
      shadowOffsetY={24}
    />
  )
  view.add(line1.node)
  view.add(line2.node)
  view.add(
    <Txt
      ref={sub}
      text={'Markdown, live from the transcript\nClaude Code itself writes.'}
      fontFamily={SANS}
      fontSize={34}
      lineHeight={48}
      fill={MUTED}
      offset={[-1, 0]}
      textAlign={'left'}
      x={90}
      y={-20}
      opacity={0}
    />
  )

  yield* fadeTransition(0.35)
  yield* all(
    img().opacity(1, 0.65),
    img().x(-500, 0.75, easeOutExpo),
    delay(0.1, line1.in(0.55)),
    delay(0.35, line2.in(0.55))
  )
  yield* sub().opacity(1, 0.45)
  yield* all(img().y(20, 1.95), waitFor(1.95))
  yield* all(
    line1.out(0.35),
    line2.out(0.35),
    sub().opacity(0, 0.3),
    img().opacity(0, 0.4, easeInCubic)
  )
})
