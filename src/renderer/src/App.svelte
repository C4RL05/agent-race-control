<script lang="ts">
  import Terminal from './Terminal.svelte'
  import { palettes } from './theme'
  import type { Mode } from './theme'
  import {
    sessions,
    ui,
    newSession,
    closeSession,
    cycleColor,
    applyStatus,
    restoreState,
    snapshotState,
    cleanTitle
  } from './sessions.svelte'

  let draggingRail = $state(false)

  function railDrag(event: PointerEvent): void {
    if (!draggingRail) return
    ui.railWidth = Math.min(480, Math.max(160, Math.round(event.clientX)))
  }

  const MODES: Mode[] = ['system', 'light', 'dark']

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
    <header class="rail-title">Agent Race Control</header>

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
            title="Change color"
            aria-label="Change session color"
            onclick={(e) => {
              e.stopPropagation()
              cycleColor(session)
            }}
          ></button>

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

    <footer class="rail-footer">
      <div class="add-buttons">
        <button class="add" onclick={() => newSession('claude')}>+ Claude</button>
        <button class="add" onclick={() => newSession('shell')}>+ Shell</button>
      </div>
      <div class="mode-toggle">
        {#each MODES as mode (mode)}
          <button class="mode" class:selected={ui.mode === mode} onclick={() => (ui.mode = mode)}>
            {mode}
          </button>
        {/each}
      </div>
    </footer>
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
</div>

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

  .rail-title {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .rail-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  .row {
    /* columns: dot | name | claude title | status | close */
    display: grid;
    grid-template-columns: 10px minmax(60px, 1fr) minmax(0, 1.4fr) 7px 14px;
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

  .rail-footer {
    padding: 8px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .add-buttons {
    display: flex;
    gap: 6px;
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

  .mode-toggle {
    display: flex;
    gap: 2px;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px;
  }

  .mode {
    flex: 1;
    font-size: 11px;
    font-family: inherit;
    padding: 3px 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    text-transform: capitalize;
  }

  .mode.selected {
    background: var(--bg);
    color: var(--fg);
    outline: 1px solid var(--border);
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
</style>
