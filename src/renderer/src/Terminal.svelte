<script lang="ts">
  import { onMount } from 'svelte'
  import { Terminal } from '@xterm/xterm'
  import type { ITheme } from '@xterm/xterm'
  import { FitAddon } from '@xterm/addon-fit'
  import { ClipboardAddon } from '@xterm/addon-clipboard'
  import '@xterm/xterm/css/xterm.css'

  let {
    type = 'shell',
    cwd,
    resume,
    active = false,
    theme,
    onSpawned,
    onExited,
    onTitle
  }: {
    type?: 'shell' | 'claude'
    cwd?: string
    resume?: string
    active?: boolean
    theme: ITheme
    onSpawned?: (ptyId: string, claudeSessionId?: string) => void
    onExited?: (exitCode: number) => void
    onTitle?: (title: string) => void
  } = $props()

  let container: HTMLDivElement
  let term: Terminal | null = null
  let fit: FitAddon | null = null

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
    if (active && term) {
      safeFit()
      term.focus()
    }
  })

  onMount(() => {
    const t = new Terminal({
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 14,
      theme
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
    t.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC' && t.hasSelection()) {
        void navigator.clipboard.writeText(t.getSelection())
        return false
      }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') {
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
    t.onTitleChange((title) => onTitle?.(title))

    const offData = window.arc.pty.onData((id, data) => {
      if (id === ptyId) t.write(data)
    })
    const offExit = window.arc.pty.onExit((id, exitCode) => {
      if (id === ptyId) {
        t.write(`\r\n\x1b[2m[process exited with code ${exitCode}]\x1b[0m\r\n`)
        onExited?.(exitCode)
      }
    })

    void window.arc.pty.spawn({ cols: t.cols, rows: t.rows, type, cwd, resume }).then((result) => {
      if (disposed) return
      if ('error' in result) {
        t.write(`\x1b[31m${result.error}\x1b[0m\r\n`)
        onExited?.(-1)
        return
      }
      ptyId = result.id
      onSpawned?.(result.id, result.claudeSessionId)
      t.onData((data) => window.arc.pty.write(result.id, data))
      t.onResize(({ cols, rows }) => window.arc.pty.resize(result.id, cols, rows))
      if (active) t.focus()
    })

    const resizeObserver = new ResizeObserver(() => safeFit())
    resizeObserver.observe(container)

    return () => {
      disposed = true
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
