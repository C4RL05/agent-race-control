import { beforeEach, describe, expect, it } from 'vitest'
import type { Session } from './sessions.svelte'
import {
  sessions,
  cleanTitle,
  nudgeStatusFromKey,
  previewItems,
  applyPreviewItems,
  applyStatus,
  toggleTodo
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
    hookToken: 'tok',
    resumeId: null,
    view: 'terminal',
    todo: false,
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

// The hook → dot state machine. The load-bearing case is PostToolUse: a
// non-blocking hook POST that arrives out of order (just after Stop) must not
// resurrect a finished turn to red — see the applyStatus comment.
describe('applyStatus', () => {
  it('maps each hook event to its dot state', () => {
    sessions.push(fakeSession({ key: 1, status: 'idle' }))
    applyStatus('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
    applyStatus('tok', 'sid', 'PermissionRequest')
    expect(sessions[0].status).toBe('waiting')
    applyStatus('tok', 'sid', 'Notification')
    expect(sessions[0].status).toBe('waiting')
    applyStatus('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('idle')
  })

  it('PostToolUse continues an active turn but never resurrects a finished one', () => {
    sessions.push(fakeSession({ key: 1, status: 'idle' }))
    // stray/out-of-order PostToolUse after Stop must leave the finished turn idle
    applyStatus('tok', 'sid', 'PostToolUse')
    expect(sessions[0].status).toBe('idle')
    // mid-turn (e.g. a permission was just granted) it resumes red
    sessions[0].status = 'waiting'
    applyStatus('tok', 'sid', 'PostToolUse')
    expect(sessions[0].status).toBe('running')
    // and keeps a running turn running
    applyStatus('tok', 'sid', 'PostToolUse')
    expect(sessions[0].status).toBe('running')
  })

  it('routes by the stable hookToken, not the conversation id', () => {
    sessions.push(fakeSession({ key: 1, hookToken: 'tok', claudeSessionId: 'sid', status: 'idle' }))
    // an unknown token is a no-op even if the conversation id matches
    applyStatus('other', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('idle')
    applyStatus('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
  })

  it('follows a changed conversation id (/clear): adopts the new id, drops the old cache', () => {
    sessions.push(fakeSession({ key: 1, hookToken: 'tok', claudeSessionId: 'sid', status: 'idle' }))
    previewItems['sid'] = [{ kind: 'user', text: 'pre-clear' }]
    applyStatus('tok', 'newsid', 'UserPromptSubmit')
    expect(sessions[0].claudeSessionId).toBe('newsid')
    expect(previewItems['sid']).toBeUndefined()
    expect(sessions[0].status).toBe('running')
  })

  it('never revives an exited session, and ignores an unknown token', () => {
    sessions.push(fakeSession({ key: 1, status: 'exited' }))
    applyStatus('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('exited')
    applyStatus('nope', 'sid', 'Stop') // no matching session — no throw, no-op
    expect(sessions[0].status).toBe('exited')
  })
})

// Cosmetic TODO flag (issue #3): toggled by clicking the dot, auto-cleared the
// next time the underlying status changes color (each status is a distinct
// color, so a value change is a color change — routed through setStatus).
describe('TODO flag', () => {
  it('toggles on and off', () => {
    sessions.push(fakeSession({ key: 1, todo: false }))
    toggleTodo(1)
    expect(sessions[0].todo).toBe(true)
    toggleTodo(1)
    expect(sessions[0].todo).toBe(false)
  })

  it('auto-clears when the underlying status changes color', () => {
    sessions.push(
      fakeSession({ key: 1, hookToken: 'tok', claudeSessionId: 'sid', status: 'idle', todo: true })
    )
    applyStatus('tok', 'sid', 'UserPromptSubmit') // idle -> running
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].todo).toBe(false)
  })

  it('survives a status update that keeps the same color, clears on a real change', () => {
    sessions.push(fakeSession({ key: 1, status: 'running', todo: true }))
    // Enter while running isn't a dialog answer — no status change, flag holds
    nudgeStatusFromKey(1, '\r')
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].todo).toBe(true)
    // Ctrl+C (running -> idle) is a color change — flag clears
    nudgeStatusFromKey(1, '\x03')
    expect(sessions[0].status).toBe('idle')
    expect(sessions[0].todo).toBe(false)
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
