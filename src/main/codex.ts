import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  openSync,
  readSync,
  closeSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PreviewItem } from './transcript'

// Learning a codex session's id.
//
// Claude hands us this for free: we pin `--session-id` at spawn, so the id is
// known before the process exists. Codex has no such flag (verified on
// codex-cli 0.153.4) — it mints its own id and opens a rollout file for it. So
// the id is DISCOVERED: after spawning, watch for the rollout our spawn just
// created and read the id out of it.
//
// The join is exact rather than a guess, because the rollout's first record
// carries everything needed to identify it. Measured from a real PTY spawn:
//
//   type: "session_meta"
//   payload.session_id: "01a071a8-ea46-7622-9fe7-c4b504c6debf"
//   payload.cwd:        the directory we spawned in, verbatim
//   payload.source:     "cli"          (the desktop app writes "vscode")
//   payload.originator: "codex-tui"    (the desktop app writes "Codex Desktop")
//
// cwd + source + a creation time at or after our spawn is three independent
// signals, which is enough to never adopt someone else's session — including
// the user's own codex running in another window.

// Sessions live under <CODEX_HOME>/sessions/YYYY/MM/DD/, honouring the same
// env override codex itself reads.
function codexHome(): string {
  return process.env['CODEX_HOME'] || join(homedir(), '.codex')
}

function dayDir(at: Date): string {
  const y = String(at.getFullYear())
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return join(codexHome(), 'sessions', y, m, d)
}

// Today and yesterday: a session spawned just before midnight lands in the
// previous day's directory, and the app should still find it.
function candidateDirs(now: Date): string[] {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return [dayDir(now), dayDir(yesterday)].filter((dir) => existsSync(dir))
}

// rollout-2026-09-05T14-01-30-<uuid>.jsonl
const ROLLOUT = /^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([0-9a-f-]{36})\.jsonl$/i

// Windows paths compare case-insensitively and arrive with either separator.
function sameDir(a: string, b: string): boolean {
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

// The first line only. `session_meta` is the first record, but it carries the
// model's full base instructions, so it runs to tens of kilobytes — read in
// chunks until the newline rather than slurping the whole (potentially
// multi-megabyte) rollout just to identify it.
const CHUNK = 64 * 1024
const FIRST_LINE_CAP = 4 * 1024 * 1024

function readFirstLine(path: string): string | null {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    const buffer = Buffer.alloc(CHUNK)
    let text = ''
    while (text.length < FIRST_LINE_CAP) {
      const read = readSync(fd, buffer, 0, CHUNK, null)
      if (read <= 0) break
      text += buffer.toString('utf8', 0, read)
      const newline = text.indexOf('\n')
      if (newline !== -1) return text.slice(0, newline)
    }
    return text || null
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        /* already gone */
      }
    }
  }
}

export interface CodexSession {
  sessionId: string
  // The rollout path, kept because it is NOT derivable from the id: the
  // filename embeds a timestamp too. The preview tail needs the path, so
  // discovery is the only thing that can supply it.
  path: string
}

// Every id we have resolved to a file, so the transcript tail can find a
// rollout by id alone. Populated by discovery; a miss falls back to a scan.
const pathById = new Map<string, string>()

