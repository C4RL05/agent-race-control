import { beforeEach, describe, expect, it } from 'vitest'
import type { Session, GitInfo } from './sessions.svelte'
import {
  sessions,
  cleanTitle,
  glyphLead,
  towerTitle,
  previewItems,
  applyPreviewItems,
  applyAgents,
  applyHook,
  nudgeStatusFromKey,
  toggleTodo,
  dirOrder,
  gitInfo,
  groupCwds,
  groupKeyOf,
  moveGroup,
  sameDir,
  parkedWorktrees,
  worktreeSpawnName,
  sessionTargetCwd
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
    claudePid: null,
    claudeStartedAt: null,
    subagentCount: 0,
    turnOpen: false,
    idleTicks: 0,
    statusSince: 0,
    lastHook: null,
    lastHookAt: null,
    agentEntry: null,
    agentEntryAt: null,
    resumeId: null,
    spawnWorktree: null,
    view: 'terminal',
    todo: false,
    notes: '',
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
    expect(cleanTitle('⠂ deploy')).toBe('deploy') // braille spinner frame
    expect(cleanTitle('✳Fix the bug')).toBe('Fix the bug') // spinner with no trailing space
    expect(cleanTitle('MINGW64: /d/Projects/x')).toBe('/d/Projects/x')
    expect(cleanTitle('MINGW64:/d/Projects/x')).toBe('/d/Projects/x') // no space after the colon
    expect(cleanTitle('Fix the bug')).toBe('Fix the bug')
    expect(cleanTitle('build MINGW64: later')).toBe('build MINGW64: later') // only a leading prefix
    expect(cleanTitle('')).toBe('')
  })
})

describe('towerTitle', () => {
  it('keeps the spinner (the row mirrors the terminal title) but drops MSYS prefixes', () => {
    expect(towerTitle('✳ Fix the bug')).toBe('✳ Fix the bug')
    expect(towerTitle('⠂ deploy')).toBe('⠂ deploy') // braille frame survives too
    expect(towerTitle('MINGW64: /d/Projects/x')).toBe('/d/Projects/x')
    expect(towerTitle('MINGW64:/d/Projects/x')).toBe('/d/Projects/x') // no space after the colon
    expect(towerTitle('UCRT64: /d/x')).toBe('/d/x')
    expect(towerTitle('Fix the bug')).toBe('Fix the bug')
    expect(towerTitle('build MINGW64: later')).toBe('build MINGW64: later') // only a leading prefix
    expect(towerTitle('')).toBe('')
  })

  // The pair is the whole point: same input, two readings. A title shown in a
  // row may churn; the one offered as a name may not.
  it('differs from cleanTitle only by the spinner', () => {
    expect(towerTitle('✳ Fix the bug')).not.toBe(cleanTitle('✳ Fix the bug'))
    expect(towerTitle('MINGW64: /d/x')).toBe(cleanTitle('MINGW64: /d/x'))
    expect(towerTitle('plain')).toBe(cleanTitle('plain'))
  })
})

describe('glyphLead', () => {
  it('classifies the leading glyph by family, first character deciding', () => {
    expect(glyphLead('✳ Fix the bug')).toEqual({ glyph: '✳', family: 'star' })
    expect(glyphLead('✻✶ churning')).toEqual({ glyph: '✻✶', family: 'star' }) // whole same-family run
    expect(glyphLead('◐ working')).toEqual({ glyph: '◐', family: 'circle' })
    expect(glyphLead('●')).toEqual({ glyph: '●', family: 'circle' })
    expect(glyphLead('✻◐ mixed')).toEqual({ glyph: '✻', family: 'star' }) // run stops at the family edge
  })

  it('leaves anything else uncolored', () => {
    expect(glyphLead('⠂ deploy')).toBe(null) // braille frames are neither family
    expect(glyphLead('Fix the bug')).toBe(null)
    expect(glyphLead('/d/Projects/x')).toBe(null)
    expect(glyphLead(' ✳ leading space')).toBe(null) // the FIRST character or nothing
    expect(glyphLead('')).toBe(null)
  })
})

