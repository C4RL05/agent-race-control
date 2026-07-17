import { DOT_COLORS, DEFAULT_FONT_ID, DEFAULT_UI_FONT_ID, type Mode } from './theme'

export interface Session {
  key: number
  type: 'shell' | 'claude'
  cwd: string
  // User label — shell sessions only. A Claude session's name IS its
  // conversation's, arriving via the terminal title (tower renames go
  // through /rename, see renameSession), so name stays '' for Claude and
  // the title is the single source of truth. The cwd basename is never a
  // display name.
  name: string
  // Claude sessions use the full set; shell sessions only running/exited.
  status: 'running' | 'waiting' | 'idle' | 'exited'
  // Live terminal title (OSC 0/2) — Claude Code keeps it set to the
  // conversation's name; Git Bash sets it to the cwd. Observation only.
  title: string
  ptyId: string | null
  // The session's CURRENT Claude conversation id — the pinned spawn id, but
  // Claude Code mints a fresh one on `/clear`, so the hook stream re-points it
  // (see applyStatus). Owns the transcript file the preview tails and the id
  // resumed on restart.
  claudeSessionId: string | null
  // Immutable per-session hook routing token (== the spawn id), set alongside
  // claudeSessionId at spawn. Hooks route on this even after `/clear` changes
  // claudeSessionId, so status stays attributed to the right session.
  hookToken: string | null
  // Set on sessions restored from the state JSON: spawn with --resume.
  resumeId: string | null
  // Which pane tab is showing: the live terminal or the read-only
  // conversation preview (Claude sessions only). Transient — not persisted.
  view: 'terminal' | 'preview'
  // Cosmetic "revisit later" flag overlaid on the status dot (both types).
  // Purely visual — no effect on sorting/focus/logic. Persisted so it survives
  // restart; auto-cleared when the underlying status changes color (setStatus).
  todo: boolean
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

// Recently used directories for the spawn menus — unlike dirOrder this
// deliberately keeps dirs whose last session closed (that's their point).
// Most-recent-first, persisted.
const RECENT_MAX = 8
export const recentDirs = $state<string[]>([])

function touchRecent(cwd: string): void {
  const index = recentDirs.indexOf(cwd)
  if (index !== -1) recentDirs.splice(index, 1)
  recentDirs.unshift(cwd)
  if (recentDirs.length > RECENT_MAX) recentDirs.length = RECENT_MAX
}

export const ui = $state<{
  focused: number | null
  mode: Mode
  towerWidth: number
  // Settings toggle: recolor the status dots to pure traffic-light RGB
  // (red/green/amber) instead of the Primer semantic tones, in both themes.
  // Off by default — the Primer tones are the documented default.
  statusRgb: boolean
  // Selected font ids: terminal (mono, theme.ts FONTS), interface/app chrome
  // and preview prose (both sans, theme.ts UI_FONTS).
  font: string
  uiFont: string
  previewFont: string
}>({
  focused: null,
  mode: 'system',
  towerWidth: 240,
  statusRgb: false,
  font: DEFAULT_FONT_ID,
  uiFont: DEFAULT_UI_FONT_ID,
  previewFont: DEFAULT_UI_FONT_ID
})

// Claude Code prefixes titles with a state glyph (✳ ✶ ✻ …) that churns while
// it works; Git Bash prefixes the cwd with the MSYS system name (MINGW64:).
// Strip both — the tower wants the conversation name / the path, nothing else.
export function cleanTitle(title: string): string {
  return title
    .replace(/^[✳✶✻✽·∴※+*●○◐◑]+\s*/u, '')
    .replace(/^(MINGW64|MINGW32|MSYS|UCRT64|CLANG64|CLANGARM64):\s*/, '')
}

// Every session literal in one place — defaults change here and nowhere
// else. Claude starts at its prompt (idle); a shell is simply alive
// (running).
function createSession(init: {
  type: 'shell' | 'claude'
  cwd: string
  name?: string
  resumeId?: string | null
}): Session {
  return {
    key: nextKey++,
    type: init.type,
    cwd: init.cwd,
    name: init.name ?? '',
    status: init.type === 'claude' ? 'idle' : 'running',
    title: '',
    ptyId: null,
    claudeSessionId: null,
    hookToken: null,
    resumeId: init.resumeId ?? null,
    view: 'terminal',
    todo: false
  }
}

// The single choke point for status changes — every path that moves a session's
// status (hooks, the keystroke nudge, exit) goes through here so the cosmetic
// TODO flag can auto-clear "the next time the underlying status changes color"
// (issue #3). Each status maps to a distinct dot color, so a value change IS a
// color change; restore sets status/todo directly (not via here) so a relaunch
// never counts as the clearing change.
export function setStatus(session: Session, next: Session['status']): void {
  if (session.todo && next !== session.status) session.todo = false
  session.status = next
}

// Left-clicking the status dot toggles the TODO flag (both session types).
// Toggle-only — it does not focus the session (App stops the click bubbling).
// Clearing just drops the overlay; the dot returns to session.status's live
// color, which was tracked underneath the whole time.
export function toggleTodo(key: number): void {
  const session = sessions.find((s) => s.key === key)
  if (session) session.todo = !session.todo
}

// dir given: spawn there (group header + buttons). No dir: OS folder picker.
export async function newSession(type: 'shell' | 'claude', dir?: string): Promise<void> {
  const cwd = dir ?? (await window.arc.pickFolder())
  if (!cwd) return
  touchDir(cwd)
  touchRecent(cwd)
  const session = createSession({ type, cwd })
  sessions.push(session)
  ui.focused = session.key
}

// Windows Terminal's "Duplicate tab": same type, same cwd, fresh process.
export function duplicateSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  const source = sessions[index]
  if (!source) return
  // A duplicated Claude session is a brand-new conversation — the source's
  // label names a different one. Shell labels describe purpose; keep those.
  const session = createSession({
    type: source.type,
    cwd: source.cwd,
    name: source.type === 'shell' ? source.name : ''
  })
  sessions.splice(index + 1, 0, session)
  ui.focused = session.key
}

