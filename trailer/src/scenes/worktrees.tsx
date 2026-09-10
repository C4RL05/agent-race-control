import { makeScene2D, Rect, Txt } from '@motion-canvas/2d'
import { all, createRef, delay, fadeTransition, linear, waitFor } from '@motion-canvas/core'
import {
  BG,
  BORDER,
  IDLE,
  MONO,
  SHOTS,
  SURFACE,
  body,
  eyebrow,
  frame,
  headline,
  reveal
} from '../lib'

// Beat 6 — the worktree workflow, in the order you meet it: name one, watch
// the row appear under the repo card, come back to a parked one later. All
// three shots share ONE slot and crossfade in place, so the cuts read as the
// same card changing rather than as three different pictures — which is what
// they are: every one of them is the pitwall card.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const COL = -900
  const SLOT = { x: 520, y: -30 }
  const chip = createRef<Rect>()
  const cmd = createRef<Txt>()

  const brow = eyebrow('ONE WORKTREE PER FEATURE', COL, -322)
  const head = headline('Branch off without\nleaving the tower.', COL, -212)
  view.add(brow)
  view.add(head)
  view.add(
    <Rect
      ref={chip}
      width={620}
      height={64}
      x={COL + 310}
      y={-56}
      fill={SURFACE}
      stroke={BORDER}
      lineWidth={1.5}
      radius={12}
    >
      <Txt
        ref={cmd}
        text={''}
        fontFamily={MONO}
        fontSize={30}
        fill={IDLE}
        offset={[-1, 0]}
        x={-280}
      />
    </Rect>
  )

  const note = body(
    'Claude Code creates it and cleans it up\non /exit. The app never runs git.',
    COL,
    64,
    { fontSize: 28, lineHeight: 42 }
  )
  const legend = body('● uncommitted    ↑ ahead    ↓ behind', COL, 156, {
    fontFamily: MONO,
    fontSize: 26
  })
  view.add(note)
  view.add(legend)

  const naming = frame(SHOTS.worktreeNew, 1.5, SLOT.x, SLOT.y)
  const rows = frame(SHOTS.worktrees, 1.5, SLOT.x, SLOT.y)
  const reopen = frame(SHOTS.reopen, 1.3, SLOT.x, SLOT.y)
  const caption = body('reopen a parked worktree', SLOT.x, 212, {
    fontFamily: MONO,
    fontSize: 25,
    textAlign: 'center',
    offset: [0, 0]
  })
  view.add(naming)
  view.add(rows)
  view.add(reopen)
  view.add(caption)

  const inBrow = reveal(brow, 20)
  const inHead = reveal(head, 28)
  const inChip = reveal(chip(), 18)
  const inNote = reveal(note, 20)
  const inLegend = reveal(legend, 18)
  const inNaming = reveal(naming, 26)
  const inCaption = reveal(caption, 16)
  rows.opacity(0)
  reopen.opacity(0)

  yield* fadeTransition(0.3)
  yield* all(inBrow.in(0.5), delay(0.1, inHead.in(0.78)), delay(0.3, inChip.in(0.5)))
  yield* cmd().text('claude --worktree login-form', 1.15, linear)
  yield* all(inNaming.in(0.6), delay(0.15, inNote.in(0.55)))
  yield* waitFor(0.8)
  // The name is typed; the row it produced takes its place.
  yield* all(naming.opacity(0, 0.45), rows.opacity(1, 0.45), delay(0.25, inLegend.in(0.5)))
  yield* waitFor(1.0)
  // The same card again, with its history menu open — but this shot frames it
  // wider, so the two are CUT rather than dissolved: overlapping them ghosts
  // the pitwall card against a shifted copy of itself.
  yield* all(
    rows.opacity(0, 0.22),
    delay(0.16, reopen.opacity(1, 0.45)),
    delay(0.3, inCaption.in(0.45))
  )
  yield* waitFor(1.85)
  yield* all(
    inBrow.out(0.32),
    inHead.out(0.35),
    inChip.out(0.3),
    inNote.out(0.3),
    inLegend.out(0.3),
    reopen.opacity(0, 0.4),
    inCaption.out(0.3)
  )
})