// Turn state comes from hooks, because they are the only source that separates
// "the agent is driving" from "this session has something running". The poll
// cannot: it reports busy for a finished turn that still owns a background shell
// (measured: 90/90 samples over 205s), which is why it never paints red.
describe('applyHook', () => {
  it('maps the turn boundaries to the dot', () => {
    sessions.push(fakeSession({ key: 1, status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
    applyHook('tok', 'sid', 'PermissionRequest')
    expect(sessions[0].status).toBe('waiting')
    applyHook('tok', 'sid', 'Notification')
    expect(sessions[0].status).toBe('waiting')
    applyHook('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('idle')
  })

  // A turn killed by an API error fires NO Stop — without StopFailure the dot
  // would stay red for the rest of the session's life.
  it('StopFailure ends a turn just like Stop', () => {
    sessions.push(fakeSession({ key: 1, status: 'running' }))
    applyHook('tok', 'sid', 'StopFailure')
    expect(sessions[0].status).toBe('idle')
  })

  it('routes by the stable hookToken, not the conversation id', () => {
    sessions.push(fakeSession({ key: 1, hookToken: 'tok', claudeSessionId: 'sid', status: 'idle' }))
    applyHook('other', 'sid', 'UserPromptSubmit') // unknown token: no-op
    expect(sessions[0].status).toBe('idle')
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
  })

  it('follows a changed conversation id (/clear): adopts it, drops the old cache', () => {
    sessions.push(fakeSession({ key: 1, hookToken: 'tok', claudeSessionId: 'sid', status: 'idle' }))
    previewItems['sid'] = [{ kind: 'user', text: 'pre-clear' }]
    applyHook('tok', 'newsid', 'UserPromptSubmit')
    expect(sessions[0].claudeSessionId).toBe('newsid')
    expect(previewItems['sid']).toBeUndefined()
  })

  it('never revives an exited session, and ignores an unknown token', () => {
    sessions.push(fakeSession({ key: 1, status: 'exited' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('exited')
    expect(() => applyHook('nope', 'sid', 'Stop')).not.toThrow()
  })

  it('follows the payload cwd into the worktree (a --worktree spawn starts at the repo root)', () => {
    dirOrder.length = 0
    sessions.push(fakeSession({ key: 1, cwd: 'D:\\repo', status: 'idle', spawnWorktree: 'feat' }))
    applyHook('tok', 'sid', 'UserPromptSubmit', 'D:\\repo\\.claude\\worktrees\\feat')
    expect(sessions[0].cwd).toBe('D:\\repo\\.claude\\worktrees\\feat')
    expect(dirOrder).toContain('D:\\repo\\.claude\\worktrees\\feat')
    expect(sessions[0].spawnWorktree).toBe(null) // parked row hands over
  })

  it('treats a respelled payload cwd as the same dir — no churn, no duplicate group', () => {
    dirOrder.length = 0
    sessions.push(fakeSession({ key: 1, cwd: 'D:\\Repo', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit', 'D:/repo')
    expect(sessions[0].cwd).toBe('D:\\Repo')
    expect(dirOrder).toEqual([])
  })
})

// delegating: the main turn is over but subagents are still working. Amber
// without the pulse. A busy MAIN agent always outranks it.
describe('delegating (subagent tracking)', () => {
  it('a turn ending with subagents in flight lands on delegating, not idle', () => {
    sessions.push(fakeSession({ key: 1, status: 'running' }))
    applyHook('tok', 'sid', 'SubagentStart')
    applyHook('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('delegating')
  })

  it('the last subagent finishing turns delegating green', () => {
    sessions.push(fakeSession({ key: 1, status: 'running' }))
    applyHook('tok', 'sid', 'SubagentStart')
    applyHook('tok', 'sid', 'SubagentStart')
    applyHook('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('delegating')
    applyHook('tok', 'sid', 'SubagentStop')
    expect(sessions[0].status).toBe('delegating') // one still running
    applyHook('tok', 'sid', 'SubagentStop')
    expect(sessions[0].status).toBe('idle')
  })

  it('a busy main agent stays red however many subagents are running', () => {
    sessions.push(fakeSession({ key: 1, status: 'idle' }))
    applyHook('tok', 'sid', 'SubagentStart')
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
    // and a subagent finishing must not green a session that is still driving
    applyHook('tok', 'sid', 'SubagentStop')
    expect(sessions[0].status).toBe('running')
  })

  it('a subagent finishing never overrides an amber waiting dot', () => {
    sessions.push(fakeSession({ key: 1, status: 'idle' }))
    applyHook('tok', 'sid', 'SubagentStart')
    applyHook('tok', 'sid', 'PermissionRequest')
    applyHook('tok', 'sid', 'SubagentStop')
    expect(sessions[0].status).toBe('waiting')
  })

  it('SubagentStop never drives the count below zero', () => {
    sessions.push(fakeSession({ key: 1, status: 'running' }))
    applyHook('tok', 'sid', 'SubagentStop')
    applyHook('tok', 'sid', 'SubagentStop')
    applyHook('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('idle') // not stuck in delegating
  })
})

// The poll is a FLOOR, not a source of truth: idle is trusted absolutely
// (nothing is running at all), busy/waiting are ignored because they cannot
// distinguish a turn from a background shell.
describe('applyAgents', () => {
  it('forces green when the tick says idle — the self-heal hooks never had', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running' }))
    applyAgents([{ sessionId: 'sid', pid: 10, status: 'idle' }])
    expect(sessions[0].status).toBe('idle')
  })

  it('an idle tick clears stale subagent bookkeeping too', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running' }))
    applyHook('tok', 'sid', 'SubagentStart') // a SubagentStop that never arrives
    applyAgents([{ sessionId: 'sid', pid: 10, status: 'idle' }])
    expect(sessions[0].status).toBe('idle')
    applyHook('tok', 'sid', 'Stop') // must not resurrect delegating
    expect(sessions[0].status).toBe('idle')
  })

  it('IGNORES busy — that is the background-shell trap, not the agent driving', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyAgents([{ sessionId: 'sid', pid: 10, status: 'busy' }])
    expect(sessions[0].status).toBe('idle')
  })

  it('IGNORES waiting, and leaves delegating alone', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'delegating' }))
    applyAgents([{ sessionId: 'sid', pid: 10, status: 'waiting' }])
    expect(sessions[0].status).toBe('delegating')
  })

  it('learns the pid, then follows it through a /clear that changes the id', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running' }))
    applyAgents([{ sessionId: 'sid', pid: 10, startedAt: 5, status: 'busy' }])
    expect(sessions[0].claudePid).toBe(10)
    applyAgents([{ sessionId: 'fresh', pid: 10, startedAt: 5, status: 'idle' }])
    expect(sessions[0].claudeSessionId).toBe('fresh')
    expect(sessions[0].status).toBe('idle')
  })

  it('rejects a recycled pid whose start time does not match', () => {
    sessions.push(
      fakeSession({
        key: 1,
        claudeSessionId: 'sid',
        claudePid: 10,
        claudeStartedAt: 5,
        status: 'running'
      })
    )
    applyAgents([{ sessionId: 'stranger', pid: 10, startedAt: 999, status: 'idle' }])
    expect(sessions[0].claudeSessionId).toBe('sid')
    expect(sessions[0].status).toBe('running')
  })

  it('leaves a session absent from the tick untouched, and skips shells', () => {
    sessions.push(
      fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running' }),
      fakeSession({ key: 2, type: 'shell', claudeSessionId: 'sid2', status: 'running' })
    )
    applyAgents([{ sessionId: 'sid2', pid: 2, status: 'idle' }])
    expect(sessions[0].status).toBe('running') // absent from the tick
    expect(sessions[1].status).toBe('running') // a shell is not a Claude session
  })

  it('follows the entry cwd into the worktree', () => {
    dirOrder.length = 0
    sessions.push(fakeSession({ key: 1, cwd: 'D:\\repo', status: 'idle', spawnWorktree: 'feat' }))
    applyAgents([
      { sessionId: 'sid', pid: 10, status: 'busy', cwd: 'D:\\repo\\.claude\\worktrees\\feat' }
    ])
    expect(sessions[0].cwd).toBe('D:\\repo\\.claude\\worktrees\\feat')
    expect(sessions[0].spawnWorktree).toBe(null)
  })

  it('ignores a session with no handles yet rather than matching by accident', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: null, status: 'running' }))
    applyAgents([{ sessionId: 'whatever', pid: 10, status: 'idle' }])
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].claudePid).toBe(null)
  })
})

