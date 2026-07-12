import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { spawn } from 'node-pty'
import type { IPty } from 'node-pty'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { findGitBash } from './bash'
import { getHookSettingsPath } from './status'
import { transcriptPath } from './transcript'

// A session that never exchanged a prompt writes no transcript, so --resume
// would fail with "No conversation found". Only resume when the transcript
// exists; otherwise start fresh under the same session id.
function claudeTranscriptExists(cwd: string, sessionId: string): boolean {
  return existsSync(transcriptPath(cwd, sessionId))
}

const ptys = new Map<string, IPty>()
let nextId = 1

// cwd is the directory the PTY actually started in — it can differ from the
// requested one (dead-path fallback below), and the renderer must follow the
// truth or the preview tails a transcript directory Claude never writes.
type SpawnResult = { id: string; claudeSessionId?: string; cwd: string } | { error: string }
export type SessionType = 'shell' | 'claude'

export function registerPtyHandlers(getWebContents: () => WebContents | null): void {
  ipcMain.handle(
    'pty:spawn',
    (
      _event,
      opts: { cols: number; rows: number; type?: SessionType; cwd?: string; resume?: string }
    ): SpawnResult => {
      const bash = findGitBash()
      if (!bash) {
        return { error: 'Git Bash not found. Install Git for Windows and restart Agent Race Control.' }
      }

      // Full environment passthrough — fidelity requires the shell to see
      // exactly what a regular terminal would. COLORTERM is truthful: xterm.js
      // renders 24-bit color (VS Code sets the same).
      const env: Record<string, string> = {}
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value
      }
      env['COLORTERM'] = 'truecolor'

      // Fidelity means "a fresh terminal", not "a child of whatever launched
      // this app". If Agent Race Control itself was started from inside a
      // Claude Code session (dev loops, testing), these injected vars leak in
      // and make spawned claudes think they're nested child sessions — which
      // silently disables transcript persistence (no resume!). A fresh
      // Windows Terminal has none of them. Deliberate user config like
      // CLAUDE_CONFIG_DIR is untouched.
      for (const key of [
        'CLAUDECODE',
        'CLAUDE_CODE_SESSION_ID',
        'CLAUDE_CODE_CHILD_SESSION',
        'CLAUDE_CODE_ENTRYPOINT',
        'CLAUDE_CODE_BRIDGE_SESSION_ID',
        'CLAUDE_CODE_EXECPATH',
        'CLAUDE_EFFORT',
        'CLAUDE_ENV_FILE',
        'CLAUDE_PROJECT_DIR',
        'CLAUDE_PLUGIN_ROOT',
        'CLAUDE_PLUGIN_DATA'
      ]) {
        delete env[key]
      }

      // Claude sessions: the login shell sources the user's profile (so claude
      // resolves from their real PATH), then exec makes bash *become* claude —
      // the PTY's lifetime IS the claude process's lifetime.
      // --session-id gives a deterministic session id (status + resume mapping);
      // --settings adds the observability-only status hooks (see status.ts).
      const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : homedir()

      let claudeSessionId: string | undefined
      let args: string[]
      if (opts.type === 'claude') {
        // Fresh session: pin our own UUID. Restored session: --resume it —
        // but only if a transcript actually exists; else fresh with same id.
        claudeSessionId = opts.resume ?? randomUUID()
        const canResume = opts.resume !== undefined && claudeTranscriptExists(cwd, opts.resume)
        let cmd = canResume
          ? `exec claude --resume ${claudeSessionId}`
          : `exec claude --session-id ${claudeSessionId}`
        const hookSettings = getHookSettingsPath()
        if (hookSettings) cmd += ` --settings '${hookSettings.replace(/\\/g, '/')}'`
        args = ['--login', '-i', '-c', cmd]
      } else {
        args = ['--login', '-i']
      }

      const pty = spawn(bash, args, {
        name: 'xterm-256color',
        cols: Math.max(1, Math.floor(opts.cols)),
        rows: Math.max(1, Math.floor(opts.rows)),
        cwd,
        env
      })

      const id = String(nextId++)
      ptys.set(id, pty)

      pty.onData((data) => getWebContents()?.send('pty:data', id, data))
      pty.onExit(({ exitCode }) => {
        ptys.delete(id)
        getWebContents()?.send('pty:exit', id, exitCode)
      })

      return { id, claudeSessionId, cwd }
    }
  )

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
