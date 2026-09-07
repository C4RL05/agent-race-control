import { describe, expect, it } from 'vitest'
import {
  expandWindowsVars,
  mergePath,
  needsLoginShellCapture,
  parseRegPath,
  pathQuery
} from './login-path'

// The pure halves. The spawn is what only a real host can exercise; everything
// that decides what the PATH ends up being is here, and both platforms' forms
// run on either host because the separator is passed in.
//
// The fencing that protects this capture moved to shell.ts, where a second
// caller needs it — see shell.test.ts.

describe('pathQuery', () => {
  it('quotes $PATH so an entry with a space survives', () => {
    expect(pathQuery()).toContain('"$PATH"')
  })

  // echo's escape handling varies between shells.
  it('uses printf, not echo', () => {
    expect(pathQuery().startsWith('printf ')).toBe(true)
  })
})

describe('mergePath', () => {
  it('puts the first list first and keeps what only the second had', () => {
    expect(mergePath('/opt/homebrew/bin:/usr/bin', '/usr/bin:/sbin', ':')).toBe(
      '/opt/homebrew/bin:/usr/bin:/sbin'
    )
  })

  // The whole safety argument: launchd's entries are thin but not wrong, and a
  // launcher may have added something the app needs. Nothing reachable before
  // may become unreachable.
  it('never drops an entry from either list', () => {
    const current = '/usr/bin:/bin:/usr/sbin:/sbin'
    const merged = mergePath('/opt/homebrew/bin', current, ':')
    for (const entry of current.split(':')) expect(merged.split(':')).toContain(entry)
  })

  // A version manager shadowing a system binary has to keep shadowing it.
  it('lets the first list win the rank of a duplicated entry', () => {
    expect(mergePath('/v/bin:/usr/bin', '/usr/bin:/v/bin', ':')).toBe('/v/bin:/usr/bin')
  })

  it('drops empty segments, which mean "the current directory" to some tools', () => {
    expect(mergePath('/usr/bin::/bin:', undefined, ':')).toBe('/usr/bin:/bin')
  })

  it('handles an absent or empty second list', () => {
    expect(mergePath('/usr/bin', undefined, ':')).toBe('/usr/bin')
    expect(mergePath('/usr/bin', '', ':')).toBe('/usr/bin')
  })
})

describe('needsLoginShellCapture', () => {
  it('is the login-shell route off win32, and the registry route on it', () => {
    expect(needsLoginShellCapture('darwin')).toBe(true)
    expect(needsLoginShellCapture('linux')).toBe(true)
    expect(needsLoginShellCapture('win32')).toBe(false)
  })
})

describe('parseRegPath', () => {
  const output = [
    '',
    'HKEY_CURRENT_USER\\Environment',
    '    Path    REG_EXPAND_SZ    %USERPROFILE%\\bin;C:\\tools',
    ''
  ].join('\r\n')

  it('reads the Path value', () => {
    expect(parseRegPath(output)).toBe('%USERPROFILE%\\bin;C:\\tools')
  })

  it('accepts a plain REG_SZ, which a hand-edited PATH is sometimes rewritten as', () => {
    expect(parseRegPath('    Path    REG_SZ    C:\\tools')).toBe('C:\\tools')
  })

  it('keeps a value containing spaces intact', () => {
    expect(parseRegPath('    Path    REG_SZ    C:\\Program Files\\Git\\cmd;C:\\tools')).toBe(
      'C:\\Program Files\\Git\\cmd;C:\\tools'
    )
  })

  // PATHEXT lives in the same key and would match a looser pattern.
  it('does not match PATHEXT, even when it comes first', () => {
    expect(parseRegPath('    PATHEXT    REG_SZ    .COM;.EXE;.BAT')).toBe(null)
    expect(
      parseRegPath('    PATHEXT    REG_SZ    .COM;.EXE\r\n    Path    REG_SZ    C:\\tools')
    ).toBe('C:\\tools')
  })

  it('is null for a key with no Path and for an empty value', () => {
    expect(parseRegPath('ERROR: The system was unable to find the specified registry key')).toBe(
      null
    )
    expect(parseRegPath('    Path    REG_SZ    ')).toBe(null)
  })
})

describe('expandWindowsVars', () => {
  const env = { SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\me' }

  it('expands references, case-insensitively', () => {
    expect(expandWindowsVars('%SystemRoot%\\system32;%userprofile%\\bin', env)).toBe(
      'C:\\Windows\\system32;C:\\Users\\me\\bin'
    )
  })

  // Blanking an unknown name would turn %FOO%\bin into \bin, which silently
  // adds the filesystem root to PATH. A wrong-looking entry that matches
  // nothing is the harmless outcome.
  it('leaves an unknown name exactly as it is', () => {
    expect(expandWindowsVars('%NOPE%\\bin', env)).toBe('%NOPE%\\bin')
  })

  it('leaves a value with no references alone', () => {
    expect(expandWindowsVars('C:\\tools;D:\\bin', env)).toBe('C:\\tools;D:\\bin')
  })
})
