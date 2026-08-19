import { describe, expect, it, vi } from 'vitest'

// sessioninfo.ts registers IPC handlers at call time, not import time — but it
// imports electron at module scope, which doesn't exist under vitest. The
// reducer under test never touches it (nor the filesystem).
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), on: vi.fn() } }))

import { emptyFold, foldLine, type FoldState } from './sessioninfo'

// Fold a list of transcript entries as if they were appended lines. Every
// fixture below is shaped after a real entry from a v2.1.229 transcript
// (verified empirically 2026-08-19) — the format is a Claude Code internal, so
// these fixtures are the contract we actually observed, not one we assumed.
function fold(...entries: unknown[]): FoldState {
  const state = emptyFold()
  for (const entry of entries) foldLine(state, JSON.stringify(entry))
  return state
}

const assistant = (message: unknown, extra: object = {}): object => ({
  type: 'assistant',
  message,
  ...extra
})

describe('foldLine — defensiveness', () => {
  // The format drifts across Claude Code versions and the last line of a live
  // file is routinely half-written. Nothing here may throw.
  it('ignores blank, torn, and non-object lines', () => {
    const state = emptyFold()
    expect(() => {
      foldLine(state, '')
      foldLine(state, '   ')
      foldLine(state, '{"type":"assistant","mess')
      foldLine(state, '[1,2,3]')
      foldLine(state, 'null')
      foldLine(state, '"a string"')
    }).not.toThrow()
    expect(state.facts).toEqual(emptyFold().facts)
  })

  it('ignores unknown entry types and malformed payloads', () => {
    const state = fold(
      { type: 'some-future-thing', payload: 42 },
      { type: 'assistant', message: 'not an object' },
      { type: 'system', subtype: 'unheard-of' }
    )
    expect(state.facts.model).toBe('')
    expect(state.facts.turns).toBe(0)
  })
})

describe('foldLine — last write wins', () => {
  it('takes the latest title, mode and permission mode', () => {
    const state = fold(
      { type: 'ai-title', aiTitle: 'First guess' },
      { type: 'permission-mode', permissionMode: 'default' },
      { type: 'mode', mode: 'normal' },
      { type: 'ai-title', aiTitle: 'Merge worktree changes' },
      { type: 'permission-mode', permissionMode: 'auto' }
    )
    expect(state.facts.aiTitle).toBe('Merge worktree changes')
    expect(state.facts.permissionMode).toBe('auto')
    expect(state.facts.mode).toBe('normal')
  })

  // slug/version/gitBranch/effort are stamped on nearly every entry, so they
  // are read wherever they appear rather than only off assistant turns.
  it('picks up the per-entry stamps from any entry type', () => {
    const state = fold({
      type: 'user',
      slug: 'shiny-toasting-cloud',
      version: '2.1.229',
      gitBranch: 'main',
      message: { role: 'user', content: 'hi' }
    })
    expect(state.facts.slug).toBe('shiny-toasting-cloud')
    expect(state.facts.version).toBe('2.1.229')
    expect(state.facts.gitBranch).toBe('main')
  })

  it('keeps the last known stamp when a later entry omits it', () => {
    const state = fold(
      { type: 'user', gitBranch: 'main', message: { role: 'user', content: 'hi' } },
      { type: 'mode', mode: 'normal' }
    )
    expect(state.facts.gitBranch).toBe('main')
  })
})

describe('foldLine — usage', () => {
  // The context figure is input + cache_read + cache_creation: everything the
  // model was sent, cached or not. Dropping the cache fields as bookkeeping
  // would report ~2 tokens of context on a 64k conversation.
  it('sums cached and uncached input into the context size', () => {
    const state = fold(
      assistant({
        model: 'claude-opus-5',
        usage: {
          input_tokens: 2,
          cache_creation_input_tokens: 2022,
          cache_read_input_tokens: 64420,
          output_tokens: 1261,
          output_tokens_details: { thinking_tokens: 372 },
          service_tier: 'standard'
        }
      })
    )
    expect(state.facts.contextTokens).toBe(66444)
    expect(state.facts.outputTokens).toBe(1261)
    expect(state.facts.thinkingTokens).toBe(372)
    expect(state.facts.serviceTier).toBe('standard')
    expect(state.facts.model).toBe('claude-opus-5')
  })

  it('reports the LATEST turn, not a running total', () => {
    const state = fold(
      assistant({ usage: { input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 5 } }),
      assistant({ usage: { input_tokens: 1, cache_read_input_tokens: 900, output_tokens: 7 } })
    )
    expect(state.facts.contextTokens).toBe(901)
    expect(state.facts.outputTokens).toBe(7)
  })

  it('survives a usage block with missing fields', () => {
    const state = fold(assistant({ model: 'claude-opus-5', usage: {} }))
    expect(state.facts.contextTokens).toBe(0)
    expect(state.facts.outputTokens).toBeNull()
    expect(state.facts.thinkingTokens).toBeNull()
  })
})

