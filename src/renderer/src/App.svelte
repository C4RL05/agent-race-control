<script lang="ts">
  import Terminal from './Terminal.svelte'
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
    dirColors,
    setDirColor,
    applyFolderColor,
    moveDir,
    moveSession
  } from './sessions.svelte'
  import { DOT_COLORS } from './theme'

  // Right-click color picker for a directory group header.
  let colorMenu = $state<{ dir: string; x: number; y: number } | null>(null)
  // Right-click context menu for a session row.
  let sessionMenu = $state<{ key: number; x: number; y: number } | null>(null)
  // The + button's create dropdown (opens upward from the bottom toolbar).
  // Both items open the OS folder picker — sessions in an existing directory
  // are spawned from that group header's hover buttons instead.
  let addMenu = $state<{ x: number; bottom: number } | null>(null)

  function dirLabel(dir: string): { base: string; parent: string } {
    const parts = dir.split(/[\\/]/).filter(Boolean)
    return { base: parts.pop() ?? dir, parent: parts.join('\\') }
  }

  let draggingRail = $state(false)

  function railDrag(event: PointerEvent): void {
    if (!draggingRail) return
    ui.railWidth = Math.min(480, Math.max(160, Math.round(event.clientX)))
  }

  const MODES: Mode[] = ['system', 'light', 'dark']
  const MODE_ICONS: Record<Mode, string> = {
    system: 'contrast',
    light: 'light_mode',
    dark: 'dark_mode'
  }

  function cycleMode(): void {
    ui.mode = MODES[(MODES.indexOf(ui.mode) + 1) % MODES.length]
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

  // Window/taskbar icon: the sports_motorsports glyph (racing helmet), white
  // on #ff1561, rendered from the bundled icon font. Rasterized fresh at every
  // DPI size Windows may ask for — one big bitmap downscaled looks pixelated.
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

  let renaming = $state<number | null>(null)

  // Rail filter: text matches name/title/cwd; chips narrow by session type.
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
      session.name.toLowerCase().includes(query) ||
      cleanTitle(session.title).toLowerCase().includes(query) ||
      session.cwd.toLowerCase().includes(query)
    )
  }

  function commitRename(key: number, value: string): void {
    const session = sessions.find((s) => s.key === key)
    if (session && value.trim()) session.name = value.trim()
    renaming = null
  }

  // --- drag & drop (same-window; component state, not dataTransfer) ---
  // Directory headers reorder against each other; sessions reorder within
  // their own directory group only (a session's directory is a fact).
  type Drag = { kind: 'session'; key: number; cwd: string } | { kind: 'dir'; dir: string }
  let dragging = $state<Drag | null>(null)
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

  function dropOnDir(dir: string): void {
    if (dragging?.kind === 'dir') moveDir(dragging.dir, dir)
    endDrag()
  }
</script>

<div
  class="shell"
  style:--bg={palette.chrome.bg}
  style:--bg-subtle={palette.chrome.bgSubtle}
  style:--fg={palette.chrome.fg}
  style:--fg-muted={palette.chrome.fgMuted}
  style:--border={palette.chrome.border}
  style:--accent={palette.chrome.accent}
  style:--success={palette.chrome.success}
  style:--attention={palette.chrome.attention}
  style:--danger={palette.chrome.danger}
