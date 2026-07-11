<script lang="ts">
  import Terminal from './Terminal.svelte'
  import { palettes } from './theme'
  import type { Mode } from './theme'
  import {
    sessions,
    ui,
    newSession,
    closeSession,
    applyColor,
    setColor,
    applyStatus,
    restoreState,
    snapshotState,
    cleanTitle
  } from './sessions.svelte'
  import { DOT_COLORS } from './theme'

  // Right-click color picker for a session dot.
  let colorMenu = $state<{ key: number; x: number; y: number } | null>(null)

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

  function commitRename(key: number, value: string): void {
    const session = sessions.find((s) => s.key === key)
    if (session && value.trim()) session.name = value.trim()
    renaming = null
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
    <div class="rail-toolbar">
      <button class="add" onclick={() => newSession('claude')}>+ Claude</button>
      <button class="add" onclick={() => newSession('shell')}>+ Shell</button>
      <button
        class="icon-btn"
        title={`Theme: ${ui.mode} — click to switch`}
        aria-label={`Theme: ${ui.mode}`}
        onclick={cycleMode}
      >
        <span class="material-symbols-outlined">{MODE_ICONS[ui.mode]}</span>
      </button>
    </div>

    <div class="rail-body">
      {#each sessions as session (session.key)}
        <div
          class="row"
          class:focused={ui.focused === session.key}
          role="button"
          tabindex="0"
          onclick={() => (ui.focused = session.key)}
          onkeydown={(e) => e.key === 'Enter' && (ui.focused = session.key)}
        >
          <button
            class="dot"
            style:background={session.color}
            title="Click: apply color to session · Right-click: choose color"
            aria-label="Session color"
            onclick={(e) => {
              e.stopPropagation()
              applyColor(session)
            }}
            oncontextmenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              colorMenu = {
                key: session.key,
                x: e.clientX,
                y: Math.min(e.clientY, window.innerHeight - 240)
              }
            }}
          ></button>

          <span
            class="type-icon material-symbols-outlined"
            title={session.type === 'claude' ? 'Claude session' : 'Shell session'}
            >{session.type === 'claude' ? 'flare' : 'terminal'}</span
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
              ondblclick={() => (renaming = session.key)}>{session.name}</span
            >
          {/if}

          <span class="title" title={cleanTitle(session.title)}
            >{cleanTitle(session.title)}</span
          >

          <span class="status {session.status}" title={session.status}></span>

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
    <div class="color-menu" style:left={`${colorMenu.x}px`} style:top={`${colorMenu.y}px`}>
      {#each DOT_COLORS as entry (entry.name)}
        <button
          class="color-item"
          onclick={() => {
            const session = sessions.find((s) => s.key === colorMenu?.key)
            if (session) setColor(session, entry)
            colorMenu = null
          }}
        >
          <span class="swatch" style:background={entry.hex}></span>{entry.name}
        </button>
      {/each}
    </div>
  {/if}
</div>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && colorMenu) colorMenu = null
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
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--border);
    background-clip: content-box;
    padding: 0 2px;
    touch-action: none;
  }

  .splitter:hover,
  .splitter.dragging {
    background-color: var(--accent);
  }

  .rail-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  .row {
    /* columns: dot | type icon | name | claude title | status | close */
    display: grid;
    grid-template-columns: 10px 16px minmax(60px, 1fr) minmax(0, 1.4fr) 7px 14px;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
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
    font-size: 15px;
    color: var(--fg-muted);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--fg-muted);
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

  .status {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
  }

  .status.running {
    background: var(--success);
  }

  .status.waiting {
    background: var(--attention);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .status.idle {
    background: var(--accent);
  }

  .status.exited {
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
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
  }

  .add {
    flex: 1;
    font-size: 12px;
    font-family: inherit;
    padding: 5px 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }

  .add:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .icon-btn {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 28px;
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

  .color-menu {
    position: fixed;
    z-index: 11;
    display: flex;
    flex-direction: column;
    min-width: 120px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .color-item {
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
    text-transform: capitalize;
    cursor: pointer;
  }

  .color-item:hover {
    background: var(--bg-subtle);
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
