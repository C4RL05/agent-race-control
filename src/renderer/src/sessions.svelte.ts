import { DOT_COLORS, DEFAULT_FONT_ID, DEFAULT_UI_FONT_ID, type Mode } from './theme'

// Read-only branch/worktree facts for the tower's repo→branch tree (issue #5),
// fetched from main (window.arc.git) and cached per cwd in `gitInfo`. Mirrors
// GitInfo in src/main/git.ts (the renderer can't import from main).
export interface GitInfo {
  isRepo: boolean
  repoRoot: string
  repoName: string
  worktreeName: string
  branch: string
}

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
  // Set on sessions the repo card spawns into a fresh worktree: pass
  // --worktree <name> ('' = let Claude auto-name) at spawn. Transient — not
  // persisted; a restored session's cwd already IS its worktree, and Claude
  // Code owns the worktree's whole lifecycle (see the worktree-workflow doc).
  spawnWorktree: string | null
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

// Which group cards are collapsed to their title (issue #5), keyed by group
// key (repoRoot or cwd — the same key moveGroup/setGroupColor use). Only
// collapsed keys are present; absent = expanded. Persisted so it survives
// restart. Click a card's name to toggle.
export const collapsedGroups = $state<Record<string, boolean>>({})

export function toggleCollapsed(groupKey: string): void {
  if (collapsedGroups[groupKey]) delete collapsedGroups[groupKey]
  else collapsedGroups[groupKey] = true
}

// Per-cwd branch/worktree info (issue #5), populated async from main. Absent =
// not yet fetched (the cwd renders as a flat folder until it lands); a stored
// `{ isRepo: false }` / null = not a git repo (a permanently flat folder).
// Never persisted — a live fact, recomputed on load.
export const gitInfo = $state<Record<string, GitInfo | null>>({})
const gitInFlight = new Set<string>()

// Fetch (or re-fetch) a cwd's git info. Fail-open by construction — main's
// getGitInfo never rejects; the .catch is belt-and-suspenders. The in-flight
// guard only dedups CONCURRENT calls, so a later refresh still re-reads (a
// shell may have changed branch). window is absent under the unit tests; the
// store stays pure there.
export function loadGitInfo(cwd: string): void {
  const api = globalThis.window?.arc?.git
  if (!api || gitInFlight.has(cwd)) return
  gitInFlight.add(cwd)
  void api
    .info(cwd)
    .then((info) => (gitInfo[cwd] = info))
    .catch(() => (gitInfo[cwd] = null))
    .finally(() => gitInFlight.delete(cwd))
}

// Re-read every known cwd — App calls this when the window regains focus, so a
// `git checkout` in a shell updates the tree without an fs-watch.
export function refreshAllGitInfo(): void {
  for (const cwd of dirOrder) loadGitInfo(cwd)
}

function touchDir(cwd: string): void {
  if (!dirOrder.includes(cwd)) dirOrder.push(cwd)
  if (!dirColors[cwd]) dirColors[cwd] = DOT_COLORS[colorIndex++ % DOT_COLORS.length].hex
  loadGitInfo(cwd)
}

// A cwd's tower group key: its repo (all worktrees of a repo share it) when
// it's a git repo, else the cwd itself (a plain, flat folder). The one key used
// for clustering, ordering (moveGroup), and color.
export function groupKeyOf(cwd: string): string {
  const info = gitInfo[cwd]
  return info?.isRepo ? info.repoRoot : cwd
}

