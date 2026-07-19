<script lang="ts">
  import Terminal from './Terminal.svelte'
  import Preview from './Preview.svelte'
  import { palettes } from './theme'
  import type { Mode } from './theme'
  import {
    sessions,
    dirOrder,
    ui,
    newSession,
    closeSession,
    applyStatus,
    restoreState,
    snapshotState,
    cleanTitle,
    duplicateSession,
    renameSession,
    nudgeStatusFromKey,
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
    noteTitleForStatus,
    gitInfo,
    groupCwds,
    refreshAllGitInfo,
    collapsedGroups,
    toggleCollapsed,
    parkedWorktrees,
    worktreeSpawnName,
    sessionTargetCwd
  } from './sessions.svelte'
  import type { Session, WorktreeEntry } from './sessions.svelte'
  import { DOT_COLORS, FONTS, UI_FONTS, fontStack } from './theme'

  // One menu at a time, one scaffold (backdrop + positioned panel + Escape)
  // for all five. spawn: the filter bar's per-type dropdowns — recent
  // directories plus Browse…; sessions in a live directory spawn from the
  // group header's hover cluster instead. type-filter: the filter box's
  // session-type dropdown. color: right-click a group header.
  // session: right-click a session row. worktrees: the repo card's reopen
  // menu — parked worktrees fetched on click, items carried in the menu.
  type Menu =
    | { kind: 'spawn'; type: 'shell' | 'claude'; x: number; y: number }
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

  const MODES: Mode[] = ['system', 'light', 'dark']
  const MODE_LABELS: Record<Mode, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark'
  }

  let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches)

  $effect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => {
      systemDark = event.matches
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  // Hook-driven status stream (main's localhost status server → renderer).
  $effect(() => {
    const off = window.arc.status.onChange(applyStatus)
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

  // Window/taskbar icon: the sports_motorsports glyph (racing helmet, weight
  // 300), white on black, rendered from the bundled icon font once it's
  // loaded. Rasterized fresh at every DPI size Windows may ask for — one big
  // bitmap downscaled looks pixelated.
  $effect(() => {
    void document.fonts.ready.then(() => {
      // base DIP size 32; scaleFactor n => 32n pixels
      const representations = [0.5, 1, 1.25, 1.5, 2, 4, 8].map((scaleFactor) => {
        const size = Math.round(32 * scaleFactor)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return { scaleFactor, dataURL: '' }
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#ffffff'
        ctx.font = `300 ${Math.round(size * 0.875)}px "Material Symbols Outlined"`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('sports_motorsports', size / 2, size * 0.54)
        return { scaleFactor, dataURL: canvas.toDataURL('image/png') }
      })
      window.arc.setAppIcon(representations.filter((r) => r.dataURL))
    })
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
  const dots = $derived(
    ui.statusRgb
      ? { running: '#ff0000', waiting: '#ffaa00', idle: '#00ff00', todo: '#0000ff' }
      : {
          running: palette.chrome.danger,
          waiting: palette.chrome.attention,
          idle: palette.chrome.success,
          todo: palette.chrome.accent
        }
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
  // the terminal title, else the bare type. Never the folder name.
  function displayName(session: (typeof sessions)[number]): string {
    return (
      session.name || cleanTitle(session.title) || (session.type === 'claude' ? 'Claude' : 'Shell')
    )
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
  type GroupView =
    | {
        kind: 'plain'
        key: string
        cwd: string
        repCwd: string
        sessions: Session[]
        visible: Session[]
      }
    | { kind: 'repo'; key: string; repoName: string; repCwd: string; branches: BranchView[] }

  const tower = $derived.by<GroupView[]>(() =>
    groupCwds(dirOrder, gitInfo).map((group): GroupView => {
      if (group.kind === 'plain') {
        const inDir = sessions.filter((s) => s.cwd === group.cwd)
        return {
          kind: 'plain',
          key: group.key,
          cwd: group.cwd,
          repCwd: group.cwd,
          sessions: inDir,
          visible: inDir.filter(sessionMatches)
        }
      }
      const branches: BranchView[] = group.cwds.map((cwd) => {
        const info = gitInfo[cwd]
        // Pending worktree spawns are pulled out of their spawn cwd's row —
        // they render on a synthetic destination row below instead.
        const inDir = sessions.filter((s) => s.cwd === cwd && !s.spawnWorktree)
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
        if (s.spawnWorktree && group.cwds.includes(s.cwd)) {
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
      return {
        kind: 'repo',
        key: group.key,
        repoName: group.repoName,
        repCwd: group.cwds[0] ?? group.key,
        branches
      }
    })
  )

  // The aggregate status dot a collapsed card shows on its title, most-urgent
  // first: waiting (a session wants you) › a running Claude (agent driving) ›
  // any other running (a live shell) › idle (your turn) › exited. Carries the
  // winning session's type so a lone running shell reads neutral (`plain`),
  // never red — the same per-type colours the rows use. null = no sessions.
  function rollupDot(group: GroupView): { status: Session['status']; plain: boolean } | null {
    const all = group.kind === 'plain' ? group.sessions : group.branches.flatMap((b) => b.sessions)
    const pick =
      all.find((s) => s.status === 'waiting') ??
      all.find((s) => s.status === 'running' && s.type === 'claude') ??
      all.find((s) => s.status === 'running') ??
      all.find((s) => s.status === 'idle') ??
      all.find((s) => s.status === 'exited')
    return pick ? { status: pick.status, plain: pick.type === 'shell' } : null
  }

  // --- drag & drop (same-window; component state, not dataTransfer) ---
  // Whole group cards (repo or plain folder) reorder against each other, moving
  // the whole group's cwd block — the card is the drag handle, so grabbing
  // anywhere on it that isn't a session row moves it. Sessions reorder within
  // their own cwd only (a session's directory is a fact); their row stops
  // dragstart from bubbling so a reorder doesn't become a card move. Branch
  // subfolders aren't independently draggable — they order by first appearance.
  type Drag = { kind: 'session'; key: number; cwd: string } | { kind: 'group'; groupKey: string }
  let dragging = $state<Drag | null>(null)
  // The drop preview. Sessions: `session-<key>` (the row highlights). Groups: an
  // insertion line at a gap — `group-before-<key>` (line above that card) or
  // `group-after-<key>` (line below it), so you see where the card will land.
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

<div
  class="shell"
  style:--ui-font={chromeFont}
  style:--bg={palette.chrome.bg}
  style:--bg-subtle={palette.chrome.bgSubtle}
  style:--fg={palette.chrome.fg}
  style:--fg-muted={palette.chrome.fgMuted}
  style:--border={palette.chrome.border}
  style:--accent={palette.chrome.accent}
  style:--danger={palette.chrome.danger}
  style:--success={palette.chrome.success}
  style:--dot-running={dots.running}
  style:--dot-waiting={dots.waiting}
  style:--dot-idle={dots.idle}
  style:--dot-todo={dots.todo}
>
  <aside class="tower" style:width={`${ui.towerWidth}px`}>
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
          <span class="material-symbols-outlined">asterisk</span>
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
          <span class="material-symbols-outlined">terminal_2</span>
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
          <span class="material-symbols-outlined">
            {filterClaude ? 'asterisk' : filterShell ? 'terminal_2' : 'filter_list'}
          </span>
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
          {#if group.sessions.length > 0 && (!filterActive || group.visible.length > 0)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="card"
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
                  <span class="spawn-cluster">{@render spawnButtons(group.cwd)}</span>
                </span>
              </div>
              {#if !collapsedGroups[group.key]}
                {#each group.visible as session (session.key)}
                  {@render sessionRow(session)}
                {/each}
              {/if}
            </div>
          {/if}
        {:else}
          {@const branches = group.branches.filter(
            (b) => b.sessions.length > 0 && (!filterActive || b.visible.length > 0)
          )}
          {#if branches.length > 0}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="card"
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
      <div class="host" style:display={ui.focused === session.key ? 'flex' : 'none'}>
        {#if session.type === 'claude'}
          <div class="tabs" role="tablist">
            <button
              class="tab"
              class:active={session.view === 'terminal'}
              role="tab"
              aria-selected={session.view === 'terminal'}
              onclick={() => (session.view = 'terminal')}
            >
              <span class="material-symbols-outlined">terminal_2</span>Terminal
            </button>
            <button
              class="tab"
              class:active={session.view === 'preview'}
              role="tab"
              aria-selected={session.view === 'preview'}
              onclick={() => (session.view = 'preview')}
            >
              <span class="material-symbols-outlined">article</span>Preview
            </button>
          </div>
        {/if}
        <!-- The terminal stays mounted while hidden — the PTY's lifetime is
             the session. The preview mounts/unmounts with its tab. -->
        <div class="view" style:display={session.view === 'terminal' ? 'block' : 'none'}>
          <Terminal
            type={session.type}
            cwd={session.cwd}
            resume={session.resumeId ?? undefined}
            worktree={session.spawnWorktree ?? undefined}
            active={ui.focused === session.key && session.view === 'terminal'}
            {focusEpoch}
            theme={palette.xterm}
            fontFamily={monoFont}
            onSpawned={(ptyId, claudeSessionId, cwd) => {
              session.ptyId = ptyId
              session.claudeSessionId = claudeSessionId ?? null
              // Immutable hook routing token; claudeSessionId may change on
              // /clear, hookToken never does (see applyStatus, issue #2).
              session.hookToken = claudeSessionId ?? null
              applySpawnCwd(session.key, cwd)
            }}
            onExited={() => setStatus(session, 'exited')}
            onInput={(data) => nudgeStatusFromKey(session.key, data)}
            onTitle={(title) => {
              session.title = title
              // The spinner in the title is our interrupt watchdog (issue #6).
              noteTitleForStatus(session.key, title)
            }}
          />
        </div>
        {#if session.view === 'preview'}
          <div class="view">
            {#if session.claudeSessionId && ui.focused === session.key}
              <!-- mounted for the focused session only: unmounting disarms
                   the tail, and the store cache makes refocus instant -->
              <Preview
                sessionId={session.claudeSessionId}
                cwd={session.cwd}
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

  <!-- One radio group per font setting. Each label previews itself in its own
       family (the icon keeps its own font). font-family only — terminal/preview
       size is the Ctrl+=/−/0 zoom. -->
  {#snippet fontGroup(
    label: string,
    list: typeof FONTS,
    selected: string,
    pick: (id: string) => void
  )}
    <div class="menu-divider"></div>
    <div class="menu-label">{label}</div>
    {#each list as font (font.id)}
      <button
        class="menu-item"
        role="menuitemradio"
        aria-checked={selected === font.id}
        style:font-family={font.stack}
        onclick={() => pick(font.id)}
      >
        <span class="material-symbols-outlined"
          >{selected === font.id ? 'radio_button_checked' : 'radio_button_unchecked'}</span
        >{font.label}
      </button>
    {/each}
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
      {#if collapsed}
        {@const r = rollupDot(group)}
        {#if r}<span class="rollup dot {r.status}" class:plain={r.plain}></span>{/if}
      {/if}
      <span class="name-text">
        {group.kind === 'plain' ? dirLabel(group.cwd).base : group.repoName}
      </span>
    </span>
  {/snippet}

  <!-- The header hover cluster: new Claude / new shell / Show in Explorer, all
       targeting one cwd. Shared by the plain-folder header and each git branch
       subfolder (issue #5) — the leaf group always owns the spawn affordances. -->
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
      <span class="material-symbols-outlined">asterisk</span>
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
      <span class="material-symbols-outlined">terminal_2</span>
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
        dragging = { kind: 'session', key: session.key, cwd: session.cwd }
      }}
      ondragend={endDrag}
      ondragover={(e) =>
        allowDrop(
          e,
          `session-${session.key}`,
          dragging?.kind === 'session' &&
            dragging.key !== session.key &&
            dragging.cwd === session.cwd
        )}
      ondragleave={() => (dropHint = null)}
      ondrop={() => dropOnSession(session)}
      onclick={() => focusSession(session.key)}
      oncontextmenu={(e) => {
        e.preventDefault()
        openMenu({ kind: 'session', key: session.key, x: e.clientX, y: e.clientY }, 220)
      }}
      onkeydown={(e) => e.key === 'Enter' && focusSession(session.key)}
    >
      <button
        class="dot {session.status}"
        class:plain={session.type === 'shell'}
        class:todo={session.todo}
        title={session.todo ? 'TODO — click to clear' : `${session.status} — click to flag`}
        aria-label={session.todo ? 'Clear TODO flag' : 'Flag TODO'}
        aria-pressed={session.todo}
        onclick={(e) => {
          e.stopPropagation()
          toggleTodo(session.key)
        }}
      ></button>

      <span
        class="type-icon material-symbols-outlined"
        title={session.type === 'claude' ? 'Claude session' : 'Shell session'}
        >{session.type === 'claude' ? 'asterisk' : 'terminal_2'}</span
      >

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
        <span
          class="name"
          role="button"
          tabindex="-1"
          title={`${session.cwd} — double-click to rename`}
          ondblclick={() => (renaming = session.key)}>{displayName(session)}</span
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
          <span class="material-symbols-outlined">asterisk</span>Claude sessions
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
          <span class="material-symbols-outlined">terminal_2</span>Shell sessions
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
          {#if menuSession.type === 'claude'}
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
    <div
      class="menu-backdrop modal-backdrop"
      role="presentation"
      onclick={() => (settingsOpen = false)}
    ></div>
    <div class="settings-modal" role="dialog" aria-label="Settings" aria-modal="true">
      <div class="settings-header">
        <span class="material-symbols-outlined">settings</span>
        <span class="settings-title">Settings</span>
      </div>
      <div class="settings-body">
        <div class="menu-label">Theme</div>
        {#each MODES as mode (mode)}
          <button
            class="menu-item"
            role="menuitemradio"
            aria-checked={ui.mode === mode}
            onclick={() => (ui.mode = mode)}
          >
            <span class="material-symbols-outlined"
              >{ui.mode === mode ? 'radio_button_checked' : 'radio_button_unchecked'}</span
            >{MODE_LABELS[mode]}
          </button>
        {/each}

        <div class="menu-divider"></div>
        <button
          class="menu-item"
          role="menuitemcheckbox"
          aria-checked={ui.statusRgb}
          onclick={() => (ui.statusRgb = !ui.statusRgb)}
        >
          <span class="material-symbols-outlined"
            >{ui.statusRgb ? 'check_box' : 'check_box_outline_blank'}</span
          >Status RGB
        </button>
        {@render fontGroup('Terminal', FONTS, ui.font, (id) => (ui.font = id))}
        {@render fontGroup('Interface', UI_FONTS, ui.uiFont, (id) => (ui.uiFont = id))}
        {@render fontGroup('Preview', UI_FONTS, ui.previewFont, (id) => (ui.previewFont = id))}
      </div>
    </div>
  {/if}
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      if (settingsOpen) settingsOpen = false
      else if (menu) menu = null
    }
  }}
/>

<style>
  :global(html, body, #app) {
    margin: 0;
    height: 100%;
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

  .tower {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--bg-subtle);
  }

  .splitter {
    /* 5px hit area; visible line is the content-box (width minus padding) */
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    /* VS Code sash: invisible at rest — the tower/pane background change
       marks the boundary; the accent line appears on hover/drag. */
    background: transparent;
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
    /* right pad matches the filter bar's 8px so row/header boxes and the
       spawn cluster end flush with the search box */
    padding: 0 8px 0 4px;
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
    /* left padding clears the 2px edge tab (2 + 11) */
    padding: 4px 8px 10px 13px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--dir-color) 8%, var(--bg-subtle));
    /* the whole card is the group's drag handle (session rows override to
       pointer) — grab anywhere on it to reorder the group */
    cursor: grab;
  }

  /* While a drag is in flight, collapse each drop target to a single hit
     surface: its inner content stops taking pointer events. Native DnD still
     fires :hover under the cursor and fires dragenter/dragleave as the pointer
     crosses child boundaries — that's what makes chrome light up and the drop
     hint flicker mid-drag. Killing pointer-events on the contents stops both.
     A group drag drops onto whole cards, so the entire card interior goes
     inert; a session drag drops onto rows, so only the row stays live (its own
     children go inert) while titles and branch rows freeze. */
  .tower-body[data-dragging='group'] .card * {
    pointer-events: none;
  }

  .tower-body[data-dragging='session'] .card-title,
  .tower-body[data-dragging='session'] .branch-row,
  .tower-body[data-dragging='session'] .row > * {
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
    grid-template-columns: 18px 16px 18px minmax(0, 1fr) auto;
    align-items: center;
  }

  /* Repo/folder title. Marker "none-left": the name is a flush-left heading in
     col 1 (no icon). The title carries the group's colour menu; the whole card
     (its parent) is the drag handle. */
  .card-title {
    padding: 3px 0 4px;
    color: var(--fg);
    font-weight: 600;
    user-select: none;
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
     shell tint and the waiting pulse). Decorative — clicks and hover fall
     through to the folder-name toggle. */
  .rollup {
    pointer-events: none;
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
     folder title has none, so this swap is branch-only. */
  .branch-row:hover .dir-path,
  .branch-row:focus-within .dir-path {
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

  .card-title:hover .spawn-cluster,
  .card-title:focus-within .spawn-cluster,
  .branch-row:hover .spawn-cluster,
  .branch-row:focus-within .spawn-cluster {
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

  .row .name,
  .row .rename {
    grid-column: 4 / 5;
    justify-self: stretch;
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

  .spawn-btn .material-symbols-outlined {
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

  .row.focused {
    background: var(--bg);
    outline: 1px solid var(--border);
  }

  /* A clickable control now (toggles the TODO flag) — reset the button chrome
     down to the 10px disc; the status classes still paint the fill. */
  .dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    padding: 0;
    appearance: none;
    cursor: pointer;
  }

  /* Hover affordance: an instant ring around the dot (no tween). The outline
     follows the border-radius, so it reads as a concentric circle — colored
     like the session title text (--fg), spaced out for clear separation. */
  .dot:hover {
    outline: 1px solid var(--fg);
    outline-offset: 4px;
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
    background: var(--dot-running);
  }

  /* A live shell is not an agent state — neutral ink, a power LED.
     "running" only means the PTY is alive; it fades via .exited when it
     dies, and green stays exclusive to "a Claude awaits you". */
  .dot.plain.running {
    background: var(--fg);
  }

  .dot.waiting {
    background: var(--dot-waiting);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .dot.idle {
    background: var(--dot-idle);
  }

  .dot.exited {
    background: var(--fg-muted);
    opacity: 0.5;
  }

  /* TODO overlay (issue #3): a cosmetic per-session "revisit later" flag,
     toggled by clicking the dot. Pulses blue over whatever the underlying
     status color is — the theme accent by default, pure #0000FF under Status
     RGB (--dot-todo, see the `dots` derived). !important so it outranks the
     3-class .dot.plain.running fill; opacity resets the .exited dimming. */
  .dot.todo {
    background: var(--dot-todo) !important;
    opacity: 1;
    animation: pulse 1.2s ease-in-out infinite;
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
    border-bottom: 1px solid var(--border);
  }

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
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
    border-radius: 4px;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .chip .material-symbols-outlined {
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
    height: 26px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
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
    border-radius: 6px;
    background: var(--bg);
    overflow: hidden;
  }

  .spawn-group .icon-btn {
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

  .icon-btn .material-symbols-outlined {
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

  .tab .material-symbols-outlined {
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

  /* Only the settings dialog dims behind it — the transient context menus
     stay a plain click-catcher so they don't read as blocking the tower. */
  .modal-backdrop {
    background: rgba(0, 0, 0, 0.75);
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

  .menu-item:hover {
    background: var(--bg-subtle);
  }

  .menu-item .material-symbols-outlined {
    font-size: 15px;
    color: var(--fg-muted);
  }

  .menu-item.color {
    text-transform: capitalize;
  }

  .menu-item.active {
    color: var(--accent);
  }

  .menu-item.active .material-symbols-outlined {
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

  /* Centered dialog (not positioned like the context menus) — same surface
     language (.menu-item/.menu-label/.menu-divider) as the popup menus. */
  .settings-modal {
    position: fixed;
    z-index: 11;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    width: 260px;
    max-height: calc(100vh - 64px);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 8px 8px 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .settings-header .material-symbols-outlined:first-child {
    font-size: 15px;
    color: var(--fg-muted);
  }

  .settings-title {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
  }

  .settings-body {
    overflow-y: auto;
    padding: 4px;
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
