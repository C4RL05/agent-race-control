import { ipcMain } from 'electron'
import { open, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { claudeConfigDir, transcriptPath } from './transcript'

// Everything the app can learn about a running Claude session, for the pane's
// Session tab. Display only: nothing here ever colours the status dot, so a
// Claude Code format drift degrades the inspector and cannot regress status.
//
// Two file sources, both read-only observation and neither a new channel:
//   - ~/.claude/sessions/<pid>.json — the file `claude agents --json` reads,
//     which carries strictly more than the CLI prints (version, age in status,
//     nameSource, bridge session).
//   - the transcript JSONL we already tail for the preview, folded to metadata
//     instead of prose.
// Both formats are internal and undocumented: parse defensively, skip anything
// unrecognized, never throw. Missing renders as "—", not as an error.

// One entry of ~/.claude/sessions/<pid>.json. Every field optional — this is
// somebody else's file and it will grow and shrink across versions.
export interface LiveSession {
  pid?: number
  sessionId?: string
  cwd?: string
  startedAt?: number
  procStart?: string
  version?: string
  kind?: string
  entrypoint?: string
  name?: string
  nameSource?: string
  status?: string
  updatedAt?: number
  statusUpdatedAt?: number
  bridgeSessionId?: string
}

export interface HookRun {
  command: string
  durationMs: number
}

// Everything folded out of the transcript. Strings default to '' and numbers to
// null so the renderer has exactly one "unknown" test per field.
export interface TranscriptFacts {
  aiTitle: string
  slug: string
  mode: string
  permissionMode: string
  model: string
  effort: string
  version: string
  gitBranch: string
  // Turn accounting, from the system/turn_duration entries.
  turns: number
  lastTurnMs: number | null
  messageCount: number | null
  // The last assistant message's usage. contextTokens is what Claude Code's own
  // status line shows as "↓ N tokens": everything the model was sent, cached or
  // not.
  contextTokens: number | null
  outputTokens: number | null
  thinkingTokens: number | null
  serviceTier: string
  compactions: number
  compactTrigger: string
  compactPreTokens: number | null
  compactPostTokens: number | null
  awaySummary: string
  bridgeUrl: string
  lastPrompt: string
  // Prompts typed while a turn was running and not yet consumed.
  queued: number
  // Work in flight, counted as a LEVEL (see openTasks below). "Open", not
  // "running": the transcript records a start and a completion, so anything
  // whose completion was never written — the app was killed mid-run, the turn
  // was interrupted — stays counted for the life of the conversation. The
  // Status section's poll line is the authority on whether the session is
  // actually doing anything; these two say what it STARTED and never closed.
  subagentsStarted: number
  subagentsOpen: number
  shellsStarted: number
  shellsOpen: number
  // The hooks that ran at the last turn boundary, with their durations — this
  // is where a slow third-party Stop hook becomes visible.
  lastHooks: HookRun[]
  hookErrors: number
  lastEntryAt: string
}

export interface SessionInfo {
  live: LiveSession | null
  facts: TranscriptFacts | null
  transcriptPath: string
  transcriptBytes: number | null
}

export function emptyFacts(): TranscriptFacts {
  return {
    aiTitle: '',
    slug: '',
    mode: '',
    permissionMode: '',
    model: '',
    effort: '',
    version: '',
    gitBranch: '',
    turns: 0,
    lastTurnMs: null,
    messageCount: null,
    contextTokens: null,
    outputTokens: null,
    thinkingTokens: null,
    serviceTier: '',
    compactions: 0,
    compactTrigger: '',
    compactPreTokens: null,
    compactPostTokens: null,
    awaySummary: '',
    bridgeUrl: '',
    lastPrompt: '',
    queued: 0,
    subagentsStarted: 0,
    subagentsOpen: 0,
    shellsStarted: 0,
    shellsOpen: 0,
    lastHooks: [],
    hookErrors: 0,
    lastEntryAt: ''
  }
}

// The fold's working state. `openTasks` and `openShells` are the reason the
// counts are a level rather than an edge: each id is opened by the record that
// starts the work and closed by the record that reports it done, so the count
// is re-derived from the whole file on every read and a wrong one self-heals —
// the same property that makes the agent poll's green floor trustworthy.
export interface FoldState {
  facts: TranscriptFacts
  openTasks: Set<string>
  openShells: Set<string>
  // The prompt queue, modelled rather than counted. Measured on a real
  // transcript: `enqueue` carries the content, but `dequeue` and `remove`
  // carry nothing at all — so a +1/-1 tally can't tell a delivered task
  // notification from a typed prompt and drifts (it read 3 queued on an empty
  // queue). Holding the contents in order and shifting on either removal nets
  // to zero correctly, and lets the count exclude the notifications.
  queue: string[]
}

export function emptyFold(): FoldState {
  return { facts: emptyFacts(), openTasks: new Set(), openShells: new Set(), queue: [] }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// Async subagents and background shells both report completion the same way:
// Claude Code injects a <task-notification> carrying the id it handed out at
// launch. One matcher closes both — but it must run against the WHOLE line,
// not just user messages: measured on a real transcript, the same notification
// arrives as a `user` message, a `queue-operation`, or an `attachment`
// depending on whether a turn was running when the task finished, and matching
// only the first shape left finished shells counted as open forever.
const TASK_ID = /<task-id>([^<]+)<\/task-id>/g

function closeFinishedTasks(state: FoldState, text: string): void {
  for (const match of text.matchAll(TASK_ID)) {
    const id = match[1]
    if (!id) continue
    state.openTasks.delete(id)
    state.openShells.delete(id)
  }
}

function foldUsage(facts: TranscriptFacts, usage: Record<string, unknown>): void {
  const input = num(usage['input_tokens']) ?? 0
  const cacheRead = num(usage['cache_read_input_tokens']) ?? 0
  const cacheWrite = num(usage['cache_creation_input_tokens']) ?? 0
  // Everything the model was sent this turn, cached or not — that sum IS the
  // context fill, which is why the cache fields can't be dropped as bookkeeping.
  facts.contextTokens = input + cacheRead + cacheWrite
  facts.outputTokens = num(usage['output_tokens'])
  facts.serviceTier = str(usage['service_tier'])
  const details = record(usage['output_tokens_details'])
  facts.thinkingTokens = details ? num(details['thinking_tokens']) : null
}

function foldAssistant(state: FoldState, entry: Record<string, unknown>): void {
  const message = record(entry['message'])
  if (!message) return
  const facts = state.facts
  facts.model = str(message['model']) || facts.model
  const usage = record(message['usage'])
  if (usage) foldUsage(facts, usage)
  const content = message['content']
  if (!Array.isArray(content)) return
  for (const block of content) {
    const b = record(block)
    if (!b || b['type'] !== 'tool_use') continue
    // Task is the subagent tool. A synchronous one stays open until its
    // tool_result lands; an async one gets its result immediately and is
    // instead closed by the <task-notification> keyed on the agentId the
    // result carries (see foldUser).
    if (b['name'] === 'Task' || b['name'] === 'Agent') {
      const id = str(b['id'])
      if (id) {
        state.openTasks.add(id)
        facts.subagentsStarted += 1
      }
    }
  }
}

function foldUser(state: FoldState, entry: Record<string, unknown>): void {
  const facts = state.facts
  const message = record(entry['message'])
  const content = message?.['content']
  if (Array.isArray(content)) {
    for (const block of content) {
      const b = record(block)
      if (b && b['type'] === 'tool_result') {
        const id = str(b['tool_use_id'])
        if (id) state.openTasks.delete(id)
      }
    }
  }

  const result = record(entry['toolUseResult'])
  if (!result) return
  // A background Bash returns the shell's id and nothing else; it closes on the
  // same <task-notification> an async subagent uses.
  const shell = str(result['backgroundTaskId'])
  if (shell) {
    state.openShells.add(shell)
    facts.shellsStarted += 1
  }
  // An async-launched subagent's tool_use resolves at once, so re-open it under
  // the agent id the result hands back — otherwise every background agent would
  // read as finished the instant it started.
  if (result['status'] === 'async_launched') {
    const agentId = str(result['agentId'])
    if (agentId) state.openTasks.add(agentId)
  }
}

function foldSystem(state: FoldState, entry: Record<string, unknown>): void {
  const facts = state.facts
  switch (entry['subtype']) {
    case 'turn_duration':
      facts.turns += 1
      facts.lastTurnMs = num(entry['durationMs'])
      facts.messageCount = num(entry['messageCount'])
      break
    case 'compact_boundary': {
      facts.compactions += 1
      const meta = record(entry['compactMetadata'])
      if (meta) {
        facts.compactTrigger = str(meta['trigger'])
        facts.compactPreTokens = num(meta['preTokens'])
        facts.compactPostTokens = num(meta['postTokens'])
      }
      break
    }
    case 'away_summary':
      facts.awaySummary = str(entry['content'])
      break
    case 'bridge_status':
      facts.bridgeUrl = str(entry['url'])
      break
    case 'stop_hook_summary': {
      const infos = entry['hookInfos']
      facts.lastHooks = Array.isArray(infos)
        ? infos.flatMap((info) => {
            const i = record(info)
            const command = i ? str(i['command']) : ''
            return command ? [{ command, durationMs: i ? (num(i['durationMs']) ?? 0) : 0 }] : []
          })
        : []
      const errors = entry['hookErrors']
      facts.hookErrors = Array.isArray(errors) ? errors.length : 0
      break
    }
  }
}

// Fold one transcript line into the running state. Pure (no I/O, no clock) so
// the whole projection is unit-testable off fixture lines — the same split the
// preview reducer uses.
export function foldLine(state: FoldState, line: string): void {
  const trimmed = line.trim()
  if (!trimmed) return
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // A torn final line — the next read sees it whole.
    return
  }
  const entry = record(parsed)
  if (!entry) return
  const facts = state.facts

  // Sidechain entries are a subagent's own turns, not this session's. Newer
  // builds write them to a separate file, older ones inlined them; either way
  // they must not overwrite the main agent's model/effort/usage.
  if (entry['isSidechain'] === true) return

  // Before dispatch, so every shape of the notification closes its task.
  if (line.includes('<task-id>')) closeFinishedTasks(state, line)

  const timestamp = str(entry['timestamp'])
  if (timestamp) facts.lastEntryAt = timestamp
  // Stamped on nearly every entry, so take them wherever they appear rather
  // than only off assistant turns.
  facts.slug = str(entry['slug']) || facts.slug
  facts.version = str(entry['version']) || facts.version
  facts.gitBranch = str(entry['gitBranch']) || facts.gitBranch
  facts.effort = str(entry['effort']) || facts.effort

  switch (entry['type']) {
    case 'ai-title':
      facts.aiTitle = str(entry['aiTitle'])
      break
    case 'mode':
      facts.mode = str(entry['mode'])
      break
    case 'permission-mode':
      facts.permissionMode = str(entry['permissionMode'])
      break
    case 'last-prompt':
      facts.lastPrompt = str(entry['lastPrompt'])
      break
    case 'queue-operation':
      if (entry['operation'] === 'enqueue') state.queue.push(str(entry['content']))
      // `remove` (a prompt dropped from the queue) and `dequeue` (one taken to
      // run) both shrink it; neither says which entry, so the head goes.
      else if (entry['operation'] === 'dequeue' || entry['operation'] === 'remove') {
        state.queue.shift()
      }
      // Only prompts YOU are still waiting on — a task notification enqueued
      // mid-turn is Claude Code's own plumbing, not something you typed.
      facts.queued = state.queue.filter((item) => !item.includes('<task-notification>')).length
      break
    case 'assistant':
      foldAssistant(state, entry)
      break
    case 'user':
      foldUser(state, entry)
      break
    case 'system':
      foldSystem(state, entry)
      break
  }

  facts.subagentsOpen = state.openTasks.size
  facts.shellsOpen = state.openShells.size
}

// One incremental fold per transcript path. The first read of a multi-MB file
// is paid once; every refresh after it parses only the appended bytes, so a 2s
// tab refresh costs a stat plus the delta. Shrinkage means the file was
// replaced — start over rather than fold garbage.
class TranscriptFold {
  private offset = 0
  private remainder = ''
  private state = emptyFold()

  async read(path: string): Promise<{ facts: TranscriptFacts; bytes: number } | null> {
    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      // No transcript yet: a never-prompted session writes no file.
      return null
    }
    if (size < this.offset) {
      this.offset = 0
      this.remainder = ''
      this.state = emptyFold()
    }
    if (size > this.offset) {
      const handle = await open(path, 'r')
      try {
        const length = size - this.offset
        const buffer = Buffer.allocUnsafe(length)
        await handle.read(buffer, 0, length, this.offset)
        this.offset = size
        const chunk = this.remainder + buffer.toString('utf8')
        const lines = chunk.split('\n')
        // The last piece may be half a line — hold it for the next read.
        this.remainder = lines.pop() ?? ''
        for (const line of lines) foldLine(this.state, line)
      } finally {
        await handle.close()
      }
    }
    return { facts: this.state.facts, bytes: size }
  }
}

