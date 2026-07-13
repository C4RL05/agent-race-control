import { beforeEach, describe, expect, it } from 'vitest'
import type { Session } from './sessions.svelte'
import {
  sessions,
  cleanTitle,
  nudgeStatusFromKey,
  previewItems,
  applyPreviewItems
} from './sessions.svelte'

function fakeSession(overrides: Partial<Session>): Session {
  return {
    key: 1,
    type: 'claude',
    cwd: 'D:\\x',
    name: '',
    status: 'idle',
    title: '',
    ptyId: '1',
    claudeSessionId: 'sid',
    resumeId: null,
    view: 'terminal',
    ...overrides
  }
}

beforeEach(() => {
  sessions.length = 0
  for (const key of Object.keys(previewItems)) delete previewItems[key]
})

describe('cleanTitle', () => {
  it('strips Claude state glyphs and MSYS prefixes, passes plain titles through', () => {
    expect(cleanTitle('✳ Fix the bug')).toBe('Fix the bug')
    expect(cleanTitle('✻✶ churning')).toBe('churning')
    expect(cleanTitle('MINGW64: /d/Projects/x')).toBe('/d/Projects/x')
    expect(cleanTitle('Fix the bug')).toBe('Fix the bug')
    expect(cleanTitle('')).toBe('')
  })
})

// Hooks are blind to user interrupts (Stop fires only on completed turns),
// so these keystroke nudges are the only cancel/answer signal — see the
// kickoff doc's interrupts entry.
describe('nudgeStatusFromKey', () => {
  it('a lone Esc or Ctrl+C while running/waiting flips to idle', () => {
    sessions.push(fakeSession({ key: 1, status: 'waiting' }))
    nudgeStatusFromKey(1, '\x1b')
    expect(sessions[0].status).toBe('idle')

    sessions[0].status = 'running'
    nudgeStatusFromKey(1, '\x03')
    expect(sessions[0].status).toBe('idle')
  })

  it('Enter while waiting means the dialog was answered — running', () => {
    sessions.push(fakeSession({ key: 1, status: 'waiting' }))
    nudgeStatusFromKey(1, '\r')
    expect(sessions[0].status).toBe('running')
  })

  it('ignores escape sequences (arrow keys arrive as multi-byte chunks)', () => {
    sessions.push(fakeSession({ key: 1, status: 'waiting' }))
    nudgeStatusFromKey(1, '\x1b[A')
    expect(sessions[0].status).toBe('waiting')
  })

  it('never touches shells, exited sessions, or non-signal keys', () => {
    sessions.push(fakeSession({ key: 1, type: 'shell', status: 'running' }))
    sessions.push(fakeSession({ key: 2, status: 'exited' }))
    sessions.push(fakeSession({ key: 3, status: 'running' }))
    nudgeStatusFromKey(1, '\x1b')
    nudgeStatusFromKey(2, '\x1b')
    nudgeStatusFromKey(3, '\r') // Enter only answers dialogs (waiting)
    expect(sessions.map((s) => s.status)).toEqual(['running', 'exited', 'running'])
  })
})

// reset=true is the first batch of any from-zero read: REPLACE, don't
// append — that's what makes replays and re-created tails duplication-proof.
describe('applyPreviewItems', () => {
  it('creates, appends, and replaces on reset', () => {
    applyPreviewItems('sid', [{ kind: 'user', text: 'a' }], false)
    expect(previewItems['sid']).toEqual([{ kind: 'user', text: 'a' }])

    applyPreviewItems('sid', [{ kind: 'assistant', text: 'b' }], false)
    expect(previewItems['sid']).toHaveLength(2)

    applyPreviewItems('sid', [{ kind: 'user', text: 'fresh' }], true)
    expect(previewItems['sid']).toEqual([{ kind: 'user', text: 'fresh' }])
  })

  it('reset with an empty batch empties the cache (file deleted)', () => {
    applyPreviewItems('sid', [{ kind: 'user', text: 'a' }], false)
    applyPreviewItems('sid', [], true)
    expect(previewItems['sid']).toEqual([])
  })

  it('routes by session id', () => {
    applyPreviewItems('a', [{ kind: 'user', text: 'x' }], false)
    applyPreviewItems('b', [{ kind: 'user', text: 'y' }], false)
    expect(previewItems['a']).toHaveLength(1)
    expect(previewItems['b']).toHaveLength(1)
  })
})
