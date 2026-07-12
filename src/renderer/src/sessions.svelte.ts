import { DOT_COLORS, type Mode } from './theme'

// One level of visual grouping — no nesting, no kanban semantics.
// Folder id 0 is the default folder: always exists, takes new sessions,
// can be renamed but not deleted.
export interface Folder {
  id: number
  name: string
}

export interface Session {
  key: number
  type: 'shell' | 'claude'
  folderId: number
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
let nextFolderId = 1

export const sessions = $state<Session[]>([])
export const folders = $state<Folder[]>([{ id: 0, name: 'Sessions' }])

export const ui = $state<{ focused: number | null; mode: Mode; railWidth: number }>({
  focused: null,
  mode: 'system',
  railWidth: 240
})

// Claude Code prefixes titles with a state glyph (✳ ✶ ✻ …) that churns while
// it works; Git Bash prefixes the cwd with the MSYS system name (MINGW64:).
// Strip both — the rail wants the conversation name / the path, nothing else.
export function cleanTitle(title: string): string {
  return title
    .replace(/^[✳✶✻✽·∴※+*●○◐◑]+\s*/u, '')
    .replace(/^(MINGW64|MINGW32|MSYS|UCRT64|CLANG64|CLANGARM64):\s*/, '')
}

// Recently used working directories, most recent first (persisted).
export const recentDirs = $state<string[]>([])

function touchRecentDir(cwd: string): void {
  const index = recentDirs.indexOf(cwd)
  if (index !== -1) recentDirs.splice(index, 1)
  recentDirs.unshift(cwd)
  if (recentDirs.length > 8) recentDirs.length = 8
}

export async function newSession(type: 'shell' | 'claude', dir?: string): Promise<void> {
  const cwd = dir ?? (await window.arc.pickFolder())
  if (!cwd) return
  touchRecentDir(cwd)
  const name = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
  const session: Session = {
    key: nextKey++,
    type,
    folderId: 0,
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

// Windows Terminal's "Duplicate tab": same type, same cwd, fresh process.
export function duplicateSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  const source = sessions[index]
  if (!source) return
  const session: Session = {
    key: nextKey++,
    type: source.type,
    folderId: source.folderId,
    cwd: source.cwd,
    name: source.name,
    color: DOT_COLORS[colorIndex++ % DOT_COLORS.length].hex,
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

// --- folders ---

export function addFolder(): void {
  folders.push({ id: nextFolderId, name: `Folder ${nextFolderId}` })
  nextFolderId++
}

export function renameFolder(id: number, name: string): void {
  const folder = folders.find((f) => f.id === id)
  if (folder && name.trim()) folder.name = name.trim()
}

// Sessions in a deleted folder fall back to the default folder — never killed.
export function deleteFolder(id: number): void {
  if (id === 0) return
  const index = folders.findIndex((f) => f.id === id)
  if (index === -1) return
  for (const s of sessions) {
    if (s.folderId === id) s.folderId = 0
  }
  folders.splice(index, 1)
}

// Reorder: move folder `id` before folder `beforeId`.
export function moveFolder(id: number, beforeId: number): void {
  if (id === beforeId || id === undefined) return
  const from = folders.findIndex((f) => f.id === id)
  if (from === -1) return
  const [folder] = folders.splice(from, 1)
  const to = folders.findIndex((f) => f.id === beforeId)
  folders.splice(to === -1 ? folders.length : to, 0, folder)
}

// Move a session into a folder — before a specific session, or appended.
export function moveSession(key: number, folderId: number, beforeKey?: number): void {
  const from = sessions.findIndex((s) => s.key === key)
  if (from === -1) return
  const [session] = sessions.splice(from, 1)
  session.folderId = folderId
  if (beforeKey !== undefined && beforeKey !== key) {
    const to = sessions.findIndex((s) => s.key === beforeKey)
    if (to !== -1) {
      sessions.splice(to, 0, session)
      return
    }
  }
  sessions.push(session)
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
  if (saved.recentDirs?.length) recentDirs.push(...saved.recentDirs)
  if (saved.folders?.length) {
    folders.length = 0
    folders.push(...saved.folders)
    if (!folders.some((f) => f.id === 0)) folders.unshift({ id: 0, name: 'Sessions' })
    nextFolderId = Math.max(...folders.map((f) => f.id)) + 1
  }
  const seenClaudeIds = new Set<string>()
  for (const s of saved.sessions) {
    // Drop legacy duplicates that earlier dev reloads may have persisted.
    if (s.type === 'claude' && s.claudeSessionId) {
      if (seenClaudeIds.has(s.claudeSessionId)) continue
      seenClaudeIds.add(s.claudeSessionId)
    }
    const folderId = folders.some((f) => f.id === s.folderId) ? (s.folderId ?? 0) : 0
    sessions.push({
      key: nextKey++,
      type: s.type,
      folderId,
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
    folders: folders.map((f) => ({ id: f.id, name: f.name })),
    recentDirs: [...recentDirs],
    sessions: alive.map((s) => ({
      type: s.type,
      folderId: s.folderId,
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
