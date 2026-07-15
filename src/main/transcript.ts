import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

// Read-only conversation preview: tail the transcript JSONL Claude Code
// writes for the pinned session id, reduce it to the readable conversation
// (user + assistant prose, plus the code Claude writes rendered as fenced
// blocks; other tool activity is dropped as agent mechanics), push the items
// to the renderer. Pure observation — the PTY byte stream is untouched.
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

export type PreviewItem = { kind: 'user'; text: string } | { kind: 'assistant'; text: string }

type Block = { type?: string; text?: string; name?: string; input?: unknown }

// File extension → fenced-code language hint. Cosmetic today (no syntax
// highlighter ships) but keeps the fence honest and is ready if one ever
// does. Unknown extensions get a bare fence — still a code box.
const LANGS: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  mts: 'ts',
  cts: 'ts',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  svelte: 'svelte',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'html',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  py: 'python',
  rs: 'rust',
  go: 'go',
  toml: 'toml',
  xml: 'xml'
}

function langOf(filePath: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(filePath)?.[1]?.toLowerCase()
  return (ext && LANGS[ext]) || ''
}

// Basename across either separator — transcripts carry absolute Windows paths,
// and node's basename is platform-sensitive (a no-op on '\' under posix), so
// don't rely on it here.
function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

// A fenced block whose fence outruns any backtick run inside the body: editing
// a Markdown file can put ``` in the code, and a too-short fence would break
// out of the block. Minimum fence length 3.
function fenced(body: string, lang: string): string {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}${lang}\n${body}\n${fence}`
}

// old → new as a +/- diff body. Not an LCS diff — the whole old block is
// removed, the whole new block added — but the +/- prefixes read as a diff
// even with no highlighter, which is the point. Strip one trailing newline so
// it doesn't tack on a blank +/- line.
function diffBody(oldStr: string, newStr: string): string {
  const sign = (s: string, mark: string): string[] =>
    s === ''
      ? []
      : s
          .replace(/\n$/, '')
          .split('\n')
          .map((l) => mark + l)
  return [...sign(oldStr, '- '), ...sign(newStr, '+ ')].join('\n')
}

// Code-writing tool_use → a filename-labeled fenced block, so the code Claude
// writes reaches the preview (it lives ONLY in tool_use — see the assistant
// branch). Write shows its content; Edit and MultiEdit show a +/- diff. Every
// other tool (Read, Bash, Grep, tool_result…) returns null and stays dropped.
function codeItem(name: string | undefined, input: unknown): PreviewItem | null {
  if (!input || typeof input !== 'object') return null
  const inp = input as Record<string, unknown>
  const filePath = typeof inp['file_path'] === 'string' ? inp['file_path'] : ''
  const label = filePath ? `\`${fileName(filePath)}\`\n\n` : ''

  if (name === 'Write' && typeof inp['content'] === 'string') {
    return { kind: 'assistant', text: label + fenced(inp['content'], langOf(filePath)) }
  }
  if (name === 'Edit' && typeof inp['new_string'] === 'string') {
    const old = typeof inp['old_string'] === 'string' ? inp['old_string'] : ''
    return { kind: 'assistant', text: label + fenced(diffBody(old, inp['new_string']), 'diff') }
  }
  if (name === 'MultiEdit' && Array.isArray(inp['edits'])) {
    const parts = inp['edits']
      .map((e) =>
        e && typeof e === 'object'
          ? diffBody(
              String((e as Record<string, unknown>)['old_string'] ?? ''),
              String((e as Record<string, unknown>)['new_string'] ?? '')
            )
          : ''
      )
      .filter(Boolean)
    if (parts.length === 0) return null
    return { kind: 'assistant', text: label + fenced(parts.join('\n\n'), 'diff') }
  }
  return null
}

