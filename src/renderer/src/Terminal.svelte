<script lang="ts">
  import { onMount } from 'svelte'
  import { Terminal } from '@xterm/xterm'
  import type { ITheme } from '@xterm/xterm'
  import { FitAddon } from '@xterm/addon-fit'
  import { ClipboardAddon } from '@xterm/addon-clipboard'
  import '@xterm/xterm/css/xterm.css'
  import { screenStatus, type ScreenState } from './screen'

  let {
    type = 'shell',
    cwd,
    resume,
    worktree,
    active = false,
    focusEpoch = 0,
    theme,
    fontFamily,
    scanning = false,
    onSpawned,
    onExited,
    onTitle,
    onScreen,
    onInput
  }: {
    type?: 'shell' | 'claude'
    cwd?: string
    resume?: string
    // Ask Claude Code for a fresh git worktree at spawn ('' = auto-name).
    worktree?: string
    active?: boolean
    // Bumped on every tower row click: re-asserts keyboard focus even when
    // `active` didn't change (a menu or chrome input stole the keyboard while
    // this session stayed the focused one).
    focusEpoch?: number
    theme: ITheme
    fontFamily: string
    // Whether the screen-scan status technique is the selected one. Off, the
    // buffer is never read at all — the alternate technique costs nothing
    // while it isn't the one driving the dot.
    scanning?: boolean
    // cwd is where the PTY actually started — may differ from the requested
    // directory (dead paths fall back to the home dir in main).
    onSpawned?: (ptyId: string, claudeSessionId: string | undefined, cwd: string) => void
    onExited?: (exitCode: number) => void
    onTitle?: (title: string) => void
    // A screen-scan verdict. Only ever called with a state the scan is sure
    // of — "no opinion" is dropped here rather than travelling as a null.
    onScreen?: (state: ScreenState) => void
    // Observes what the user types (already bound for the PTY) — the bytes
    // themselves pass through to pty.write untouched.
    onInput?: (data: string) => void
  } = $props()

  let container: HTMLDivElement
  let term: Terminal | null = null
  let fit: FitAddon | null = null

  // The screen-scan technique (screen.ts). The buffer is read here because
  // this is the only place that owns the xterm instance — the classifier
  // itself is pure and lives in its own module.
  //
  // Reading the buffer is observation, the same kind the terminal title
  // already is: nothing is written, intercepted or rewritten, and the byte
  // stream reaches the emulator untouched. What is read is what the user
  // would see if they looked at this pane.
  let lastTitle = ''
  let scanTimer: ReturnType<typeof setTimeout> | null = null

  // Coalesce a burst of writes into one scan. The spinner animates while a
  // turn runs, so data keeps arriving and the state keeps being re-affirmed;
  // when it stops, the timer set by the last burst still fires and reads the
  // settled frame. A throttle, not a trailing debounce: it bounds the work at
  // one scan per interval however hard the session is writing.
  const SCAN_INTERVAL = 250

  function scheduleScan(): void {
    if (!scanning || scanTimer) return
    scanTimer = setTimeout(() => {
      scanTimer = null
      const t = term
      if (!t || !scanning) return
      const buffer = t.buffer.active
      const lines: string[] = []
      for (let y = 0; y < t.rows; y++) {
        const line = buffer.getLine(buffer.viewportY + y)
        lines.push(line ? line.translateToString(true) : '')
      }
      const state = screenStatus({ title: lastTitle, lines })
      if (state) onScreen?.(state)
    }, SCAN_INTERVAL)
  }

  // Selecting the technique must colour the tower straight away — an idle
  // session emits no bytes, so waiting for the next write could mean waiting
  // for the next turn.
  $effect(() => {
    if (scanning) scheduleScan()
  })

  // Never fit while hidden (display:none gives 0x0 and garbage dimensions).
  function safeFit(): void {
    if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
      fit?.fit()
    }
  }

  $effect(() => {
    if (term) term.options.theme = theme
  })

  $effect(() => {
    void focusEpoch
    if (active && term) {
      safeFit()
      term.focus()
    }
  })

  // Live font swap (Settings picker). The bundled webfonts load lazily, so
  // wait for the face before xterm re-measures the cell — otherwise the grid
  // sizes to the fallback metrics and never reflows when the woff2 arrives.
  // load() resolves immediately for the native choices (no @font-face) and
  // near-instantly for the local files; apply on failure too (fallback is fine).
  $effect(() => {
    const family = fontFamily
    const t = term
    if (!t) return
    const apply = (): void => {
      if (term !== t) return
      t.options.fontFamily = family
      safeFit()
    }
    void document.fonts.load(`12px ${family}`).then(apply, apply)
  })

  onMount(() => {
    const t = new Terminal({
      fontFamily,
      // Match the standalone Git Bash (mintty default 9pt = 12px) at zoom 0.
      fontSize: 12,
      theme,
      // xterm's default OSC-8 link activation opens a blank popup first, then
      // sets its location — a popup-blocker dodge that doesn't survive our
      // setWindowOpenHandler (main/index.ts), which only sees the blank URL
      // and denies it, so the real navigation never happens. Open the real
      // URL directly so it hits that same http(s)-only guard correctly.
      linkHandler: {
        activate: (_event, uri) => {
          if (/^https?:/i.test(uri) && confirm(`Open ${uri} in your browser?`)) {
            window.open(uri, '_blank')
          }
        }
      }
    })
    const f = new FitAddon()
    t.loadAddon(f)
    // OSC 52 — how Claude Code copies to the system clipboard (e.g. /btw's `c`).
    t.loadAddon(new ClipboardAddon())
    t.open(container)
    term = t
    fit = f
    safeFit()

    let ptyId: string | null = null
    let disposed = false

    // Zero new muscle memory: Windows Terminal conventions only.
    // Ctrl+Shift+C/V for copy/paste; everything else passes through untouched
    // (Ctrl+C stays Claude's interrupt).
    // preventDefault is load-bearing, not decoration: returning false only tells
    // xterm to skip the key — it bails BEFORE its own cancel(), so the browser
    // default still runs. Ctrl+Shift+V is Chromium's own "paste as plain text",
    // which pastes into xterm's focused helper textarea and fires the paste
    // event xterm forwards to the PTY, so the text landed twice.
    t.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC' && t.hasSelection()) {
        event.preventDefault()
        void navigator.clipboard.writeText(t.getSelection())
        return false
      }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') {
        event.preventDefault()
        void navigator.clipboard.readText().then((text) => t.paste(text))
        return false
      }
      return true
    })

    // Dropping files pastes their quoted paths at the cursor — the same bytes
    // Windows Terminal sends, and how you hand images/files to Claude Code.
    container.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    })
    container.addEventListener('drop', (event) => {
      const files = event.dataTransfer?.files
      if (!files?.length) return
      event.preventDefault()
      const text = Array.from(files)
        .map((file) => window.arc.getPathForFile(file))
        .filter(Boolean)
        .map((path) => `"${path.replace(/"/g, '\\"')}"`)
        .join(' ')
      if (text) t.paste(text)
    })

    // Right-click: copy selection if present, else paste (Windows Terminal default).
    container.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      if (t.hasSelection()) {
        void navigator.clipboard.writeText(t.getSelection())
        t.clearSelection()
      } else {
        void navigator.clipboard.readText().then((text) => t.paste(text))
      }
    })

    // Surface the terminal title (OSC 0/2) — Claude Code keeps it set to the
    // conversation name; Git Bash sets it to the cwd.
    t.onTitleChange((title) => {
      lastTitle = title
      onTitle?.(title)
    })

    const offData = window.arc.pty.onData((id, data) => {
      if (id === ptyId) {
        t.write(data)
        scheduleScan()
      }
    })
    const offExit = window.arc.pty.onExit((id, exitCode) => {
      if (id === ptyId) {
        t.write(`\r\n\x1b[2m[process exited with code ${exitCode}]\x1b[0m\r\n`)
        onExited?.(exitCode)
      }
    })

    void window.arc.pty
      .spawn({ cols: t.cols, rows: t.rows, type, cwd, resume, worktree })
      .then((result) => {
        if (disposed) return
        if ('error' in result) {
          t.write(`\x1b[31m${result.error}\x1b[0m\r\n`)
          onExited?.(-1)
          return
        }
        ptyId = result.id
        onSpawned?.(result.id, result.claudeSessionId, result.cwd)
        t.onData((data) => {
          onInput?.(data)
          window.arc.pty.write(result.id, data)
        })
        t.onResize(({ cols, rows }) => window.arc.pty.resize(result.id, cols, rows))
        if (active) t.focus()
      })

    const resizeObserver = new ResizeObserver(() => safeFit())
    resizeObserver.observe(container)

    return () => {
      disposed = true
      if (scanTimer) clearTimeout(scanTimer)
      scanTimer = null
      resizeObserver.disconnect()
      offData()
      offExit()
      if (ptyId) window.arc.pty.kill(ptyId)
      t.dispose()
      term = null
      fit = null
    }
  })
</script>

<div class="terminal" bind:this={container}></div>

<style>
  .terminal {
    width: 100%;
    height: 100%;
  }
</style>
