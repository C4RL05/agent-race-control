import { describe, expect, it } from 'vitest'
import { screenStatus, __regions } from './screen'
import { IDLE, WORKING, BLOCKED_PERMISSION, BLOCKED_TRUST } from './screens.fixtures'

const { isHorizontalRule, bottomNonEmptyLines, afterLastHorizontalRule, promptBoxBody } = __regions

describe('screenStatus on real 2.1.261 screens', () => {
  it('reads a settled prompt box as idle', () => {
    expect(screenStatus(IDLE)).toBe('idle')
  })

  it('reads a running turn as running', () => {
    expect(screenStatus(WORKING)).toBe('running')
  })

  it('reads a tool permission dialog as waiting', () => {
    expect(screenStatus(BLOCKED_PERMISSION)).toBe('waiting')
  })

  it('reads the workspace-trust form as waiting', () => {
    expect(screenStatus(BLOCKED_TRUST)).toBe('waiting')
  })
})

describe('the case the title alone gets wrong', () => {
  // The whole reason the screen scan exists. A session parked on a permission
  // dialog still reports the IDLE title glyph, so a title-only technique would
  // paint it green — the one colour that means "nothing wants you".
  it('a blocked session reports the idle title glyph, and is still waiting', () => {
    expect(BLOCKED_PERMISSION.title.startsWith('✳ ')).toBe(true)
    expect(screenStatus({ title: BLOCKED_PERMISSION.title, lines: [] })).toBe('idle')
    expect(screenStatus(BLOCKED_PERMISSION)).toBe('waiting')
  })

  it('the screen carries a running turn even with no title at all', () => {
    expect(screenStatus({ title: '', lines: WORKING.lines })).toBe('running')
  })

  it('a running title outranks everything below it', () => {
    // Working title over an otherwise-idle screen: the title wins (priority 1100).
    expect(screenStatus({ title: '◐ Anything', lines: IDLE.lines })).toBe('running')
  })
})

describe('lines that must NOT read as running', () => {
  const box = [
    '────────────────────────',
    '❯ ',
    '────────────────────────',
    '  demo Opus 5 (1M context)                    /rc'
  ]

  it('a finished turn line has no ellipsis or elapsed parenthetical', () => {
    expect(screenStatus({ title: '✳ demo', lines: ['✻ Brewed for 2s · done 9:50', ...box] })).toBe(
      'idle'
    )
    expect(screenStatus({ title: '✳ demo', lines: ['✻ Worked for 7s · done 9:51', ...box] })).toBe(
      'idle'
    )
  })

  it('the mode footer only counts while it offers the interrupt', () => {
    expect(
      screenStatus({ title: '✳ demo', lines: [...box, '  ⏸ manual mode on · ← for agents'] })
    ).toBe('idle')
    expect(
      screenStatus({
        title: '✳ demo',
        lines: [...box, '  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents']
      })
    ).toBe('idle')
    expect(
      screenStatus({
        title: '',
        lines: [...box, '  ⏵⏵ auto mode on · 1 shell · esc to interrupt']
      })
    ).toBe('running')
  })

  it('every captured spinner frame is recognised in the activity line', () => {
    for (const frame of ['*', '·', '✢', '✶', '✻', '✽']) {
      expect(
        screenStatus({ title: '', lines: [`${frame} Baking… (7s · ↓ 338 tokens)`, ...box] })
      ).toBe('running')
    }
  })
})

describe('drift safety', () => {
  it('an unrecognisable screen has no opinion rather than a guess', () => {
    expect(screenStatus({ title: '', lines: [] })).toBe(null)
    expect(screenStatus({ title: 'claude', lines: ['some future TUI nobody has seen'] })).toBe(null)
  })

  it('overlays that are neither working nor blocked hold the previous colour', () => {
    expect(
      screenStatus({
        title: '✳ demo',
        lines: ['showing detailed transcript', 'ctrl+o to toggle', '↑↓ scroll']
      })
    ).toBe(null)
  })
})

describe('regions', () => {
  it('isHorizontalRule takes a full run or three-plus with a tail', () => {
    expect(isHorizontalRule('────────')).toBe(true)
    expect(isHorizontalRule('  ────  ')).toBe(true)
    expect(isHorizontalRule('─── Read file')).toBe(true) // 3+ then text
    expect(isHorizontalRule('─ x')).toBe(false) // too short to be a border
    expect(isHorizontalRule('')).toBe(false)
    expect(isHorizontalRule('❯ 1. Yes')).toBe(false)
  })

  it('promptBoxBody is the span between the last two borders', () => {
    // xterm's translateToString trims the row, so the empty input line is a
    // bare marker — which is exactly what the app will scan.
    expect(promptBoxBody(IDLE.lines)).toEqual(['❯'])
  })

  it('promptBoxBody is absent while a dialog is up — a dialog has one border', () => {
    // This is what stops "❯ 1. Yes" from ever reading as the input prompt.
    expect(promptBoxBody(BLOCKED_TRUST.lines)).toBe(null)
    expect(promptBoxBody(BLOCKED_PERMISSION.lines)).toBe(null)
  })

  it('afterLastHorizontalRule is where a dialog lives', () => {
    const region = afterLastHorizontalRule(BLOCKED_PERMISSION.lines).join('\n')
    expect(region).toContain('Do you want to proceed?')
    expect(region).toContain('❯ 1. Yes')
    expect(region).toContain('Esc to cancel')
    // The settled prompt box leaves only its footer below the last border.
    expect(afterLastHorizontalRule(IDLE.lines).join('\n')).not.toContain('❯')
  })

  it('bottomNonEmptyLines counts non-empty rows but keeps the blanks between', () => {
    expect(bottomNonEmptyLines(['a', '', 'b', '', ''], 2)).toEqual(['a', '', 'b', '', ''])
    expect(bottomNonEmptyLines(['a', '', 'b', '', ''], 1)).toEqual(['b', '', ''])
    expect(bottomNonEmptyLines(['', ''], 3)).toEqual([])
  })
})
