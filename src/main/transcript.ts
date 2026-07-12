import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

// Read-only conversation preview: tail the transcript JSONL Claude Code
// writes for the pinned session id, reduce it to the readable conversation
// (user + assistant text; tool activity collapsed to one-liners), push the
// items to the renderer. Pure observation — the PTY byte stream is untouched.
//
// The transcript format is internal and drifts across Claude Code versions:
// parse defensively, skip anything unrecognized, never throw.

// Claude Code encodes the project cwd into the transcript directory name by
// dashing EVERY non-alphanumeric character — verified empirically (dots,
// spaces, and underscores all become '-'; case is preserved). Don't narrow
// the regex: [\\/:] alone breaks any dotted cwd, which silently kills both
// the preview and --resume. The base honors a relocated CLAUDE_CONFIG_DIR
// (deliberately preserved user config — see the env scrub in pty.ts).
export function transcriptPath(cwd: string, sessionId: string): string {
  const configDir = process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude')
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-')
  return join(configDir, 'projects', encoded, `${sessionId}.jsonl`)
}

export type PreviewItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; label: string }

// One-liner for a tool_use block: tool name + its most telling input field
// ("Edit D:\...\foo.ts", "Bash npm run dev"). Fields probed in rough order
// of how identifying they are; unknown tools fall back to the bare name.
function toolLabel(name: string, input: unknown): string {
  const fields = ['file_path', 'command', 'pattern', 'query', 'url', 'skill', 'description']
  let detail = ''
  if (input && typeof input === 'object') {
    for (const field of fields) {
      const value = (input as Record<string, unknown>)[field]
      if (typeof value === 'string' && value.trim()) {
        detail = value
        break
      }
    }
  }
  return `${name} ${detail.replace(/\s+/g, ' ').trim().slice(0, 200)}`.trim()
}

type Block = { type?: string; text?: string; name?: string; input?: unknown }

// Wrapped so the "never throw" contract survives format drift (?. guards
// null/undefined but not, say, text becoming a number) — a single bad entry
// must cost one line, not the whole chunk.
function parseLine(line: string): PreviewItem[] {
  try {
    return parseLineInner(line)
  } catch {
    return []
  }
}

function parseLineInner(line: string): PreviewItem[] {
  let entry: {
    type?: string
    isSidechain?: boolean
    isMeta?: boolean
    message?: { content?: string | Block[] }
  }
  try {
    entry = JSON.parse(line)
  } catch {
    return []
  }
  // Sidechains are subagent chatter; meta entries are injected context
  // (caveats, command wrappers' stdout) — neither is the conversation.
  if (!entry || typeof entry !== 'object' || entry.isSidechain || entry.isMeta) return []

  if (entry.type === 'user') {
    const content = entry.message?.content
    if (typeof content === 'string') {
      // Slash commands arrive wrapped in XML-ish tags; their stdout too.
      if (content.includes('<local-command-stdout>')) return []
      const command = content.match(/<command-name>([^<]*)<\/command-name>/)
      if (command) {
        const args = content.match(/<command-args>([^<]*)<\/command-args>/)?.[1] ?? ''
        return [{ kind: 'user', text: `${command[1]} ${args}`.trim() }]
      }
      return content.trim() ? [{ kind: 'user', text: content }] : []
    }
    if (Array.isArray(content)) {
      // tool_result entries mirror tool_use — already covered by the one-liner.
      if (content.some((block) => block?.type === 'tool_result')) return []
      const text = content
        .map((block) => (block?.type === 'text' ? block.text : block?.type === 'image' ? '[image]' : ''))
        .filter(Boolean)
        .join('\n\n')
      return text.trim() ? [{ kind: 'user', text }] : []
    }
    return []
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    const items: PreviewItem[] = []
    for (const block of entry.message.content) {
      if (block?.type === 'text' && block.text?.trim()) {
        items.push({ kind: 'assistant', text: block.text })
      } else if (block?.type === 'tool_use' && typeof block.name === 'string') {
        items.push({ kind: 'tool', label: toolLabel(block.name, block.input) })
      }
      // thinking et al: skipped
    }
    return items
  }

  // summary / system / mode / attachment / file-history-snapshot / future types
  return []
}

type Push = (items: PreviewItem[], reset: boolean) => void

class TranscriptTail {
  private offset = 0
  private remainder = Buffer.alloc(0)
  private watcher: FSWatcher | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private readTimer: NodeJS.Timeout | null = null
  private reading = false
  private dirty = false
  private disposed = false