// Wrapped so the "never throw" contract survives format drift (?. guards
// null/undefined but not, say, text becoming a number) — a single bad entry
// must cost one line, not the whole chunk. Exported for the unit tests,
// which double as documentation of the transcript shapes we handle.
export function parseLine(line: string): PreviewItem[] {
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
      // tool_result is agent mechanics, not conversation — drop it.
      if (content.some((block) => block?.type === 'tool_result')) return []
      const text = content
        .map((block) =>
          block?.type === 'text' ? block.text : block?.type === 'image' ? '[image]' : ''
        )
        .filter(Boolean)
        .join('\n\n')
      return text.trim() ? [{ kind: 'user', text }] : []
    }
    return []
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    // Prose plus the code Claude writes. Text blocks render as-is; the
    // code-writing tools (Write/Edit/MultiEdit) become filename-labeled fenced
    // blocks (revised 2026-07-15). Dropping ALL tool activity — the 2026-07-14
    // call — also dropped the code, which lives only in tool_use: in a working
    // session no assistant turn interleaves prose with tool_use, so every code
    // turn is tool-only and vanished entirely. thinking and non-code tools
    // (Read, Bash, Grep…) still never reach the preview.
    const items: PreviewItem[] = []
    for (const block of entry.message.content) {
      if (block?.type === 'text' && block.text?.trim()) {
        items.push({ kind: 'assistant', text: block.text })
      } else if (block?.type === 'tool_use') {
        const code = codeItem(block.name, block.input)
        if (code) items.push(code)
      }
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
  private pollTimer: NodeJS.Timeout | null = null
  private queue: Promise<void> = Promise.resolve()
  private disposed = false

  constructor(
    readonly path: string,
    private push: Push
  ) {}

  // Watch the transcript's directory — the file itself may not exist yet (a
  // never-prompted session writes nothing: empty preview, not an error). If
  // even the directory is missing (first session in a cwd), retry until
  // Claude creates it on the first prompt. Idempotent: arming an armed (or
  // arming-in-progress) tail is a no-op. Arming schedules a catch-up read
  // from the stored offset, so a re-opened preview ships only the delta.
  arm(): void {
    if (this.disposed || this.watcher || this.retryTimer) return
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
      this.startPoll()
    } catch {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.arm()
      }, 1000)
    }
  }

  // fs.watch on Windows drops change events — notably the *final* append of a
  // turn, the exact byte range that carries the last assistant message. The
  // watch has no retry for a missed event, so without a backstop the preview
  // sits one turn behind until the next append happens to fire. A low-
  // frequency stat poll is that backstop: if the file has grown past what we
  // read, schedule a read. Only runs while armed (one preview at a time), so
  // it's ~1 stat/sec, and the watch stays the low-latency path. Survives a
  // rearm() on purpose — it's the safety net precisely when the watch is flaky.
  private startPoll(): void {
    if (this.pollTimer || this.disposed) return
    this.pollTimer = setInterval(() => {
      void stat(this.path)
        .then(({ size }) => {
          if (size !== this.offset) this.schedule()
        })
        .catch(() => {
          // missing/transient — existence is the watch + retry path's job
        })
    }, 1000)
  }

  private stopPoll(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private rearm(): void {
    this.watcher?.close()
    this.watcher = null
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.arm()
    }, 1000)
  }

  // Stop watching but KEEP offset and remainder — the preview closed, not
  // the session. An in-flight read completes and still delivers; the
  // renderer's cache accepts items whether or not a preview is showing.
  disarm(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    if (this.readTimer) clearTimeout(this.readTimer)
    this.readTimer = null
    this.stopPoll()
  }

  // fs.watch fires in bursts during rapid appends — coalesce into one read.
  // Reads serialize through a queued promise (offset/remainder must never be
  // touched by two readOnce calls at once); a request landing mid-read just
  // queues a cheap no-op pass (open + stat, size === offset, return). The
  // catch keeps one failed link (e.g. a rejecting close()) from wedging the
  // chain — readOnce already swallows everything else itself.
  private schedule(): void {
    if (this.readTimer || this.disposed) return
    this.readTimer = setTimeout(() => {
      this.readTimer = null
      this.queue = this.queue.then(() => this.readOnce()).catch(() => {})
    }, 50)
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
        // Truncated/replaced — start over; the from-zero read below re-ships
        // everything, and its first batch resets the renderer's cache.
        this.offset = 0
        this.remainder = Buffer.alloc(0)
      }
      if (size === this.offset) return
      // The first batch of any from-zero read carries reset=true — the
      // renderer REPLACES its cache instead of appending, so replays
      // (truncation, a re-created tail, an in-flight delivery racing a
      // re-watch) can never duplicate items by construction.
      let reset = this.offset === 0
      const buffer = Buffer.alloc(size - this.offset)
      await file.read(buffer, 0, buffer.length, this.offset)
      this.offset = size
      // Split on newlines at the byte level — a chunk boundary can fall
      // inside a multi-byte character, so only complete lines get decoded.
      // Parse and push in batches: a from-zero read is the WHOLE transcript
      // (possibly many MB), and main's event loop also pumps every PTY — it
      // must never block for the full parse, and no single IPC message
      // should carry an unbounded array.
      const BATCH = 400
      let data = Buffer.concat([this.remainder, buffer])
      let items: PreviewItem[] = []
      let nl: number
      while ((nl = data.indexOf(0x0a)) !== -1) {
        items.push(...parseLine(data.subarray(0, nl).toString('utf8')))
        data = data.subarray(nl + 1)
        if (items.length >= BATCH) {
          if (this.disposed) return
          this.push(items, reset)
          reset = false
          items = []
          await new Promise((resolve) => setImmediate(resolve))
        }
      }
      this.remainder = data
      if ((items.length || reset) && !this.disposed) this.push(items, reset)
    } catch {
      // transient read failure — the next watch event retries
    } finally {
      await file.close()
    }
  }

  dispose(): void {
    this.disposed = true
    this.disarm()
  }
}

// One persistent tail per session id, living from the first watch until the
// session closes (drop) or the page goes away (disposeAllTails). watch arms,
// unwatch merely disarms — offset, remainder, and the renderer's item cache
// all survive a closed preview, so reopening ships just the delta.
const tails = new Map<string, TranscriptTail>()

export function registerTranscriptHandlers(getWebContents: () => WebContents | null): void {
  ipcMain.on('transcript:watch', (_event, sessionId: string, cwd: string) => {
    const path = transcriptPath(cwd, sessionId)
    let tail = tails.get(sessionId)
    if (tail && tail.path !== path) {
      // Same id, different cwd (dead-path spawn fallback resolved late) —
      // the old offset points into the wrong file. Start over; the fresh
      // from-zero read resets the renderer's cache.
      tail.dispose()
      tail = undefined
    }
    if (!tail) {
      tail = new TranscriptTail(path, (items, reset) => {
        getWebContents()?.send('transcript:items', sessionId, items, reset)
      })
      tails.set(sessionId, tail)
    }
    tail.arm()
  })

  ipcMain.on('transcript:unwatch', (_event, sessionId: string) => {
    tails.get(sessionId)?.disarm()
  })

  // The session is gone — forget the tail entirely.
  ipcMain.on('transcript:drop', (_event, sessionId: string) => {
    tails.get(sessionId)?.dispose()
    tails.delete(sessionId)
  })
}

export function disposeAllTails(): void {
  for (const tail of tails.values()) tail.dispose()
  tails.clear()
}