// The floor vs an OPEN turn. This is the 2026-08-19 field bug: the poll blinked
// idle once, mid-turn, the dot went green, and it stayed green for the next 14
// minutes of real work — red only ever comes from UserPromptSubmit, and that
// turn had already spent it.
describe('applyAgents and an open turn', () => {
  const tick = (status: string): void => applyAgents([{ sessionId: 'sid', pid: 10, status }])

  it('one idle blink mid-turn does NOT green the dot', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
    tick('idle')
    expect(sessions[0].status).toBe('running')
    tick('idle')
    expect(sessions[0].status).toBe('running')
  })

  it('but the CLI HOLDING idle still ends the turn — the self-heal survives', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    tick('idle')
    tick('idle')
    tick('idle')
    expect(sessions[0].status).toBe('idle')
    expect(sessions[0].turnOpen).toBe(false)
  })

  it('any non-idle sample resets the streak, so blinks never accumulate', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    tick('idle')
    tick('idle')
    tick('busy') // back to work: the two idles above are not evidence any more
    tick('idle')
    tick('idle')
    expect(sessions[0].status).toBe('running')
  })

  // The streak has to start AT the prompt. A session waiting at its prompt is
  // idle tick after idle tick, so a counter carried into the new turn is
  // already past the threshold, and the first idle sample — one that merely
  // beat the CLI's own flip to busy — would close the turn on tick one.
  it('a prompt zeroes the streak, so idle sitting time is not evidence', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    for (let i = 0; i < 5; i++) tick('idle') // sitting at the prompt, unprompted
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].idleTicks).toBe(0)
    tick('idle') // the poll hasn't caught up with the turn yet
    expect(sessions[0].status).toBe('running')
    tick('idle')
    tick('idle')
    expect(sessions[0].status).toBe('idle') // and the self-heal still lands
  })

  it('with no turn open a single idle still greens immediately', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running' }))
    tick('idle')
    expect(sessions[0].status).toBe('idle')
  })

  // busy alone is still not evidence of anything — but a turn the hooks opened
  // and never closed makes it corroboration, and then the green is what is wrong.
  it('busy restores red when a turn is open and the dot somehow went green', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle', turnOpen: true }))
    tick('busy')
    expect(sessions[0].status).toBe('running')
  })

  it('busy still means nothing with no turn open — that is the background shell', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    tick('busy')
    expect(sessions[0].status).toBe('idle')
  })

  it('busy never overrides amber or delegating, which the hooks own', () => {
    for (const from of ['waiting', 'delegating'] as const) {
      sessions.length = 0
      sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: from, turnOpen: true }))
      tick('busy')
      expect(sessions[0].status).toBe(from)
    }
  })

  it('Stop closes the turn, so a later busy cannot re-paint red', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    applyHook('tok', 'sid', 'Stop')
    tick('busy')
    expect(sessions[0].status).toBe('idle')
  })

  it('an interrupt closes the turn too — a shell outliving it must not re-paint red', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle' }))
    applyHook('tok', 'sid', 'UserPromptSubmit')
    nudgeStatusFromKey(1, '\x03')
    expect(sessions[0].status).toBe('idle')
    tick('busy')
    expect(sessions[0].status).toBe('idle')
  })
})