  constructor(
    private path: string,
    private push: Push
  ) {
    this.arm()
  }

  // Watch the transcript's directory — the file itself may not exist yet (a
  // never-prompted session writes nothing: empty preview, not an error). If
  // even the directory is missing (first session in a cwd), retry until
  // Claude creates it on the first prompt.
  private arm(): void {
    if (this.disposed) return
    try {
      this.watcher = watch(dirname(this.path), (_event, filename) => {
        // Windows paths are case-insensitive; a null filename means "unknown
        // change" — read to be safe.
        if (!filename || filename.toLowerCase() === basename(this.path).toLowerCase()) {
          this.schedule()
        }
      })
      this.watcher.on('error', () => this.rearm())
      this.schedule()
    } catch {
      this.retryTimer = setTimeout(() => this.arm(), 1000)
    }
  }

  private rearm(): void {
    this.watcher?.close()
    this.watcher = null
    this.retryTimer = setTimeout(() => this.arm(), 1000)
  }

  // fs.watch fires in bursts during rapid appends — coalesce into one read.
  private schedule(): void {
    if (this.readTimer || this.disposed) return
    this.readTimer = setTimeout(() => {
      this.readTimer = null
      void this.read()
    }, 50)
  }

  private async read(): Promise<void> {
    if (this.reading) {
      this.dirty = true
      return
    }
    this.reading = true
    try {
      do {
        this.dirty = false
        await this.readOnce()
      } while (this.dirty && !this.disposed)
    } finally {
      this.reading = false
    }
  }

  private async readOnce(): Promise<void> {
    let file
    try {
      file = await open(this.path, 'r')
    } catch {
      // Not created yet, or deleted out from under us. The disposed guard
      // matters: a dispose/re-watch can interleave this in-flight read, and
      // a stale reset would wipe the successor tail's just-delivered items.
      if (this.offset > 0 && !this.disposed) {
        this.offset = 0
        this.remainder = Buffer.alloc(0)
        this.push([], true)
      }
      return
    }
    try {
      const size = (await file.stat()).size
      if (this.disposed) return
      if (size < this.offset) {
        // Truncated/replaced — start over, tell the renderer to reset.
        this.offset = 0
        this.remainder = Buffer.alloc(0)
        this.push([], true)
      }
      if (size === this.offset) return
      const buffer = Buffer.alloc(size - this.offset)
      await file.read(buffer, 0, buffer.length, this.offset)
      this.offset = size
      // Split on newlines at the byte level — a chunk boundary can fall
      // inside a multi-byte character, so only complete lines get decoded.
      // Parse and push in batches: the first read of a watch is the WHOLE
      // transcript (possibly many MB), and main's event loop also pumps
      // every PTY — it must never block for the full parse, and no single
      // IPC message should carry an unbounded array.
      const BATCH = 400
      let data = Buffer.concat([this.remainder, buffer])
      let items: PreviewItem[] = []
      let nl: number
      while ((nl = data.indexOf(0x0a)) !== -1) {
        items.push(...parseLine(data.subarray(0, nl).toString('utf8')))
        data = data.subarray(nl + 1)
        if (items.length >= BATCH) {
          if (this.disposed) return
          this.push(items, false)
          items = []
          await new Promise((resolve) => setImmediate(resolve))
        }
      }
      this.remainder = data
      if (items.length && !this.disposed) this.push(items, false)
    } catch {
      // transient read failure — the next watch event retries
    } finally {
      await file.close()
    }
  }

  dispose(): void {
    this.disposed = true
    this.watcher?.close()
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.readTimer) clearTimeout(this.readTimer)
  }
}

const tails = new Map<string, TranscriptTail>()

export function registerTranscriptHandlers(getWebContents: () => WebContents | null): void {
  ipcMain.on('transcript:watch', (_event, sessionId: string, cwd: string) => {
    tails.get(sessionId)?.dispose()
    tails.set(
      sessionId,
      new TranscriptTail(transcriptPath(cwd, sessionId), (items, reset) => {
        getWebContents()?.send('transcript:items', sessionId, items, reset)
      })
    )
  })

  ipcMain.on('transcript:unwatch', (_event, sessionId: string) => {
    tails.get(sessionId)?.dispose()
    tails.delete(sessionId)
  })
}

export function disposeAllTails(): void {
  for (const tail of tails.values()) tail.dispose()
  tails.clear()
}
