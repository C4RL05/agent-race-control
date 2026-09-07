import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { findGitBash } from './bash'

// Which shell a PTY runs, per host.
//
// bash.ts holds the Windows answer and its reasoning, which is intricate and
// unchanged: never PATH-resolve bash.exe, because the WSL stub and the legacy
// launcher both shadow it. This file is the dispatch AROUND that, not a
// rewrite of it — the Windows branch stays reviewable as the thing it always
// was, and the only new code is the POSIX one.
//
// POSIX hosts get the user's LOGIN shell rather than a fixed one, which is what
// every terminal the user already trusts does (Terminal.app, iTerm, VS Code).
// That is not a style preference: on the machine these notes were measured on,
// the CLI the module exists to reach was on PATH ONLY via .zshrc, with no
// .bash_profile or .bashrc on the box at all — so a hardcoded /bin/bash opens a
// terminal that cannot see the user's own toolchain. Given this app's premise
// is "if it works in your terminal, it works here", $SHELL is the only answer
// consistent with it.
//
// Dialect parity with Git Bash was considered and rejected: nothing here ever
// SCRIPTS the shell. The one command string this app writes is cli/index.ts's
// `exec claude --resume …`, which is POSIX-portable as written; everything else
// is the user's own keystrokes.

/** A shell to spawn: the binary, and the argv that makes it interactive and profiled. */
export interface ShellChoice {
  command: string
  args: string[]
}

export type ShellResult = { ok: true; shell: ShellChoice } | { ok: false; message: string }

// The POSIX login shell, given $SHELL and a per-platform fallback.
//
// Pure and predicate-injected so both platforms' cases unit-test on either
// host. $SHELL is trusted only when it is an absolute path that exists: a
// relative value would resolve against this process's cwd rather than anything
// the user meant, and a stale one (a shell they uninstalled) fails inside
// node-pty as a spawn error with no useful message.
export function posixShell(
  shellEnv: string | undefined,
  fallback: string,
  exists: (path: string) => boolean
): string {
  const candidate = shellEnv?.trim()
  if (candidate && isAbsolute(candidate) && exists(candidate)) return candidate
  return fallback
}

