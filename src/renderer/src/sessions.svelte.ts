import { DOT_COLORS, type Mode } from './theme'

export interface Session {
  key: number
  type: 'shell' | 'claude'
  cwd: string
  name: string
  // Claude sessions use the full set; shell sessions only running/exited.
  status: 'running' | 'waiting' | 'idle' | 'exited'
  // Live terminal title (OSC 0/2) — Claude Code keeps it set to the
  // conversation's name; Git Bash sets it to the cwd. Observation only.
  title: string
  ptyId: string | null
  claudeSessionId: string | null
  // Set on sessions restored from the state JSON: spawn with --resume.
  resumeId: string | null
}

let nextKey = 1
let colorIndex = 0

export const sessions = $state<Session[]>([])

// Directory groups are DERIVED, not managed: a group exists because sessions
// run in that directory — it appears with its first session and disappears
// with its last. dirOrder only records the display order of the groups
// (header drag reorders it); it never creates or deletes anything.
export const dirOrder = $state<string[]>([])

// Color belongs to the directory group — auto-assigned on first appearance
// from Claude's /color vocabulary, right-click the header to change it.
export const dirColors = $state<Record<string, string>>({})

function touchDir(cwd: string): void {
  if (!dirOrder.includes(cwd)) dirOrder.push(cwd)
  if (!dirColors[cwd]) dirColors[cwd] = DOT_COLORS[colorIndex++ % DOT_COLORS.length].hex
}

export function setDirColor(dir: string, hex: string): void {
  dirColors[dir] = hex
}

export const ui = $state<{ focused: number | null; mode: Mode; towerWidth: number }>({
  focused: null,
  mode: 'system',
  towerWidth: 240
})

// Claude Code prefixes titles with a state glyph (✳ ✶ ✻ …) that churns while
// it works; Git Bash prefixes the cwd with the MSYS system name (MINGW64:).
// Strip both — the tower wants the conversation name / the path, nothing else.
export function cleanTitle(title: string): string {
  return title
    .replace(/^[✳✶✻✽·∴※+*●○◐◑]+\s*/u, '')
    .replace(/^(MINGW64|MINGW32|MSYS|UCRT64|CLANG64|CLANGARM64):\s*/, '')
}

// dir given: spawn there (group header + buttons). No dir: OS folder picker.
export async function newSession(type: 'shell' | 'claude', dir?: string): Promise<void> {
  const cwd = dir ?? (await window.arc.pickFolder())
  if (!cwd) return
  touchDir(cwd)
  const name = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
  const session: Session = {
    key: nextKey++,
    type,
    cwd,
    name,
    // Claude starts at its prompt (idle); a shell is simply alive (running).
    status: type === 'claude' ? 'idle' : 'running',
    title: '',
    ptyId: null,
    claudeSessionId: null,
    resumeId: null
  }
  sessions.push(session)
  ui.focused = session.key
}

// Windows Terminal's "Duplicate tab": same type, same cwd, fresh process.
export function duplicateSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  const source = sessions[index]
  if (!source) return
  const session: Session = {
    key: nextKey++,
    type: source.type,
    cwd: source.cwd,
    name: source.name,
    status: source.type === 'claude' ? 'idle' : 'running',
    title: '',
    ptyId: null,
    claudeSessionId: null,
    resumeId: null
  }
  sessions.splice(index + 1, 0, session)
  ui.focused = session.key
}

export function applyStatus(claudeSessionId: string, status: 'running' | 'waiting' | 'idle'): void {
  const session = sessions.find((s) => s.claudeSessionId === claudeSessionId)
  if (session && session.status !== 'exited') session.status = status
}

// Hooks are blind to user interrupts — documented: Stop fires only on
// normally-completed turns, and no hook fires when a permission/question
// dialog is dismissed. Infer those transitions from the keystrokes we
// already forward to the PTY (observation only; the bytes pass through
// untouched). Optimistic nudge — the next hook event stays authoritative.
export function nudgeStatusFromKey(key: number, data: string): void {
  const session = sessions.find((s) => s.key === key)
  if (!session || session.type !== 'claude' || session.status === 'exited') return
  // A lone ESC byte is the Esc key (arrows etc. arrive as longer 0x1b-prefixed
  // chunks); 0x03 is Ctrl+C. Both abort the dialog/turn → back at the prompt.
  if (data === '\x1b' || data === '\x03') {
    if (session.status === 'running' || session.status === 'waiting') session.status = 'idle'
  } else if (data === '\r' && session.status === 'waiting') {
    // Enter answers the dialog — approve and deny-with-feedback both resume the turn.
    session.status = 'running'
  }
}