// Parking: the conversation moves to a background claude with its own pid, and
// the interactive process we spawned stays alive reporting `idle` for as long as
// it is parked. The row is the CONVERSATION, so it has to follow the id, not the
// husk (field bug, 2026-08-21 — a session that had been working for an hour and
// a half showed green).
describe('applyAgents follows a conversation that moves process', () => {
  // The parked pair, exactly as `claude agents --json` reports it.
  const husk = { sessionId: 'sid', pid: 10, startedAt: 100, kind: 'interactive', status: 'idle' }
  const job = { sessionId: 'bg', pid: 20, startedAt: 900, kind: 'background', status: 'busy' }

  const parked = (): Session =>
    fakeSession({ key: 1, claudeSessionId: 'sid', claudePid: 10, claudeStartedAt: 100 })

  it('adopts the background job pid once a hook reports its conversation', () => {
    sessions.push(parked())
    // The background process runs the inherited --settings hooks, so the POST
    // routes on our stable hookToken but carries ITS conversation id.
    applyHook('tok', 'bg', 'UserPromptSubmit')
    applyAgents([husk, job])
    expect(sessions[0].claudePid).toBe(20)
    expect(sessions[0].agentEntry?.kind).toBe('background')
  })

  it('the parked husk can no longer green a working session', () => {
    sessions.push(parked())
    applyHook('tok', 'bg', 'UserPromptSubmit')
    for (let i = 0; i < 5; i++) applyAgents([husk, job])
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].turnOpen).toBe(true)
  })

  // The other half of the old bug: hook and poll each dragged the row onto their
  // own id, and every switch reset turnOpen and the idle streak — so the first
  // idle sample after a prompt greened the dot with the guard bypassed.
  it('stops the hook and the poll fighting over the conversation id', () => {
    sessions.push(parked())
    applyHook('tok', 'bg', 'UserPromptSubmit')
    applyAgents([husk, job])
    expect(sessions[0].claudeSessionId).toBe('bg')
    applyAgents([husk, job])
    expect(sessions[0].claudeSessionId).toBe('bg')
  })

  it('greens when the background job itself goes idle — the floor still works', () => {
    sessions.push(parked())
    applyHook('tok', 'bg', 'UserPromptSubmit')
    applyAgents([husk, job])
    for (let i = 0; i < 3; i++) applyAgents([husk, { ...job, status: 'idle' }])
    expect(sessions[0].status).toBe('idle')
  })

  // The fallback that must survive: `/clear` keeps the process and changes the
  // id, and nothing announces it — so an unknown id on a known pid is a clear.
  it('still follows the pid through a /clear, when no entry carries our id', () => {
    sessions.push(parked())
    applyAgents([{ ...husk, sessionId: 'cleared' }])
    expect(sessions[0].claudeSessionId).toBe('cleared')
    expect(sessions[0].claudePid).toBe(10)
  })

  it('does not match a recycled pid whose claude started at a different time', () => {
    sessions.push(parked())
    applyAgents([{ ...husk, sessionId: 'someone-else', startedAt: 777 }])
    expect(sessions[0].claudeSessionId).toBe('sid')
    expect(sessions[0].agentEntry).toBe(null)
  })
})

