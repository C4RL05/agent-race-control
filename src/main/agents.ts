import { execFile } from 'node:child_process'
import { findGitBash } from './bash'

// Session status, QUERIED rather than inferred. `claude agents --json` is an
// official command that prints every active session as a JSON array, each with
// a `status` field — so the tower asks "what is this session doing?" instead of
// reconstructing it from edges (hook POSTs, title-spinner frames, keystrokes).
// That is the whole point: a level can be re-read, so a wrong dot self-heals on
// the next tick, where a missed edge used to persist to the end of the turn.
//
// Observation only, and out of band: this never touches the PTY byte stream and
// never writes to the user's Claude config. It replaces the localhost hook
// server outright (see the kickoff doc) — the same payload carries status,
// the session's CURRENT conversation id, and its real cwd.

// One session as `claude agents --json` reports it. Fields beyond these exist
// (background sessions add `id`/`state`); the tower needs only these, and
// unknown fields are ignored rather than mapped.
export interface AgentEntry {
  sessionId?: string
  pid?: number
  status?: string
  cwd?: string
  kind?: string
  startedAt?: number
}

// One tick per second: the poll itself costs ~275ms (measured, 71 polls on
// v2.1.229), and it returns EVERY session, so this is one subprocess per tick
// for the whole tower rather than one per session. Ticks are spaced from the
// END of the previous poll, so a slow machine stretches the cadence instead of
// stacking overlapping claude processes.
const POLL_MS = 1000

// `claude` must not be PATH-resolved from Electron's environment — the app's
// own PATH is not the user's login PATH (the same trap as bash.exe, see
// bash.ts). Resolve the real binary ONCE through the Git Bash login shell that
// spawned sessions use, then invoke that absolute path per tick: 273ms direct
// vs 403ms through a login shell every time.
//
// Async on purpose: the login shell costs ~400ms and this runs in the MAIN
// process, where a sync spawn would stall the window (and it would land right
// at startup). Resolution is attempted once; the result — including failure —
// is cached, so a machine without claude pays for one lookup, not one per tick.
let claudePath: string | null | undefined
let resolving: Promise<string | null> | null = null

function resolveClaude(): Promise<string | null> {
  if (claudePath !== undefined) return Promise.resolve(claudePath)
  if (resolving) return resolving
  resolving = new Promise<string | null>((done) => {
    const bash = findGitBash()
    if (!bash) {
      claudePath = null
      done(null)
      return
    }
    execFile(
      bash,
      ['--login', '-c', 'cygpath -w "$(command -v claude)"'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true },
      (error, stdout) => {
        // claude not installed or not on the login PATH — polling stays off and
        // the tower simply shows no status changes. Never fatal.
        claudePath = !error && stdout.trim() ? stdout.trim() : null
        done(claudePath)
      }
    )
  })
  return resolving
}

let timer: ReturnType<typeof setTimeout> | null = null
let running = false

// Poll only while at least one Claude PTY is alive (pty.ts owns that count), so
// a tower of nothing but shells spawns no subprocesses at all.
export function startAgentPolling(
  hasClaudeSessions: () => boolean,
  onUpdate: (entries: AgentEntry[]) => void
): void {
  if (running) return
  running = true

  const schedule = (): void => {
    if (!running) return
    timer = setTimeout(tick, POLL_MS)
  }

  const tick = (): void => {
    if (!running) return
    // Cheap check first: with no Claude session alive there is nothing to ask
    // about, and resolution (one login shell) is deferred until it matters.
    if (!hasClaudeSessions()) {
      schedule()
      return
    }
    void resolveClaude().then((exe) => {
      if (!running) return
      if (!exe) {
        schedule()
        return
      }
      execFile(
        exe,
        ['agents', '--json'],
        { encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        (error, stdout) => {
          if (!running) return
          if (!error) {
            try {
              const parsed: unknown = JSON.parse(stdout)
              if (Array.isArray(parsed)) onUpdate(parsed as AgentEntry[])
            } catch {
              // A partial or non-JSON write is a dropped tick, nothing more —
              // the next one re-reads the whole truth.
            }
          }
          schedule()
        }
      )
    })
  }

  tick()
}

export function stopAgentPolling(): void {
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
