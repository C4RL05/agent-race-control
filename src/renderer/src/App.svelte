<script lang="ts">
  // The three session-type icons, inlined as geometry rather than added as
  // dependencies: three icon packages alongside Material Symbols is not a
  // trade three glyphs earn. Everything else in the app stays Material.
  //
  // Two of the three are PRODUCT MARKS — the Claude Code mark and the OpenAI
  // symbol name their row type the way a logo does, and neither may be
  // redrawn to match a house style. The shell keeps the one drawn icon
  // (Phosphor terminal-window) and it is the piece that gives, which is why
  // it sits at the family's own REGULAR weight: it no longer has to shout to
  // hold its own beside an outlined robot, as it did when the Claude row was
  // a Lucide `bot`.
  //
  // Each entry therefore carries its own viewBox and paint mode rather than
  // assuming one grid: 24 for the Claude mark, a padded ~20 for OpenAI, 256
  // for Phosphor. `stroke` is the WIDTH, 0 meaning a filled icon — all three
  // are filled today, so nothing here is weight-matched; the sizes are
  // levelled by the FRACTION of the viewBox each glyph fills instead (see the
  // openai entry, the only one that needed padding to get there). `evenodd`
  // is per-glyph too: a mark whose notches are punched-out subpaths goes
  // solid under the default nonzero rule.
  const ICONS = {
    // The Claude Code product mark, monochrome variant (thesvg.org, from
    // glincker/thesvg `icons/claude-code/mono.svg`). A filled glyph, so it
    // takes `evenodd` — the two notches are subpaths punched out of the body,
    // and under the default nonzero rule they fill in and the mark goes solid.
    // Replaces the generic Lucide `bot` that stood in before.
    claude: {
      box: '0 0 24 24',
      stroke: 0,
      evenodd: true,
      paths: [
        'M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z'
      ]
    },
    // The OpenAI 2025 symbol (Wikimedia Commons, `OpenAI_logo_2025_(symbol).svg`)
    // — the codex row's mark, the counterpart to the Claude mark above. A
    // filled glyph like it, and like it a product mark used to name a row type.
    //
    // The source crops tight: the glyph fills its viewBox edge to edge, where
    // the Claude mark occupies 62% of its box's height and the terminal 81% of
    // its width. At a shared em size that made this one dominate the icon
    // column. Padded to ~85% by growing the viewBox around the glyph's centre
    // (10.005, 10.0) rather than by touching the path — the drawing is the
    // vendor's and stays byte-for-byte. The figure is tuned by eye against the
    // other two, not derived: it sits just above the terminal's 81%, which is
    // where it stopped looking undersized beside the Claude mark.
    openai: {
      box: '0.211 0.294 19.588 19.412',
      stroke: 0,
      evenodd: false,
      paths: [
        'M11.248 18.25q-.825 0-1.568-.314a4.3 4.3 0 0 1-1.32-.874 4 4 0 0 1-1.304.214 4 4 0 0 1-2.046-.544 4.27 4.27 0 0 1-1.518-1.485 4 4 0 0 1-.56-2.095q0-.48.131-1.04A4.4 4.4 0 0 1 2.04 10.71a4.07 4.07 0 0 1 .017-3.4 4.2 4.2 0 0 1 1.056-1.418 3.8 3.8 0 0 1 1.6-.842 3.9 3.9 0 0 1 .76-1.683q.593-.759 1.451-1.188a4.04 4.04 0 0 1 1.832-.429q.825 0 1.567.313.742.314 1.32.875a4 4 0 0 1 1.304-.215q1.106 0 2.046.545a4.14 4.14 0 0 1 1.501 1.485q.578.941.578 2.095 0 .48-.132 1.04.66.61 1.023 1.419.363.792.363 1.666 0 .892-.38 1.717a4.3 4.3 0 0 1-1.072 1.435 3.8 3.8 0 0 1-1.584.825 3.8 3.8 0 0 1-.775 1.683 4.06 4.06 0 0 1-1.436 1.188 4.04 4.04 0 0 1-1.832.429m-4.076-2.062q.825 0 1.435-.347l3.103-1.782a.36.36 0 0 0 .164-.313v-1.42L7.881 14.62a.67.67 0 0 1-.726 0l-3.118-1.798a.5.5 0 0 1-.017.115v.198q0 .841.396 1.551.413.693 1.139 1.089a3.2 3.2 0 0 0 1.617.412m.165-2.69a.4.4 0 0 0 .181.05q.083 0 .165-.05l1.238-.71-3.977-2.31a.7.7 0 0 1-.363-.643v-3.58q-.825.362-1.32 1.122a2.9 2.9 0 0 0-.495 1.65q0 .809.413 1.55.412.743 1.072 1.123zm3.91 3.663q.875 0 1.585-.396a2.96 2.96 0 0 0 1.534-2.64v-3.564a.32.32 0 0 0-.165-.297l-1.254-.726v4.604a.7.7 0 0 1-.363.643l-3.119 1.799a3 3 0 0 0 1.783.577m.627-6.039V8.878L10.01 7.822 8.129 8.878v2.244l1.881 1.056zM7.057 5.859a.7.7 0 0 1 .363-.644l3.119-1.798a3 3 0 0 0-1.782-.578q-.874 0-1.584.396A2.96 2.96 0 0 0 6.05 4.324a3.07 3.07 0 0 0-.396 1.551v3.547q0 .199.165.314l1.237.726zm8.383 7.887q.825-.364 1.303-1.123.495-.758.495-1.65a3.15 3.15 0 0 0-.412-1.55q-.413-.743-1.073-1.123l-3.086-1.782q-.099-.065-.181-.049a.3.3 0 0 0-.165.05l-1.238.692 3.993 2.327a.6.6 0 0 1 .264.264.64.64 0 0 1 .1.363zm-3.317-8.382a.63.63 0 0 1 .726 0l3.135 1.831v-.297q0-.792-.396-1.501a2.86 2.86 0 0 0-1.105-1.155q-.71-.43-1.65-.43-.825 0-1.436.347L8.294 5.941a.36.36 0 0 0-.165.314v1.418z'
      ]
    },
    // Phosphor `terminal-window`, REGULAR weight (MIT, @phosphor-icons/core
    // 2.1.1). It was bold to sit level with the old outlined `bot`; the two
    // agent marks either side of it are now solid product glyphs, so the
    // shell no longer has to shout to keep up — regular is the family's own
    // default and reads level against them.
    'terminal-window': {
      box: '0 0 256 256',
      stroke: 0,
      evenodd: false,
      paths: [
        'M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z'
      ]
    }
  }

  import Terminal from './Terminal.svelte'
  import Preview from './Preview.svelte'
  import Info from './Info.svelte'
  import Notes from './Notes.svelte'
  import { palettes } from './theme'
  import type { Chrome, Mode } from './theme'
  import {
    sessions,
    dirOrder,
    ui,
    newSession,
    closeSession,
    applyAgents,
    applyHook,
    nudgeStatusFromKey,
    restoreState,
    snapshotState,
    cleanTitle,
    towerTitle,
    glyphLead,
    duplicateSession,
    traitsOf,
    applyDiscoveredSession,
    type SessionType,
    relaunchSession,
    finishRelaunch,
    applyScreen,
    renameSession,
    applySpawnCwd,
    applyPreviewItems,
    dirColors,
    recentDirs,
    setGroupColor,
    applyFolderColor,
    moveGroup,
    moveSession,
    setStatus,
    toggleTodo,
    setArchived,
    expandedArchives,
    toggleArchive,
    gitInfo,
    groupCwds,
    groupKeyOf,
    refreshAllGitInfo,
    collapsedGroups,
    toggleCollapsed,
    parkedWorktrees,
    worktreeSpawnName,
    sessionTargetCwd,
    bumpPaneZoom,
    resetPaneZoom,
    zoomFactor
  } from './sessions.svelte'
  import type { Session, WorktreeEntry, ZoomPane } from './sessions.svelte'
  import { DOT_COLORS, FONTS, UI_FONTS, chromeVars, fontStack } from './theme'
  import arcIconPng from './assets/arc.png?inline'

  // One menu at a time, one scaffold (backdrop + positioned panel + Escape)
  // for all five. spawn: the filter bar's per-type dropdowns — recent
  // directories plus Browse…; sessions in a live directory spawn from the
  // group header's hover cluster instead. type-filter: the filter box's
  // session-type dropdown. color: right-click a group header.
  // session: right-click a session row. worktrees: the repo card's reopen
  // menu — parked worktrees fetched on click, items carried in the menu.
  type Menu =
    | { kind: 'spawn'; type: SessionType; x: number; y: number }
    | { kind: 'color'; dir: string; x: number; y: number }
    | { kind: 'session'; key: number; x: number; y: number }
    | { kind: 'type-filter'; x: number; y: number }
    | { kind: 'worktrees'; repoRoot: string; items: WorktreeEntry[]; x: number; y: number }
  let menu = $state<Menu | null>(null)
  let settingsOpen = $state(false)

  // Clamp y so no menu opens off the bottom edge — the per-menu copies of
  // this had drifted (spawn menus never clamped). height ≈ panel pixels.
  function openMenu(next: Menu, height: number): void {
    // Clamp within the viewport (8px margins).
    menu = { ...next, y: Math.max(8, Math.min(next.y, window.innerHeight - height)) }
  }

  function dirLabel(dir: string): { base: string; parent: string } {
    const parts = dir.split(/[\\/]/).filter(Boolean)
    return { base: parts.pop() ?? dir, parent: parts.join('\\') }
  }

  let draggingTower = $state(false)

  function towerDrag(event: PointerEvent): void {
    if (!draggingTower) return
    ui.towerWidth = Math.min(480, Math.max(160, Math.round(event.clientX)))
  }

  // Ctrl+wheel sizes the ONE pane under the pointer (paneZoom in the store).
  // Bound in the capture phase because the terminal and the scrolling panes
  // already own the wheel: stopping it on the way down is what keeps a zoom
  // gesture from also scrolling whatever it was aimed at. preventDefault stops
  // Chromium's own ctrl+wheel page zoom, which would fight the window zoom
  // main owns. A wheel with any other modifier is left entirely alone.
  function zoomWheel(pane: ZoomPane, event: WheelEvent): void {
    if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    if (event.deltaY !== 0) bumpPaneZoom(pane, event.deltaY < 0 ? 1 : -1)
  }

  // Ctrl+=/−/0 (main's window zoom) puts every pane back in lockstep with it.
  $effect(() => {
    const off = window.arc.zoom.onSync(resetPaneZoom)
    return off
  })

  const MODES: Mode[] = ['system', 'light', 'dark']
  const MODE_LABELS: Record<Mode, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark'
  }
  // Segment glyphs for the theme control. Names verified present in the
  // shipped woff2, not just in the package's name list (see the CLAUDE.md
  // gotcha — the two disagree in both directions).
  const MODE_ICONS: Record<Mode, string> = {
    system: 'brightness_auto',
    light: 'light_mode',
    dark: 'dark_mode'
  }

  // The three card controls (2026-09-11). Two washes — how much of the group's
  // colour the selected card carries, and how much the rest do — off one list
  // of steps, plus the edge that marks an unselected card.
  // `id`, not `value`, so these read as the same kind of list as CARD_EDGES and
  // STATUS_SOURCES and the one segRow snippet can render all four.
  const CARD_WASHES: { id: 0.1 | 0.5 | 1; label: string }[] = [
    { id: 0.1, label: '10%' },
    { id: 0.5, label: '50%' },
    { id: 1, label: '100%' }
  ]
  // The unselected cards get one step the selected card doesn't: no background
  // at all. `background: none` and a 0% mix are not the same thing on light,
  // where bgSubtle is a shade off the canvas — this is the transparent one.
  const CARD_WASHES_REST: { id: 0 | 0.1 | 0.5 | 1; label: string }[] = [
    { id: 0, label: 'None' },
    ...CARD_WASHES
  ]
  const CARD_EDGES: { id: 'tab' | 'outline' | 'none'; label: string }[] = [
    { id: 'tab', label: 'Tab' },
    { id: 'outline', label: 'Outline' },
    { id: 'none', label: 'None' }
  ]

  // Which font row in Settings is unfolded, or null. One value, not a flag per
  // row: opening one closes the others, so the panel keeps its height.
  let openFont = $state<string | null>(null)

  // Where the panel has been dragged to, in viewport px, or null for "centred".
  // Deliberately NOT persisted and reset on every close: the panel opens in the
  // middle of the window every time, so it can never be hunted for in a corner
  // you left it in, and moving it is a gesture for right now — get it off the
  // row you're watching — rather than a preference.
  let settingsPos = $state<{ x: number; y: number } | null>(null)

  // Closing the panel folds whatever was open, so reopening it never starts
  // mid-gesture on a list you left behind — and drops it back to centre.
  $effect(() => {
    if (!settingsOpen) {
      openFont = null
      settingsPos = null
    }
  })

  // Drag the panel by its header. Window listeners rather than pointer capture:
  // the pointer leaves the header constantly during a drag, and capture on a
  // div that also holds the close button is more to unpick than it's worth.
  function dragSettings(e: PointerEvent): void {
    if (e.button !== 0) return
    const header = e.currentTarget as HTMLElement
    // The close button is in the header; a click on it is not a drag.
    if ((e.target as HTMLElement).closest('button')) return
    const panel = header.parentElement as HTMLElement
    const rect = panel.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    // Clamped to the window: a header dragged past the edge is a panel you can
    // no longer grab (or close by hand). Both bounds are read ONCE here with
    // the rect — `innerWidth`/`innerHeight` force a layout flush, and inside
    // the move handler that is one per frame for the length of the drag.
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height
    const move = (m: PointerEvent): void => {
      settingsPos = {
        x: Math.min(Math.max(m.clientX - dx, 0), maxX),
        y: Math.min(Math.max(m.clientY - dy, 0), maxY)
      }
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Which technique colours the status dot. One at a time — see screen.ts.
  const STATUS_SOURCES = [
    {
      id: 'hooks' as const,
      label: 'Hooks + poll',
      hint: 'Turn-boundary hooks decide red and amber; the agent poll is a green floor.'
    },
    {
      id: 'screen' as const,
      label: 'Screen',
      hint: "Reads the session's own screen — the spinner, the prompt box, an open dialog."
    }
  ]

  let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches)

  $effect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => {
      systemDark = event.matches
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  // Turn boundaries (hooks) — these are what colour the dot red/amber.
  $effect(() => {
    const off = window.arc.status.onChange(applyHook)
    return off
  })

  // Polled session state, used ONLY as the green floor: a tick reporting idle
  // means nothing at all is running, which is the one thing hooks can miss
  // (interrupts fire no hook). busy/waiting are ignored — see applyAgents.
  $effect(() => {
    const off = window.arc.agents.onUpdate(applyAgents)
    return off
  })

  // Preview item stream (main's transcript tails → per-session store cache).
  // Routed here, once — Preview components are pure views of the cache, so
  // items landing while no preview is mounted are never lost.
  $effect(() => {
    const off = window.arc.transcript.onItems(applyPreviewItems)
    return off
  })

  // Re-read every cwd's branch/worktree when the window regains focus, so a
  // `git checkout` done in a shell (or another app) updates the tree (issue
  // #5). Cheap and fs-watch-free — the tree is only ever this-stale on focus.
  $effect(() => {
    const onFocus = (): void => refreshAllGitInfo()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  })

  // Window/taskbar icon: the 16×16 pixel-art PNG (assets/arc.png, `?inline`
  // forces Vite to hand us a data URL), scaled fresh at every DPI size
  // Windows may ask for — with smoothing OFF, so nearest neighbour keeps the
  // pixels crisp squares. scripts/make-icon.mjs bakes the SAME file into
  // build/icon.ico — one source, zero drift. The sprite is deliberately
  // opaque (solid #ff9747 ground). A data URL never taints the canvas
  // (a file:// asset in the packaged build would) — which is why the CSP
  // carries `img-src data:`.
  $effect(() => {
    const img = new Image()
    img.src = arcIconPng
    const render = (): void => {
      // base DIP size 32; scaleFactor n => 32n pixels
      const representations = [0.5, 1, 1.25, 1.5, 2, 4, 8].map((scaleFactor) => {
        const size = Math.round(32 * scaleFactor)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return { scaleFactor, dataURL: '' }
        // nearest neighbour — pixel art must not blur. The letterbox guard
        // stays from the SVG era (a no-op on this square source).
        ctx.imageSmoothingEnabled = false
        const iw = img.naturalWidth || 1
        const ih = img.naturalHeight || 1
        const fit = Math.min(size / iw, size / ih)
        const w = iw * fit
        const h = ih * fit
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        return { scaleFactor, dataURL: canvas.toDataURL('image/png') }
      })
      window.arc.setAppIcon(representations.filter((r) => r.dataURL))
    }
    img
      .decode()
      .then(render)
      .catch((err: unknown) => console.error('app icon rasterization failed:', err))
  })

  // Restore persisted sessions/mode once at boot; persist on any change after.
  let restored = $state(false)
  $effect(() => {
    void restoreState().finally(() => (restored = true))
  })

  $effect(() => {
    const snapshot = snapshotState()
    if (restored) window.arc.state.save(snapshot)
  })

  const effective = $derived(ui.mode === 'system' ? (systemDark ? 'dark' : 'light') : ui.mode)
  const palette = $derived(palettes[effective])

  // The selected terminal-font stack — fed to every terminal (xterm option)
  // and the preview's code blocks (--mono). Changing it live-swaps all panes;
  // see Terminal's font effect for the load-before-remeasure handling.
  const monoFont = $derived(fontStack(ui.font))

  // The sans stacks (UI_FONTS): app chrome (--ui-font on .shell) and preview
  // prose. Independent settings that happen to share the same font list.
  const chromeFont = $derived(fontStack(ui.uiFont, UI_FONTS))
  const previewFont = $derived(fontStack(ui.previewFont, UI_FONTS))

  // Status-dot fills. Default: the Primer semantic tones (per theme). With the
  // Status RGB setting on: pure traffic-light RGB, identical in both themes.
  // Scoped to the dots only — the close/clear hovers keep reading --danger.
  // `todo` is the TODO-overlay blue (issue #3): the theme accent normally, pure
  // #0000FF under Status RGB (matching the pure-RGB traffic lights).
  const dotsFor = (chrome: Chrome): Record<string, string> =>
    ui.statusRgb
      ? { running: '#ff0000', waiting: '#ffaa00', idle: '#00ff00', todo: '#0000ff' }
      : {
          running: chrome.danger,
          waiting: chrome.attention,
          idle: chrome.success,
          todo: chrome.accent
        }

  const dots = $derived(dotsFor(palette.chrome))

  // Every chrome token the shell owns, from the one serialiser in theme.ts.
  // The live palette always; the DARK palette beside it under a `dark-` prefix
  // only while "Dark selected card" can actually apply, since that is the only
  // thing that reads it (the selected card re-points its own tokens at the
  // second set — see the .card.active override in the CSS) and in dark mode the
  // two sets are the same palette twice.
  const shellVars = $derived(
    ui.cardDark && effective === 'light'
      ? `${chromeVars(palette.chrome, dots)};${chromeVars(palettes.dark.chrome, dotsFor(palettes.dark.chrome), 'dark-')}`
      : chromeVars(palette.chrome, dots)
  )

  let renaming = $state<number | null>(null)

  // Bumped on every row click so the focused Terminal re-asserts keyboard
  // focus even when the focused session didn't change — a dismissed menu or a
  // chrome input otherwise kept the keyboard and "click to drive" silently
  // didn't. Transient by nature.
  let focusEpoch = $state(0)

  function focusSession(key: number): void {
    ui.focused = key
    focusEpoch++
  }

  // Repo-card "new feature" flow (worktree workflow): which repo card's title
  // is showing the inline worktree-name field, keyed like the card itself.
  let namingWorktree = $state<string | null>(null)

  // Enter spawns a Claude with --worktree, Escape/blur cancels — creating a
  // branch is a real side effect, so a stray click-away must not spawn. The
  // name is slugified to a git-friendly token (spaces → dashes; quotes and
  // backslashes dropped — they'd break refnames or the bash -c string); blank
  // lets Claude Code auto-name the worktree.
  function commitWorktree(repoRoot: string, value: string): void {
    namingWorktree = null
    const name = value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/['"\\]/g, '')
    void newSession('claude', repoRoot, name)
  }

  // Focus an inline field when it mounts: the `autofocus` attribute is not
  // honored for dynamically inserted inputs (verified empirically — the click
  // left focus on the spawn button), so focus explicitly. Used by the
  // worktree-name field AND the rename field — the latter matters doubly now
  // that row clicks re-assert terminal focus (focusSession): a rename input
  // that silently failed to take the keyboard would send the typed name
  // straight into the live session.
  function focusOnMount(node: HTMLElement): void {
    node.focus()
  }

  // The reopen menu: list the repo's parked worktrees (on disk, no rows) and
  // carry them in the menu itself — fetched fresh on every click, no cache.
  async function openWorktreeMenu(repoRoot: string, x: number, y: number): Promise<void> {
    const entries = await window.arc.git.worktrees(repoRoot)
    const items = parkedWorktrees(
      entries,
      repoRoot,
      // Target cwds, not raw ones — a worktree mid-reopen (still parked on
      // its synthetic row) must not be offered a second time.
      sessions.map(sessionTargetCwd)
    )
    openMenu({ kind: 'worktrees', repoRoot, items, x, y }, 30 * Math.max(items.length, 1) + 10)
  }

  // Reopen a parked worktree: a .claude/worktrees one goes back through
  // --worktree so Claude Code re-attaches its cleanup lifecycle
  // (probe-verified safe for committed work); any other worktree gets a plain
  // spawn in its directory.
  function reopenWorktree(repoRoot: string, path: string): void {
    const name = worktreeSpawnName(repoRoot, path)
    if (name !== null) void newSession('claude', repoRoot, name)
    else void newSession('claude', path)
  }

  // Tower filter: text matches name/title/cwd; chips narrow by session type.
  // Transient UI state — deliberately not persisted.
  let filterText = $state('')
  let filterClaude = $state(false)
  let filterShell = $state(false)
  const filterActive = $derived(filterText.trim() !== '' || filterClaude || filterShell)

  function sessionMatches(session: (typeof sessions)[number]): boolean {
    // exactly one chip on → only that type; both/neither → all types
    if (filterClaude !== filterShell) {
      if (filterClaude && session.type !== 'claude') return false
      if (filterShell && session.type !== 'shell') return false
    }
    const query = filterText.trim().toLowerCase()
    if (!query) return true
    return (
      // displayName covers the rendered 'Claude'/'Shell' fallback — what the
      // row visibly says must be findable.
      displayName(session).toLowerCase().includes(query) ||
      session.name.toLowerCase().includes(query) ||
      cleanTitle(session.title).toLowerCase().includes(query) ||
      session.cwd.toLowerCase().includes(query)
    )
  }

  function commitRename(key: number, value: string): void {
    renaming = null
    const session = sessions.find((s) => s.key === key)
    const name = value.trim()
    // Blur commits, so only act on a real change — clicking away from the
    // untouched prefill must not type /rename into a live session.
    if (session && name && name !== (session.name || cleanTitle(session.title))) {
      renameSession(key, name)
    }
  }

  // What a row is called: user label, else the session's own live name from
  // the terminal title, else the bare type. Never the folder name. towerTitle,
  // not cleanTitle — the row shows the title verbatim (Claude's spinner churn
  // included), so it says the same thing the Session tab's "Terminal title"
  // does. Only the rename prefill below still wants the name-shaped version.
  function displayName(session: (typeof sessions)[number]): string {
    return session.name || towerTitle(session.title) || traitsOf(session.type)?.label || 'Shell'
  }

  // The tower tree (issue #5). groupCwds clusters dirOrder into repos (all their
  // worktree cwds) and plain folders; here we hang each cwd's sessions (and the
  // filtered `visible` subset) off it, plus each branch's label. `repCwd` is the
  // color source — a repo's primary (first) worktree. A repo whose git info
  // hasn't landed yet renders as a plain folder until it does.
  type BranchView = {
    cwd: string
    branch: string
    worktreeName: string
    showWorktree: boolean
    // Branch-state markers (muted ● ↑n ↓n after the name — never the
    // traffic-light colors, those belong to the session dots).
    dirty: boolean
    ahead: number
    behind: number
    base: string
    sessions: Session[]
    visible: Session[]
  }

  // The row tooltip spells the markers out — the glyphs stay terse.
  function branchTitle(b: BranchView): string {
    const bits: string[] = []
    if (b.dirty) bits.push('uncommitted changes')
    if (b.ahead) bits.push(`${b.ahead} ahead`)
    if (b.behind) bits.push(`${b.behind} behind`)
    if ((b.ahead || b.behind) && b.base) bits.push(`vs ${b.base}`)
    return bits.length ? `${b.cwd}\n${bits.join(' · ')}` : b.cwd
  }
  // `archived`/`archivedVisible` are the same pair as `sessions`/`visible`, for
  // the card's archive section: every archived row in the group (a repo's span
  // ALL its branches — the archive belongs to the card, not to a branch) and
  // the subset the filter leaves. Archived rows are excluded from the branch
  // and plain lists above, so a row appears in exactly one place.
  type GroupView =
    | {
        kind: 'plain'
        key: string
        cwd: string
        repCwd: string
        sessions: Session[]
        visible: Session[]
        archived: Session[]
        archivedVisible: Session[]
      }
    | {
        kind: 'repo'
        key: string
        repoName: string
        repCwd: string
        branches: BranchView[]
        archived: Session[]
        archivedVisible: Session[]
      }

  const tower = $derived.by<GroupView[]>(() =>
    groupCwds(dirOrder, gitInfo).map((group): GroupView => {
      if (group.kind === 'plain') {
        const inDir = sessions.filter((s) => s.cwd === group.cwd && !s.archived)
        const archived = sessions.filter((s) => s.cwd === group.cwd && s.archived)
        return {
          kind: 'plain',
          key: group.key,
          cwd: group.cwd,
          repCwd: group.cwd,
          sessions: inDir,
          visible: inDir.filter(sessionMatches),
          archived,
          archivedVisible: archived.filter(sessionMatches)
        }
      }
      const branches: BranchView[] = group.cwds.map((cwd) => {
        const info = gitInfo[cwd]
        // Pending worktree spawns are pulled out of their spawn cwd's row —
        // they render on a synthetic destination row below instead.
        const inDir = sessions.filter((s) => s.cwd === cwd && !s.spawnWorktree && !s.archived)
        return {
          cwd,
          branch: info?.branch ?? '',
          worktreeName: info?.worktreeName ?? '',
          showWorktree: !!info && info.worktreeName !== info.repoName,
          dirty: info?.dirty ?? false,
          ahead: info?.ahead ?? 0,
          behind: info?.behind ?? 0,
          base: info?.base ?? '',
          sessions: inDir,
          visible: inDir.filter(sessionMatches)
        }
      })
      // A named --worktree spawn parks on its destination's branch row from
      // the start — the app's own intent (it typed the flag), not a guess:
      // the first hook payload adopts the real cwd, clears the flag, and the
      // real row takes over under the same label, appended last just like
      // this one (touchDir pushes to dirOrder's end). Auto-named spawns
      // ('' — name unknown until Claude picks it) stay on their spawn row.
      const parked = new Map<string, Session[]>()
      for (const s of sessions) {
        if (s.spawnWorktree && !s.archived && group.cwds.includes(s.cwd)) {
          parked.set(s.spawnWorktree, [...(parked.get(s.spawnWorktree) ?? []), s])
        }
      }
      for (const [name, inWt] of parked) {
        branches.push({
          cwd: `${group.key}/.claude/worktrees/${name}`,
          branch: `worktree-${name}`,
          worktreeName: name,
          showWorktree: name !== group.repoName,
          // Nothing to observe yet — a parked spawn's worktree is seconds old.
          dirty: false,
          ahead: 0,
          behind: 0,
          base: '',
          sessions: inWt,
          visible: inWt.filter(sessionMatches)
        })
      }
      const archived = sessions.filter((s) => group.cwds.includes(s.cwd) && s.archived)
      return {
        kind: 'repo',
        key: group.key,
        repoName: group.repoName,
        repCwd: group.cwds[0] ?? group.key,
        branches,
        archived,
        archivedVisible: archived.filter(sessionMatches)
      }
    })
  )

  // The aggregate status dot a collapsed card shows on its title, most-urgent
  // first: waiting (a session wants you) › a running Claude (agent driving) ›
  // delegating (its subagents are still working) ›
  // any other running (a live shell) › idle (your turn) › exited. Carries the
  // winning session's type so a lone running shell reads neutral (`plain`),
  // never red — the same per-type colours the rows use. null = no sessions.
  //
  // ARCHIVED ROWS COUNT HERE, deliberately. Excluding them is the tempting read
  // of "out of the way", but it would turn a visual feature into a behavioural
  // one: a folded card would stop telling you an archived session is blocked on
  // a permission dialog. Archiving hides a row; it does not silence it.
  //
  // It does say so, though: the winner's own archived flag rides along and the
  // dot is drawn hollow for it, exactly as that row's own dot would be. So a
  // folded card still shouts amber for a blocked archived session, while the
  // ring says where to look for it — otherwise you unfold the card and find
  // every visible row calm.
  // Every row a card shows, live and archived, in one list — the two shapes a
  // group comes in (a plain folder's flat list, a repo's branches) reconciled
  // in ONE place. Both readers below want exactly this, and a third group kind
  // would otherwise have to be remembered in each of them.
  function groupSessions(group: GroupView): Session[] {
    const live = group.kind === 'plain' ? group.sessions : group.branches.flatMap((b) => b.sessions)
    return [...live, ...group.archived]
  }

  // The card holding the focused session (2026-09-11): one card at a time wears
  // its colour at `--card-wash` while the rest sit at `--card-wash-rest`, so
  // "which repo am I in" reads from across the room. Archived rows count, as
  // above — the focused row can be an archived one.
  function hasFocused(group: GroupView): boolean {
    return groupSessions(group).some((s) => s.key === ui.focused)
  }

  function rollupDot(
    group: GroupView
  ): { status: Session['status']; plain: boolean; archived: boolean } | null {
    const all = groupSessions(group)
    const pick =
      all.find((s) => s.status === 'waiting') ??
      all.find((s) => s.status === 'running' && s.type === 'claude') ??
      all.find((s) => s.status === 'delegating') ??
      all.find((s) => s.status === 'running') ??
      all.find((s) => s.status === 'idle') ??
      all.find((s) => s.status === 'exited')
    return pick
      ? { status: pick.status, plain: pick.type === 'shell', archived: pick.archived }
      : null
  }

  // --- drag & drop (same-window; component state, not dataTransfer) ---
  // Whole group cards (repo or plain folder) reorder against each other, moving
  // the whole group's cwd block — the card is the drag handle, so grabbing
  // anywhere on it that isn't a session row moves it. Sessions reorder within
  // their own cwd only (a session's directory is a fact); their row stops
  // dragstart from bubbling so a reorder doesn't become a card move. Branch
  // subfolders aren't independently draggable — they order by first appearance.
  //
  // A session drag also crosses the card's archive divider in both directions,
  // which is the drag half of archiving: onto a row in the other section to
  // choose the position, onto the divider itself to take that section's near
  // end. The drag carries its group key and archived flag so both targets can
  // judge a drop without going back to the store for the row.
  type Drag =
    | { kind: 'session'; key: number; cwd: string; groupKey: string; archived: boolean }
    | { kind: 'group'; groupKey: string }
  let dragging = $state<Drag | null>(null)
  // The drop preview. Sessions: `session-<key>` (the row highlights). Groups: an
  // insertion line at a gap — `group-before-<key>` (line above that card) or
  // `group-after-<key>` (line below it), so you see where the card will land.
  // Archive dividers: `archive-<group key>` — the divider itself lights up.
  let dropHint = $state<string | null>(null)

  function allowDrop(event: DragEvent, hint: string, accept: boolean): void {
    if (!accept) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    dropHint = hint
  }

  function endDrag(): void {
    dragging = null
    dropHint = null
  }

  function dropOnSession(target: { key: number }): void {
    if (dragging?.kind === 'session') moveSession(dragging.key, target.key)
    endDrag()
  }

  // Whether a row being dragged may land on this one. Never itself, never
  // another card. Beyond that the store's rule decides and this only mirrors
  // it so the highlight never promises a move that won't happen: an ARCHIVED
  // target takes any row of the card (the archive is one flat list), a live
  // target only a row of its own directory (live rows are drawn per branch).
  function acceptsRow(target: Session): boolean {
    return (
      dragging?.kind === 'session' &&
      dragging.key !== target.key &&
      dragging.groupKey === groupKeyOf(target.cwd) &&
      (target.archived || dragging.cwd === target.cwd)
    )
  }

  // The divider is the boundary, so dropping a row on it means "cross" —
  // whichever side the row is on, it ends up on the other, at that section's
  // near end (setArchived). It is the only target that works when the far side
  // is empty, which is why the divider shows itself for the length of a drag
  // inside a card that has no archive yet (see archiveOpenFor).
  function dropOnArchive(): void {
    if (dragging?.kind === 'session') setArchived(dragging.key, !dragging.archived)
    endDrag()
  }

  // Reveal an empty card's divider while one of its own rows is in flight.
  function archiveOpenFor(groupKey: string): boolean {
    return dragging?.kind === 'session' && dragging.groupKey === groupKey
  }

  // Which gap the pointer is over a card: the top half means "insert before this
  // card", the bottom half "insert after it". moveGroup only knows "before key
  // X", so after-a-card is expressed as before the next visible card — and the
  // DOM is the source of visible order (hidden groups aren't rendered), so the
  // next `.card` sibling is exactly it (null → drop at the very end).
  function groupDragOver(event: DragEvent, targetKey: string): void {
    if (dragging?.kind !== 'group') return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    // No line over the card you're holding — dropping on it is a no-op anyway.
    if (dragging.groupKey === targetKey) {
      dropHint = null
      return
    }
    dropHint = `group-${afterHalf(event) ? 'after' : 'before'}-${targetKey}`
  }

  function dropOnGroup(event: DragEvent, targetKey: string): void {
    if (dragging?.kind === 'group') {
      let beforeKey = targetKey
      if (afterHalf(event)) {
        const next = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null
        beforeKey = next?.dataset.groupKey ?? '' // '' matches no group → append at end
      }
      moveGroup(dragging.groupKey, beforeKey)
    }
    endDrag()
  }

  // True when the pointer sits in the lower half of the card under it.
  function afterHalf(event: DragEvent): boolean {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return event.clientY > rect.top + rect.height / 2
  }
</script>

<!-- A snippet, not a component: an <svg> rendered by a child component would
     not match this file's scoped `.tab .svg-icon`-style rules, and sizing every
     call site by hand is how the icon column stops lining up. Sized in em so the
     existing font-size rules keep driving it, exactly like the font icons. -->
{#snippet icon(name: keyof typeof ICONS, cls = '', label = '')}
  {@const i = ICONS[name]}
  <svg
    class="svg-icon {cls}"
    viewBox={i.box}
    fill={i.stroke ? 'none' : 'currentColor'}
    fill-rule={i.evenodd ? 'evenodd' : null}
    clip-rule={i.evenodd ? 'evenodd' : null}
    stroke={i.stroke ? 'currentColor' : null}
    stroke-width={i.stroke || null}
    stroke-linecap="round"
    stroke-linejoin="round"
    role={label ? 'img' : 'presentation'}
    aria-label={label ? label : undefined}
  >
    {#if label}<title>{label}</title>{/if}
    {#each i.paths as d (d)}
      <path {d} />
    {/each}
  </svg>
{/snippet}

<!-- The shell owns the palette and every app-wide card setting: the tokens as
     one serialised string, the three that are a LOOK rather than a value as
     data attributes the card rules descend from. None of them varies per card,
     so none of them belongs on a card — only `--dir-color` does. -->
<div
  class="shell"
  style={shellVars}
  style:--ui-font={chromeFont}
  style:--dot-track={ui.statusDot ? '16px' : '0px'}
  style:--card-wash={`${Math.round(ui.cardWash * 100)}%`}
  style:--card-wash-rest={`${Math.round(ui.cardWashRest * 100)}%`}
  data-card-dark={ui.cardDark && effective === 'light' ? 'on' : null}
  data-edge={ui.cardEdge}
  data-fill={ui.cardWashRest === 0 ? 'none' : null}
>
  <!-- CSS `zoom` scales the tower's text and every px in its chrome with it,
       which is what makes one declaration enough for a pane whose sizes are
       all in px. It scales the WIDTH too, so the width is pre-divided by it:
       the splitter stores the width the user dragged to, in real screen px,
       and it must not move when the text does. -->
  <aside
    class="tower"
    style:width={`${ui.towerWidth / zoomFactor('tower')}px`}
    style:zoom={zoomFactor('tower')}
    onwheelcapture={(e) => zoomWheel('tower', e)}
  >
    <div class="tower-filter">
      <div class="spawn-group">
        <button
          class="icon-btn"
          title="New Claude session"
          aria-label="New Claude session"
          onclick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            openMenu(
              { kind: 'spawn', type: 'claude', x: rect.left, y: rect.bottom + 4 },
              30 * recentDirs.length + 42
            )
          }}
        >
          {@render icon('claude')}
        </button>
        <button
          class="icon-btn"
          title="New Codex session"
          aria-label="New Codex session"
          onclick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            openMenu(
              { kind: 'spawn', type: 'codex', x: rect.left, y: rect.bottom + 4 },
              30 * recentDirs.length + 42
            )
          }}
        >
          {@render icon('openai')}
        </button>
        <button
          class="icon-btn"
          title="New shell session"
          aria-label="New shell session"
          onclick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            openMenu(
              { kind: 'spawn', type: 'shell', x: rect.left, y: rect.bottom + 4 },
              30 * recentDirs.length + 42
            )
          }}
        >
          {@render icon('terminal-window')}
        </button>
      </div>
      <div class="search">
        <span class="material-symbols-outlined">search</span>
        <input
          placeholder="Filter"
          bind:value={filterText}
          onkeydown={(e) => {
            if (e.key === 'Escape') {
              filterText = ''
              e.currentTarget.blur()
            }
          }}
        />
        {#if filterText}
          <button class="clear" aria-label="Clear filter" onclick={() => (filterText = '')}
            >×</button
          >
        {/if}
        <button
          class="chip type-filter"
          class:active={filterClaude || filterShell}
          title="Filter by session type"
          aria-label="Filter by session type"
          onclick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            openMenu({ kind: 'type-filter', x: rect.left, y: rect.bottom + 4 }, 110)
          }}
        >
          {#if filterClaude}
            {@render icon('claude')}
          {:else if filterShell}
            {@render icon('terminal-window')}
          {:else}
            <span class="material-symbols-outlined">filter_list</span>
          {/if}
          <span class="material-symbols-outlined caret">expand_more</span>
        </button>
      </div>
      <button
        class="icon-btn"
        title="Settings"
        aria-label="Settings"
        onclick={() => (settingsOpen = true)}
      >
        <span class="material-symbols-outlined">menu</span>
      </button>
    </div>

    <div class="tower-body" data-dragging={dragging?.kind}>
      {#each tower as group (group.key)}
        {#if group.kind === 'plain'}
          <!-- The card survives on its archive alone: a folder whose every
               session is archived keeps its header (and its spawn buttons)
               rather than vanishing from the tower. -->
          {@const showArchive = group.archivedVisible.length > 0 || archiveOpenFor(group.key)}
          {#if (group.sessions.length > 0 && (!filterActive || group.visible.length > 0)) || showArchive}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="card"
              class:active={hasFocused(group)}
              class:collapsed={collapsedGroups[group.key]}
              class:drop-before={dropHint === `group-before-${group.key}`}
              class:drop-after={dropHint === `group-after-${group.key}`}
              data-group-key={group.key}
              style:--dir-color={dirColors[group.repCwd]}
              draggable="true"
              ondragstart={() => (dragging = { kind: 'group', groupKey: group.key })}
              ondragend={endDrag}
              ondragover={(e) => groupDragOver(e, group.key)}
              ondragleave={() => (dropHint = null)}
              ondrop={(e) => dropOnGroup(e, group.key)}
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="card-title"
                title={group.cwd}
                oncontextmenu={(e) => {
                  e.preventDefault()
                  openMenu({ kind: 'color', dir: group.key, x: e.clientX, y: e.clientY }, 260)
                }}
              >
                {@render cardLabel(group)}
                <span class="dir-meta">
                  {@render rollupChip(group)}
                  <span class="spawn-cluster">{@render spawnButtons(group.cwd)}</span>
                </span>
              </div>
              {#if !collapsedGroups[group.key]}
                {#each group.visible as session (session.key)}
                  {@render sessionRow(session)}
                {/each}
                {#if showArchive}{@render archiveSection(group)}{/if}
              {/if}
            </div>
          {/if}
        {:else}
          {@const branches = group.branches.filter(
            (b) => b.sessions.length > 0 && (!filterActive || b.visible.length > 0)
          )}
          {@const showArchive = group.archivedVisible.length > 0 || archiveOpenFor(group.key)}
          {#if branches.length > 0 || showArchive}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="card"
              class:active={hasFocused(group)}
              class:collapsed={collapsedGroups[group.key]}
              class:drop-before={dropHint === `group-before-${group.key}`}
              class:drop-after={dropHint === `group-after-${group.key}`}
              data-group-key={group.key}
              style:--dir-color={dirColors[group.repCwd]}
              draggable="true"
              ondragstart={() => (dragging = { kind: 'group', groupKey: group.key })}
              ondragend={endDrag}
              ondragover={(e) => groupDragOver(e, group.key)}
              ondragleave={() => (dropHint = null)}
              ondrop={(e) => dropOnGroup(e, group.key)}
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="card-title"
                title={group.key}
                oncontextmenu={(e) => {
                  e.preventDefault()
                  openMenu({ kind: 'color', dir: group.key, x: e.clientX, y: e.clientY }, 260)
                }}
              >
                {#if namingWorktree === group.key}
                  <input
                    class="rename"
                    placeholder="new worktree — blank auto-names"
                    use:focusOnMount
                    onblur={() => (namingWorktree = null)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') commitWorktree(group.key, e.currentTarget.value)
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        namingWorktree = null
                      }
                    }}
                  />
                {:else}
                  {@render cardLabel(group)}
                {/if}
                <span class="dir-meta">
                  {@render rollupChip(group)}
                  <span class="spawn-cluster">
                    <button
                      class="spawn-btn"
                      title="New Claude session in a fresh worktree"
                      aria-label="New Claude session in a fresh worktree"
                      onclick={(e) => {
                        e.stopPropagation()
                        namingWorktree = group.key
                      }}
                    >
                      <span class="material-symbols-outlined">create_new_folder</span>
                    </button>
                    <button
                      class="spawn-btn"
                      title="Reopen a worktree"
                      aria-label="Reopen a worktree"
                      onclick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        void openWorktreeMenu(group.key, rect.left, rect.bottom + 4)
                      }}
                    >
                      <span class="material-symbols-outlined">history</span>
                    </button>
                    <button
                      class="spawn-btn"
                      title="Show repo in Explorer"
                      aria-label="Show repo in Explorer"
                      onclick={(e) => {
                        e.stopPropagation()
                        window.arc.openInExplorer(group.key)
                      }}
                    >
                      <span class="material-symbols-outlined">folder_open</span>
                    </button>
                  </span>
                </span>
              </div>
              {#if !collapsedGroups[group.key]}
                {#each branches as branch (branch.cwd)}
                  <div class="branch-row" title={branchTitle(branch)}>
                    <span class="material-symbols-outlined branch-icon">account_tree</span>
                    <span class="branch-name">
                      <span class="branch-text">{branch.branch}</span>
                      {#if branch.dirty || branch.ahead || branch.behind}
                        <span class="branch-state">
                          {#if branch.dirty}<span class="state-dirty"></span>{/if}
                          {#if branch.ahead}<span>↑{branch.ahead}</span>{/if}
                          {#if branch.behind}<span>↓{branch.behind}</span>{/if}
                        </span>
                      {/if}
                    </span>
                    <span class="dir-meta">
                      <span class="dir-path">{branch.showWorktree ? branch.worktreeName : ''}</span>
                      <span class="spawn-cluster">{@render spawnButtons(branch.cwd)}</span>
                    </span>
                  </div>
                  {#each branch.visible as session (session.key)}
                    {@render sessionRow(session)}
                  {/each}
                {/each}
                {#if showArchive}{@render archiveSection(group)}{/if}
              {/if}
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  </aside>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="splitter"
    class:dragging={draggingTower}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize timing tower"
    onpointerdown={(e) => {
      draggingTower = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }}
    onpointermove={towerDrag}
    onpointerup={() => (draggingTower = false)}
    onpointercancel={() => (draggingTower = false)}
  ></div>

  <main class="pane">
    {#each sessions as session (session.key)}
      {@const paneTraits = traitsOf(session.type)}
      <div class="host" style:display={ui.focused === session.key ? 'flex' : 'none'}>
        {#if paneTraits}
          <div class="tabs" role="tablist">
            <button
              class="tab"
              class:active={session.view === 'terminal'}
              role="tab"
              aria-selected={session.view === 'terminal'}
              onclick={() => (session.view = 'terminal')}
            >
              {@render icon('terminal-window')}Terminal
            </button>
            {#if paneTraits.preview}
              <button
                class="tab"
                class:active={session.view === 'preview'}
                role="tab"
                aria-selected={session.view === 'preview'}
                onclick={() => (session.view = 'preview')}
              >
                <span class="material-symbols-outlined">article</span>Preview
              </button>
            {/if}
            {#if paneTraits.info}
              <button
                class="tab"
                class:active={session.view === 'info'}
                role="tab"
                aria-selected={session.view === 'info'}
                onclick={() => (session.view = 'info')}
              >
                <span class="material-symbols-outlined">speed</span>Session
              </button>
            {/if}
            {#if paneTraits.notes}
              <button
                class="tab"
                class:active={session.view === 'notes'}
                role="tab"
                aria-selected={session.view === 'notes'}
                onclick={() => (session.view = 'notes')}
              >
                <span class="material-symbols-outlined">edit_note</span>Notes
              </button>
            {/if}
          </div>
        {/if}
        <!-- The terminal stays mounted while hidden — the PTY's lifetime is
             the session. The preview mounts/unmounts with its tab.
             Alone among the panes it takes a font SCALE rather than CSS zoom:
             the size change has to re-measure the cell, reflow the grid and
             resize the PTY, which is what Ctrl+wheel does in Windows Terminal.
             Scaling the canvas instead would just enlarge the old grid. -->
        <div
          class="view"
          style:display={session.view === 'terminal' ? 'block' : 'none'}
          onwheelcapture={(e) => zoomWheel('terminal', e)}
        >
          <Terminal
            type={session.type}
            cwd={session.cwd}
            resume={session.resumeId ?? undefined}
            worktree={session.spawnWorktree ?? undefined}
            active={ui.focused === session.key && session.view === 'terminal'}
            {focusEpoch}
            theme={palette.xterm}
            fontFamily={monoFont}
            fontScale={zoomFactor('terminal')}
            onSpawned={(ptyId, claudeSessionId, cwd) => {
              session.ptyId = ptyId
              // The pinned spawn id is the first join key against the agent
              // poll; from the first match on it we follow the claude pid,
              // which survives a /clear (see applyAgents).
              session.claudeSessionId = claudeSessionId ?? null
              // Immutable hook routing token: claudeSessionId may change on
              // /clear, hookToken never does (see applyHook, issue #2). The
              // pinned id is also the first join key for the agent poll, which
              // then follows the claude pid instead.
              session.hookToken = claudeSessionId ?? null
              session.claudePid = null
              session.claudeStartedAt = null
              applySpawnCwd(session.key, cwd)
            }}
            onExited={() => {
              // A relaunch kills the PTY on purpose and swaps the row for a
              // resumed one — that exit is the mechanism, not the end of the
              // session, so it must not paint the row exited on the way past.
              if (!finishRelaunch(session.key)) setStatus(session, 'exited')
            }}
            scanning={session.type === 'codex' ||
              (ui.statusSource === 'screen' && session.type === 'claude')}
            onScreen={(state) => applyScreen(session.key, state)}
            onSession={(sessionId, name) => applyDiscoveredSession(session.key, sessionId, name)}
            onInput={(data) => nudgeStatusFromKey(session.key, data)}
            onTitle={(title) => {
              session.title = title
            }}
          />
        </div>
        <!-- Notes stay mounted with the terminal rather than mounting per tab
             like Preview/Info: a textarea that unmounts loses its undo history
             and scroll, and there is nothing to disarm — the text lives in the
             store, not in a watcher. -->
        {#if paneTraits?.notes}
          <div
            class="view"
            style:display={session.view === 'notes' ? 'block' : 'none'}
            style:zoom={zoomFactor('notes')}
            onwheelcapture={(e) => zoomWheel('notes', e)}
          >
            <Notes
              {session}
              codeFont={monoFont}
              active={ui.focused === session.key && session.view === 'notes'}
            />
          </div>
        {/if}
        {#if session.view === 'info'}
          <div
            class="view"
            style:zoom={zoomFactor('info')}
            onwheelcapture={(e) => zoomWheel('info', e)}
          >
            <!-- Mounted for the focused session only, same as the preview: the
                 pull runs on an interval, so an unfocused tab must not keep
                 asking main for facts nobody is reading. -->
            {#if session.claudeSessionId && ui.focused === session.key}
              <Info {session} codeFont={monoFont} />
            {:else if !session.claudeSessionId}
              <div class="empty">No session yet.</div>
            {/if}
          </div>
        {/if}
        {#if session.view === 'preview'}
          <div
            class="view"
            style:zoom={zoomFactor('preview')}
            onwheelcapture={(e) => zoomWheel('preview', e)}
          >
            {#if session.claudeSessionId && ui.focused === session.key}
              <!-- mounted for the focused session only: unmounting disarms
                   the tail, and the store cache makes refocus instant -->
              <Preview
                sessionId={session.claudeSessionId}
                cwd={session.cwd}
                kind={session.type === 'codex' ? 'codex' : 'claude'}
                proseFont={previewFont}
                codeFont={monoFont}
              />
            {:else if session.claudeSessionId}
              <!-- unfocused, parked on its preview tab: nothing to render,
                   nothing to tail — the host is display:none anyway -->
            {:else}
              <!-- spawn still in flight, or it failed (the terminal tab has
                   the error) — never a silently blank pane -->
              <div class="empty">No conversation yet.</div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
    {#if sessions.length === 0}
      <div class="empty">
        <p>No sessions. Spawn one from the timing tower.</p>
      </div>
    {/if}
  </main>

  <!-- An on/off setting looks like an on/off setting. A checkbox glyph in a
       menu row read as "an item you can tick", which is what a menu does; a
       switch reads as state, which is what these are. -->
  <!-- One settings row whose control is a segmented "pick one of these". Four
       rows shared the same sixteen lines before this existed — the class:on /
       role / aria-checked triple had to be kept in sync across every copy, and
       any future keyboard handling would have had to land in all of them. The
       option lists all carry `{ id, label }` so one snippet renders them; the
       Theme row keeps its own block, its buttons carrying an icon as well.
       `id` widens to `string | number` here (the wash steps are numbers), so
       the call sites narrow on the way back out. -->
  {#snippet segRow(
    label: string,
    aria: string,
    options: { id: string | number; label: string }[],
    selected: string | number,
    pick: (id: never) => void
  )}
    <div class="set-row">
      <span class="set-label">{label}</span>
      <div class="segmented" role="radiogroup" aria-label={aria}>
        {#each options as option (option.id)}
          <button
            class="seg"
            class:on={selected === option.id}
            role="radio"
            aria-checked={selected === option.id}
            onclick={() => pick(option.id as never)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet switchBtn(label: string, on: boolean, toggle: () => void)}
    <button
      class="switch"
      class:on
      role="switch"
      aria-checked={on}
      aria-label={label}
      onclick={toggle}
    >
      <span class="knob"></span>
    </button>
  {/snippet}

  <!-- One font setting: a picker showing the current face IN that face, which
       unfolds in place to the whole list, each name likewise previewing itself.
       In place rather than as a popup menu — the panel is already a dialog, and
       a second layer over it would need its own backdrop and z-index. One open
       at a time (openFont holds the row, not a boolean per row), so the panel
       never grows by three lists at once. font-family only — the size of the
       terminal and the preview is the zoom. -->
  {#snippet fontRow(
    label: string,
    key: string,
    list: typeof FONTS,
    selected: string,
    pick: (id: string) => void
  )}
    {@const current = list.find((f) => f.id === selected) ?? list[0]}
    {@const open = openFont === key}
    <div class="set-row">
      <span class="set-label">{label}</span>
      <button
        class="picker"
        class:open
        aria-expanded={open}
        aria-label={`${label} font: ${current.label}`}
        style:font-family={current.stack}
        onclick={() => (openFont = open ? null : key)}
      >
        <span class="picker-name">{current.label}</span>
        <span class="material-symbols-outlined">expand_more</span>
      </button>
    </div>
    {#if open}
      <div class="options" role="radiogroup" aria-label={`${label} font`}>
        {#each list as font (font.id)}
          <button
            class="option"
            class:on={selected === font.id}
            role="radio"
            aria-checked={selected === font.id}
            style:font-family={font.stack}
            onclick={() => {
              pick(font.id)
              openFont = null
            }}
          >
            {font.label}
          </button>
        {/each}
      </div>
    {/if}
  {/snippet}

  <!-- The card's name, which doubles as the collapse toggle (issue #5): click
       it to fold the card to just this title / unfold it. Collapsed, it leads
       with a roll-up status dot so a folded card still reads at a glance;
       expanded, it's just the name. Drag still works (a click isn't a drag) and
       right-clicking the title still opens the colour menu. -->
  {#snippet cardLabel(group: GroupView)}
    {@const collapsed = collapsedGroups[group.key]}
    <span
      class="folder-name"
      role="button"
      tabindex="0"
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand' : 'Collapse'}
      onclick={() => toggleCollapsed(group.key)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleCollapsed(group.key)
        }
      }}
    >
      <span class="name-text">
        {group.kind === 'plain' ? dirLabel(group.cwd).base : group.repoName}
      </span>
    </span>
  {/snippet}

  <!-- The folded card's roll-up dot. It lives in the title's RIGHT track, the
       stacked cell the worktree annotation and the spawn cluster share — and it
       holds that cell outright, because the cluster doesn't come out while the
       card is folded (see the CSS). Folded, the dot is the whole status report
       for the card, so it wants the end of the line rather than a position in
       front of the name that nothing occupies when the card is open. -->
  {#snippet rollupChip(group: GroupView)}
    {#if collapsedGroups[group.key] && ui.statusDot}
      {@const r = rollupDot(group)}
      {#if r}<span class="rollup dot {r.status}" class:plain={r.plain} class:archived={r.archived}
        ></span>{/if}
    {/if}
  {/snippet}

  <!-- The header hover cluster: new Claude / new Codex / new shell / Show in
       Explorer, all targeting one cwd. Shared by the plain-folder header and each
       git branch subfolder (issue #5) — the leaf group owns the affordances. -->
  {#snippet spawnButtons(dir: string)}
    <button
      class="spawn-btn"
      title="New Claude session here"
      aria-label="New Claude session here"
      onclick={(e) => {
        e.stopPropagation()
        void newSession('claude', dir)
      }}
    >
      {@render icon('claude')}
    </button>
    <button
      class="spawn-btn"
      title="New Codex session here"
      aria-label="New Codex session here"
      onclick={(e) => {
        e.stopPropagation()
        void newSession('codex', dir)
      }}
    >
      {@render icon('openai')}
    </button>
    <button
      class="spawn-btn"
      title="New shell session here"
      aria-label="New shell session here"
      onclick={(e) => {
        e.stopPropagation()
        void newSession('shell', dir)
      }}
    >
      {@render icon('terminal-window')}
    </button>
    <button
      class="spawn-btn"
      title="Show in Explorer"
      aria-label="Show in Explorer"
      onclick={(e) => {
        e.stopPropagation()
        window.arc.openInExplorer(dir)
      }}
    >
      <span class="material-symbols-outlined">folder_open</span>
    </button>
  {/snippet}

  <!-- The card's archive: rows pushed out of the way, which keep running all
       the same. The separator IS the fold toggle, the same job the card's name
       does for the card — and it folds by DEFAULT (expandedArchives stores the
       open ones), because a section that opened itself on the first archive
       would undo the feature. An active filter with a match down here opens it
       regardless of that state, and without writing to it: a search that can't
       find a session you know exists is a bug, not decluttering.
       It is also the drop target that crosses the divider in either direction
       (dropOnArchive), which is why it renders while a row of this card is in
       flight even with nothing archived yet. -->
  {#snippet archiveSection(group: GroupView)}
    {@const rows = group.archivedVisible}
    {@const open = !!expandedArchives[group.key] || filterActive}
    <div
      class="archive-sep"
      class:over={dropHint === `archive-${group.key}`}
      role="button"
      tabindex="0"
      aria-expanded={open}
      title={open ? 'Fold archived sessions' : 'Unfold archived sessions'}
      onclick={() => toggleArchive(group.key)}
      ondragover={(e) => allowDrop(e, `archive-${group.key}`, archiveOpenFor(group.key))}
      ondragleave={() => (dropHint = null)}
      ondrop={dropOnArchive}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleArchive(group.key)
        }
      }}
    >
      <!-- The glyph carries the meaning, so the count is just a number; both
           sit at the RIGHT end of the rule, out of the rows' left margin. -->
      <span class="archive-count">
        <span class="material-symbols-outlined">archive</span>{rows.length}
      </span>
    </div>
    {#if open}
      {#each rows as session (session.key)}
        {@render sessionRow(session)}
      {/each}
    {/if}
  {/snippet}

  <!-- One session row — same 12-column grid placement in every card (dot col 2,
       type icon col 3, name col 4+), so plain and repo cards share it. -->
  {#snippet sessionRow(session: Session)}
    <div
      class="row"
      class:focused={ui.focused === session.key}
      class:drop-hint={dropHint === `session-${session.key}`}
      role="button"
      tabindex="0"
      draggable="true"
      ondragstart={(e) => {
        // Don't let this bubble to the card's group-drag handler — otherwise it
        // overwrites `dragging` and a row reorder becomes a whole-card move.
        e.stopPropagation()
        dragging = {
          kind: 'session',
          key: session.key,
          cwd: session.cwd,
          groupKey: groupKeyOf(session.cwd),
          archived: session.archived
        }
      }}
      ondragend={endDrag}
      ondragover={(e) => allowDrop(e, `session-${session.key}`, acceptsRow(session))}
      ondragleave={() => (dropHint = null)}
      ondrop={() => dropOnSession(session)}
      onclick={() => focusSession(session.key)}
      oncontextmenu={(e) => {
        e.preventDefault()
        openMenu({ kind: 'session', key: session.key, x: e.clientX, y: e.clientY }, 280)
      }}
      onkeydown={(e) => e.key === 'Enter' && focusSession(session.key)}
    >
      {#if ui.statusDot}
        <button
          class="dot {session.status}"
          class:plain={session.type === 'shell'}
          class:todo={session.todo}
          class:archived={session.archived}
          title={session.todo ? 'TODO — click to clear' : `${session.status} — click to flag`}
          aria-label={session.todo ? 'Clear TODO flag' : 'Flag TODO'}
          aria-pressed={session.todo}
          onclick={(e) => {
            e.stopPropagation()
            toggleTodo(session.key)
          }}
        ></button>
      {/if}

      {@render icon(
        (traitsOf(session.type)?.icon ?? 'terminal-window') as keyof typeof ICONS,
        'type-icon',
        `${traitsOf(session.type)?.label ?? 'Shell'} session`
      )}

      {#if renaming === session.key}
        <input
          class="rename"
          value={session.name || cleanTitle(session.title)}
          use:focusOnMount
          onblur={(e) => commitRename(session.key, e.currentTarget.value)}
          onkeydown={(e) => {
            if (e.key === 'Enter') commitRename(session.key, e.currentTarget.value)
            if (e.key === 'Escape') renaming = null
          }}
        />
      {:else}
        {@const label = displayName(session)}
        {@const lead = ui.glyphColor ? glyphLead(label) : null}
        <span
          class="name"
          role="button"
          tabindex="-1"
          title={`${session.cwd} — double-click to rename`}
          ondblclick={() => (renaming = session.key)}
          >{#if lead}<span class="glyph {lead.family}">{lead.glyph}</span>{label.slice(
              lead.glyph.length
            )}{:else}{label}{/if}</span
        >
      {/if}

      <button
        class="close"
        title="Close session"
        aria-label="Close session"
        onclick={(e) => {
          e.stopPropagation()
          closeSession(session.key)
        }}>×</button
      >
    </div>
  {/snippet}

  {#if menu}
    <div
      class="menu-backdrop"
      role="presentation"
      onclick={() => (menu = null)}
      oncontextmenu={(e) => {
        e.preventDefault()
        menu = null
      }}
    ></div>
    <div class="menu" style:left={`${menu.x}px`} style:top={`${menu.y}px`}>
      {#if menu.kind === 'spawn'}
        {#each recentDirs as dir (dir)}
          {@const label = dirLabel(dir)}
          <button
            class="menu-item"
            title={dir}
            onclick={() => {
              if (menu?.kind === 'spawn') void newSession(menu.type, dir)
              menu = null
            }}
          >
            <span class="material-symbols-outlined">folder</span>{label.base}
            <span class="dir-parent">{label.parent}</span>
          </button>
        {/each}
        {#if recentDirs.length > 0}
          <div class="menu-divider"></div>
        {/if}
        <button
          class="menu-item"
          onclick={() => {
            if (menu?.kind === 'spawn') void newSession(menu.type)
            menu = null
          }}
        >
          <span class="material-symbols-outlined">folder_open</span>Browse…
        </button>
      {:else if menu.kind === 'worktrees'}
        {#if menu.items.length === 0}
          <div class="menu-label">No parked worktrees</div>
        {:else}
          {#each menu.items as wt (wt.path)}
            <button
              class="menu-item"
              title={wt.path}
              onclick={() => {
                if (menu?.kind === 'worktrees') reopenWorktree(menu.repoRoot, wt.path)
                menu = null
              }}
            >
              <span class="material-symbols-outlined">account_tree</span>{dirLabel(wt.path).base}
              <span class="dir-parent">{wt.branch}</span>
            </button>
          {/each}
        {/if}
      {:else if menu.kind === 'type-filter'}
        <button
          class="menu-item"
          class:active={!filterClaude && !filterShell}
          onclick={() => {
            filterClaude = false
            filterShell = false
            menu = null
          }}
        >
          <span class="material-symbols-outlined">filter_list</span>All types
        </button>
        <button
          class="menu-item"
          class:active={filterClaude}
          onclick={() => {
            filterClaude = true
            filterShell = false
            menu = null
          }}
        >
          {@render icon('claude')}Claude sessions
        </button>
        <button
          class="menu-item"
          class:active={filterShell}
          onclick={() => {
            filterClaude = false
            filterShell = true
            menu = null
          }}
        >
          {@render icon('terminal-window')}Shell sessions
        </button>
      {:else if menu.kind === 'color'}
        {#each DOT_COLORS as entry (entry.name)}
          <button
            class="menu-item color"
            onclick={() => {
              if (menu?.kind === 'color') setGroupColor(menu.dir, entry.hex)
              menu = null
            }}
          >
            <span class="swatch" style:background={entry.hex}></span>{entry.name}
          </button>
        {/each}
      {:else}
        {@const menuSession = sessions.find((s) => menu?.kind === 'session' && s.key === menu.key)}
        {#if menuSession}
          <button
            class="menu-item"
            onclick={() => {
              window.arc.openInExplorer(menuSession.cwd)
              menu = null
            }}
          >
            <span class="material-symbols-outlined">folder_open</span>Show in Explorer
          </button>
          <button
            class="menu-item"
            onclick={() => {
              void navigator.clipboard.writeText(menuSession.cwd)
              menu = null
            }}
          >
            <span class="material-symbols-outlined">content_copy</span>Copy path
          </button>
          <button
            class="menu-item"
            onclick={() => {
              duplicateSession(menuSession.key)
              menu = null
            }}
          >
            <span class="material-symbols-outlined">tab_duplicate</span>Duplicate session
          </button>
          <button
            class="menu-item"
            onclick={() => {
              renaming = menuSession.key
              menu = null
            }}
          >
            <span class="material-symbols-outlined">edit</span>Rename
          </button>
          {#if traitsOf(menuSession.type)?.color}
            <button
              class="menu-item"
              onclick={() => {
                applyFolderColor(menuSession.key)
                menu = null
              }}
            >
              <span class="material-symbols-outlined">palette</span>Apply folder color
            </button>
          {/if}
          {#if traitsOf(menuSession.type) && menuSession.claudeSessionId}
            <button
              class="menu-item"
              onclick={() => {
                relaunchSession(menuSession.key)
                menu = null
              }}
            >
              <span class="material-symbols-outlined">restart_alt</span>Relaunch session
            </button>
          {/if}
          <button
            class="menu-item"
            onclick={() => {
              setArchived(menuSession.key, !menuSession.archived)
              menu = null
            }}
          >
            {#if menuSession.archived}
              <span class="material-symbols-outlined">unarchive</span>Unarchive session
            {:else}
              <span class="material-symbols-outlined">archive</span>Archive session
            {/if}
          </button>
          <button
            class="menu-item"
            onclick={() => {
              closeSession(menuSession.key)
              menu = null
            }}
          >
            <span class="material-symbols-outlined">close</span>Close session
          </button>
        {/if}
      {/if}
    </div>
  {/if}

  {#if settingsOpen}
    <!-- A settings PANEL, not a menu (2026-09-10). The controls are unchanged;
         what changed is that they stopped being twenty-three identical rows in
         one column. Each control now has the shape of the choice it makes — a
         segmented control for "one of two or three", a switch for on/off, a
         picker for "one of five" — and they sit in a label-left / control-right
         grid under three section headings.
         Non-modal since 2026-09-11: no backdrop, nothing dimmed, nothing
         blocked — every control here changes the app BEHIND it, and a panel
         that hides what it is changing is the wrong shape for that. Escape and
         the close button close it; a click on the tower goes to the tower. -->
    <div
      class="settings-modal"
      class:dragged={settingsPos !== null}
      style:left={settingsPos ? `${settingsPos.x}px` : null}
      style:top={settingsPos ? `${settingsPos.y}px` : null}
      role="dialog"
      aria-label="Settings"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="settings-header" onpointerdown={dragSettings}>
        <span class="material-symbols-outlined">settings</span>
        <span class="settings-title">Settings</span>
        <button
          class="settings-close"
          aria-label="Close settings"
          onclick={() => (settingsOpen = false)}
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="settings-body">
        <section class="set-group">
          <h2>Appearance</h2>
          <div class="set-row">
            <span class="set-label">Theme</span>
            <div class="segmented" role="radiogroup" aria-label="Theme">
              {#each MODES as mode (mode)}
                <button
                  class="seg"
                  class:on={ui.mode === mode}
                  role="radio"
                  aria-checked={ui.mode === mode}
                  onclick={() => (ui.mode = mode)}
                >
                  <span class="material-symbols-outlined">{MODE_ICONS[mode]}</span>{MODE_LABELS[
                    mode
                  ]}
                </button>
              {/each}
            </div>
          </div>
          {@render segRow(
            'Selected card',
            'Selected card wash',
            CARD_WASHES,
            ui.cardWash,
            (id: (typeof CARD_WASHES)[number]['id']) => (ui.cardWash = id)
          )}
          {@render segRow(
            'Unselected cards',
            'Unselected card wash',
            CARD_WASHES_REST,
            ui.cardWashRest,
            (id: (typeof CARD_WASHES_REST)[number]['id']) => (ui.cardWashRest = id)
          )}
          {@render segRow(
            'Card edge',
            'Card edge',
            CARD_EDGES,
            ui.cardEdge,
            (id: (typeof CARD_EDGES)[number]['id']) => (ui.cardEdge = id)
          )}
          <!-- Light mode only, and the row stays put in dark rather than
               appearing and disappearing as a `system` theme follows the OS. -->
          <div class="set-row">
            <span class="set-label">Dark selected card</span>
            {@render switchBtn(
              'Dark selected card',
              ui.cardDark,
              () => (ui.cardDark = !ui.cardDark)
            )}
          </div>
          <div class="set-row">
            <span class="set-label">Color title glyph</span>
            {@render switchBtn(
              'Color title glyph',
              ui.glyphColor,
              () => (ui.glyphColor = !ui.glyphColor)
            )}
          </div>
        </section>

        <section class="set-group">
          <h2>Status</h2>
          <div class="set-row">
            <span class="set-label">Status dot</span>
            {@render switchBtn('Status dot', ui.statusDot, () => (ui.statusDot = !ui.statusDot))}
          </div>
          <div class="set-row">
            <span class="set-label">Status RGB</span>
            {@render switchBtn('Status RGB', ui.statusRgb, () => (ui.statusRgb = !ui.statusRgb))}
          </div>
          {@render segRow(
            'Detection',
            'Status detection',
            STATUS_SOURCES,
            ui.statusSource,
            (id: (typeof STATUS_SOURCES)[number]['id']) => (ui.statusSource = id)
          )}
          <!-- The hint the old rows hid in a title attribute. It changes with
               the choice, so it explains what is selected rather than making
               you hover both to find out. -->
          <p class="set-hint">
            {STATUS_SOURCES.find((s) => s.id === ui.statusSource)?.hint} Claude rows only — a Codex row
            always reads its screen.
          </p>
        </section>

        <section class="set-group">
          <h2>Fonts</h2>
          {@render fontRow('Terminal', 'terminal', FONTS, ui.font, (id) => (ui.font = id))}
          {@render fontRow('Interface', 'interface', UI_FONTS, ui.uiFont, (id) => (ui.uiFont = id))}
          {@render fontRow(
            'Preview',
            'preview',
            UI_FONTS,
            ui.previewFont,
            (id) => (ui.previewFont = id)
          )}
        </section>
      </div>
    </div>
  {/if}
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      // An open font picker is the innermost thing Escape can mean, so it goes
      // first — one Escape shouldn't close the panel out from under a list you
      // were still reading.
      if (openFont) openFont = null
      else if (settingsOpen) settingsOpen = false
      else if (menu) menu = null
    }
  }}
/>

<style>
  /* The app shell is exactly the window and is never itself a scrollable
     document: every real scroll surface inside it (the tower body, the
     preview, the Session tab, the menus, xterm's viewport) declares its own
     overflow. Without this, anything that overshoots — a pane whose content
     outgrows its box, a horizontal overflow whose scrollbar then steals the
     last row of height — turns the whole window into a page you can scroll
     off the bottom of, past the tower and the terminal into empty background.
     There is nothing below .shell to reach, so clip it here. */
  :global(html, body, #app) {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

  /* App-wide icon weight; the variation axis beats the package's
     font-weight: normal regardless of stylesheet order */
  :global(.material-symbols-outlined) {
    font-variation-settings: 'wght' 300;
  }

  .shell {
    display: flex;
    height: 100%;
    /* Interface-font picker (--ui-font, default Inter). system-ui in the
       stacks catches non-latin titles/paths. */
    font-family: var(--ui-font);
    background: var(--bg);
    color: var(--fg);
  }

  /* Scrollbars from the palette, not Chromium's light default — which paints
     them white, and on the dark theme that is the brightest thing on screen.
     This was one inherited `scrollbar-color` on .shell; it moved onto the
     ::-webkit-scrollbar pseudo-elements to get rid of the arrow buttons.
     Two things measured in this Electron (43.1.0) settle the shape:
     `scrollbar-width: thin` does NOT drop the Fluent arrows (it only narrows
     15px → 10px), and Chromium IGNORES every ::-webkit-scrollbar-* rule on an
     element that also has `scrollbar-color` — so the two cannot be combined
     and the standard property had to go entirely.
     The pseudo-elements don't inherit the way `scrollbar-color` did, so this
     one :global descendant rule stands in for it: it reaches every scroll
     container inside .shell (the tower, the Preview/Session/Notes tabs, the
     menus), which is also where the palette vars resolve. NOT the terminal —
     xterm 6 scrolls through the VS Code scrollable element and draws its
     scrollbar as ordinary DOM (`.xterm-scrollable-element > .scrollbar`, see
     its own CSS), so no ::-webkit-scrollbar rule has ever applied to it. It
     takes its colours from the `scrollbarSlider*` theme options instead.
     The thumb is the same line colour every divider in the app already uses;
     the track stays transparent so it takes whichever surface it sits on. */
  :global(.shell ::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  /* The point of the exercise. */
  :global(.shell ::-webkit-scrollbar-button) {
    display: none;
  }

  :global(.shell ::-webkit-scrollbar-track),
  :global(.shell ::-webkit-scrollbar-corner) {
    background: transparent;
  }

  /* Chromium drew a 15px track with a 9px pill thumb; this was a 10px track
     with a 6px thumb, and is now an 8px track carrying a **1px** one — the
     weight of the card's own title rule and archive divider, so the bar reads
     as another hairline in a chrome made of hairlines rather than as a piece of
     furniture. The transparent border does the inset and background-clip keeps
     the fill off it; 8 − 4 − 3 = 1 in both axes, the odd half-pixel spent as an
     asymmetric border because a fractional border-width would snap to the
     device pixel grid and land on 0 or 2. The thumb is a hairline to LOOK at,
     not to hit: Chromium hit-tests its whole border box, so all 8px stay
     grabbable. The track width is also the tower's scrollbar gutter, which is
     why it is 8 — the cards' own inset (see .tower-body). ONE bar everywhere:
     the tower briefly had a narrower exception, and two scrollbar looks in one
     window is one more than the app needs. */
  :global(.shell ::-webkit-scrollbar-thumb) {
    background: var(--border);
    background-clip: padding-box;
    border: 4px solid transparent;
    border-right-width: 3px;
    border-bottom-width: 3px;
    border-radius: 1px;
  }

  .tower {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--bg-subtle);
  }

  .splitter {
    /* 5px hit area; visible line is the content-box (width minus padding) —
       which needs border-box to actually be 1px. Without it `width` was the
       CONTENT box, so the sash measured 9px and painted a 5px bar; harmless
       while it rested transparent, fat as soon as it rested on a line.
       1px now, the same hairline every other divider in the app draws. */
    box-sizing: border-box;
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    /* A VS Code sash, but NOT the invisible-at-rest kind. It used to be
       transparent and let the tower/pane background change mark the boundary
       — which dark no longer has (bg and bgSubtle are both #000000, one
       surface), so the sash IS the boundary now and rests at 1px of `border`,
       the same line every other divider in the app draws. Accent on
       hover/drag as before. */
    background: var(--border);
    background-clip: content-box;
    padding: 0 2px;
    touch-action: none;
    transition: background-color 100ms ease-out 300ms;
  }

  .splitter:hover,
  .splitter.dragging {
    background-color: var(--accent);
  }

  .splitter.dragging {
    transition-delay: 0s;
  }

  .tower-body {
    flex: 1;
    overflow-y: auto;
    /* The cards line up with the filter bar above them, on both edges and at
       every card count. Left is the filter bar's own 8px. Right is the
       SCROLLBAR GUTTER, reserved at the same 8px whether the tower scrolls or
       not (`stable`), with no padding of its own — so the card box is the
       search box's box, and it does not resize the moment a session pushes the
       list past the fold. The two numbers are one number: the gutter is the
       scrollbar's track width. */
    padding: 0 0 0 8px;
    scrollbar-gutter: stable;
  }

  /* Repo/folder cards (issue #5): each group is a card — a faint wash of its
     colour with a 2px colour tab welded to the left edge, on a 12-column grid so
     titles, dots, icons and names align to fixed tracks. */
  .card {
    position: relative;
    /* visible (not hidden) so the drop-line ::after can sit in the margin gap
       between cards; the colour tab rounds its own left corners to match. */
    overflow: visible;
    margin-top: 4px;
    /* Equal sides. The 13px is the left's, where it clears the 2px edge tab
       (2 + 11); the right simply matches it rather than keeping the 8px it
       inherited from the tower's own gutter, which made every card's contents
       sit visibly off-centre in their own box. */
    padding: 4px 13px 10px;
    border-radius: 2px;
    /* The card wash: the group's colour mixed over the tower ground. Was a
       constant (8% over Primer's #161b22, then 16% once the canvas went
       black — at 8% the colour IS the whole card there); it is now the
       `--card-wash-rest` setting, since how much colour a resting card wants
       depends on the monitor and on how many cards are on it. The selected
       card overrides it below. */
    background: color-mix(in srgb, var(--dir-color) var(--card-wash-rest), var(--bg-subtle));
    /* The card RE-DECLARES the text colour it would otherwise inherit from
       .shell, which changes nothing here and is what makes the borrowed-palette
       card below possible: `color` is resolved where it is declared, so text
       that merely inherits from .shell has already been computed against the
       light `--fg` by the time it reaches the card, and no token override on
       the card can reach it. Session names were the visible half of that — the
       card title and the branch rows set their own colour and went white, the
       rows inherited and stayed dark. Declaring it once here makes the card the
       colour boundary, so anything inside it that just inherits follows. */
    color: var(--fg);
    /* the whole card is the group's drag handle (session rows override to
       pointer) — grab anywhere on it to reorder the group */
    cursor: grab;
  }

  /* Folded to its title, the card is one line, so its padding has to read as
     one box: the 10px bottom exists to separate the last session row from the
     card edge, and with no rows it just looks bottom-heavy. Match the top
     instead. The title also stops being a heading over anything — nothing is
     under it — so it drops to the body weight and reads as the list item it
     now is, leaving 600 to mean "this card is open". */
  /* Selected card: the same wash at its own number — `--card-wash` for the card
     that owns the focused session, `--card-wash-rest` for every other. Same
     hue, same recipe, one setting apart, so the selected card reads as this
     card lit rather than as a different surface. */
  .card.active {
    background: color-mix(in srgb, var(--dir-color) var(--card-wash), var(--bg-subtle));
  }

  /* "Dark selected card" (Settings), light mode only: the selected card borrows
     the DARK palette — every chrome token its contents read is re-pointed at
     the `--dark-*` set on .shell, so the card is what it would be in dark mode
     and not a light card with pale text. The list is exhaustive on purpose:
     grounds and inks, plus the accent (spawn hover, drop hints, the rename
     field), danger/success (the close hover, the coloured title glyph) and the
     four status-dot fills — leave one out and it is the one tone in the card
     still speaking light. No rule below changes: they all still say `var(--fg)`
     and the wash recipe above is untouched, it just mixes over a dark ground
     now. That ground is the point — the wash controls say how much colour a
     card carries, this says what it is carried over, which is the other half of
     whether a strong colour reads. Redeclaring `--bg-subtle` on the card itself
     is enough to move the background the same selector paints: a custom
     property resolves to the winning value on the element where it is USED.
     Dark mode never sets the attribute — the borrowed palette is already the
     live one there. */
  .shell[data-card-dark='on'] .card.active {
    --bg: var(--dark-bg);
    --bg-subtle: var(--dark-bg-subtle);
    --fg: var(--dark-fg);
    --fg-muted: var(--dark-fg-muted);
    --border: var(--dark-border);
    --accent: var(--dark-accent);
    --danger: var(--dark-danger);
    --success: var(--dark-success);
    --dot-running: var(--dark-dot-running);
    --dot-waiting: var(--dark-dot-waiting);
    --dot-idle: var(--dark-dot-idle);
    --dot-todo: var(--dark-dot-todo);
  }

  /* Card edge (Settings), the card's colour EDGE and nothing else — it never
     touches the background, which belongs entirely to the two wash controls.
     `tab` is the default 2px tab drawn by .card::before above; `outline` trades
     it for a 1px line around the whole card; `none` draws neither, leaving the
     wash alone to say whose card this is. The edge applies to every card,
     selected or not: the selected one is already marked by its stronger wash,
     and a second edge idiom on top would say the same thing twice. */
  /* Unselected background = "None": no fill at all, so the card is whatever the
     edge and the rows make it. Scoped off .active, which keeps its own wash —
     the two wash controls stay independent, as with the edge. */
  .shell[data-fill='none'] .card:not(.active) {
    background: none;
  }

  .shell[data-edge='outline'] .card {
    outline: 1px solid var(--dir-color);
    outline-offset: -1px;
  }

  .shell:not([data-edge='tab']) .card::before {
    display: none;
  }

  .card.collapsed {
    padding-bottom: 4px;
  }

  .card.collapsed .card-title {
    font-weight: 400;
  }

  /* While a drag is in flight, collapse each drop target to a single hit
     surface: its inner content stops taking pointer events. Native DnD still
     fires :hover under the cursor and fires dragenter/dragleave as the pointer
     crosses child boundaries — that's what makes chrome light up and the drop
     hint flicker mid-drag. Killing pointer-events on the contents stops both.
     A group drag drops onto whole cards, so the entire card interior goes
     inert; a session drag drops onto rows AND onto the archive divider, so
     those two stay live (their own children go inert) while titles and branch
     rows freeze. */
  .tower-body[data-dragging='group'] .card * {
    pointer-events: none;
  }

  .tower-body[data-dragging='session'] .card-title,
  .tower-body[data-dragging='session'] .branch-row,
  .tower-body[data-dragging='session'] .row > *,
  .tower-body[data-dragging='session'] .archive-sep > * {
    pointer-events: none;
  }

  /* Group drop preview: a 2px accent line floating in the margin gap the dragged
     card will land in — above the card (before) or below it (after). Centred in
     the 4px gap (top/bottom -3px), so it reads as "between cards", not a border. */
  .card.drop-before::after,
  .card.drop-after::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
  }

  .card.drop-before::after {
    top: -3px;
  }

  .card.drop-after::after {
    bottom: -3px;
  }

  /* The colour tab, welded to the card's left edge. Its left corners round to
     match the card's 2px radius (the card no longer clips it via overflow). */
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    border-radius: 2px 0 0 2px;
    background: var(--dir-color);
  }

  /* Every row (title, branch, session) shares one track template: fixed leading
     tracks (col 1 marker / col 2 dot / col 3 icon), one flexible label track
     (the only thing that stretches), and an auto right track (worktree
     annotation + spawn cluster, or the session close). Tracks line up across
     rows without subgrid. */
  .card-title,
  .branch-row,
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 18px var(--dot-track) 18px minmax(0, 1fr) auto;
    align-items: center;
  }

  /* Repo/folder title. Marker "none-left": the name is a flush-left heading in
     col 1 (no icon). The title carries the group's colour menu; the whole card
     (its parent) is the drag handle. */
  .card-title {
    padding: 3px 0 4px;
    font-weight: 600;
    user-select: none;
    /* The rule under the title, the same span as the archive divider's at the
       other end of the card, so an open card is a bracketed list rather than a
       stack of loose lines. It carries the card's own colour, and `--card-rule`
       is what the selected card re-points (below) — the wash difference between
       selected and not is deliberately slight, and is nothing at all at
       `--card-wash-rest: 0`, so the header line says which card you are in when
       the fill doesn't. A FOLDED card keeps it: there it is the card's bottom
       edge rather than a divider, and a tower of folded cards that each end on
       their own colour is what makes them read as cards. */
    border-bottom: 1px solid var(--card-rule, var(--dir-color));
  }

  /* Selected, the card says so in one place: the rule under its title goes to
     the foreground. The colour is a token on the CARD, not a second selector on
     the title, so anything else that comes to mark a selected card reads the
     same declaration instead of restating the condition. */
  .card.active {
    --card-rule: var(--fg);
  }

  .folder-name {
    grid-column: 1 / 5;
    /* stretch (not start) so the box fills its tracks and the name ellipsizes
       before the edge instead of overrunning to the card's clipped edge */
    justify-self: stretch;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    /* the name is the collapse toggle — pointer (over the card's grab) says so */
    cursor: pointer;
  }

  /* The name text lives in its own element so the flex row can lead with the
     roll-up dot when collapsed; it, not the flex box, carries the ellipsis. */
  .name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Collapsed roll-up dot: reuses the .dot status palette (incl. the plain
     shell tint and the waiting pulse). Decorative — it takes no pointer events,
     so hover and clicks go to the title underneath it. It sits in the title's
     right cell, which on a folded card is its alone: the spawn cluster that
     shares that cell doesn't come out while the card is folded (see below), so
     the dot never yields it and never flickers on hover. No ground ring: that
     separation is for a dot sitting on a card wash among its siblings, and the
     roll-up sits alone on the folded title. `--dot-inner` stays, so an archived
     roll-up keeps its hollow ring. */
  .rollup.dot {
    pointer-events: none;
    box-shadow: var(--dot-inner, 0 0 transparent);
  }

  /* Right (auto) track: the worktree annotation, swapping to the spawn cluster
     on hover. Capped so a long annotation can't starve the label track. */
  .dir-meta {
    grid-column: 5 / -1;
    justify-self: end;
    min-width: 0;
    max-width: 96px;
    display: grid;
    align-items: center;
    justify-items: end;
  }

  .dir-meta > * {
    grid-area: 1 / 1;
  }

  .dir-path {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10.5px;
    font-weight: 400;
    color: var(--fg-muted);
    transition:
      opacity 0.12s,
      visibility 0.12s;
  }

  /* Only branch rows carry a .dir-path (the worktree annotation); the repo/
     folder title has none, so this swap is branch-only. The condition has to be
     the exact one that shows the cluster below, `:focus-visible` included —
     they trade one cell, and a mismatch leaves it empty. */
  .branch-row:hover .dir-path,
  .branch-row:has(:focus-visible) .dir-path {
    visibility: hidden;
    opacity: 0;
  }

  .spawn-cluster {
    display: flex;
    visibility: hidden;
    opacity: 0;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    overflow: hidden;
    transition:
      opacity 0.12s,
      visibility 0.12s;
  }

  /* Only an OPEN card's title hands its cell to the cluster. Folded, the card
     is one line that says which repo it is and how it is doing, and the buttons
     would be answering a question nobody asked of a card that has been put
     away — the roll-up dot keeps that cell instead. Branch rows are unscoped
     because they only exist inside an open card.
     The keyboard half is `:has(:focus-visible)`, NOT `:focus-within`: the
     cluster starts `visibility: hidden`, which takes its buttons out of the tab
     order entirely, so the way in is to focus the title (the name carries
     tabindex) and have the buttons appear — which `:focus-within` did. What it
     also did was leave them showing after a MOUSE click, since the button it
     opened a menu from keeps focus and the mouse is long gone. `:focus-visible`
     splits exactly there: a keyboard focus matches, a click does not. */
  .card:not(.collapsed) .card-title:hover .spawn-cluster,
  .card:not(.collapsed) .card-title:has(:focus-visible) .spawn-cluster,
  .branch-row:hover .spawn-cluster,
  .branch-row:has(:focus-visible) .spawn-cluster {
    visibility: visible;
    opacity: 1;
  }

  /* A git repo's branch/worktree row: icon in col 1, name in col 2 (flush-left
     under the session dots), the worktree annotation / spawn cluster on the
     right tracks. */
  .branch-row {
    padding: 3px 0;
    color: var(--fg-muted);
    font-size: 12px;
    user-select: none;
  }

  .branch-icon {
    grid-column: 1;
    justify-self: start;
    font-size: 12px;
  }

  .branch-name {
    grid-column: 2 / 5;
    justify-self: stretch;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-weight: 500;
  }

  /* The name carries the ellipsis so the state markers never get pushed out. */
  .branch-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Branch-state markers (● dirty, ↑ahead ↓behind) — muted ink on purpose:
     the traffic-light colors stay reserved for the session dots. */
  .branch-state {
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: var(--fg-muted);
  }

  /* A real CSS disc, not the ● glyph — glyph metrics vary and rendered small.
     Sized to a lowercase o of the branch name (12px Segoe x-height ≈ 6px). */
  .state-dirty {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    align-self: center;
    flex-shrink: 0;
  }

  /* Session-row placement on the shared track template: dot col 2 (flush-left
     under the branch names), type icon col 3, name in the flexible label track,
     close in the auto right track. */
  .row .dot {
    grid-column: 2;
    justify-self: start;
  }

  .row .type-icon {
    grid-column: 3;
    justify-self: start;
  }

  /* 2px of air between the status dot and the type icon. The icon is 12px in
     an 18px track, so the shift spends the track's own slack: the glyph moves,
     the label track does not. Gated on the row actually having a dot — with
     the status dot off its track collapses to 0 and there is nothing to
     separate the icon from. */
  .row:has(.dot) .type-icon {
    margin-left: 2px;
  }

  /* 2px of air after the type icon, spent on the name rather than on the icon:
     the two are in separate fixed tracks, so a margin-right on the icon would
     push nothing. The rename field takes it too, so the text doesn't jump 1px
     when a row goes into edit. */
  .row .name,
  .row .rename {
    grid-column: 4 / 5;
    justify-self: stretch;
    margin-left: 2px;
  }

  .row .close {
    grid-column: 5 / -1;
    justify-self: end;
    /* nudge the × a few px in from the card's right edge */
    margin-right: 6px;
  }

  .spawn-btn {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 24px;
    height: 20px;
    padding: 0;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .spawn-btn + .spawn-btn {
    border-left: 1px solid var(--border);
  }

  .spawn-btn .material-symbols-outlined,
  .spawn-btn .svg-icon {
    font-size: 14px;
  }

  .spawn-btn:hover {
    background: var(--border);
    color: var(--accent);
  }

  .drop-hint {
    outline: 1px solid var(--accent);
    background: var(--bg);
  }

  /* The card's archive divider: a hairline carrying a glyph and a count, the
     fold toggle for the rows under it, and the drop target that crosses it.
     Not a grid child — it separates rows rather than being one, so it spans the
     card's whole width and ignores the shared track template.
     The label sits at the RIGHT end: the long rule leads and a short stub
     closes, so the count reads as sitting ON the line while the card's left
     margin stays clear for the dots and icons every row lines up on. */
  .archive-sep {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0 1px;
    padding: 2px 0;
    color: var(--fg-muted);
    font-size: 11px;
    cursor: pointer;
    user-select: none;
  }

  /* The rule is muted INK, not a border: it belongs to the count and the glyph
     sitting on it, which are `--fg-muted` too, so the divider reads as one
     object rather than a line with a label parked on it — at two thirds that
     ink, because a hairline carries a tone further than text does and the label
     is what should be read first. Thinned as a colour (`color-mix` toward
     transparent, so the token's 50% ink lands at 33%) rather than as `opacity`
     on the pseudo-elements, which would also fade the drop state's accent line
     below — that one has to stay full strength. */
  .archive-sep::before,
  .archive-sep::after {
    content: '';
    height: 1px;
    background: color-mix(in srgb, var(--fg-muted) 66%, transparent);
  }

  .archive-sep::before {
    flex: 1;
  }

  .archive-sep::after {
    width: 12px;
    flex: none;
  }

  .archive-sep:hover {
    color: var(--fg);
  }

  /* Drop target (a row crossing the divider): the whole rule lights up rather
     than the .drop-hint outline the rows use — this one is a line, and an
     outline around a 1px hairline reads as a glitch. */
  .archive-sep.over {
    color: var(--accent);
  }

  .archive-sep.over::before,
  .archive-sep.over::after {
    background: var(--accent);
  }

  .archive-count {
    display: flex;
    align-items: center;
    /* tight: the glyph labels the number, it isn't a second item beside it */
    gap: 2px;
    flex: none;
  }

  .archive-count .material-symbols-outlined {
    font-size: 14px;
  }

  /* Grid comes from the shared .card-title/.branch-row/.row rule; here only the
     row's own chrome. A bit more vertical padding gives the focused/hover box
     more height and separates the rows. */
  .row {
    padding: 5px 0;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background: var(--border);
  }

  /* The focused row is its FILL and nothing else. The 1px outline it used to
     wear drew a second box inside the card's own edge — two borders a few px
     apart, saying the same thing; the ground change alone is enough to find
     the row you are typing into. */
  .row.focused {
    background: var(--bg);
  }

  /* A clickable control now (toggles the TODO flag) — reset the button chrome
     down to the 10px disc; the status classes still paint the fill. */
  .dot {
    background: var(--dot-fill, transparent);
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    padding: 0;
    appearance: none;
    cursor: pointer;
    /* A 1px ring of the page ground at half opacity, so the traffic light
       reads as its own colour instead of as a colour mixed into whatever card
       wash it is sitting on — a separation, not a hard outline. A box-shadow
       rather than a border: it draws OUTSIDE the 10px disc, follows the
       radius, and costs no layout, so the dot's track and the hover ring's
       4px offset are untouched. It fades with the dot
       under the waiting pulse and the exited fade, both of which are opacity
       on the whole element — which is right, the ring belongs to the dot.
       `--dot-inner` is the same indirection --dot-fill uses: box-shadow is one
       non-additive shorthand, so a state that wants its own ring (archived,
       below) contributes it as a variable instead of replacing this one and
       silently dropping the ground ring with it. */
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--bg) 50%, transparent),
      var(--dot-inner, 0 0 transparent);
  }

  /* Hover affordance: an instant ring around the dot (no tween). The outline
     follows the border-radius, so it reads as a concentric circle — colored
     like the session title text (--fg), spaced out for clear separation. */
  .dot:hover {
    outline: 1px solid var(--fg);
    outline-offset: 4px;
  }

  /* These are inline svg, so they take their size from the same
     font-size rules as the font icons — 1em square, and never flex-shrunk. */
  .svg-icon {
    width: 1em;
    height: 1em;
    flex: none;
  }

  .type-icon {
    font-size: 12px;
    color: var(--fg-muted);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  /* "Color title glyph" (settings, off by default): the title's leading glyph
     painted by which glyph it is — star family green, circle family red. The
     Primer semantic tones, deliberately NOT the --dot-* palette: this axis
     reads the glyph, not the session's status, so Status RGB doesn't reach it. */
  .name .glyph.star {
    color: var(--success);
  }

  .name .glyph.circle {
    color: var(--danger);
  }

  .rename {
    min-width: 0;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 1px 4px;
    outline: none;
  }

  /* The repo title's inline worktree-name field spans the title's label tracks
     (the session rename sits in the row's label track instead). */
  .card-title .rename {
    grid-column: 1 / 5;
    justify-self: stretch;
    font-weight: 400;
  }

  /* Traffic lights from the user's point of view — every color answers
     "is this session mine to act on?": red = the agent is driving (hands
     off), pulsing amber = it's asking for you, green = your turn. The fills
     come from --dot-* (see the `dots` derived): Primer semantic tokens with
     roles remapped by default, pure RGB when the Status RGB setting is on. */
  .dot.running {
    --dot-fill: var(--dot-running);
  }

  /* A live shell is not an agent state — neutral ink, a power LED.
     "running" only means the PTY is alive; it fades via .exited when it
     dies, and green stays exclusive to "a Claude awaits you". */
  .dot.plain.running {
    --dot-fill: var(--fg);
  }

  .dot.waiting {
    --dot-fill: var(--dot-waiting);
    animation: pulse 1.2s ease-in-out infinite;
  }

  /* delegating: the main turn ended but subagents are still working. Same amber
     as waiting — work is happening, you're not blocked — but STATIC. The pulse
     is reserved for "it wants you", the one state that should catch your eye. */
  .dot.delegating {
    --dot-fill: var(--dot-waiting);
  }

  .dot.idle {
    --dot-fill: var(--dot-idle);
  }

  .dot.exited {
    --dot-fill: var(--fg-muted);
    opacity: 0.5;
  }

  /* TODO overlay (issue #3): a cosmetic per-session "revisit later" flag,
     toggled by clicking the dot. Pulses blue over whatever the underlying
     status color is — the theme accent by default, pure #0000FF under Status
     RGB (--dot-todo, see the `dots` derived). !important so it outranks the
     3-class .dot.plain.running fill; opacity resets the .exited dimming. */
  .dot.todo {
    --dot-fill: var(--dot-todo) !important;
    opacity: 1;
    animation: pulse 1.2s ease-in-out infinite;
  }

  /* Archived (session archive): the SAME colour, drawn hollow. Every status
     above sets --dot-fill rather than painting `background` itself, so this one
     rule turns all of them inside out — the neutral shell tint and the blue
     TODO pulse included — without knowing any of their colours. An inset shadow,
     not a border: a border would eat into the 10px box and shrink the disc. */
  .dot.archived {
    background: transparent;
    --dot-inner: inset 0 0 0 1.5px var(--dot-fill);
  }

  /* The pulse animates element opacity, which drags the hover outline with it.
     Freeze it on hover for any pulsing dot (waiting, todo) so the ring never
     pulsates — the dot goes solid while pointed at. */
  .dot.waiting:hover,
  .dot.todo:hover {
    animation: none;
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  .close {
    visibility: hidden;
    flex-shrink: 0;
    border: none;
    background: none;
    color: var(--fg-muted);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
  }

  .row:hover .close {
    visibility: visible;
  }

  .close:hover {
    color: var(--danger);
  }

  .tower-filter {
    display: flex;
    gap: 6px;
    padding: 8px;
  }

  /* Every control in the bar is ONE outer height, stated as the outer height.
     They drifted because `height` was measuring different boxes: a <div> is
     content-box, so the search box's 26px became 28 once its 1px border was
     added, while a <button> is border-box in the UA sheet and the settings
     button's identical 26px stayed 26. Pinning box-sizing here means the number
     below is what you see, whatever the element is and whether or not it wears
     a border — the spawn group's buttons are the exception that proves it, at
     `auto` so they stretch to fill the group's box rather than carrying a
     height of their own inside it.

     They also share the CARD's 2px radius, stated once here rather than three
     times: the bar sits directly above the cards, and at 6px its controls were
     the roundest boxes in a chrome that corners everything else at 2px or
     less. The spawn group's inner buttons still square off to 0 below — the
     group's own box is what carries the corner. */
  .search,
  .icon-btn,
  .spawn-group {
    box-sizing: border-box;
    height: 28px;
    border-radius: 2px;
  }

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    border: 1px solid var(--border);
    background: var(--bg);
  }

  .search:focus-within {
    border-color: var(--accent);
  }

  .search .material-symbols-outlined {
    font-size: 14px;
    color: var(--fg-muted);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--fg);
    font-size: 12px;
    font-family: inherit;
    outline: none;
  }

  .search .clear {
    border: none;
    background: none;
    color: var(--fg-muted);
    font-size: 13px;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }

  .search .clear:hover {
    color: var(--danger);
  }

  .chip {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    /* the bar's 2px, the same corner the cards and the controls around it
       wear — it sits inside the search box, not beside it */
    border-radius: 2px;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .chip .material-symbols-outlined,
  .chip .svg-icon {
    font-size: 14px;
  }

  .chip:hover {
    color: var(--accent);
  }

  .chip.active {
    color: var(--accent);
    background: var(--bg-subtle);
    outline: 1px solid var(--accent);
  }

  .chip.type-filter {
    display: flex;
    align-items: center;
    width: auto;
    padding: 0 3px;
    gap: 1px;
  }

  .chip.type-filter .caret {
    font-size: 12px;
  }

  .icon-btn {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 28px;
    padding: 0;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-muted);
    cursor: pointer;
  }

  /* Segmented pill for the spawn buttons — same idiom as the folder
     header's hover cluster */
  .spawn-group {
    flex: 0 0 auto;
    display: flex;
    border: 1px solid var(--border);
    background: var(--bg);
    overflow: hidden;
  }

  .spawn-group .icon-btn {
    /* stretch to the group's inner height instead of setting one — the group
       already owns the outer 28px, and a fixed height inside it would be the
       group's height minus its border, restated */
    height: auto;
    border: none;
    border-radius: 0;
  }

  .spawn-group .icon-btn + .icon-btn {
    border-left: 1px solid var(--border);
  }

  .spawn-group .icon-btn:hover {
    background: var(--border);
  }

  .icon-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .icon-btn .material-symbols-outlined,
  .icon-btn .svg-icon {
    font-size: 16px;
  }

  .pane {
    flex: 1;
    min-width: 0;
    padding: 8px;
    position: relative;
  }

  .host {
    width: 100%;
    height: 100%;
    flex-direction: column;
  }

  /* GitHub-style underline tabs, only rendered on Claude sessions. */
  .tabs {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 5px;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    background: none;
    color: var(--fg-muted);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }

  .tab .material-symbols-outlined,
  .tab .svg-icon {
    font-size: 14px;
  }

  .tab:hover {
    color: var(--fg);
  }

  .tab.active {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }

  .view {
    flex: 1;
    min-height: 0;
  }

  /* Shared empty-state idiom — deliberately :global so the pane's
     "No sessions" and the preview's "No conversation yet" stay one rule. */
  :global(.empty) {
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 12px;
    color: var(--fg-muted);
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .menu {
    position: fixed;
    z-index: 11;
    display: flex;
    flex-direction: column;
    min-width: 150px;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--fg);
    font-size: 12px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Hover fills paint with `border`, not `bg-subtle` — the same idiom as
     .row/.icon-btn/.spawn-btn above. Load-bearing since dark's bgSubtle IS
     its bg (#000000): a subtle fill is invisible there. */
  .menu-item:hover {
    background: var(--border);
  }

  .menu-item .material-symbols-outlined,
  .menu-item .svg-icon {
    font-size: 15px;
    color: var(--fg-muted);
  }

  .menu-item.color {
    text-transform: capitalize;
  }

  .menu-item.active {
    color: var(--accent);
  }

  .menu-item.active .material-symbols-outlined,
  .menu-item.active .svg-icon {
    color: var(--accent);
  }

  .menu-divider {
    height: 1px;
    margin: 4px 0;
    background: var(--border);
  }

  .menu-label {
    padding: 2px 8px 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  /* Centered dialog (not positioned like the context menus). It deliberately
     STOPS sharing the popup menus' row language: a menu is a list of things to
     do, a settings panel is a set of states to read, and dressing the second as
     the first is what made twenty-three near-identical rows. Wide enough for a
     label-left / control-right grid, and tall enough that nothing scrolls at a
     normal window size. */
  .settings-modal {
    position: fixed;
    z-index: 11;
    /* Centred until it is dragged, at which point the inline left/top take
       over and the centring transform has to stop pulling it half its own
       size up and left. */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    width: 400px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 64px);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .settings-modal.dragged {
    transform: none;
  }

  /* Also the drag handle (see dragSettings): the title bar of a small window,
     which is where anyone would reach for it. No text selection, or a drag
     across the title highlights the word instead of moving the panel. */
  .settings-header {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    padding: 9px 9px 9px 14px;
    border-bottom: 1px solid var(--border);
    cursor: move;
    user-select: none;
  }

  .settings-header .material-symbols-outlined:first-child {
    font-size: 16px;
    color: var(--fg-muted);
  }

  .settings-title {
    flex: 1;
    font-size: 12.5px;
    font-weight: 600;
  }

  /* With the backdrop gone this is the only pointer way out (Escape is the
     other), so it is no longer decoration. */
  .settings-close {
    display: flex;
    flex: none;
    padding: 3px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .settings-close:hover {
    background: var(--border);
    color: var(--fg);
  }

  .settings-close .material-symbols-outlined {
    font-size: 17px;
  }

  .settings-body {
    overflow-y: auto;
    padding: 12px 14px 14px;
  }

  /* One section per thing you'd come here to change. The heading is the Session
     tab's, deliberately — the app already has a "group of labelled facts" idiom
     and this is the same shape. */
  .set-group + .set-group {
    margin-top: 16px;
  }

  .set-group h2 {
    margin: 0 0 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  /* Label left, control right, on one track pair — so every control in the
     panel starts at the same x and the eye runs down one column, not twenty. */
  .set-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 32px;
  }

  .set-label {
    font-size: 12px;
  }

  .set-hint {
    margin: 2px 0 0;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--fg-muted);
  }

  /* Segmented control: for a choice of two or three, where showing the options
     costs less than hiding them behind a menu and the set reads as one control. */
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
  }

  .seg {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px 4px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--fg-muted);
    font-family: inherit;
    font-size: 11px;
    white-space: nowrap;
    cursor: pointer;
  }

  .seg:hover {
    color: var(--fg);
  }

  /* The selected segment lifts onto the panel's own surface — the inverse of
     the track it sits in, which is what makes it read as pressed. */
  .seg.on {
    background: var(--bg);
    color: var(--fg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
  }

  .seg .material-symbols-outlined {
    font-size: 14px;
  }

  /* Switch: the shape of an on/off state. The knob is a child rather than a
     pseudo-element so the transition is on a real box. */
  .switch {
    position: relative;
    flex: none;
    width: 32px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg-subtle);
    cursor: pointer;
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  .switch.on {
    background: var(--accent);
    border-color: var(--accent);
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--fg-muted);
    transition:
      transform 0.15s,
      background-color 0.15s;
  }

  .switch.on .knob {
    transform: translateX(14px);
    /* on the accent fill, not on the page — a palette token would vanish */
    background: #ffffff;
  }

  /* Font picker: the current face, set in that face. A font name in the app's
     own font tells you nothing about the font. */
  .picker {
    display: flex;
    align-items: center;
    gap: 3px;
    max-width: 210px;
    padding: 3px 5px 3px 9px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
    color: var(--fg);
    font-size: 12px;
    cursor: pointer;
  }

  .picker:hover,
  .picker.open {
    border-color: var(--fg-muted);
  }

  .picker-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .picker .material-symbols-outlined {
    flex: none;
    font-size: 16px;
    color: var(--fg-muted);
    transition: transform 0.12s;
  }

  .picker.open .material-symbols-outlined {
    transform: rotate(180deg);
  }

  /* The unfolded list: chips rather than rows, because five short names read
     faster wrapped than stacked, and each one is its own specimen. */
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0 0 4px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
  }

  .option {
    padding: 3px 8px 4px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg-muted);
    font-size: 11.5px;
    cursor: pointer;
  }

  .option:hover {
    color: var(--fg);
  }

  .option.on {
    border-color: var(--accent);
    color: var(--fg);
  }

  .dir-parent {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    color: var(--fg-muted);
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