// The only keystroke inference left. No hook fires on an interrupt, and the
// poll's floor can't help while a background shell keeps the session "busy".
describe('nudgeStatusFromKey', () => {
  it('Ctrl+C greens from running, waiting or delegating', () => {
    for (const from of ['running', 'waiting', 'delegating'] as const) {
      sessions.length = 0
      sessions.push(fakeSession({ key: 1, status: from }))
      nudgeStatusFromKey(1, '\x03')
      expect(sessions[0].status).toBe('idle')
    }
  })

  it('an interrupt also cancels the subagents', () => {
    sessions.push(fakeSession({ key: 1, status: 'running' }))
    applyHook('tok', 'sid', 'SubagentStart')
    nudgeStatusFromKey(1, '\x03')
    applyHook('tok', 'sid', 'Stop')
    expect(sessions[0].status).toBe('idle') // not delegating
  })

  // Esc is ambiguous with closing the /btw menu — issue #6 stays fixed by not
  // guessing. Arrow keys arrive as longer 0x1b-prefixed chunks.
  it('ignores Esc, escape sequences, shells and exited sessions', () => {
    sessions.push(
      fakeSession({ key: 1, status: 'running' }),
      fakeSession({ key: 2, type: 'shell', status: 'running' }),
      fakeSession({ key: 3, status: 'exited' })
    )
    nudgeStatusFromKey(1, '\x1b')
    nudgeStatusFromKey(1, '\x1b[A')
    nudgeStatusFromKey(2, '\x03')
    nudgeStatusFromKey(3, '\x03')
    expect(sessions.map((s) => s.status)).toEqual(['running', 'running', 'exited'])
  })
})

// One dir, several spellings: the picker writes backslashes, git and hook
// payloads may not, and Windows paths fold case — sameDir is what keeps a
// second spelling from becoming a second tower group.
describe('sameDir', () => {
  it('folds separators and case, but different paths stay different', () => {
    expect(sameDir('D:\\Projects\\x', 'D:/projects/X')).toBe(true)
    expect(sameDir('D:\\a', 'D:\\a\\b')).toBe(false)
  })
})

