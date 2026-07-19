import { describe, expect, it } from 'vitest'
import { parseStatusV2 } from './git'

// The `git status --porcelain=v2 --branch` reduction feeding the branch-state
// markers. The samples mirror real git output shapes: `# branch.*` headers,
// then one line per change entry (1 = changed, 2 = renamed, u = unmerged,
// ? = untracked) — ANY entry means dirty.

describe('parseStatusV2', () => {
  it('reads upstream and ahead/behind from the headers of a clean tree', () => {
    const out = [
      '# branch.oid 4e0b97fdeadbeef',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1'
    ].join('\n')
    expect(parseStatusV2(out)).toEqual({
      dirty: false,
      ahead: 2,
      behind: 1,
      upstream: 'origin/main'
    })
  })

  it('any entry line means dirty — modified, untracked, renamed, unmerged', () => {
    const header = '# branch.oid abc\n# branch.head feat'
    const modified = '1 .M N... 100644 100644 100644 abc def src/foo.ts'
    const untracked = '? new.txt'
    const renamed = '2 R. N... 100644 100644 100644 abc def R100 b.ts\ta.ts'
    const unmerged = 'u UU N... 100644 100644 100644 100644 abc def ghi conflicted.ts'
    for (const entry of [modified, untracked, renamed, unmerged]) {
      expect(parseStatusV2(`${header}\n${entry}`).dirty).toBe(true)
    }
    expect(parseStatusV2(header).dirty).toBe(false)
  })

  it('no upstream header → empty upstream and zero counts', () => {
    const out = '# branch.oid abc\n# branch.head worktree-feat\n? scratch.txt'
    expect(parseStatusV2(out)).toEqual({ dirty: true, ahead: 0, behind: 0, upstream: '' })
  })

  it('a detached head and an empty output stay inert', () => {
    expect(parseStatusV2('# branch.oid abc\n# branch.head (detached)')).toEqual({
      dirty: false,
      ahead: 0,
      behind: 0,
      upstream: ''
    })
    expect(parseStatusV2('')).toEqual({ dirty: false, ahead: 0, behind: 0, upstream: '' })
  })

  it('reads multi-digit ahead/behind counts, not just the first digit', () => {
    const out = '# branch.head main\n# branch.upstream origin/main\n# branch.ab +12 -34'
    expect(parseStatusV2(out)).toMatchObject({ ahead: 12, behind: 34 })
  })

  it('trims the upstream name so no trailing space leaks into the base label', () => {
    expect(parseStatusV2('# branch.upstream origin/feature ').upstream).toBe('origin/feature')
  })

  it('a malformed branch.ab line leaves counts at zero instead of throwing', () => {
    // the file's contract is to parse defensively and never throw on drift
    const out = '# branch.head main\n# branch.ab whoops'
    expect(() => parseStatusV2(out)).not.toThrow()
    expect(parseStatusV2(out)).toMatchObject({ ahead: 0, behind: 0 })
  })
})
