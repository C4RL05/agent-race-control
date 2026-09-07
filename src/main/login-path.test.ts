import { describe, expect, it } from 'vitest'
import {
  PATH_END,
  PATH_START,
  expandWindowsVars,
  loginPathCommand,
  mergePath,
  needsLoginShellCapture,
  parseLoginPath,
  parseRegPath
} from './login-path'

// The pure halves. The spawn is what only a real host can exercise; everything
// that decides what the PATH ends up being is here, and both platforms' forms
// run on either host because the separator is passed in.

describe('loginPathCommand', () => {
  it('fences the value and expands only $PATH', () => {
    const cmd = loginPathCommand()
    expect(cmd).toContain(PATH_START)
    expect(cmd).toContain(PATH_END)
    // Double quotes around $PATH so an entry with a space survives; single
    // quotes around the sentinels so the shell cannot touch them.
    expect(cmd).toContain('"$PATH"')
    expect(cmd).toContain(`'${PATH_START}'`)
    // printf, not echo — echo's escape handling varies between shells.
    expect(cmd.startsWith('printf ')).toBe(true)
  })
})

describe('parseLoginPath', () => {
  it('extracts the fenced value', () => {
    expect(parseLoginPath(`${PATH_START}/usr/bin:/bin${PATH_END}`)).toBe('/usr/bin:/bin')
  })

  // An interactive shell prints whatever its rc files print — banners,
  // version-manager notices, a stray echo. The value is extracted, never read
  // as "the output".
  it('ignores rc-file chatter on either side', () => {
    const noisy = `nvm: using v22\n${PATH_START}/opt/homebrew/bin:/usr/bin${PATH_END}\nbye\n`
    expect(parseLoginPath(noisy)).toBe('/opt/homebrew/bin:/usr/bin')
  })

  // Some setups echo the command line back before running it, and that echo
  // contains the opening sentinel with $PATH unexpanded. The real value is
  // always the last one written.
  it('takes the last opening sentinel, not the first', () => {
    const echoed = `printf '%s%s%s' '${PATH_START}' "$PATH" '${PATH_END}'\n${PATH_START}/real/bin${PATH_END}`
    expect(parseLoginPath(echoed)).toBe('/real/bin')
  })

  it('is null for output with no sentinels, a missing close, or an empty value', () => {
    expect(parseLoginPath('command not found')).toBe(null)
    expect(parseLoginPath(`${PATH_START}/usr/bin`)).toBe(null)
    expect(parseLoginPath(`${PATH_START}   ${PATH_END}`)).toBe(null)
  })
})

describe('mergePath', () => {
  it('puts the captured entries first and keeps what only the process had', () => {
    expect(mergePath('/opt/homebrew/bin:/usr/bin', '/usr/bin:/sbin', ':')).toBe(
      '/opt/homebrew/bin:/usr/bin:/sbin'
    )
  })

  // The whole safety argument: launchd's entries are thin but not wrong, and a
  // launcher may have added something the app needs. Nothing reachable before
  // may become unreachable.
  it('never drops an entry the process already had', () => {
    const current = '/usr/bin:/bin:/usr/sbin:/sbin'
    const merged = mergePath('/opt/homebrew/bin', current, ':')
    for (const entry of current.split(':')) expect(merged.split(':')).toContain(entry)
  })

  // A version manager shadowing a system binary has to keep shadowing it here.
  it('lets the captured order win for a duplicated entry', () => {
    expect(mergePath('/v/bin:/usr/bin', '/usr/bin:/v/bin', ':')).toBe('/v/bin:/usr/bin')
  })

  it('drops empty segments, which mean "the current directory" to some tools', () => {
    expect(mergePath('/usr/bin::/bin:', undefined, ':')).toBe('/usr/bin:/bin')
  })

  it('works with the Windows separator too', () => {
    expect(mergePath('C:\\tools;C:\\Windows', 'C:\\Windows;C:\\Users\\me\\bin', ';')).toBe(
      'C:\\tools;C:\\Windows;C:\\Users\\me\\bin'
    )
  })

  it('handles an absent current PATH', () => {
    expect(mergePath('/usr/bin', undefined, ':')).toBe('/usr/bin')
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

  // PATHEXT lives in the same key and would match a looser pattern.
  it('does not match PATHEXT', () => {
    expect(parseRegPath('    PATHEXT    REG_SZ    .COM;.EXE;.BAT')).toBe(null)
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