export function rolloutPath(sessionId: string): string | null {
  const known = pathById.get(sessionId)
  if (known && existsSync(known)) return known
  for (const dir of candidateDirs(new Date())) {
    for (const name of safeReaddir(dir)) {
      const match = ROLLOUT.exec(name)
      if (match && match[2].toLowerCase() === sessionId.toLowerCase()) {
        const full = join(dir, name)
        pathById.set(sessionId, full)
        return full
      }
    }
  }
  return null
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

// The newest rollout that was opened in `cwd` by a CLI session at or after
// `sinceMs`. Null until codex has written its first record, which is why the
// caller polls rather than asking once.
export function findSession(cwd: string, sinceMs: number): CodexSession | null {
  const now = new Date()
  const candidates: Array<{ path: string; id: string; mtime: number }> = []

  for (const dir of candidateDirs(now)) {
    for (const name of safeReaddir(dir)) {
      const match = ROLLOUT.exec(name)
      if (!match) continue
      const full = join(dir, name)
      let mtime: number
      try {
        // Written continuously, so mtime moves; birthtime is the honest
        // creation stamp and Windows reports it reliably.
        const stats = statSync(full)
        mtime = stats.birthtimeMs || stats.mtimeMs
      } catch {
        continue
      }
      // A second of slack: the filename's stamp and our spawn clock are not
      // the same clock, and codex writes the file a beat after it starts.
      if (mtime < sinceMs - 1000) continue
      candidates.push({ path: full, id: match[2], mtime })
    }
  }

  candidates.sort((a, b) => b.mtime - a.mtime)

  for (const candidate of candidates) {
    const line = readFirstLine(candidate.path)
    if (!line) continue
    let payload: { cwd?: string; session_id?: string; source?: string; originator?: string }
    try {
      const record = JSON.parse(line)
      if (record?.type !== 'session_meta') continue
      payload = record.payload ?? {}
    } catch {
      // A rollout caught mid-write: the first line is not complete JSON yet.
      // Not an error — the next poll sees it finished.
      continue
    }
    if (!payload.cwd || !sameDir(payload.cwd, cwd)) continue
    // The desktop app writes "vscode"; only our own spawns say "cli". Without
    // this a codex window the user opened in the same directory could be
    // adopted by our row.
    if (payload.source && payload.source !== 'cli') continue
    const sessionId = payload.session_id || candidate.id
    pathById.set(sessionId, candidate.path)
    return { sessionId, path: candidate.path }
  }
  return null
}

// Poll until the rollout appears. Codex writes it within a second or so of
// starting, but a cold start behind an update check can be slower, so the
// window is generous and giving up is silent: a row with no id still runs
// perfectly well as a terminal, it just has no preview or resume handle.
const POLL_INTERVAL = 400
const POLL_LIMIT = 30_000

export function watchForSession(
  cwd: string,
  sinceMs: number,
  onFound: (session: CodexSession) => void
): () => void {
  let stopped = false
  const started = Date.now()

  const tick = (): void => {
    if (stopped) return
    const found = findSession(cwd, sinceMs)
    if (found) {
      onFound(found)
      return
    }
    if (Date.now() - started >= POLL_LIMIT) return
    timer = setTimeout(tick, POLL_INTERVAL)
  }

  let timer: ReturnType<typeof setTimeout> = setTimeout(tick, POLL_INTERVAL)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

// --- the preview fold -------------------------------------------------------
//
// Same job as parseLine in transcript.ts, different schema. A codex rollout is
// a stream of typed records; the conversation is the `response_item` /
// `message` ones. Everything else — `event_msg` (item_completed, task_started,
// token_count), `token_usage_record`, `world_state`, `turn_context` — is
// mechanics and stays dropped, the same rule the claude fold applies.
//
// Two codex-specific drops, both measured on a real rollout:
//   `role: "developer"` carries the skills catalogue and the multi-agent
//   preamble — the system prompt by another name, and never conversation.
//   `reasoning` records hold `encrypted_content` with an empty summary, so
//   there is no thinking to show even if we wanted it.

interface CodexContent {
  type?: string
  text?: string
}

// A user "message" that is really injected context: codex opens a session by
// sending `<environment_context>…</environment_context>` as the user. It is one
// XML-ish element start to finish, which is the shape no human types.
function isInjectedContext(text: string): boolean {
  const trimmed = text.trim()
  const open = /^<([a-z_][a-z0-9_-]*)>/i.exec(trimmed)
  return open ? trimmed.endsWith(`</${open[1]}>`) : false
}

export function parseCodexLine(line: string): PreviewItem[] {
  try {
    return parseCodexLineInner(line)
  } catch {
    // Same contract as the claude fold: a single unrecognised entry costs one
    // line, never the chunk, and format drift degrades the preview rather than
    // throwing.
    return []
  }
}

function parseCodexLineInner(line: string): PreviewItem[] {
  let record: { type?: string; payload?: { type?: string; role?: string; content?: unknown } }
  try {
    record = JSON.parse(line)
  } catch {
    return []
  }
  if (!record || typeof record !== 'object' || record.type !== 'response_item') return []
  const payload = record.payload
  if (!payload || payload.type !== 'message') return []

  const role = payload.role
  if (role !== 'user' && role !== 'assistant') return []

  const content = Array.isArray(payload.content) ? (payload.content as CodexContent[]) : []
  const text = content
    .map((block) => (typeof block?.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim()
  if (!text) return []
  if (role === 'user' && isInjectedContext(text)) return []
  return [{ kind: role, text }]
}

// Codex names a thread a turn or two in, so the name is not there at discovery.
// Re-read the (small, append-only) index for a while afterwards and report it
// when it appears or changes. Bounded on purpose: names settle early, and a
// permanent poll per codex row is exactly the sort of background cost the app
// avoids elsewhere. A rename after the window closes keeps the old label —
// the row is still the row, and the title bar underneath is unaffected.
const NAME_INTERVAL = 3000
const NAME_LIMIT = 3 * 60 * 1000

export function watchForName(sessionId: string, onName: (name: string) => void): () => void {
  let stopped = false
  let last: string | null = null
  const started = Date.now()

  const tick = (): void => {
    if (stopped) return
    const name = threadName(sessionId)
    if (name && name !== last) {
      last = name
      onName(name)
    }
    if (Date.now() - started >= NAME_LIMIT) return
    timer = setTimeout(tick, NAME_INTERVAL)
  }

  let timer: ReturnType<typeof setTimeout> = setTimeout(tick, NAME_INTERVAL)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

// The conversation's name, which codex does NOT put in the terminal title (it
// titles the window with the working directory's basename). The index is a
// small append-only JSONL of {id, thread_name, updated_at}; the last entry for
// an id wins, so a renamed conversation reads correctly.
export function threadName(sessionId: string): string | null {
  const index = join(codexHome(), 'session_index.jsonl')
  if (!existsSync(index)) return null
  let name: string | null = null
  try {
    const lines = readFileSync(index, 'utf8').split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (entry?.id === sessionId && typeof entry.thread_name === 'string') {
          name = entry.thread_name
        }
      } catch {
        /* skip a malformed line rather than lose the file */
      }
    }
  } catch {
    return null
  }
  return name
}
