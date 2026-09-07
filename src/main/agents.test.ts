import { describe, expect, it } from 'vitest'
import { whichClaudeCommand } from './agents'

describe('whichClaudeCommand', () => {
  // cygpath turns Git Bash's /c/Users/… into a path execFile can spawn.
  it('converts through cygpath on Windows', () => {
    expect(whichClaudeCommand('win32')).toBe('cygpath -w "$(command -v claude)"')
  })

  // cygpath is MSYS/Cygwin-only. Off Windows the call would just fail, and the
  // failure path caches null — so the poller would stay silently off forever on
  // a machine where claude is installed and working.
  it('asks command -v alone everywhere else', () => {
    expect(whichClaudeCommand('darwin')).toBe('command -v claude')
    expect(whichClaudeCommand('linux')).toBe('command -v claude')
  })

  it('asks the same question on every host', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      expect(whichClaudeCommand(platform)).toContain('command -v claude')
    }
  })
})
