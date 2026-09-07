import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { spawn } from 'node-pty'
import type { IPty } from 'node-pty'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolveShell } from './shell'
import { writeSessionHooks } from './status'
import { transcriptPath } from './transcript'
import { adapterFor, type SessionType } from './cli'
import {
  rolloutPath as codexRolloutPath,
  watchForSession as watchForCodexSession,
  watchForName,
  threadName
} from './codex'

// A session that never exchanged a prompt writes no transcript, so --resume
// would fail with "No conversation found". Only resume when the transcript
// exists; otherwise start fresh under the same session id.
function claudeTranscriptExists(cwd: string, sessionId: string): boolean {
  return existsSync(transcriptPath(cwd, sessionId))
}

const ptys = new Map<string, IPty>()
// Which of those are Claude sessions — the agent poller only spawns a
// `claude agents --json` subprocess while at least one is alive, so a tower of
// plain shells costs nothing.
const claudePtys = new Set<string>()
// Pending codex session-id discoveries, so a row that exits before its rollout
// appears doesn't leave a poll running against a directory nobody is watching.
const codexWatchers = new Map<string, () => void>()
let nextId = 1

export function hasClaudeSessions(): boolean {
  return claudePtys.size > 0
}

function stopCodexWatch(id: string): void {
  codexWatchers.get(id)?.()
  codexWatchers.delete(id)
}

// cwd is the directory the PTY actually started in — it can differ from the
// requested one (dead-path fallback below), and the renderer must follow the
// truth or the preview tails a transcript directory Claude never writes.
type SpawnResult = { id: string; claudeSessionId?: string; cwd: string } | { error: string }
// Re-exported from the adapter registry so the preload keeps importing it from
// here and nothing else has to learn where the CLI table lives.
export type { SessionType }

export function registerPtyHandlers(getWebContents: () => WebContents | null): void {
  ipcMain.handle(
    'pty:spawn',
    (
      _event,
      opts: {
        cols: number
        rows: number
        type?: SessionType
        cwd?: string
        resume?: string
        // Ask Claude Code to create-and-enter a fresh git worktree ('' = let
        // Claude auto-name). Claude runs the git; the app never does.
        worktree?: string
      }
    ): SpawnResult => {
      // Git Bash on Windows, the user's login shell on POSIX — shell.ts owns
      // the choice, and carries the reason it is not a fixed binary.
      const shell = resolveShell()
      if (!shell.ok) return { error: shell.message }

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

      // A requested cwd that no longer exists is a fact to surface, not paper
      // over: a cleaned-up worktree (or any deleted folder) must not silently
      // respawn in the home dir — the error renders in the terminal pane and
      // the row exits (see the worktree-workflow doc section).
      if (opts.cwd && !existsSync(opts.cwd)) {
        return { error: `Working directory no longer exists: ${opts.cwd}` }
      }

      // Agent sessions: the login shell sources the user's profile (so the CLI
      // resolves from the user's real PATH), then exec makes the shell *become*
      // it — the PTY's lifetime IS the agent process's lifetime. What each CLI
      // is handed on that line lives in cli/index.ts; everything below is
      // shared. `exec <cli> …` is POSIX-portable, so the same string serves
      // Git Bash and zsh.
      const cwd = opts.cwd ?? homedir()
      const adapter = adapterFor(opts.type)

      // The conversation id, when it is knowable at spawn. Claude's is pinned
      // here (it is also the join key for the agent poll and the hook routing
      // token); codex mints its own, so this stays undefined and the id is
      // discovered from the rollout it opens (see codex.ts).
      let claudeSessionId: string | undefined
      let args: string[]
      if (adapter) {
        const resumeId = adapter.identity === 'pinned' ? (opts.resume ?? randomUUID()) : opts.resume
        const resumable =
          opts.resume !== undefined &&
          (adapter.kind === 'claude'
            ? claudeTranscriptExists(cwd, opts.resume)
            : codexRolloutPath(opts.resume) !== null)
        // Per-session turn-boundary hooks, for the CLI that takes them: the
        // spawn id is the URL's routing token, so this session's hooks keep
        // arriving even after `/clear` mints a new conversation id (issue #2).
        const hookSettings =
          adapter.capabilities.hooks && resumeId
            ? (writeSessionHooks(resumeId) ?? undefined)
            : undefined
        const cmd = adapter.spawnCommand({
          cwd,
          resumeId,
          resumable,
          worktree: adapter.capabilities.worktree ? opts.worktree : undefined,
          hookSettings
        })
        if (adapter.identity === 'pinned') claudeSessionId = resumeId
        args = [...shell.shell.args, '-c', cmd]
      } else {
        args = [...shell.shell.args]
      }

      const pty = spawn(shell.shell.command, args, {
        name: 'xterm-256color',
        cols: Math.max(1, Math.floor(opts.cols)),
        rows: Math.max(1, Math.floor(opts.rows)),
        cwd,
        env
      })

      const id = String(nextId++)
      ptys.set(id, pty)
      // Claude sessions only: the poller shells out to `claude agents --json`,
      // which knows nothing about codex, so a tower of codex rows must not
      // keep it alive.
      if (opts.type === 'claude') claudePtys.add(id)

      // Codex mints its own conversation id, so the row spawns without one and
      // learns it when the rollout appears (usually within a second). The
      // renderer keys the preview and the resume handle off this arriving.
      if (opts.type === 'codex') {
        let stopName: (() => void) | null = null
        const stopSession = watchForCodexSession(cwd, Date.now(), (session) => {
          getWebContents()?.send(
            'pty:session',
            id,
            session.sessionId,
            threadName(session.sessionId)
          )
          // The conversation's name is not in codex's terminal title, and it
          // is not set at all until a turn or two in — so follow the index for
          // a while and report it when it lands.
          stopName = watchForName(session.sessionId, (name) => {
            getWebContents()?.send('pty:session', id, session.sessionId, name)
          })
        })
        codexWatchers.set(id, () => {
          stopSession()
          stopName?.()
        })
      }

      pty.onData((data) => getWebContents()?.send('pty:data', id, data))
      pty.onExit(({ exitCode }) => {
        ptys.delete(id)
        claudePtys.delete(id)
        stopCodexWatch(id)
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
    claudePtys.delete(id)
    stopCodexWatch(id)
  })
}

export function killAllPtys(): void {
  for (const pty of ptys.values()) pty.kill()
  for (const stop of codexWatchers.values()) stop()
  ptys.clear()
  claudePtys.clear()
  codexWatchers.clear()
}
