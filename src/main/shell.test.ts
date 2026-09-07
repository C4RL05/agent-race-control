import { describe, expect, it } from 'vitest'
import { posixFallback, posixShell } from './shell'

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
