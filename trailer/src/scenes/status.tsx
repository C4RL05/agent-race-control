import { Circle, makeScene2D, Node, Rect, Txt } from '@motion-canvas/2d'
import { all, createRef, delay, fadeTransition, waitFor } from '@motion-canvas/core'
import {
  ACCENT,
  BG,
  BORDER,
  FG,
  IDLE,
  MUTED,
  RUNNING,
  SANS,
  SURFACE,
  WAITING,
  body,
  eyebrow,
  headline,
  mark,
  reveal
} from '../lib'

// Beat 3 — the status dot. The card here is DRAWN, not screenshotted: the
// point of the beat is the colour changing, and a still frame cannot show
// that. Same geometry, same palette, same three rows as the hero shot.
const ROWS = [
  { kind: 'claude' as const, title: 'F1 dry tyre compounds', start: IDLE },
  { kind: 'claude' as const, title: 'Refactor the spawn flow', start: IDLE },
  { kind: 'shell' as const, title: 'dev server', start: '#6e7681' }
]

// Each claim carries the dot it is about, hung in the margin to the left of
// the text — naming a colour in words and then not showing it is the one
// thing this beat cannot afford.
const CLAIMS = [
  { color: RUNNING, text: 'Red is working.' },
  { color: WAITING, text: 'Amber wants you.' },
  { color: IDLE, text: 'Green is your turn.' }
]

export default makeScene2D(function* (view) {
  view.fill(BG)

  const COL = 150
  const card = createRef<Rect>()
  const dots = ROWS.map(() => createRef<Circle>())

  view.add(
    <Rect
      ref={card}
      width={560}
      height={316}
      x={-430}
      y={55}
      radius={12}
      clip
      fill={SURFACE}
      stroke={BORDER}
      lineWidth={1.5}
      shadowColor={'rgba(0, 0, 0, 0.7)'}
      shadowBlur={70}
      shadowOffsetY={26}
    >
      <Rect width={4} height={316} x={-278} fill={ACCENT} />
      <Txt
        text={'agent-race-control'}
        fontFamily={SANS}
        fontSize={27}
        fontWeight={700}
        fill={FG}
        offset={[-1, 0]}
        x={-252}
        y={-110}
      />
    </Rect>
  )

  card().add(
    ROWS.map((row, i) => {
      const y = -34 + i * 66
      const glyph = mark(row.kind, 22, MUTED)
      glyph.position([-210, y])
      return (
        <Node>
          <Circle ref={dots[i]} size={14} fill={row.start} x={-244} y={y} />
          {glyph}
          <Txt
            text={row.title}
            fontFamily={SANS}
            fontSize={26}
            fill={FG}
            offset={[-1, 0]}
            x={-182}
            y={y}
          />
        </Node>
      )
    })
  )

  const brow = eyebrow('STATUS, NOT GUESSWORK', COL, -207)
  const claims = CLAIMS.map((claim, i) => {
    const group = createRef<Node>()
    view.add(
      <Node ref={group} y={-105 + i * 66}>
        <Circle size={26} fill={claim.color} x={COL - 36} />
        {headline(claim.text, COL, 0, { fontSize: 52, lineHeight: 62 })}
      </Node>
    )
    return group() as Node
  })
  const note = body(
    'Turn-boundary hooks decide the colour.\nAn agent poll keeps it honest.\nA Codex row reads its own screen.',
    COL,
    137,
    { fontSize: 28, lineHeight: 42 }
  )

  view.add(brow)
  view.add(note)

  const inCard = reveal(card(), 26)
  const inBrow = reveal(brow, 20)
  const inClaims = claims.map((claim) => reveal(claim, 22))
  const inNote = reveal(note, 20)

  yield* fadeTransition(0.3)
  yield* all(inCard.in(0.7), delay(0.1, inBrow.in(0.5)))
  // Each claim lands with the row it describes changing under it.
  yield* all(inClaims[0].in(0.5), dots[0]().fill(RUNNING, 0.4))
  yield* waitFor(0.75)
  yield* all(inClaims[1].in(0.5), dots[1]().fill(WAITING, 0.4))
  yield* waitFor(0.75)
  yield* all(inClaims[2].in(0.5), dots[0]().fill(IDLE, 0.4))
  yield* waitFor(0.75)
  yield* all(
    inNote.in(0.55),
    // Amber is the one state the app animates, so it animates here too.
    dots[1]().scale(1.35, 0.38).to(1, 0.38)
  )
  yield* waitFor(2.5)
  yield* all(
    inCard.out(0.4),
    inBrow.out(0.32),
    ...inClaims.map((claim) => claim.out(0.32)),
    inNote.out(0.3)
  )
})
