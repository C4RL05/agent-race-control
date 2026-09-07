import { execFile } from 'node:child_process'
import { delimiter } from 'node:path'
import { CAPTURE_TIMEOUT_MS, askShell } from './shell'

// Give this process the PATH the user's environment would have given it.
//
// TWO BUGS, ONE SHAPE: the app ends up holding a PATH the user's environment
// does not have, and every consequence reads like our code being wrong rather
// than our environment being thin.
//
//   macOS — an app launched from Finder or the Dock inherits LAUNCHD's
//   environment, not a shell's. Measured: `launchctl getenv PATH` is empty, so
//   the app gets launchd's default /usr/bin:/bin:/usr/sbin:/sbin. No
//   /opt/homebrew/bin, no version-manager shim, no ~/.local/bin. THE BUG
//   APPEARS ONLY IN THE ARRANGEMENT NOBODY DEVELOPS IN, which is why it
//   survives: a dev launch from a terminal inherits the terminal's PATH and
//   shows none of it.
//
//   Windows — a process inherits its PARENT's environment block, so anything
//   launched from a shell that started before a PATH-changing install keeps the
//   old PATH for its whole life: the registry has moved on and the process has
//   not. Measured immediately after installing a CLI — the persisted machine
//   PATH held its directory and the running app's did not, so the tool read as
//   absent on a machine where it plainly was not. A FRESH-LOOKING TERMINAL CAN
//   STILL CARRY A STALE BLOCK, which is unguessable from the outside and is why
//   "just restart it" is not the fix.
//
// ONE PROCESS-WIDE REPAIR, NO CALLERS CHANGED. This is awaited in whenReady
// before anything registers IPC or spawns, so every caller inherits it —
// git.ts's bare `execFile('git', …)`, and the absolute `claude` path agents.ts
// resolves, whose own shebang has to find `node` on THIS process's PATH.
//
// The PTYs are unaffected either way: they start a login shell, which derives
// its own PATH regardless of what this process was handed. That is why the
// terminals were never the symptom.
//
// FAILURE IS ALWAYS SILENT AND ALWAYS SURVIVABLE. Every outcome — no shell, a
// shell that hangs, output with no sentinels, an unreadable registry key —
// leaves the existing PATH untouched. A worse PATH is not a possible result:
// mergePath is a union, so nothing reachable before becomes unreachable. The
// app then behaves exactly as it did before this file existed, which is the
// right floor for something that runs before the window.

// The question, for askShell to fence and run. Double quotes around $PATH so an
// entry containing a space comes back intact; printf rather than echo, because
// echo's escape handling varies between shells.
export function pathQuery(): string {
  return 'printf \'%s\' "$PATH"'
}

// The captured PATH first, then anything this process already had that it did
// not mention. A UNION, NEVER A REPLACEMENT: launchd's entries are thin but not
// wrong, and Electron or a launcher may have added something the app needs. The
// captured order wins because that is the order the user's own tooling resolves
// in — a version manager shadowing a system binary has to keep shadowing it
// here.
//
// The separator is passed in rather than read, so both platforms' forms are
// testable on either host.
export function mergePath(
  loginPath: string,
  currentPath: string | undefined,
  separator: string
): string {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const list of [loginPath, currentPath ?? '']) {
    for (const raw of list.split(separator)) {
      const entry = raw.trim()
      // Empty segments are what a trailing or doubled separator leaves behind,
      // and an empty PATH entry means "the current directory" to some tools —
      // never wanted here.
      if (entry === '' || seen.has(entry)) continue
      seen.add(entry)
      merged.push(entry)
    }
  }
  return merged.join(separator)
}

// Which repair this host needs. win32 asks the registry; everything else asks
// the login shell. Not "whether to repair at all" — both hosts have a form of
// this bug.
export function needsLoginShellCapture(platform: string): boolean {
  return platform !== 'win32'
}

/** The two keys Windows composes the persisted PATH from, in the order it uses. */
export const MACHINE_ENV_KEY =
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
export const USER_ENV_KEY = 'HKCU\\Environment'

