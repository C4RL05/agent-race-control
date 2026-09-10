import { makeScene2D, Node, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeOutQuint,
  fadeTransition,
  sequence,
  waitFor
} from '@motion-canvas/core'
import { BG, FG, MUTED, SANS, SHOTS, body, eyebrow, frame, headline, mark, reveal } from '../lib'

// Beat 2 — the tower itself. The hero shot arrives on the right; the left
// column names the three kinds of row it can hold, each with the mark the
// app draws for it.
const TYPES = [
  { kind: 'claude' as const, name: 'Claude Code', note: 'hooked, resumable' },
  { kind: 'codex' as const, name: 'Codex', note: 'resumed by rollout id' },
  { kind: 'shell' as const, name: 'Git Bash', note: 'just a shell' }
]

export default makeScene2D(function* (view) {
  view.fill(BG)

  const COL = -900
  // x is set by the margin the frame must keep at the far edge once the
  // push below has grown it, not by centring it in the space left over.
  const shot = frame(SHOTS.hero, 0.8, 468, 30)
  const brow = eyebrow('THE TIMING TOWER', COL, -322)
  const head = headline('Every session.\nOne glance.', COL, -212)
  const sub = body(
    'One window, one terminal, and a list of\neverything you have running.',
    COL,
    -62
  )

  const rows = TYPES.map((type, i) => {
    const row = createRef<Node>()
    const glyph = mark(type.kind, 34, FG)
    glyph.position([-882, 0])
    view.add(
      <Node ref={row} y={42 + i * 62}>
        {glyph}
        <Txt
          text={type.name}
          fontFamily={SANS}
          fontSize={31}
          fontWeight={600}
          fill={FG}
          offset={[-1, 0]}
          x={-838}
        />
        <Txt
          text={type.note}
          fontFamily={SANS}
          fontSize={26}
          fill={MUTED}
          offset={[-1, 0]}
          x={-588}
        />
      </Node>
    )
    return row() as Node
  })

  view.add(shot)
  view.add(brow)
  view.add(head)
  view.add(sub)

  const inBrow = reveal(brow, 20)
  const inHead = reveal(head, 28)
  const inSub = reveal(sub, 22)
  const inRows = rows.map((row) => reveal(row, 20))
  shot.opacity(0).x(514).scale(0.99)

  yield* fadeTransition(0.3)
  yield* all(
    inBrow.in(0.5),
    delay(0.1, inHead.in(0.78)),
    delay(0.05, shot.opacity(1, 0.6)),
    delay(0.05, shot.x(468, 0.9, easeOutQuint)),
    delay(0.05, shot.scale(1, 0.9, easeOutQuint))
  )
  yield* sequence(0.18, inSub.in(0.55), ...inRows.map((row) => row.in(0.55)))
  // A slow push on the shot — enough drift that the frame is never static,
  // not enough to read as a move.
  yield* all(shot.scale(1.025, 5.25), waitFor(5.15))
  yield* all(
    inBrow.out(0.32),
    inHead.out(0.35),
    inSub.out(0.3),
    ...inRows.map((row) => row.out(0.3)),
    shot.opacity(0, 0.4)
  )
})