// Reorder directory groups: move `dir` before `beforeDir`.
export function moveDir(dir: string, beforeDir: string): void {
  if (dir === beforeDir) return
  const from = dirOrder.indexOf(dir)
  if (from === -1) return
  dirOrder.splice(from, 1)
  const to = dirOrder.indexOf(beforeDir)
  dirOrder.splice(to === -1 ? dirOrder.length : to, 0, dir)
}

// Reorder a session within its directory group (a session's directory is a
// fact of the running process — it cannot be moved between groups).
export function moveSession(key: number, beforeKey: number): void {
  if (key === beforeKey) return
  const from = sessions.findIndex((s) => s.key === key)
  const to = sessions.findIndex((s) => s.key === beforeKey)
  if (from === -1 || to === -1 || sessions[from].cwd !== sessions[to].cwd) return
  const [session] = sessions.splice(from, 1)
  sessions.splice(
    sessions.findIndex((s) => s.key === beforeKey),
    0,
    session
  )
}

// --- persistence ---

let booted = false

export async function restoreState(): Promise<void> {
  // HMR re-mounts App, which re-runs the boot effect — restore must happen
  // once per page load and never into a non-empty list (it would append
  // duplicates, and the persist effect would then save them).
  if (booted || sessions.length > 0) return
  booted = true
  const saved = await window.arc.state.load()
  if (!saved) return
  ui.mode = saved.mode
  if (saved.dirOrder?.length) dirOrder.push(...saved.dirOrder)
  if (saved.dirColors) Object.assign(dirColors, saved.dirColors)
  const seenClaudeIds = new Set<string>()
  for (const s of saved.sessions) {
    // Drop legacy duplicates that earlier dev reloads may have persisted.
    if (s.type === 'claude' && s.claudeSessionId) {
      if (seenClaudeIds.has(s.claudeSessionId)) continue
      seenClaudeIds.add(s.claudeSessionId)
    }
    touchDir(s.cwd)
    sessions.push({
      key: nextKey++,
      type: s.type,
      cwd: s.cwd,
      name: s.name,
      status: s.type === 'claude' ? 'idle' : 'running',
      title: '',
      ptyId: null,
      claudeSessionId: null,
      // Claude sessions resume their conversation; shells just reopen fresh.
      resumeId: s.type === 'claude' ? s.claudeSessionId : null
    })
    colorIndex++
  }
  // towerWidth was persisted as railWidth before the rename — accept both.
  const width = saved.towerWidth ?? saved.railWidth
  if (width) ui.towerWidth = width
  ui.focused = sessions[saved.focusedIndex]?.key ?? sessions[0]?.key ?? null
}

// Exited sessions are not persisted — a session that ended is gone.
export function snapshotState(): PersistedState {
  const alive = sessions.filter((s) => s.status !== 'exited')
  const focusedIndex = Math.max(
    0,
    alive.findIndex((s) => s.key === ui.focused)
  )
  return {
    version: 1,
    mode: ui.mode,
    towerWidth: ui.towerWidth,
    focusedIndex,
    dirOrder: dirOrder.filter((dir) => alive.some((s) => s.cwd === dir)),
    dirColors: Object.fromEntries(
      Object.entries(dirColors).filter(([dir]) => alive.some((s) => s.cwd === dir))
    ),
    sessions: alive.map((s) => ({
      type: s.type,
      name: s.name,
      cwd: s.cwd,
      claudeSessionId: s.claudeSessionId
    }))
  }
}

export function closeSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  if (index === -1) return
  sessions.splice(index, 1)
  if (ui.focused === key) {
    ui.focused = sessions[Math.min(index, sessions.length - 1)]?.key ?? null
  }
}

// Type `/color <name>` into the session on the user's behalf. User-initiated,
// visible in the TUI, public command — the one blessed form of writing into a
// session. Claude tints its agent-view row to match. One-way sync: /color
// typed inside the TUI can't be read back (verified: no file, no escape seq).
function injectColor(session: Session, name: string): void {
  if (session.type === 'claude' && session.ptyId && session.status !== 'exited') {
    window.arc.pty.write(session.ptyId, `/color ${name}\r`)
  }
}

// Context-menu action: push the folder's color into the session (useful
// after resume too — Claude's color is runtime-only and resets).
export function applyFolderColor(key: number): void {
  const session = sessions.find((s) => s.key === key)
  if (!session) return
  const entry = DOT_COLORS.find((c) => c.hex === dirColors[session.cwd])
  if (entry) injectColor(session, entry.name)
}
