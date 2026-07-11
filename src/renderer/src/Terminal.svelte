<script lang="ts">
  import { onMount } from 'svelte'
  import { Terminal } from '@xterm/xterm'
  import { FitAddon } from '@xterm/addon-fit'
  import { ClipboardAddon } from '@xterm/addon-clipboard'
  import '@xterm/xterm/css/xterm.css'

  let { type = 'shell' }: { type?: 'shell' | 'claude' } = $props()

  let container: HTMLDivElement

  onMount(() => {
    const term = new Terminal({
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 14
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    // OSC 52 — how Claude Code copies to the system clipboard (e.g. /btw's `c`).
    term.loadAddon(new ClipboardAddon())
    term.open(container)
    fit.fit()

    let ptyId: string | null = null
    let disposed = false

    // Zero new muscle memory: Windows Terminal conventions only.
    // Ctrl+Shift+C/V for copy/paste; everything else passes through untouched
    // (Ctrl+C stays Claude's interrupt).
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC' && term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection())
        return false
      }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') {
        void navigator.clipboard.readText().then((text) => term.paste(text))
        return false
      }
      return true
    })

    // Right-click: copy selection if present, else paste (Windows Terminal default).
    container.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      if (term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
      } else {
        void navigator.clipboard.readText().then((text) => term.paste(text))
      }
    })

    const offData = window.arc.pty.onData((id, data) => {
      if (id === ptyId) term.write(data)
    })
    const offExit = window.arc.pty.onExit((id, exitCode) => {
      if (id === ptyId) {
        term.write(`\r\n\x1b[2m[process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })

    void window.arc.pty.spawn({ cols: term.cols, rows: term.rows, type }).then((result) => {
      if (disposed) return
      if ('error' in result) {
        term.write(`\x1b[31m${result.error}\x1b[0m\r\n`)
        return
      }
      ptyId = result.id
      term.onData((data) => window.arc.pty.write(result.id, data))
      term.onResize(({ cols, rows }) => window.arc.pty.resize(result.id, cols, rows))
      term.focus()
    })

    const resizeObserver = new ResizeObserver(() => fit.fit())
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      offData()
      offExit()
      if (ptyId) window.arc.pty.kill(ptyId)
      term.dispose()
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
