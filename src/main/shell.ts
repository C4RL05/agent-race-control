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
// -l -i on BOTH branches, for the same reason: without a login shell the
// terminal's PATH is this process's, so neither the user's zsh rc files nor Git
// Bash's /etc/profile.d/* run. Without -i, an rc file that is sourced only for
// interactive shells (.bashrc, .zshrc) is skipped — and that is where a version
// manager usually puts the agent CLI. Both shells accept the short forms;
// --login is spelled out on the Windows branch because it always has been.
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
