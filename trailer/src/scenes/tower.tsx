import { Circle, Img, makeScene2D, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeInCubic,
  easeOutBack,
  easeOutExpo,
  fadeTransition,
  sequence,
  waitFor
} from '@motion-canvas/core'
import { BG, FG, IDLE, MUTED, RUNNING, SANS, WAITING, rise } from '../lib'
import hero from '../../../images/arc-hero-light.png'

// Beat 2 (0:04–0:10) — the timing tower: the hero shot plus the three
// traffic lights, animated natively so the status idea moves.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const img = createRef<Img>()
  const head = rise(
    { text: 'Every session.\nOne glance.', fontSize: 76, fontWeight: 700, lineHeight: 92 },
    { width: 760, height: 210, x: -510, y: -250, align: 'left' }
  )

  const dots = [
    { color: RUNNING, label: 'running — the agent is busy' },
    { color: WAITING, label: 'waiting for you' },
    { color: IDLE, label: 'idle — your turn' }
  ].map((d, i) => {
    const dot = createRef<Circle>()
    const txt = createRef<Txt>()
    view.add(
      <>
        <Circle ref={dot} size={26} fill={d.color} x={-850} y={-40 + i * 88} scale={0} />
        <Txt
          ref={txt}
          text={d.label}
          fontFamily={SANS}
          fontSize={34}
          fill={i === 1 ? FG : MUTED}
          offset={[-1, 0]}
          x={-800}
          y={-40 + i * 88}
          opacity={0}
        />
      </>
    )
    return { dot, txt }
  })

  view.add(head.node)
  view.add(
    <Img
      ref={img}
      src={hero}
      scale={0.92}
      x={470}
      y={40}
      radius={14}
      clip
      opacity={0}
      shadowColor={'rgba(0, 0, 0, 0.65)'}
      shadowBlur={70}
      shadowOffsetY={24}
    />
  )

  yield* fadeTransition(0.35)
  yield* all(
    head.in(0.6),
    delay(0.1, img().opacity(1, 0.6)),
    delay(0.1, img().x(390, 0.75, easeOutExpo))
  )
  yield* sequence(
    0.22,
    ...dots.map(({ dot, txt }) =>
      all(dot().scale(1, 0.5, easeOutBack), txt().opacity(1, 0.4))
    )
  )
  // The amber dot pulses — the same "wants you" signal the app animates.
  yield* all(
    dots[1].dot().scale(1.25, 0.4).to(1, 0.4).wait(0.3).to(1.25, 0.4).to(1, 0.4),
    img().y(20, 1.9)
  )
  yield* waitFor(0.95)
  yield* all(
    head.out(0.4),
    img().opacity(0, 0.45, easeInCubic),
    ...dots.flatMap(({ dot, txt }) => [dot().scale(0, 0.35), txt().opacity(0, 0.3)])
  )
})
