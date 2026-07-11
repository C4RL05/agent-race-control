import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { spawn } from 'node-pty'
import type { IPty } from 'node-pty'
import { homedir } from 'node:os'
import { findGitBash } from './bash'

const ptys = new Map<string, IPty>()
let nextId = 1

type SpawnResult = { id: string } | { error: string }

export function registerPtyHandlers(getWebContents: () => WebContents | null): void {
  ipcMain.handle('pty:spawn', (_event, opts: { cols: number; rows: number }): SpawnResult => {
    const bash = findGitBash()
    if (!bash) {
      return { error: 'Git Bash not found. Install Git for Windows and restart aRC.' }
    }

    // Full environment passthrough — fidelity requires the shell to see
    // exactly what a regular terminal would. COLORTERM is truthful: xterm.js
    // renders 24-bit color (VS Code sets the same).
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value
    }
    env['COLORTERM'] = 'truecolor'

    const pty = spawn(bash, ['--login', '-i'], {
      name: 'xterm-256color',
      cols: Math.max(1, Math.floor(opts.cols)),
      rows: Math.max(1, Math.floor(opts.rows)),
      cwd: homedir(),
      env
    })

    const id = String(nextId++)
    ptys.set(id, pty)

    pty.onData((data) => getWebContents()?.send('pty:data', id, data))
    pty.onExit(({ exitCode }) => {
      ptys.delete(id)
      getWebContents()?.send('pty:exit', id, exitCode)
    })

    return { id }
  })

  ipcMain.on('pty:write', (_event, id: string, data: string) => {
    ptys.get(id)?.write(data)
  })

  ipcMain.on('pty:resize', (_event, id: string, cols: number, rows: number) => {
    ptys.get(id)?.resize(Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows)))
  })

  ipcMain.on('pty:kill', (_event, id: string) => {
    ptys.get(id)?.kill()
    ptys.delete(id)
  })
}

export function killAllPtys(): void {
  for (const pty of ptys.values()) pty.kill()
  ptys.clear()
}