// The PTY reports the directory it actually started in — a dead requested
// cwd falls back to the home dir (pty.ts). Follow the truth, and keep the
// invariant that every session's cwd has a directory group.
export function applySpawnCwd(key: number, cwd: string): void {
  const session = sessions.find((s) => s.key === key)
  if (!session || session.cwd === cwd) return
  session.cwd = cwd
  touchDir(cwd)
}

// Mirrors HookEvent in src/main/status.ts (the renderer can't import from main).
type HookEvent = 'UserPromptSubmit' | 'PostToolUse' | 'PermissionRequest' | 'Notification' | 'Stop'

// `/clear` (and an in-TUI `/resume`) makes Claude Code mint a new conversation
// id + transcript file mid-session. Hooks route on the stable hookToken, so we
// still find the session; when the payload's id diverges from the one we hold,
// follow it — adopt the new id, forget the old transcript tail and preview
// cache, and let the Preview's watch re-point (its sessionId prop is this id).
// Without this the preview froze on the pre-clear conversation (issue #2).
function switchClaudeSession(session: Session, nextId: string): void {
  const prev = session.claudeSessionId
  if (prev) {
    delete previewItems[prev]
    // window is absent in the unit-test env; the store is otherwise pure.
    globalThis.window?.arc?.transcript.drop(prev)
  }
  session.claudeSessionId = nextId
}

// The hook half of the status state machine (the other half is
// nudgeStatusFromKey). Main forwards the raw hook event keyed by the session's
// stable hookToken, plus the payload's current conversation id; we own the
// meaning. PermissionRequest fires the instant a dialog appears (incl.
// AskUserQuestion); Notification is the safety net for other needs-input types
// (the idle_prompt nag is dropped in main). PostToolUse is the subtle one:
// these are non-blocking POSTs that can arrive out of order, so a PostToolUse
// landing just after a turn's Stop would otherwise flip a just-finished session
// back to red — and a backgrounded session has no keystroke nudge to correct
// it. A tool finishing only means "still in a turn", so it may keep
// running/waiting red but must never resurrect `idle`; only UserPromptSubmit (a
// new turn) leaves idle. exited is terminal — nothing revives a dead session.
export function applyStatus(hookToken: string, claudeSessionId: string, event: HookEvent): void {
  const session = sessions.find((s) => s.hookToken === hookToken)
  if (!session || session.status === 'exited') return
  if (claudeSessionId && session.claudeSessionId !== claudeSessionId) {
    switchClaudeSession(session, claudeSessionId)
  }
  // Compute the next status, then commit via setStatus (one choke point, so the
  // TODO overlay auto-clears on a color change). PostToolUse holds idle idle.
  let next = session.status
  switch (event) {
    case 'Stop':
      next = 'idle'
      break
    case 'PermissionRequest':
    case 'Notification':
      next = 'waiting'
      break
    case 'UserPromptSubmit':
      next = 'running'
      break
    case 'PostToolUse':
      if (session.status !== 'idle') next = 'running'
      break
  }
  setStatus(session, next)
}

// Read-only preview items, cached per Claude session id. The cache outlives
// the Preview component: a tab flip re-renders from memory while main's
// disarmed tail keeps its byte offset, so reopening ships only the delta.
// reset=true (the first batch of any from-zero read) REPLACES the cache —
// that's what makes replays duplication-proof. Dropped with the session.
export const previewItems = $state<Record<string, PreviewItem[]>>({})

