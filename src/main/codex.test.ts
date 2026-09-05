import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '' }, ipcMain: { on: () => {} } }))

import { parseCodexLine } from './codex'

// Record shapes taken from a real codex 0.153.4 rollout, trimmed to the fields
// the fold reads. The rollout is a stream of typed records; only
// `response_item` / `message` is conversation.
const line = (payload: unknown, type = 'response_item'): string =>
  JSON.stringify({ timestamp: '2026-09-05T14:01:30.000Z', ordinal: 3, type, payload })

const message = (role: string, text: string, contentType = 'output_text'): string =>
  line({ type: 'message', id: 'msg_1', role, content: [{ type: contentType, text }] })

describe('parseCodexLine', () => {
  it('keeps the conversation, both sides', () => {
    expect(parseCodexLine(message('assistant', 'Soft green letters glow'))).toEqual([
      { kind: 'assistant', text: 'Soft green letters glow' }
    ])
    expect(parseCodexLine(message('user', 'write a haiku', 'input_text'))).toEqual([
      { kind: 'user', text: 'write a haiku' }
    ])
  })

  it('drops the developer role — that is the system prompt by another name', () => {
    // Real content: the skills catalogue, the sandbox policy, the multi-agent
    // preamble. Never conversation, and enormous.
    expect(parseCodexLine(message('developer', '<skills_instructions>\n## Skills\n…'))).toEqual([])
  })

  it('drops the environment context codex opens every session with', () => {
    // Sent AS THE USER, so the role alone cannot catch it. The tell is that it
    // is one XML-ish element start to finish — a shape nobody types.
    const injected =
      '<environment_context>\n  <cwd>D:\\projects\\demo</cwd>\n</environment_context>'
    expect(parseCodexLine(message('user', injected, 'input_text'))).toEqual([])
  })

  it('keeps prose that merely mentions a tag', () => {
    const text = 'use <environment_context> in the prompt, then check the output'
    expect(parseCodexLine(message('user', text, 'input_text'))).toEqual([{ kind: 'user', text }])
  })

  it('drops agent mechanics — every record type that is not a message', () => {
    expect(parseCodexLine(line({ type: 'function_call', name: 'sleep', arguments: '{}' }))).toEqual(
      []
    )
    expect(parseCodexLine(line({ type: 'function_call_output', output: 'ok' }))).toEqual([])
    // Reasoning is encrypted with an empty summary — there is nothing to show.
    expect(
      parseCodexLine(line({ type: 'reasoning', summary: [], encrypted_content: 'gAAA' }))
    ).toEqual([])
    expect(parseCodexLine(line({ type: 'task_started' }, 'event_msg'))).toEqual([])
    expect(parseCodexLine(line({ session_id: 'x', cwd: 'D:\\x' }, 'session_meta'))).toEqual([])
    expect(parseCodexLine(line({ total_tokens: 10 }, 'token_usage_record'))).toEqual([])
  })

  it('joins multi-part content and skips empty messages', () => {
    const two = line({
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'output_text', text: 'one' },
        { type: 'output_text', text: 'two' }
      ]
    })
    expect(parseCodexLine(two)).toEqual([{ kind: 'assistant', text: 'one\n\ntwo' }])
    expect(parseCodexLine(message('assistant', '   '))).toEqual([])
    expect(parseCodexLine(line({ type: 'message', role: 'assistant', content: [] }))).toEqual([])
  })

  it('never throws on junk — one bad line costs one line', () => {
    expect(parseCodexLine('')).toEqual([])
    expect(parseCodexLine('not json')).toEqual([])
    expect(parseCodexLine('{"type":"response_item"}')).toEqual([])
    expect(parseCodexLine('{"type":"response_item","payload":null}')).toEqual([])
    expect(parseCodexLine('null')).toEqual([])
    // Format drift: content becomes something other than an array of blocks.
    expect(parseCodexLine(line({ type: 'message', role: 'user', content: 'plain' }))).toEqual([])
  })
})
