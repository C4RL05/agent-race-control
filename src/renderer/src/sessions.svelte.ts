import { DOT_COLORS, type Mode } from './theme'

export interface Session {
  key: number
  type: 'shell' | 'claude'
  cwd: string
  name: string
  color: string
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

export const ui = $state<{ focused: number | null; mode: Mode; railWidth: number }>({
  focused: null,
  mode: 'system',
  railWidth: 240
})

// Claude Code prefixes titles with a state glyph (✳ ✶ ✻ …) that churns while
// it works — strip it for the rail's name column.
export function cleanTitle(title: string): string {
  return title.replace(/^[✳✶✻✽·∴※+*●○◐◑]+\s*/u, '')
}

export async function newSession(type: 'shell' | 'claude'): Promise<void> {
  const cwd = await window.arc.pickFolder()
  if (!cwd) return
  const name = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
  const session: Session = {
    key: nextKey++,
    type,
    cwd,
    name,
    color: DOT_COLORS[colorIndex++ % DOT_COLORS.length].hex,
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

export function applyStatus(claudeSessionId: string, status: 'running' | 'waiting' | 'idle'): void {
  const session = sessions.find((s) => s.claudeSessionId === claudeSessionId)
  if (session && session.status !== 'exited') session.status = status
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
  const seenClaudeIds = new Set<string>()
  for (const s of saved.sessions) {
    // Drop legacy duplicates that earlier dev reloads may have persisted.
    if (s.type === 'claude' && s.claudeSessionId) {
      if (seenClaudeIds.has(s.claudeSessionId)) continue
      seenClaudeIds.add(s.claudeSessionId)
    }
    sessions.push({
      key: nextKey++,
      type: s.type,
      cwd: s.cwd,
      name: s.name,
      color: s.color,
      status: s.type === 'claude' ? 'idle' : 'running',
      title: '',
      ptyId: null,
      claudeSessionId: null,
      // Claude sessions resume their conversation; shells just reopen fresh.
      resumeId: s.type === 'claude' ? s.claudeSessionId : null
    })
    colorIndex++
  }
  if (saved.railWidth) ui.railWidth = saved.railWidth
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
    railWidth: ui.railWidth,
    focusedIndex,
    sessions: alive.map((s) => ({
      type: s.type,
      name: s.name,
      color: s.color,
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

// Left-click on the dot: re-apply the current color to the session
// (useful after resume — Claude's color is runtime-only and resets).
export function applyColor(session: Session): void {
  const entry = DOT_COLORS.find((c) => c.hex === session.color)
  if (entry) injectColor(session, entry.name)
}

// Context-menu pick: set the dot and push it into the session.
export function setColor(session: Session, entry: { name: string; hex: string }): void {
  session.color = entry.hex
  injectColor(session, entry.name)
}