describe('foldLine — sidechains', () => {
  // A subagent's own turns must never overwrite the main agent's facts: newer
  // builds write them to a separate file, older ones inlined them here.
  it('ignores sidechain entries entirely', () => {
    const state = fold(
      assistant({ model: 'claude-opus-5', usage: { input_tokens: 1000, output_tokens: 10 } }),
      assistant(
        { model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 5, output_tokens: 1 } },
        { isSidechain: true }
      )
    )
    expect(state.facts.model).toBe('claude-opus-5')
    expect(state.facts.contextTokens).toBe(1000)
  })
})

describe('foldLine — system entries', () => {
  it('counts turns and keeps the last duration', () => {
    const state = fold(
      { type: 'system', subtype: 'turn_duration', durationMs: 1000, messageCount: 10 },
      { type: 'system', subtype: 'turn_duration', durationMs: 75383, messageCount: 976 }
    )
    expect(state.facts.turns).toBe(2)
    expect(state.facts.lastTurnMs).toBe(75383)
    expect(state.facts.messageCount).toBe(976)
  })

  it('counts compactions and records the last one', () => {
    const state = fold({
      type: 'system',
      subtype: 'compact_boundary',
      compactMetadata: { trigger: 'manual', preTokens: 468887, postTokens: 7390 }
    })
    expect(state.facts.compactions).toBe(1)
    expect(state.facts.compactTrigger).toBe('manual')
    expect(state.facts.compactPreTokens).toBe(468887)
    expect(state.facts.compactPostTokens).toBe(7390)
  })

  it('records the hooks that ran at the last turn boundary', () => {
    const state = fold({
      type: 'system',
      subtype: 'stop_hook_summary',
      hookCount: 1,
      hookInfos: [{ command: 'gk-alpha.exe ai hook run', durationMs: 199 }, { durationMs: 5 }],
      hookErrors: []
    })
    // The nameless second entry is dropped rather than rendered as a blank row.
    expect(state.facts.lastHooks).toEqual([
      { command: 'gk-alpha.exe ai hook run', durationMs: 199 }
    ])
    expect(state.facts.hookErrors).toBe(0)
  })

  it('replaces the hook list each turn instead of accumulating it', () => {
    const state = fold(
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        hookInfos: [{ command: 'a', durationMs: 1 }]
      },
      { type: 'system', subtype: 'stop_hook_summary', hookInfos: [{ command: 'b', durationMs: 2 }] }
    )
    expect(state.facts.lastHooks).toEqual([{ command: 'b', durationMs: 2 }])
  })

  it('takes the away summary and the remote-control url', () => {
    const state = fold(
      { type: 'system', subtype: 'away_summary', content: 'Goal was fixing the status dots.' },
      { type: 'system', subtype: 'bridge_status', url: 'https://claude.ai/code/session_01' }
    )
    expect(state.facts.awaySummary).toBe('Goal was fixing the status dots.')
    expect(state.facts.bridgeUrl).toBe('https://claude.ai/code/session_01')
  })
})

describe('foldLine — the queue', () => {
  it('nets enqueue against dequeue', () => {
    const state = fold(
      { type: 'queue-operation', operation: 'enqueue', content: 'first' },
      { type: 'queue-operation', operation: 'enqueue', content: 'second' },
      { type: 'queue-operation', operation: 'dequeue' }
    )
    expect(state.facts.queued).toBe(1)
  })

  // `remove` is a third operation (a queued prompt dropped rather than run) and
  // it shrinks the queue too. Counting only enqueue/dequeue read 3 prompts
  // queued on an empty queue in a real transcript.
  it('shrinks on remove as well as dequeue', () => {
    const state = fold(
      { type: 'queue-operation', operation: 'enqueue', content: 'a' },
      { type: 'queue-operation', operation: 'enqueue', content: 'b' },
      { type: 'queue-operation', operation: 'remove' },
      { type: 'queue-operation', operation: 'dequeue' }
    )
    expect(state.facts.queued).toBe(0)
  })

  // Claude Code queues its own task notifications through the same mechanism.
  // Those are plumbing, not something the user is waiting on.
  it('does not count queued task notifications as prompts', () => {
    const state = fold(
      { type: 'queue-operation', operation: 'enqueue', content: 'a real prompt' },
      {
        type: 'queue-operation',
        operation: 'enqueue',
        content: '<task-notification><task-id>bgxyz</task-id></task-notification>'
      }
    )
    expect(state.facts.queued).toBe(1)
  })

  // A fold that starts mid-file (it never does, but a truncated transcript
  // would) must not report a negative queue.
  it('never goes negative', () => {
    const state = fold({ type: 'queue-operation', operation: 'dequeue' })
    expect(state.facts.queued).toBe(0)
  })
})

