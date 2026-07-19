import { Img, makeScene2D, Rect, Txt } from '@motion-canvas/2d'
import {
  all,
  createRef,
  delay,
  easeInCubic,
  easeOutExpo,
  fadeTransition,
  linear,
  waitFor
} from '@motion-canvas/core'
import { BG, CHIP_BG, CHIP_BORDER, FG, IDLE, MUTED, MONO, rise } from '../lib'
import worktreesShot from '../../../images/arc-worktrees-light.png'
import reopenShot from '../../../images/arc-reopen-light.png'

// Beat 4 (0:13.5–0:20) — the worktree workflow: one command, real branch
// rows with state markers, then the reopen menu.
export default makeScene2D(function* (view) {
  view.fill(BG)

  const head = rise(
    { text: 'One worktree\nper feature.', fontSize: 76, fontWeight: 700, lineHeight: 92 },
    { width: 760, height: 210, x: -510, y: -250, align: 'left' }
  )
  const chip = createRef<Rect>()
  const cmd = createRef<Txt>()
  const cap = createRef<Txt>()
  const legend = createRef<Txt>()
  const card1 = createRef<Img>()
  const card2 = createRef<Img>()

  view.add(head.node)
  view.add(
    <Rect
      ref={chip}
      width={620}
      height={68}
      x={-540}
      y={-60}
      fill={CHIP_BG}
      stroke={CHIP_BORDER}
      lineWidth={1.5}
      radius={12}
      opacity={0}
    >
      <Txt
        ref={cmd}
        text={''}
        fontFamily={MONO}
        fontSize={30}
        fill={IDLE}
        offset={[-1, 0]}
        x={-282}
      />
    </Rect>
  )
  view.add(
    <Txt
      ref={cap}
      text={'Claude Code creates it — and cleans it up on /exit.'}
      fontFamily={MONO}
      fontSize={27}
      fill={MUTED}
      offset={[-1, 0]}
      x={-850}
      y={40}
      opacity={0}
    />
  )
  view.add(
    <Img
      ref={card1}
      src={worktreesShot}
      scale={1.55}
      x={480}
      y={-60}
      radius={12}
      clip
      opacity={0}
      shadowColor={'rgba(0, 0, 0, 0.65)'}
      shadowBlur={60}
      shadowOffsetY={20}
    />
  )
  view.add(
    <Txt
      ref={legend}
      text={'●  uncommitted      ↑ ahead      ↓ behind'}
      fontFamily={MONO}
      fontSize={26}
      fill={MUTED}
      x={480}
      y={190}
      opacity={0}
    />
  )
  view.add(
    <Img
      ref={card2}
      src={reopenShot}
      scale={1.45}
      x={480}
      y={0}
      radius={12}
      clip
      opacity={0}
      shadowColor={'rgba(0, 0, 0, 0.65)'}
      shadowBlur={60}
      shadowOffsetY={20}
    />
  )

  yield* fadeTransition(0.35)
  yield* all(head.in(0.6), delay(0.15, chip().opacity(1, 0.4)))
  yield* cmd().text('> claude --worktree login-form', 1.1, linear)
  yield* all(
    card1().opacity(1, 0.6),
    card1().x(430, 0.7, easeOutExpo),
    delay(0.3, legend().opacity(1, 0.4)),
    delay(0.2, cap().opacity(1, 0.45))
  )
  yield* waitFor(1.05)
  // The second act: parked worktrees come back through the history menu.
  yield* all(
    card1().opacity(0, 0.5, easeInCubic),
    legend().opacity(0, 0.3),
    cap().opacity(0, 0.3),
    delay(0.15, card2().opacity(1, 0.6)),
    delay(0.15, card2().x(430, 0.65, easeOutExpo)),
    delay(
      0.35,
      (function* () {
        cap().text('Reopen parked worktrees anytime.')
        yield* cap().opacity(1, 0.45)
      })()
    )
  )
  yield* waitFor(1.3)
  yield* all(
    head.out(0.4),
    chip().opacity(0, 0.35),
    cap().opacity(0, 0.3),
    card2().opacity(0, 0.45, easeInCubic)
  )
})