// The reopen menu's model: worktrees on disk minus the main checkout and
// minus any cwd already showing rows. git prints forward slashes, the tower
// holds backslashes — the filter must see through that.
describe('parkedWorktrees', () => {
  const entries = [
    { path: 'D:/repo', branch: 'main', locked: false },
    { path: 'D:/repo/.claude/worktrees/feat', branch: 'worktree-feat', locked: true },
    { path: 'D:/repo-sibling', branch: 'carlos/x', locked: false }
  ]

  it('drops the main checkout and cwds with live rows, keeps the rest', () => {
    expect(parkedWorktrees(entries, 'D:/repo', ['D:\\repo'])).toEqual([entries[1], entries[2]])
    expect(parkedWorktrees(entries, 'D:/repo', ['D:\\repo\\.claude\\worktrees\\feat'])).toEqual([
      entries[2]
    ])
  })

  it('empty list stays empty', () => {
    expect(parkedWorktrees([], 'D:/repo', [])).toEqual([])
  })
})

// A pending worktree spawn's row belongs to its destination — the reopen menu
// filters on this so a worktree mid-reopen isn't offered twice.
describe('sessionTargetCwd', () => {
  it('pending spawns resolve to the destination, others to their cwd', () => {
    expect(sessionTargetCwd(fakeSession({ cwd: 'D:\\repo', spawnWorktree: 'feat' }))).toBe(
      'D:\\repo/.claude/worktrees/feat'
    )
    expect(sessionTargetCwd(fakeSession({ cwd: 'D:\\repo' }))).toBe('D:\\repo')
  })
})

