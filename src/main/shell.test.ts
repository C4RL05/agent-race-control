import { describe, expect, it } from 'vitest'
import {
  FENCE_END,
  FENCE_START,
  fencedCommand,
  parseFenced,
  posixFallback,
  posixShell,
  speaksPosix
} from './shell'

// The platform-dependent half of resolveShell() is exercised here rather than
// through resolveShell itself: the predicate and the fallback are injected, so
// both hosts' branches run on either host. resolveShell's own body is two
// existsSync calls around these.

const nothingExists = (): boolean => false
const everythingExists = (): boolean => true
const only =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path)

describe('posixShell', () => {
  it('uses $SHELL when it is absolute and present', () => {
    expect(posixShell('/opt/homebrew/bin/fish', '/bin/zsh', only('/opt/homebrew/bin/fish'))).toBe(
      '/opt/homebrew/bin/fish'
    )
  })

  it('falls back when $SHELL is unset or blank', () => {
    expect(posixShell(undefined, '/bin/zsh', everythingExists)).toBe('/bin/zsh')
    expect(posixShell('   ', '/bin/zsh', everythingExists)).toBe('/bin/zsh')
  })

  // A relative $SHELL would resolve against this process's cwd rather than
  // anything the user meant — a shell somewhere under the app's working
  // directory is not the one they log in with.
  it('refuses a relative $SHELL even when a file of that name exists', () => {
    expect(posixShell('zsh', '/bin/zsh', everythingExists)).toBe('/bin/zsh')
    expect(posixShell('./zsh', '/bin/zsh', everythingExists)).toBe('/bin/zsh')
  })

  // The uninstalled-shell case: $SHELL still names it, and spawning it would
  // fail inside node-pty with no useful message.
  it('falls back when $SHELL names something that is gone', () => {
    expect(posixShell('/usr/local/bin/removed', '/bin/zsh', nothingExists)).toBe('/bin/zsh')
  })

  it('trims surrounding whitespace before testing', () => {
    expect(posixShell(' /bin/bash ', '/bin/zsh', only('/bin/bash'))).toBe('/bin/bash')
  })
})

describe('posixFallback', () => {
  it('is zsh on macOS and bash elsewhere', () => {
    expect(posixFallback('darwin')).toBe('/bin/zsh')
    expect(posixFallback('linux')).toBe('/bin/bash')
  })
})

describe('speaksPosix', () => {
  it('accepts the POSIX shells wherever they are installed', () => {
    for (const path of [
      '/bin/sh',
      '/bin/bash',
      '/bin/zsh',
      '/usr/local/bin/bash',
      '/opt/homebrew/bin/zsh',
      '/bin/ksh',
      '/usr/bin/dash'
    ]) {
      expect(speaksPosix(path)).toBe(true)
    }
  })

  // In fish, $PATH is a LIST and "$PATH" joins it with SPACES; nushell does not
  // expand "$PATH" at all. Either returns something non-empty that parses as one
  // bogus entry — the bug unfixed, reported as fixed.
  it('rejects fish and nushell', () => {
    expect(speaksPosix('/opt/homebrew/bin/fish')).toBe(false)
    expect(speaksPosix('/usr/local/bin/nu')).toBe(false)
  })

  it('handles a Windows path and a .exe suffix', () => {
    expect(speaksPosix('C:\\Program Files\\Git\\bin\\bash.exe')).toBe(true)
  })

  it('handles a versioned name', () => {
    expect(speaksPosix('/usr/bin/bash5')).toBe(true)
    expect(speaksPosix('/usr/bin/zsh-5.9')).toBe(true)
  })
})

describe('fencedCommand', () => {
  it('wraps the command in both fences', () => {
    const cmd = fencedCommand('command -v claude')
    expect(cmd).toContain(`'${FENCE_START}'`)
    expect(cmd).toContain(`'${FENCE_END}'`)
    expect(cmd).toContain('command -v claude')
  })

  // The last printf decides the exit status, so a failed inner command reads as
  // an empty answer rather than as a spawn error — one thing to test, not two.
  it('runs the fences as separate statements so the command cannot suppress them', () => {
    expect(fencedCommand('false')).toBe(
      `printf '%s' '${FENCE_START}'; false; printf '%s' '${FENCE_END}'`
    )
  })
})

describe('parseFenced', () => {
  it('extracts the fenced answer', () => {
    expect(parseFenced(`${FENCE_START}/usr/local/bin/claude\n${FENCE_END}`)).toBe(
      '/usr/local/bin/claude'
    )
  })

  // THE REASON THIS EXISTS. Git for Windows' /etc/bash.bashrc prints an upgrade
  // warning to STDOUT (not stderr) when stdout is a pipe, and its whole body is
  // gated on the shell being interactive — so `--login -c` never saw it and
  // `--login -i -c` does. Unfenced, that banner becomes part of the "path".
  it('ignores rc-file chatter on either side', () => {
    const noisy = `\n\twarning:\n\t\tGit for Windows was updated.\n\n${FENCE_START}C:\\Users\\me\\claude.exe${FENCE_END}\n`
    expect(parseFenced(noisy)).toBe('C:\\Users\\me\\claude.exe')
  })

  // Some setups echo the command line back before running it, and that echo
  // contains the opening fence with nothing expanded.
  it('takes the last opening fence, not the first', () => {
    const echoed = `printf '%s' '${FENCE_START}'; command -v claude\n${FENCE_START}/real/bin/claude${FENCE_END}`
    expect(parseFenced(echoed)).toBe('/real/bin/claude')
  })

  it('is null for no fences, a missing close, and an empty answer', () => {
    expect(parseFenced('bash: command not found')).toBe(null)
    expect(parseFenced(`${FENCE_START}/usr/bin/claude`)).toBe(null)
    expect(parseFenced(`${FENCE_START}   ${FENCE_END}`)).toBe(null)
  })
})