export function applyPreviewItems(sessionId: string, items: PreviewItem[], reset: boolean): void {
  const cached = previewItems[sessionId]
  if (reset || !cached) previewItems[sessionId] = [...items]
  else cached.push(...items)
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
    if (session.status === 'running' || session.status === 'waiting') setStatus(session, 'idle')
  } else if (data === '\r' && session.status === 'waiting') {
    // Enter answers the dialog — approve and deny-with-feedback both resume the turn.
    setStatus(session, 'running')
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
  ui.statusRgb = saved.statusRgb ?? false
  ui.font = saved.font ?? DEFAULT_FONT_ID
  ui.uiFont = saved.uiFont ?? DEFAULT_UI_FONT_ID
  ui.previewFont = saved.previewFont ?? DEFAULT_UI_FONT_ID
  if (saved.dirOrder?.length) dirOrder.push(...saved.dirOrder)
  if (saved.dirColors) Object.assign(dirColors, saved.dirColors)
  // Re-apply touchRecent's invariants (dedupe + cap) — the state file is
  // external data and the one path that skips them otherwise.
  if (saved.recentDirs?.length) {
    recentDirs.push(...[...new Set(saved.recentDirs)].slice(0, RECENT_MAX))
  }
  for (const s of saved.sessions) {
    touchDir(s.cwd)
    const restored = createSession({
      type: s.type,
      cwd: s.cwd,
      // name is a shell-only label (enforced here against hand-edited
      // state files — the title is a Claude session's source of truth).
      name: s.type === 'shell' ? s.name : '',
      // Claude sessions resume their conversation; shells reopen fresh.
      resumeId: s.type === 'claude' ? s.claudeSessionId : null
    })
    // Restore the TODO flag directly (not via setStatus) — the spawn's status
    // defaults must not count as the color change that would clear it.
    restored.todo = s.todo ?? false
    sessions.push(restored)
    colorIndex++
  }
  if (saved.towerWidth) ui.towerWidth = saved.towerWidth
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
    version: 2,
    mode: ui.mode,
    statusRgb: ui.statusRgb,
    font: ui.font,
    uiFont: ui.uiFont,
    previewFont: ui.previewFont,
    towerWidth: ui.towerWidth,
    focusedIndex,
    dirOrder: dirOrder.filter((dir) => alive.some((s) => s.cwd === dir)),
    dirColors: Object.fromEntries(
      Object.entries(dirColors).filter(([dir]) => alive.some((s) => s.cwd === dir))
    ),
    recentDirs: [...recentDirs],
    sessions: alive.map((s) => ({
      type: s.type,
      name: s.name,
      cwd: s.cwd,
      claudeSessionId: s.claudeSessionId,
      todo: s.todo
    }))
  }
}

export function closeSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  if (index === -1) return
  const claudeSessionId = sessions[index].claudeSessionId
  if (claudeSessionId) {
    delete previewItems[claudeSessionId]
    window.arc.transcript.drop(claudeSessionId)
  }
  sessions.splice(index, 1)
  if (ui.focused === key) {
    ui.focused = sessions[Math.min(index, sessions.length - 1)]?.key ?? null
  }
}

// The two blessed forms of writing into a session (/color, /rename):
// user-initiated, visible in the TUI, public commands. Only injected at the
// IDLE prompt — while `waiting`, the trailing Enter would answer the open
// permission/question dialog (and digits in the argument could pick an
// option first); while `running`, the input box may hold a draft the command
// would corrupt. Returns whether the command was actually typed.
function injectCommand(session: Session, command: string): boolean {
  if (session.type !== 'claude' || !session.ptyId || session.status !== 'idle') return false
  window.arc.pty.write(session.ptyId, `${command}\r`)
  return true
}

// Claude tints its agent-view row to match. One-way sync: /color typed
// inside the TUI can't be read back (verified: no file, no escape seq).
function injectColor(session: Session, name: string): void {
  injectCommand(session, `/color ${name}`)
}

// Tower rename. Shell: plain local label. Claude: type /rename on the user's
// behalf — Claude renames the conversation, so tower and TUI stay in sync.
// Claude doesn't re-emit the terminal title right away, so the title is set
// optimistically; the next real title emission overwrites it (title stays
// the single source of truth — name is never set for Claude sessions). If
// the session isn't at its idle prompt, nothing is typed and nothing
// changes: the label visibly not taking beats a silent revert later.
export function renameSession(key: number, name: string): void {
  const session = sessions.find((s) => s.key === key)
  if (!session) return
  if (session.type === 'shell') {
    session.name = name
  } else if (injectCommand(session, `/rename ${name}`)) {
    session.title = name
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