// The `Path` value out of one `reg query … /v Path` output, or null.
//
// Anchored on `Path` followed by its type token, which is what keeps PATHEXT
// out: it lives in the same key and would otherwise match a looser pattern.
// REG_SZ and REG_EXPAND_SZ are both accepted because which one a machine uses
// is not ours to predict — a default install writes REG_EXPAND_SZ, and a
// hand-edited PATH is sometimes rewritten as plain REG_SZ.
export function parseRegPath(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s+Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/i.exec(line)
    if (match && match[1].trim() !== '') return match[1].trim()
  }
  return null
}

// Expand %NAME% references against an environment.
//
// REG_EXPAND_SZ values are stored unexpanded — the machine PATH really does
// contain %SystemRoot%\system32 — and a PATH entry with a literal %SystemRoot%
// in it resolves nothing. Unknown names are left exactly as they are rather
// than blanked: a wrong-looking entry that nothing matches is harmless, while
// turning %FOO%\bin into \bin would silently add the filesystem root to PATH.
export function expandWindowsVars(value: string, env: Record<string, string | undefined>): string {
  return value.replace(/%([^%]+)%/g, (whole, name: string) => {
    const found = Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase())
    return found?.[1] ?? whole
  })
}

export type LoginPathOutcome = { applied: true; path: string } | { applied: false; reason: string }

/** Promisified execFile, bounded — the shape git.ts already uses. */
function capture(file: string, args: string[]): Promise<string | null> {
  return new Promise((done) => {
    try {
      execFile(
        file,
        args,
        { encoding: 'utf8', timeout: CAPTURE_TIMEOUT_MS, windowsHide: true },
        (error, stdout) => done(error ? null : stdout)
      )
    } catch {
      // spawn can fail synchronously; no outcome here is worth failing startup.
      done(null)
    }
  })
}

// Windows: re-read the persisted PATH and append what this process is missing.
//
// `reg query` rather than PowerShell: two spawns of a few tens of milliseconds
// against a shell that takes hundreds, and this runs before the window appears.
//
// Machine, then user, then whatever we already had — so it can only ever ADD an
// entry.
async function applyRegistryPath(): Promise<LoginPathOutcome> {
  const read = async (key: string): Promise<string | null> => {
    const stdout = await capture('reg', ['query', key, '/v', 'Path'])
    if (stdout === null) return null
    const raw = parseRegPath(stdout)
    return raw === null ? null : expandWindowsVars(raw, process.env)
  }

  const [machine, user] = await Promise.all([read(MACHINE_ENV_KEY), read(USER_ENV_KEY)])
  if (machine === null && user === null) {
    return { applied: false, reason: 'no persisted PATH could be read from the registry' }
  }

  const persisted = [machine, user].filter((part): part is string => part !== null).join(delimiter)
  const merged = mergePath(persisted, process.env['PATH'], delimiter)
  process.env['PATH'] = merged
  return { applied: true, path: merged }
}

// POSIX: ask the login shell what PATH it would have had.
//
// Captured entries go FIRST here, unlike the Windows branch, and the asymmetry
// is deliberate: launchd's PATH is not a stale copy of the user's, it is four
// system directories that were never the user's order at all. A version manager
// shadowing a system binary has to keep shadowing it, so the shell's order
// wins. Nothing is lost either way — mergePath is a union.
//
// -l -i, not just -l: an rc file sourced only for INTERACTIVE shells is where a
// version manager usually puts the agent CLI, and on the machine this was
// measured on it reached PATH through .zshrc alone, with no .zprofile or
// .zshenv putting it there. A -l-only capture returns a PATH without the one
// tool the bug is about, AND LOOKS LIKE IT WORKED.
//
// askShell owns the two traps that answer costs — rc-file chatter on stdout,
// and a $SHELL that does not speak POSIX. See shell.ts.
async function applyShellPath(): Promise<LoginPathOutcome> {
  const answer = await askShell(pathQuery())
  if (!answer.answered) return { applied: false, reason: answer.reason }
  const resolved = answer.value
  if (resolved === null) {
    return { applied: false, reason: 'the login shell printed no usable PATH' }
  }
  const merged = mergePath(resolved, process.env['PATH'], delimiter)
  process.env['PATH'] = merged
  return { applied: true, path: merged }
}

/** Resolve and apply, once, at startup. Awaited before anything registers IPC or spawns. */
export function applyLoginPath(): Promise<LoginPathOutcome> {
  return needsLoginShellCapture(process.platform) ? applyShellPath() : applyRegistryPath()
}