// One fold per session, keyed like the preview's tails. The path is held
// alongside so a `/clear` (new conversation id) or a late cwd correction
// restarts the fold instead of appending one file's bytes to another's state.
const folds = new Map<string, { path: string; fold: TranscriptFold }>()

async function readLiveSession(pid: number | null): Promise<LiveSession | null> {
  if (pid === null) return null
  try {
    const raw = await readFile(join(claudeConfigDir(), 'sessions', `${pid}.json`), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return record(parsed) as LiveSession | null
  } catch {
    // The file exists only while that pid is alive, and it is somebody else's
    // format — absent is a normal answer, not a failure.
    return null
  }
}

export function registerSessionInfoHandlers(): void {
  ipcMain.handle(
    'session:info',
    async (_event, opts: { sessionId: string; cwd: string; pid: number | null }) => {
      const path = transcriptPath(opts.cwd, opts.sessionId)
      let entry = folds.get(opts.sessionId)
      if (!entry || entry.path !== path) {
        entry = { path, fold: new TranscriptFold() }
        folds.set(opts.sessionId, entry)
      }
      const [live, read] = await Promise.all([readLiveSession(opts.pid), entry.fold.read(path)])
      const info: SessionInfo = {
        live,
        facts: read?.facts ?? null,
        transcriptPath: path,
        transcriptBytes: read?.bytes ?? null
      }
      return info
    }
  )

  // A fold's lifetime is exactly the preview tail's — the session closed, the
  // conversation is gone. Listening on the tail's own channel keeps that shared
  // lifetime honest without a second preload call or a circular import.
  ipcMain.on('transcript:drop', (_event, sessionId: string) => {
    folds.delete(sessionId)
  })
}