>
  <aside class="rail" style:width={`${ui.railWidth}px`}>
    <div class="rail-filter">
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
          class="chip"
          class:active={filterClaude}
          title="Show Claude sessions"
          aria-label="Filter Claude sessions"
          onclick={() => {
            filterClaude = !filterClaude
            if (filterClaude) filterShell = false
          }}
        >
          <span class="material-symbols-outlined">asterisk</span>
        </button>
        <button
          class="chip"
          class:active={filterShell}
          title="Show shell sessions"
          aria-label="Filter shell sessions"
          onclick={() => {
            filterShell = !filterShell
            if (filterShell) filterClaude = false
          }}
        >
          <span class="material-symbols-outlined">terminal_2</span>
        </button>
      </div>
    </div>

    <div class="rail-body">
      {#each dirOrder as dir (dir)}
        {@const inDir = sessions.filter((s) => s.cwd === dir)}
        {@const visible = inDir.filter(sessionMatches)}
        {#if inDir.length > 0 && (!filterActive || visible.length > 0)}
        {@const label = dirLabel(dir)}
        <div
          class="folder-header"
          class:drop-hint={dropHint === `dir-${dir}`}
          role="button"
          tabindex="0"
          draggable="true"
          title={dir}
          ondragstart={() => (dragging = { kind: 'dir', dir })}
          ondragend={endDrag}
          ondragover={(e) => allowDrop(e, `dir-${dir}`, dragging?.kind === 'dir')}
          ondragleave={() => (dropHint = null)}
          ondrop={() => dropOnDir(dir)}
          oncontextmenu={(e) => {
            e.preventDefault()
            colorMenu = {
              dir,
              x: e.clientX,
              y: Math.min(e.clientY, window.innerHeight - 260)
            }
          }}
        >
          <span class="material-symbols-outlined folder-icon">folder</span>
          <span class="folder-name">{label.base}</span>
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
          <span
            class="dir-chip"
            style:border-color={dirColors[dir]}
            style:background={`color-mix(in srgb, ${dirColors[dir]} 25%, transparent)`}
            >{label.parent}</span
          >
        </div>

        {#each visible as session (session.key)}
          <div
            class="row"
            class:focused={ui.focused === session.key}
            class:drop-hint={dropHint === `session-${session.key}`}
            role="button"
            tabindex="0"
            draggable="true"
            ondragstart={() => (dragging = { kind: 'session', key: session.key, cwd: session.cwd })}
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
            onclick={() => (ui.focused = session.key)}
            oncontextmenu={(e) => {
              e.preventDefault()
              sessionMenu = {
                key: session.key,
                x: e.clientX,
                y: Math.min(e.clientY, window.innerHeight - 220)
              }
            }}
            onkeydown={(e) => e.key === 'Enter' && (ui.focused = session.key)}
          >
          <span class="dot {session.status}" title={session.status}></span>

          <span
            class="type-icon material-symbols-outlined"
            title={session.type === 'claude' ? 'Claude session' : 'Shell session'}
            >{session.type === 'claude' ? 'asterisk' : 'terminal_2'}</span
          >

          {#if renaming === session.key}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename"
              value={session.name}
              autofocus
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
              ondblclick={() => (renaming = session.key)}
              >{cleanTitle(session.title) || session.name}</span
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
        {/each}
        {/if}
      {/each}
    </div>

    <div class="rail-toolbar">
      <button
        class="icon-btn"
        title="New session or folder"
        aria-label="New session or folder"
        onclick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          addMenu = { x: rect.left, bottom: window.innerHeight - rect.top + 4 }
        }}
      >
        <span class="material-symbols-outlined">add</span>
      </button>
      <button
        class="icon-btn theme-btn"
        title={`Theme: ${ui.mode} — click to switch`}
        aria-label={`Theme: ${ui.mode}`}
        onclick={cycleMode}
      >
        <span class="material-symbols-outlined">{MODE_ICONS[ui.mode]}</span>
      </button>
    </div>
  </aside>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="splitter"
    class:dragging={draggingRail}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize session rail"
    onpointerdown={(e) => {
      draggingRail = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }}
    onpointermove={railDrag}
    onpointerup={() => (draggingRail = false)}
    onpointercancel={() => (draggingRail = false)}
  ></div>

  <main class="pane">
    {#each sessions as session (session.key)}
      <div class="host" style:display={ui.focused === session.key ? 'block' : 'none'}>
        <Terminal
          type={session.type}
          cwd={session.cwd}
          resume={session.resumeId ?? undefined}
          active={ui.focused === session.key}
          theme={palette.xterm}
          onSpawned={(ptyId, claudeSessionId) => {
            session.ptyId = ptyId
            session.claudeSessionId = claudeSessionId ?? null
          }}
          onExited={() => (session.status = 'exited')}
          onTitle={(title) => (session.title = title)}
        />
      </div>
    {/each}
    {#if sessions.length === 0}
      <div class="empty">
        <p>No sessions. Spawn one from the rail.</p>
      </div>
    {/if}
  </main>

  {#if addMenu}
    <div
      class="menu-backdrop"
      role="presentation"
      onclick={() => (addMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault()
        addMenu = null
      }}
    ></div>
    <div class="menu" style:left={`${addMenu.x}px`} style:bottom={`${addMenu.bottom}px`}>
      <button
        class="menu-item"
        onclick={() => {
          addMenu = null
          void newSession('claude')
        }}
      >
        <span class="material-symbols-outlined">asterisk</span>Claude session
      </button>
      <button
        class="menu-item"
        onclick={() => {
          addMenu = null
          void newSession('shell')
        }}
      >
        <span class="material-symbols-outlined">terminal_2</span>Shell session
      </button>
    </div>
  {/if}

  {#if colorMenu}
    <div
      class="menu-backdrop"
      role="presentation"
      onclick={() => (colorMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault()
        colorMenu = null
      }}
    ></div>
    <div class="menu" style:left={`${colorMenu.x}px`} style:top={`${colorMenu.y}px`}>
      {#each DOT_COLORS as entry (entry.name)}
        <button
          class="menu-item color"
          onclick={() => {
            if (colorMenu) setDirColor(colorMenu.dir, entry.hex)
            colorMenu = null
          }}
        >
          <span class="swatch" style:background={entry.hex}></span>{entry.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if sessionMenu}
    {@const menuSession = sessions.find((s) => s.key === sessionMenu?.key)}
    <div
      class="menu-backdrop"
      role="presentation"
      onclick={() => (sessionMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault()
        sessionMenu = null
      }}
    ></div>
    {#if menuSession}
      <div class="menu" style:left={`${sessionMenu.x}px`} style:top={`${sessionMenu.y}px`}>
        <button
          class="menu-item"
          onclick={() => {
            window.arc.openInExplorer(menuSession.cwd)
            sessionMenu = null
          }}
        >
          <span class="material-symbols-outlined">folder_open</span>Show in Explorer
        </button>
        <button
          class="menu-item"
          onclick={() => {
            void navigator.clipboard.writeText(menuSession.cwd)
            sessionMenu = null
          }}
        >
          <span class="material-symbols-outlined">content_copy</span>Copy path
        </button>
        <button
          class="menu-item"
          onclick={() => {
            duplicateSession(menuSession.key)
            sessionMenu = null
          }}
        >
          <span class="material-symbols-outlined">tab_duplicate</span>Duplicate session
        </button>
        <button
          class="menu-item"
          onclick={() => {
            renaming = menuSession.key
            sessionMenu = null
          }}
        >
          <span class="material-symbols-outlined">edit</span>Rename
        </button>
        {#if menuSession.type === 'claude'}
          <button
            class="menu-item"
            onclick={() => {
              applyFolderColor(menuSession.key)
              sessionMenu = null
            }}
          >
            <span class="material-symbols-outlined">palette</span>Apply folder color
          </button>
        {/if}
        <button
          class="menu-item"
          onclick={() => {
            closeSession(menuSession.key)
            sessionMenu = null
          }}
        >
          <span class="material-symbols-outlined">close</span>Close session
        </button>
      </div>
    {/if}
  {/if}
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      if (colorMenu) colorMenu = null
      if (sessionMenu) sessionMenu = null
      if (addMenu) addMenu = null
    }
  }}
/>

<style>
  :global(html, body, #app) {
    margin: 0;
    height: 100%;
  }

  .shell {
    display: flex;
    height: 100%;
    font-family: system-ui, sans-serif;
    background: var(--bg);
    color: var(--fg);
  }

  .rail {
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
    /* VS Code sash: invisible at rest — the rail/pane background change
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

  .rail-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 4px;
  }

  .folder-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    margin-top: 4px;
    border-radius: 6px;
    color: var(--fg-muted);
    font-size: 13px;
    font-weight: 600;
    user-select: none;
    cursor: grab;
  }

  .folder-icon {
    font-size: 18px;
  }

  .folder-name {
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dir-chip {
    margin-left: auto;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 8px;
    border: 1px solid;
    border-radius: 999px;
    color: var(--fg);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
  }

  .spawn-btn {
    visibility: hidden;
    flex-shrink: 0;
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

  .spawn-btn .material-symbols-outlined {
    font-size: 14px;
  }

  .folder-header:hover .spawn-btn {
    visibility: visible;
  }

  .spawn-btn:hover {
    background: var(--bg-subtle);
    color: var(--accent);
  }

  .drop-hint {
    outline: 1px solid var(--accent);
    background: var(--bg);
  }

  .row {
    /* columns: status dot | type icon | name | close */
    display: grid;
    grid-template-columns: 10px 18px minmax(0, 1fr) 14px;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-left: 8px;
    border-radius: 6px;
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

  .dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .type-icon {
    font-size: 18px;
    color: var(--fg-muted);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .rename {
    min-width: 0;
    font-size: 13px;
    font-family: inherit;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 1px 4px;
    outline: none;
  }

  .dot.running {
    background: var(--success);
  }

  .dot.waiting {
    background: var(--attention);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .dot.idle {
    background: var(--accent);
  }

  .dot.exited {
    background: var(--fg-muted);
    opacity: 0.5;
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

  .rail-toolbar {
    display: flex;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid var(--border);
  }

  .rail-filter {
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

  .theme-btn {
    margin-left: auto;
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
  }

  .empty {
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

  .menu-divider {
    height: 1px;
    margin: 4px 0;
    background: var(--border);
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