// Recolor a whole group. For a repo that writes every worktree cwd, so the
// header stripe (which reads the primary worktree's color) stays put even as
// the primary changes; for a plain folder the group key IS the cwd.
export function setGroupColor(groupKey: string, hex: string): void {
  const cwds = dirOrder.filter((cwd) => groupKeyOf(cwd) === groupKey)
  if (cwds.length === 0) dirColors[groupKey] = hex
  for (const cwd of cwds) dirColors[cwd] = hex
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

// Claude Code's animated title spinner: the asterisk churn (✳ ✶ ✻ …) it
// originally used PLUS the braille frames (⠀-⣿) newer builds also cycle
// through — both observed in the spinner-status probe. Shared so cleanTitle
// (strip it from the name) and hasSpinner (detect it for status) never drift.
const SPINNER_LEAD = /^[✳✶✻✽·∴※+*●○◐◑⠀-⣿]+\s*/u

// Whether a raw terminal title carries the working spinner — i.e. Claude is
// processing. The OS/ConPTY process title ("claude") and a settled name have no
// leading spinner glyph, so this cleanly picks out the "busy" title frames.
export function hasSpinner(title: string): boolean {
  return SPINNER_LEAD.test(title)
}

// Claude Code prefixes titles with the spinner above while it works; Git Bash
// prefixes the cwd with the MSYS system name (MINGW64:). Strip both — the tower
// wants the conversation name / the path, nothing else.
export function cleanTitle(title: string): string {
  return title
    .replace(SPINNER_LEAD, '')
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
  worktree?: string
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
    spawnWorktree: init.worktree ?? null,
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

// Windows paths compare case-insensitively and arrive with either separator
// (the folder picker uses backslashes; git and hook payloads may not) — one
// dir, several spellings. Used wherever a path from a new source meets the
// cwds we already hold, so the tower never grows a duplicate group.
export function sameDir(a: string, b: string): boolean {
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

// dir given: spawn there (group header + buttons). No dir: OS folder picker.
// worktree set (repo cards only): spawn claude with --worktree <name> ('' =
// auto-name) — Claude Code creates and enters the worktree; the hook stream
// then re-points the session's cwd to it (applyStatus).
export async function newSession(
  type: 'shell' | 'claude',
  dir?: string,
  worktree?: string
): Promise<void> {
  const picked = dir ?? (await window.arc.pickFolder())
  if (!picked) return
  // Prefer the spelling dirOrder already holds (git reports forward slashes,
  // the picker backslashes) — a second spelling would be a second group.
  const cwd = dirOrder.find((d) => sameDir(d, picked)) ?? picked
  touchDir(cwd)
  touchRecent(cwd)
  const session = createSession({ type, cwd, worktree })
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

// The PTY reports the directory it actually started in (a dead requested cwd
// is a spawn error now, not a fallback — but the echo keeps the invariant
// that every session's cwd has a directory group, whatever main decides).
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
export function applyStatus(
  hookToken: string,
  claudeSessionId: string,
  event: HookEvent,
  cwd?: string
): void {
  const session = sessions.find((s) => s.hookToken === hookToken)
  if (!session || session.status === 'exited') return
  if (claudeSessionId && session.claudeSessionId !== claudeSessionId) {
    switchClaudeSession(session, claudeSessionId)
  }
  // A --worktree spawn's PTY starts at the repo root, but the session lives in
  // the worktree Claude creates — the payload's cwd is the truth, so follow it
  // (the spawn-echo sibling is applySpawnCwd, the conversation-id sibling is
  // the /clear follow above). The reactive cwd re-groups the tower row; an
  // open Preview re-arms on the change and main's transcript watch re-points
  // a tail whose path changed, so nothing else needs telling.
  if (cwd && !sameDir(session.cwd, cwd)) {
    session.cwd = cwd
    touchDir(cwd)
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
  // 0x03 is Ctrl+C — an unambiguous interrupt/cancel, so idle from either
  // active state. A lone ESC byte is the Esc key (arrows etc. arrive as longer
  // 0x1b-prefixed chunks).
  if (data === '\x03') {
    if (session.status === 'running' || session.status === 'waiting') setStatus(session, 'idle')
  } else if (data === '\x1b') {
    // Esc dismisses an open dialog (waiting → idle). While RUNNING it is
    // ambiguous — it ALSO just closes the slash-command menu / /btw overlay
    // without stopping the turn (issue #6), and sends the same lone 0x1b, so it
    // must NOT green a busy Claude. Ctrl+C remains the way to interrupt-to-idle.
    if (session.status === 'waiting') setStatus(session, 'idle')
  } else if (data === '\r' && session.status === 'waiting') {
    // Enter answers the dialog — approve and deny-with-feedback both resume the turn.
    setStatus(session, 'running')
  }
}

// The terminal-title spinner is the one signal that survives a user interrupt:
// Claude animates the title while a turn runs and stops when it ends — but NO
// hook fires on an Esc/Ctrl+C interrupt (verified — the spinner-status probe),
// and a lone Esc mid-turn is ambiguous with closing the /btw menu (issue #6).
// So watch the RUNNING turn's spinner: every spinner-bearing title re-arms a
// decay; when frames stop for SPINNER_IDLE_MS the turn ended (completed OR
// interrupted) → idle. Scoped to `running` — the decay's own `running` guard
// leaves a `waiting` dialog (hook-owned, spinner already stopped) alone, and
// normal completion (Stop) / Ctrl+C (keystroke) still idle instantly; this is
// the ~1.2s-latency safety net for the hook-blind interrupt. The OS/ConPTY
// "claude" title has no spinner (hasSpinner), so the title's flap is ignored.
const SPINNER_IDLE_MS = 1200
const spinnerTimers = new Map<number, ReturnType<typeof setTimeout>>()

function clearSpinnerTimer(key: number): void {
  const timer = spinnerTimers.get(key)
  if (timer !== undefined) {
    clearTimeout(timer)
    spinnerTimers.delete(key)
  }
}

export function noteTitleForStatus(key: number, title: string): void {
  const session = sessions.find((s) => s.key === key)
  if (!session || session.type !== 'claude' || session.status !== 'running') return
  if (!hasSpinner(title)) return
  clearSpinnerTimer(key)
  spinnerTimers.set(
    key,
    setTimeout(() => {
      spinnerTimers.delete(key)
      const s = sessions.find((x) => x.key === key)
      if (s && s.status === 'running') setStatus(s, 'idle')
    }, SPINNER_IDLE_MS)
  )
}

// Mirrors WorktreeEntry in src/main/git.ts (the renderer can't import from
// main): one worktree as `git worktree list` reports it.
export interface WorktreeEntry {
  path: string
  branch: string
  locked: boolean
}

// The reopen menu's model: the repo's worktrees that currently show no rows —
// a worktree with sessions is already in the tower, and the main checkout has
// the ordinary spawn buttons. Pure — unit-tested; App fetches the list on
// menu open and filters it through here.
export function parkedWorktrees(
  entries: WorktreeEntry[],
  repoRoot: string,
  activeCwds: string[]
): WorktreeEntry[] {
  return entries.filter(
    (e) => !sameDir(e.path, repoRoot) && !activeCwds.some((cwd) => sameDir(cwd, e.path))
  )
}

// How to reopen a parked worktree: a path under the repo's .claude/worktrees/
// returns its name — spawn via `--worktree <name>` so Claude Code re-attaches
// its cleanup lifecycle (probe-verified: reopening preserves committed work
// and ignores stale locks). Anything else (a hand-made or sibling worktree)
// returns null — plain spawn in that directory.
export function worktreeSpawnName(repoRoot: string, path: string): string | null {
  const prefix = `${repoRoot.replace(/\//g, '\\')}\\.claude\\worktrees\\`
  const normalized = path.replace(/\//g, '\\')
  if (!normalized.toLowerCase().startsWith(prefix.toLowerCase())) return null
  const rest = normalized.slice(prefix.length)
  return rest && !rest.includes('\\') ? rest : null
}

// Cluster the cwd order into the tower's top-level groups: repos gather all
// their worktree cwds, plain folders stand alone, all in first-appearance
// order. Pure — unit-tested; the component layers sessions and branch labels on
// top. A cwd whose git info hasn't landed yet clusters as a plain folder, then
// re-groups into its repo once loadGitInfo resolves.
export type CwdGroup =
  | { kind: 'plain'; key: string; cwd: string }
  | { kind: 'repo'; key: string; repoName: string; cwds: string[] }

export function groupCwds(
  order: string[],
  info: Record<string, GitInfo | null | undefined>
): CwdGroup[] {
  const groups: CwdGroup[] = []
  const byKey = new Map<string, CwdGroup>()
  for (const cwd of order) {
    const g = info[cwd]
    if (g?.isRepo) {
      let group = byKey.get(g.repoRoot)
      if (!group) {
        group = { kind: 'repo', key: g.repoRoot, repoName: g.repoName, cwds: [] }
        byKey.set(g.repoRoot, group)
        groups.push(group)
      }
      if (group.kind === 'repo') group.cwds.push(cwd)
    } else if (!byKey.has(cwd)) {
      const group: CwdGroup = { kind: 'plain', key: cwd, cwd }
      byKey.set(cwd, group)
      groups.push(group)
    }
  }
  return groups
}

// Reorder top-level groups: move the whole block of `fromKey`'s cwds before
// `beforeKey`'s first cwd (keeping a repo's worktrees contiguous). Works for
// both repo and plain groups — a plain group is a single-cwd block.
export function moveGroup(fromKey: string, beforeKey: string): void {
  if (fromKey === beforeKey) return
  const moving = dirOrder.filter((cwd) => groupKeyOf(cwd) === fromKey)
  if (moving.length === 0) return
  const rest = dirOrder.filter((cwd) => groupKeyOf(cwd) !== fromKey)
  const at = rest.findIndex((cwd) => groupKeyOf(cwd) === beforeKey)
  rest.splice(at === -1 ? rest.length : at, 0, ...moving)
  dirOrder.splice(0, dirOrder.length, ...rest)
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
  if (saved.collapsed) for (const key of saved.collapsed) collapsedGroups[key] = true
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
    // Keep only collapsed keys whose group is still alive (mirrors dirColors) —
    // group key is the repo/cwd key, so compare against each alive cwd's key.
    collapsed: Object.keys(collapsedGroups).filter(
      (key) => collapsedGroups[key] && alive.some((s) => groupKeyOf(s.cwd) === key)
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
  clearSpinnerTimer(key)
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