// How a parked worktree reopens: .claude/worktrees/<name> → the name (spawn
// via --worktree, lifecycle re-attached); anything else → null (plain spawn).
describe('worktreeSpawnName', () => {
  it('extracts the name from a .claude/worktrees path, either separator', () => {
    expect(worktreeSpawnName('D:/repo', 'D:/repo/.claude/worktrees/feat')).toBe('feat')
    expect(worktreeSpawnName('D:\\repo', 'D:\\repo\\.claude\\worktrees\\Feat')).toBe('Feat')
  })

  it('returns null for the repo root, siblings, and nested non-name paths', () => {
    expect(worktreeSpawnName('D:/repo', 'D:/repo')).toBe(null)
    expect(worktreeSpawnName('D:/repo', 'D:/repo-sibling')).toBe(null)
    expect(worktreeSpawnName('D:/repo', 'D:/other/.claude/worktrees/feat')).toBe(null)
    expect(worktreeSpawnName('D:/repo', 'D:/repo/.claude/worktrees/a/b')).toBe(null)
    // same worktrees structure on a different drive must not match this repo —
    // the prefix guard is the only thing standing between it and a false 'feat'
    expect(worktreeSpawnName('D:/repo', 'X:/repo/.claude/worktrees/feat')).toBe(null)
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

  it('toggles only the matching key; a missing key is a no-op, not a throw', () => {
    sessions.push(fakeSession({ key: 1, todo: false }), fakeSession({ key: 2, todo: false }))
    toggleTodo(2)
    expect(sessions.map((s) => s.todo)).toEqual([false, true]) // key 1 untouched
    expect(() => toggleTodo(999)).not.toThrow()
    expect(sessions.map((s) => s.todo)).toEqual([false, true])
  })

  it('auto-clears when the underlying status changes color', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'idle', todo: true }))
    applyHook('tok', 'sid', 'UserPromptSubmit') // idle -> running
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].todo).toBe(false)
  })

  it('survives a status update that keeps the same color, clears on a real change', () => {
    sessions.push(fakeSession({ key: 1, claudeSessionId: 'sid', status: 'running', todo: true }))
    // A hook that re-asserts the SAME state is not a colour change — flag holds
    applyHook('tok', 'sid', 'UserPromptSubmit')
    expect(sessions[0].status).toBe('running')
    expect(sessions[0].todo).toBe(true)
    // running -> idle is a real colour change — flag clears
    applyHook('tok', 'sid', 'Stop')
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

// The tower's repo→branch tree (issue #5): git cwds cluster by their shared
// repo root (so all worktrees group together), non-git cwds stand alone, and a
// cwd whose git info hasn't loaded yet is a plain folder until it does.
function repo(repoRoot: string, worktreeName: string, branch = 'main'): GitInfo {
  return {
    isRepo: true,
    repoRoot,
    repoName: repoRoot.split(/[\\/]/).pop() ?? repoRoot,
    worktreeName,
    branch,
    dirty: false,
    ahead: 0,
    behind: 0,
    base: ''
  }
}

describe('groupCwds', () => {
  it('groups a repo’s worktrees under one repo, in first-appearance order', () => {
    const order = ['D:\\wt\\main', 'D:\\wt\\hotfix']
    const info = {
      'D:\\wt\\main': repo('D:/R', 'main', 'main'),
      'D:\\wt\\hotfix': repo('D:/R', 'hotfix', 'hotfix')
    }
    expect(groupCwds(order, info)).toEqual([
      { kind: 'repo', key: 'D:/R', repoName: 'R', cwds: ['D:\\wt\\main', 'D:\\wt\\hotfix'] }
    ])
  })

  it('clusters a repo’s worktrees even when interleaved with another repo', () => {
    const order = ['D:\\a', 'D:\\x', 'D:\\b']
    const info = {
      'D:\\a': repo('D:/R1', 'a'),
      'D:\\x': repo('D:/R2', 'x'),
      'D:\\b': repo('D:/R1', 'b')
    }
    // R1 keeps its first-appearance slot and gathers both of its worktrees.
    expect(groupCwds(order, info)).toEqual([
      { kind: 'repo', key: 'D:/R1', repoName: 'R1', cwds: ['D:\\a', 'D:\\b'] },
      { kind: 'repo', key: 'D:/R2', repoName: 'R2', cwds: ['D:\\x'] }
    ])
  })

  it('non-git and not-yet-loaded cwds are plain folders', () => {
    const order = ['D:\\plain', 'D:\\pending']
    const info = { 'D:\\plain': { isRepo: false } as GitInfo } // 'D:\\pending' absent
    expect(groupCwds(order, info)).toEqual([
      { kind: 'plain', key: 'D:\\plain', cwd: 'D:\\plain' },
      { kind: 'plain', key: 'D:\\pending', cwd: 'D:\\pending' }
    ])
  })
})

describe('moveGroup', () => {
  beforeEach(() => {
    dirOrder.length = 0
    for (const key of Object.keys(gitInfo)) delete gitInfo[key]
  })

  it('moves a whole repo block before another group, keeping worktrees contiguous', () => {
    dirOrder.push('D:\\a', 'D:\\b', 'D:\\c')
    Object.assign(gitInfo, {
      'D:\\a': repo('D:/R1', 'a'),
      'D:\\b': repo('D:/R1', 'b'),
      'D:\\c': repo('D:/R2', 'c')
    })
    expect(groupKeyOf('D:\\a')).toBe('D:/R1')
    moveGroup('D:/R2', 'D:/R1')
    expect([...dirOrder]).toEqual(['D:\\c', 'D:\\a', 'D:\\b'])
  })

  it('groupKeyOf falls back to the cwd for a non-git folder', () => {
    gitInfo['D:\\plain'] = { isRepo: false } as GitInfo
    expect(groupKeyOf('D:\\plain')).toBe('D:\\plain')
    expect(groupKeyOf('D:\\unknown')).toBe('D:\\unknown') // absent → itself
  })

  it('a self-move (fromKey === beforeKey) is a no-op', () => {
    dirOrder.push('D:\\a', 'D:\\b') // two plain groups (groupKeyOf → the cwd)
    moveGroup('D:\\a', 'D:\\a')
    expect([...dirOrder]).toEqual(['D:\\a', 'D:\\b'])
  })

  it('moving before an unknown group appends the block to the end', () => {
    dirOrder.push('D:\\a', 'D:\\b')
    moveGroup('D:\\a', 'D:\\nope')
    expect([...dirOrder]).toEqual(['D:\\b', 'D:\\a'])
  })
})
