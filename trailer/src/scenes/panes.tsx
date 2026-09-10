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
import { BG, FG, MUTED, SANS, SHOTS, body, eyebrow, frame, headline, reveal } from '../lib'

// Beat 5 — the pane tabs. The Preview shot carries the beat because it is
// the tab you cannot guess from the name; the list beside it says what the
// other three hold.
const TABS = [
  { name: 'Terminal', note: 'the unmodified CLI, live' },
  { name: 'Preview', note: 'the conversation as markdown' },
  { name: 'Session', note: 'every fact about the run' },
  { name: 'Notes', note: 'a scratchpad that persists' }
]

export default makeScene2D(function* (view) {
  view.fill(BG)

  const COL = 90
  // Mirrors the tower's framing: far edge first, position second.
  const shot = frame(SHOTS.preview, 0.8, -468, 30)
  const brow = eyebrow('FOUR VIEWS OF ONE SESSION', COL, -305)
  const head = headline('Terminal, Preview,\nSession, Notes.', COL, -207)

  view.add(shot)
  view.add(brow)
  view.add(head)

  const rows = TABS.map((tab, i) => {
    const row = createRef<Node>()
    view.add(
      <Node ref={row} y={-15 + i * 72}>
        <Txt
          text={tab.name}
          fontFamily={SANS}
          fontSize={31}
          fontWeight={600}
          fill={FG}
          offset={[-1, 0]}
          x={COL}
        />
        <Txt
          text={tab.note}
          fontFamily={SANS}
          fontSize={27}
          fill={MUTED}
          offset={[-1, 0]}
          x={COL + 230}
        />
      </Node>
    )
    return row() as Node
  })

  const note = body(
    'Diffs come out coloured, and every file the\nsession writes folds into a tab of its own.',
    COL,
    283,
    { fontSize: 28, lineHeight: 42 }
  )
  view.add(note)

  const inBrow = reveal(brow, 20)
  const inHead = reveal(head, 28)
  const inRows = rows.map((row) => reveal(row, 20))
  const inNote = reveal(note, 20)
  shot.opacity(0).x(-514).scale(0.99)

  yield* fadeTransition(0.3)
  yield* all(
    inBrow.in(0.5),
    delay(0.1, inHead.in(0.78)),
    delay(0.05, shot.opacity(1, 0.6)),
    delay(0.05, shot.x(-468, 0.9, easeOutQuint)),
    delay(0.05, shot.scale(1, 0.9, easeOutQuint))
  )
  yield* sequence(0.16, ...inRows.map((row) => row.in(0.5)))
  yield* inNote.in(0.5)
  yield* all(shot.scale(1.025, 6.25), waitFor(6.15))
  yield* all(
    inBrow.out(0.32),
    inHead.out(0.35),
    ...inRows.map((row) => row.out(0.3)),
    inNote.out(0.3),
    shot.opacity(0, 0.4)
  )
})