/** /bin/zsh has been the macOS default since Catalina; Linux's is bash. */
export function posixFallback(platform: string): string {
  return platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

// The shell for this host, or the reason there is none.
//
// A discriminated union rather than { file, args, missing }, so a caller cannot
// read a shell out of a failure.
//
// -l -i on BOTH branches. Without a login shell the terminal's PATH is this
// process's, so neither the user's zsh rc files nor Git Bash's
// /etc/profile.d/* run. `-i` is what makes the shell INTERACTIVE, which
// unlocks every rc block guarded on `$-` containing `i` — on zsh that is
// `.zshrc` itself, which is where a version manager usually puts the agent
// CLI. Both shells accept the short forms; --login is spelled out on the
// Windows branch because it always has been.
export function resolveShell(): ShellResult {
  if (process.platform === 'win32') {
    const bash = findGitBash()
    return bash === null
      ? {
          ok: false,
          message: 'Git Bash not found. Install Git for Windows and restart Agent Race Control.'
        }
      : { ok: true, shell: { command: bash, args: ['--login', '-i'] } }
  }

  const shell = posixShell(process.env['SHELL'], posixFallback(process.platform), existsSync)
  // Only reachable when $SHELL is unusable AND the platform default is absent
  // too, which means a host with no shell where this app expects one. Said
  // plainly rather than spawned hopefully, because node-pty's failure for a
  // missing binary is noise.
  return existsSync(shell)
    ? { ok: true, shell: { command: shell, args: ['-l', '-i'] } }
    : {
        ok: false,
        message: `No shell was found to run. Neither $SHELL nor ${shell} exists on this machine.`
      }
}

// ---------------------------------------------------------------------------
// Asking the user's shell a question
// ---------------------------------------------------------------------------
//
// Two callers need a scalar answer out of the user's environment — where
// `claude` is (agents.ts) and what PATH the user would have had
// (login-path.ts). Both are the same job and both have the same two traps, so
// the job lives here once rather than being written twice and guarded once.
//
// TRAP 1 — AN INTERACTIVE SHELL PRINTS WHATEVER ITS RC FILES PRINT, ON STDOUT.
// This is not hypothetical and it is not only a POSIX concern. Git for Windows'
// /etc/profile sources /etc/bash.bashrc unconditionally, and that file's body is
// gated on `[[ "$-" != *i* ]] && return` — so it does nothing for `--login -c`
// and runs for `--login -i -c`. Inside it is a warning block that prints to
// STDOUT (`printf "\twarning:\n…"`, no `1>&2`) whenever a
// /etc/profile.d/*.warning.once file exists, which Git for Windows writes after
// an upgrade. Read `test -t 1` there: under execFile stdout is a pipe, so it
// takes the stdout branch. A caller that treats stdout as the answer therefore
// gets the warning glued to it. zsh is the same story with a chattier .zshrc.
//
// So the answer is FENCED and extracted, never read as "the output".
//
// TRAP 2 — NOT EVERY $SHELL SPEAKS POSIX. In fish, $PATH is a LIST and "$PATH"
// joins it with SPACES, not colons; nushell does not expand "$PATH" at all. A
// capture run in either returns something non-empty that parses as a single
// bogus entry — the bug unfixed, reported as fixed. So a question is asked in a
// POSIX-compatible shell, chosen separately from the one the terminal runs.
// The user still gets fish in their terminal; they just do not get it here.

/** Wraps the answer so rc-file chatter cannot be mistaken for it. */
export const FENCE_START = '__ARC_ANSWER_START__'
export const FENCE_END = '__ARC_ANSWER_END__'

// How long to wait. A bound on a pathological rc file, not the expected cost —
// a normal capture measured 0.43–0.52s on zsh and 0.47s on Git Bash — but on
// the login-path path it is spent before the window appears, so it is
// deliberately short rather than generous.
export const CAPTURE_TIMEOUT_MS = 2000

// Shells whose `-l -i -c` runs a POSIX one-liner as written.
//
// Matched on BASENAME, so /bin/bash, /usr/local/bin/bash and a Homebrew bash
// all qualify. `sh` is included because on some hosts it is the only thing
// present; ksh and dash are POSIX by definition. fish and nushell are the two
// common shells deliberately absent — see TRAP 2.
export const POSIX_CAPTURE_SHELLS = ['sh', 'bash', 'zsh', 'ksh', 'dash', 'ash'] as const

/** Whether a shell path can be handed a POSIX one-liner. Pure, for the tests. */
export function speaksPosix(shellPath: string): boolean {
  const base = shellPath.split(/[\\/]/).pop() ?? ''
  // Strip a Windows extension and a trailing version digit (bash5, zsh-5.9).
  const name = base.replace(/\.exe$/i, '').replace(/[-.]?\d[\d.]*$/, '')
  return (POSIX_CAPTURE_SHELLS as readonly string[]).includes(name)
}

// The shell to ASK a question in, which is not always the one to RUN.
//
// resolveShell()'s answer when it speaks POSIX, the platform fallback
// otherwise. A fish user's PATH is then whatever zsh -l -i reports, which is
// less than their real one — /etc/paths and .zprofile but not config.fish.
// That is a partial answer rather than a wrong one, and it is the honest limit:
// the alternative is a confidently-reported PATH built by splitting a
// space-joined list on colons.
export function captureShell(): ShellResult {
  const resolved = resolveShell()
  if (!resolved.ok) return resolved
  if (speaksPosix(resolved.shell.command)) return resolved

  const fallback = posixFallback(process.platform)
  return existsSync(fallback)
    ? { ok: true, shell: { command: fallback, args: ['-l', '-i'] } }
    : {
        ok: false,
        message: `$SHELL (${resolved.shell.command}) is not POSIX-compatible and ${fallback} does not exist.`
      }
}

// The one-liner to run: fence, then the caller's command, then fence.
//
// printf rather than echo, because echo's escape handling varies between
// shells. The command's own exit status is deliberately discarded — the last
// printf decides it — so a failed command reads as an EMPTY answer rather than
// as a spawn error, and the caller has one thing to test instead of two.
export function fencedCommand(command: string): string {
  return `printf '%s' '${FENCE_START}'; ${command}; printf '%s' '${FENCE_END}'`
}

// The fenced answer, or null if it is not in there.
//
// Takes the LAST opening fence rather than the first: some interactive setups
// echo the command line back, and that echo contains the fence with nothing
// expanded. The real answer is always the last one written.
export function parseFenced(stdout: string): string | null {
  const start = stdout.lastIndexOf(FENCE_START)
  if (start === -1) return null
  const from = start + FENCE_START.length
  const end = stdout.indexOf(FENCE_END, from)
  if (end === -1) return null
  const value = stdout.slice(from, end).trim()
  return value === '' ? null : value
}

// Whether the shell RAN, separately from what it said.
//
// The split exists because one caller needs it: agents.ts caches its answer
// forever, and must distinguish "this machine has no claude" (a fact, cache it)
// from "the shell could not be started just now" (transient — `spawn EBUSY` has
// been seen in the wild — so retry on the next tick). Collapsing both to null
// would turn a hiccup at startup into a poller that is dead until relaunch.
export type ShellAnswer =
  { answered: true; value: string | null } | { answered: false; reason: string }

// Ask the user's shell one question and get a trustworthy scalar back.
//
// Never throws and never outlasts CAPTURE_TIMEOUT_MS. The command's own failure
// is `answered: true, value: null` — the shell ran and reported nothing, which
// is an answer.
export function askShell(command: string): Promise<ShellAnswer> {
  const shell = captureShell()
  if (!shell.ok) return Promise.resolve({ answered: false, reason: shell.message })
  return new Promise((done) => {
    try {
      execFile(
        shell.shell.command,
        // The same flags a spawned session gets, plus -c to run one command and
        // exit. Taken from the result rather than respelled, so there is one
        // statement of "-l -i" per platform and not two.
        [...shell.shell.args, '-c', fencedCommand(command)],
        { encoding: 'utf8', timeout: CAPTURE_TIMEOUT_MS, windowsHide: true },
        // The error is deliberately ignored: fencedCommand discards the inner
        // command's exit status, so a non-zero one here means the SHELL failed,
        // and in that case there are no fences to find and parseFenced says so.
        (_error, stdout) => done({ answered: true, value: parseFenced(stdout) })
      )
    } catch {
      // spawn can fail synchronously, which never reaches the callback.
      done({ answered: false, reason: `${shell.shell.command} could not be spawned` })
    }
  })
}
