import { execFile } from 'node:child_process'
import { askShell } from './shell'

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
// bash.ts). Resolve the real binary ONCE through the same login shell that
// spawned sessions use, then invoke that absolute path per tick: 273ms direct
// vs 403ms through a login shell every time. (A POSIX login shell measured
// 0.43–0.52s across five runs, so the same argument holds there.)
//
// Async on purpose: the login shell costs ~400ms and this runs in the MAIN
// process, where a sync spawn would stall the window (and it would land right
// at startup). Resolution is attempted once; the result — including failure —
// is cached, so a machine without claude pays for one lookup, not one per tick.

// How to ask the shell where `claude` is, per host.
//
// `cygpath` is MSYS/Cygwin-only and exists to turn Git Bash's /c/… back into a
// Windows path that execFile can spawn. On POSIX there is nothing to convert —
// `command -v` already answers with a spawnable absolute path — and the call
// would simply fail, caching `null` and leaving the poller silently off
// forever (the failure below is deliberately never fatal, which is what would
// hide it).
//
// Pure and platform-injected, so both forms are asserted on either host.
export function whichClaudeCommand(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'cygpath -w "$(command -v claude)"' : 'command -v claude'
}

let claudePath: string | null | undefined
let resolving: Promise<string | null> | null = null

function resolveClaude(): Promise<string | null> {
  if (claudePath !== undefined) return Promise.resolve(claudePath)
  if (resolving) return resolving
  // askShell fences the answer, which this call cannot do without. An
  // INTERACTIVE shell prints whatever its rc files print, ON STDOUT, and the
  // line below takes stdout as the binary's path — so unfenced, one banner
  // makes claudePath a string that is not a path, caches it, and leaves the
  // poller silently dead for the whole session. Git for Windows is a concrete
  // producer of exactly that: /etc/bash.bashrc's warning block prints to stdout
  // when stdout is a pipe, and it is gated on the shell being interactive.
  // shell.ts carries the measurement.
  resolving = askShell(whichClaudeCommand(process.platform)).then((answer) => {
    // The shell could not be started at all — transient (`spawn EBUSY` has been
    // seen in the wild), so deliberately NOT cached: claudePath stays undefined
    // and the memo below is dropped, so the next tick tries again.
    if (!answer.answered) return null
    // The shell ran. Whatever it said is the truth, including "nothing" —
    // claude is not installed or not on the login PATH, polling stays off, and
    // the tower simply shows no status changes. Never fatal.
    claudePath = answer.value
    return answer.value
  })
  // An attempt that finished without learning a path was that transient
  // failure, so drop the memo — otherwise every later call replays the same
  // resolved-null promise and polling never recovers. Runs after the
  // assignment above, which is why it is a .then and not a catch inside the
  // executor (the executor body runs BEFORE `resolving` is assigned).
  void resolving.then(() => {
    if (claudePath === undefined) resolving = null
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
    // Clearing first makes this idempotent: the guards below may call it on a
    // path that already armed one, and two live timers would fork the loop in
    // two — permanently, and doubling on every later fork.
    if (timer) clearTimeout(timer)
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
    void resolveClaude()
      .then((exe) => {
        if (!running) return
        if (!exe) {
          schedule()
          return
        }
        try {
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
        } catch {
          // `spawn EBUSY`, observed in the wild 2026-08-25: Claude Code
          // auto-updates by replacing its own ~380MB claude.exe in place, and
          // we spawn that exe once a second, so the poll lands in the swap
          // window sooner or later. child_process throws it SYNCHRONOUSLY, so
          // the callback's error branch never runs — and since schedule() sits
          // after the throwing call, the loop simply stopped, for the life of
          // the app (`running` stays true, so startAgentPolling won't restart
          // it either). A dropped tick is fine; a dead floor is not.
          schedule()
        }
      })
      // Nothing whatsoever may kill the loop. schedule() clears before it arms,
      // so a double-call here cannot fork it.
      .catch(() => schedule())
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
