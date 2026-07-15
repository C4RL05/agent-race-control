import { describe, expect, it, vi } from 'vitest'

// transcript.ts registers IPC handlers at call time, not import time — but it
// imports electron at module scope, which doesn't exist under vitest. The
// functions under test never touch it.
vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))

import { parseLine, transcriptPath } from './transcript'

describe('transcriptPath', () => {
  // The encoding rule was verified empirically (2026-07-13): Claude Code
  // dashes EVERY non-alphanumeric character of the cwd, case preserved.
  // A [\\/:]-only regex silently broke preview AND --resume for dotted paths.
  it('dashes every non-alphanumeric character of the cwd', () => {
    expect(transcriptPath('D:\\HelloEnjoy\\HelloEnjoy.com', 'id')).toContain(
      'D--HelloEnjoy-HelloEnjoy-com'
    )
    expect(transcriptPath('C:\\tmp\\enc_test a.b', 'id')).toContain('C--tmp-enc-test-a-b')
  })

  it('preserves case and digits', () => {
    expect(transcriptPath('D:\\Projects\\agent-race-control', 'id')).toContain(
      'D--Projects-agent-race-control'
    )
  })

  it('names the file <sessionId>.jsonl', () => {
    expect(transcriptPath('D:\\x', 'abc-123')).toMatch(/[\\/]abc-123\.jsonl$/)
  })

  it('honors a relocated CLAUDE_CONFIG_DIR', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', 'E:\\claude-config')
    try {
      expect(transcriptPath('D:\\x', 'id')).toMatch(/^E:\\claude-config[\\/]projects[\\/]/)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// These tests double as documentation of the transcript JSONL shapes we
// handle. The format is internal and drifts across Claude Code versions —
// when one of these breaks on a Claude update, the shape changed.
describe('parseLine', () => {
  const line = (entry: unknown): string => JSON.stringify(entry)

  it('ignores unparseable lines', () => {
    expect(parseLine('not json {')).toEqual([])
    expect(parseLine('')).toEqual([])
  })

  it('ignores non-conversation entries (meta, sidechain, unknown types)', () => {
    expect(parseLine(line({ type: 'user', isMeta: true, message: { content: 'x' } }))).toEqual([])
    expect(
      parseLine(line({ type: 'assistant', isSidechain: true, message: { content: [] } }))
    ).toEqual([])
    expect(parseLine(line({ type: 'summary', summary: 'x' }))).toEqual([])
    expect(parseLine(line({ type: 'file-history-snapshot' }))).toEqual([])
  })

  it('reduces a plain user message', () => {
    expect(parseLine(line({ type: 'user', message: { content: 'hello' } }))).toEqual([
      { kind: 'user', text: 'hello' }
    ])
  })

  it('unwraps slash commands and drops their stdout', () => {
    const command = '<command-name>/rename</command-name><command-args>db work</command-args>'
    expect(parseLine(line({ type: 'user', message: { content: command } }))).toEqual([
      { kind: 'user', text: '/rename db work' }
    ])
    expect(
      parseLine(line({ type: 'user', message: { content: '<local-command-stdout>x' } }))
    ).toEqual([])
  })

  it('joins user content blocks and marks images', () => {
    const content = [
      { type: 'text', text: 'look at' },
      { type: 'image', source: {} }
    ]
    expect(parseLine(line({ type: 'user', message: { content } }))).toEqual([
      { kind: 'user', text: 'look at\n\n[image]' }
    ])
  })

  it('drops tool_result user entries (agent mechanics, not conversation)', () => {
    const content = [{ type: 'tool_result', content: 'output' }]
    expect(parseLine(line({ type: 'user', message: { content } }))).toEqual([])
  })

  it('keeps assistant prose and drops thinking + non-code tools (Read/Bash/…)', () => {
    const content = [
      { type: 'text', text: 'On it.' },
      { type: 'thinking', thinking: 'hmm' },
      { type: 'tool_use', name: 'Read', input: { file_path: 'D:\\x\\a.ts' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'npm run dev' } },
      { type: 'tool_use', name: 'Mystery', input: { weird: true } },
      { type: 'text', text: 'Done.' }
    ]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([
      { kind: 'assistant', text: 'On it.' },
      { kind: 'assistant', text: 'Done.' }
    ])
  })

  // The code Claude writes lives only in tool_use — render it as a filename-
  // labeled fenced block (revised 2026-07-15). These document the shapes.
  it('renders a Write as a labeled fenced block, language from the extension', () => {
    const content = [
      {
        type: 'tool_use',
        name: 'Write',
        input: { file_path: 'D:\\x\\a.ts', content: 'const x = 1' }
      }
    ]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([
      { kind: 'assistant', text: '`a.ts`\n\n```ts\nconst x = 1\n```' }
    ])
  })

  it('renders an Edit as a labeled +/- diff block', () => {
    const content = [
      {
        type: 'tool_use',
        name: 'Edit',
        input: { file_path: 'a.svelte', old_string: 'old', new_string: 'new' }
      }
    ]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([
      { kind: 'assistant', text: '`a.svelte`\n\n```diff\n- old\n+ new\n```' }
    ])
  })

  it('renders a MultiEdit as one diff block over all edits', () => {
    const edits = [
      { old_string: 'a', new_string: 'b' },
      { old_string: 'c', new_string: 'd' }
    ]
    const content = [{ type: 'tool_use', name: 'MultiEdit', input: { file_path: 'x.ts', edits } }]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([
      { kind: 'assistant', text: '`x.ts`\n\n```diff\n- a\n+ b\n\n- c\n+ d\n```' }
    ])
  })

  it('outruns backtick runs inside the code so a fence cannot break out', () => {
    // editing a Markdown file puts ``` in the body — the fence must be longer
    const content = [
      { type: 'tool_use', name: 'Write', input: { file_path: 'f.md', content: 'a\n```\nb' } }
    ]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([
      { kind: 'assistant', text: '`f.md`\n\n````markdown\na\n```\nb\n````' }
    ])
  })

  it('drops a malformed code tool_use (no content/new_string) instead of throwing', () => {
    const content = [
      { type: 'tool_use', name: 'Edit', input: { file_path: 'a.ts', old_string: 'y' } }
    ]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([])
  })

  it('never throws on drifted shapes — one bad entry costs one line', () => {
    // text as a number defeats ?. (which only guards null/undefined)
    const content = [{ type: 'text', text: 42 }]
    expect(parseLine(line({ type: 'assistant', message: { content } }))).toEqual([])
    expect(parseLine(line({ type: 'user', message: { content: 42 } }))).toEqual([])
    expect(parseLine(line(null))).toEqual([])
  })
})
