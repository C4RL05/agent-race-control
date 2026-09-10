import { makeScene2D, Node, Txt } from '@motion-canvas/2d'
import { all, createRef, delay, fadeTransition, sequence, waitFor } from '@motion-canvas/core'
import {
  ACCENT,
  BG,
  FG,
  ICON_FONT,
  SANS,
  SETTINGS_PANEL,
  SHOTS,
  crop,
  eyebrow,
  frame,
  headline,
  reveal
} from '../lib'

// Beat 7 — the settings panel and the session menu, stacked like two open
// surfaces, beside the four adjustments worth naming. Every glyph here is a
// Material Symbols ligature the app itself already draws.
const KNOBS = [
  { icon: 'palette', text: 'Themes, fonts, status detection' },
  { icon: 'archive', text: 'File a row away without closing it' },
  { icon: 'search', text: 'Ctrl + wheel zooms one pane' },
  { icon: 'restart_alt', text: 'Relaunch a session in place' }
]

export default makeScene2D(function* (view) {
  view.fill(BG)

  const COL = 130
  const settings = crop(SHOTS.settings, SETTINGS_PANEL, 0.95, -620, 0)
  const menu = frame(SHOTS.sessionMenu, 1, -200, 120)
  const brow = eyebrow('MADE YOURS', COL, -282)
  const head = headline('Set it up\nthe way you work.', COL, -182)

  view.add(settings)
  view.add(menu)
  view.add(brow)
  view.add(head)

  const rows = KNOBS.map((knob, i) => {
    const row = createRef<Node>()
    view.add(
      <Node ref={row} y={-12 + i * 72}>
        <Txt
          text={knob.icon}
          fontFamily={ICON_FONT}
          fontSize={30}
          fill={ACCENT}
          offset={[-1, 0]}
          x={COL}
        />
        <Txt
          text={knob.text}
          fontFamily={SANS}
          fontSize={29}
          fill={FG}
          offset={[-1, 0]}
          x={COL + 52}
        />
      </Node>
    )
    return row() as Node
  })

  const inSettings = reveal(settings, 28)
  const inMenu = reveal(menu, 24)
  const inBrow = reveal(brow, 20)
  const inHead = reveal(head, 28)
  const inRows = rows.map((row) => reveal(row, 20))

  yield* fadeTransition(0.3)
  yield* all(inSettings.in(0.7), inBrow.in(0.5), delay(0.1, inHead.in(0.78)))
  yield* all(sequence(0.16, ...inRows.map((row) => row.in(0.5))), delay(0.3, inMenu.in(0.55)))
  yield* waitFor(4.45)
  yield* all(
    inSettings.out(0.4),
    inMenu.out(0.35),
    inBrow.out(0.32),
    inHead.out(0.35),
    ...inRows.map((row) => row.out(0.3))
  )
})