describe('foldLine — work in flight as a level', () => {
  const taskUse = (id: string): object =>
    assistant({ content: [{ type: 'tool_use', id, name: 'Task', input: {} }] })
  const toolResult = (id: string): object => ({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id }] }
  })
  const notification = (id: string): object => ({
    type: 'user',
    message: {
      role: 'user',
      content: `<task-notification>\n<task-id>${id}</task-id>\n<status>completed</status>\n</task-notification>`
    }
  })

  it('holds a synchronous subagent open until its tool_result lands', () => {
    const open = fold(taskUse('toolu_01'))
    expect(open.facts.subagentsOpen).toBe(1)
    expect(open.facts.subagentsStarted).toBe(1)

    const closed = fold(taskUse('toolu_01'), toolResult('toolu_01'))
    expect(closed.facts.subagentsOpen).toBe(0)
    expect(closed.facts.subagentsStarted).toBe(1)
  })

  // The trap: an async-launched subagent's tool_use resolves IMMEDIATELY with
  // an agentId, so pairing on tool_use/tool_result alone would report every
  // background agent as finished the instant it started. It is re-opened under
  // the agentId and closed by the <task-notification> that carries it.
  it('keeps an async subagent open past its own tool_result', () => {
    const launched = fold(taskUse('toolu_01'), {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01' }] },
      toolUseResult: { isAsync: true, status: 'async_launched', agentId: 'a1dfea32372f7' }
    })
    expect(launched.facts.subagentsOpen).toBe(1)

    const done = fold(
      taskUse('toolu_01'),
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01' }] },
        toolUseResult: { isAsync: true, status: 'async_launched', agentId: 'a1dfea32372f7' }
      },
      notification('a1dfea32372f7')
    )
    expect(done.facts.subagentsOpen).toBe(0)
  })

  it('opens a background shell on its id and closes it on the notification', () => {
    const running = fold({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_02' }] },
      toolUseResult: { stdout: '', backgroundTaskId: 'bgwxqmm2g' }
    })
    expect(running.facts.shellsOpen).toBe(1)
    expect(running.facts.shellsStarted).toBe(1)

    const finished = fold(
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_02' }] },
        toolUseResult: { stdout: '', backgroundTaskId: 'bgwxqmm2g' }
      },
      notification('bgwxqmm2g')
    )
    expect(finished.facts.shellsOpen).toBe(0)
    expect(finished.facts.shellsStarted).toBe(1)
  })

  // Measured on a real transcript: the same completion notice arrives as a
  // `user` message, a `queue-operation`, or an `attachment` depending on
  // whether a turn was running when the task finished. Matching only the user
  // shape left finished shells counted as open forever.
  it('closes on the queue-operation and attachment shapes too', () => {
    const start = {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_02' }] },
      toolUseResult: { backgroundTaskId: 'bgwxqmm2g' }
    }
    const viaQueue = fold(start, {
      type: 'queue-operation',
      operation: 'enqueue',
      content: '<task-notification><task-id>bgwxqmm2g</task-id></task-notification>'
    })
    expect(viaQueue.facts.shellsOpen).toBe(0)

    const viaAttachment = fold(start, {
      type: 'attachment',
      attachment: { content: '<task-notification><task-id>bgwxqmm2g</task-id></task-notification>' }
    })
    expect(viaAttachment.facts.shellsOpen).toBe(0)
  })

  it('closes several ids from one notification message', () => {
    const state = fold(
      taskUse('toolu_01'),
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01' }] },
        toolUseResult: { status: 'async_launched', agentId: 'agent-a' }
      },
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_02' }] },
        toolUseResult: { backgroundTaskId: 'bg-b' }
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: '<task-id>agent-a</task-id> and <task-id>bg-b</task-id>'
        }
      }
    )
    expect(state.facts.subagentsOpen).toBe(0)
    expect(state.facts.shellsOpen).toBe(0)
  })

  // A subagent's own transcript is a sidechain; counting its Task calls would
  // attribute a nested agent to the main session.
  it('does not count subagents launched inside a sidechain', () => {
    const state = fold(
      assistant(
        { content: [{ type: 'tool_use', id: 'toolu_09', name: 'Task', input: {} }] },
        {
          isSidechain: true
        }
      )
    )
    expect(state.facts.subagentsStarted).toBe(0)
  })
})
