import { DOT_COLORS, DEFAULT_FONT_ID, DEFAULT_UI_FONT_ID, type Mode } from './theme'
import type { ScreenState } from './screen'

// Read-only branch/worktree facts for the tower's repo→branch tree (issue #5),
// fetched from main (window.arc.git) and cached per cwd in `gitInfo`. Mirrors
// GitInfo in src/main/git.ts (the renderer can't import from main).
export interface GitInfo {
  isRepo: boolean
  repoRoot: string
  repoName: string
  worktreeName: string
  branch: string
  // Branch state markers ("safe to merge/close?"): uncommitted/untracked
  // changes, and ahead/behind counts vs `base` ('' = no comparison).
  dirty: boolean
  ahead: number
  behind: number
  base: string
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
  // delegating = the MAIN turn has ended but subagents are still working: the
  // same amber as waiting, without the pulse (the pulse stays reserved for
  // "it wants you", the only state that should catch your eye).
  status: 'running' | 'waiting' | 'delegating' | 'idle' | 'exited'
  // Live terminal title (OSC 0/2) — Claude Code keeps it set to the
  // conversation's name; Git Bash sets it to the cwd. Observation only.
  title: string
  ptyId: string | null
  // The session's CURRENT Claude conversation id — the pinned spawn id, but
  // Claude Code mints a fresh one on `/clear`, so each agent poll re-points it
  // (see applyAgents). Owns the transcript file the preview tails and the id
  // resumed on restart.
  claudeSessionId: string | null
  // Immutable per-session hook routing token (== the spawn id). Hooks route on
  // this even after `/clear` changes claudeSessionId, so a turn boundary is
  // always attributed to the right session.
  hookToken: string | null
  // The claude.exe pid currently running this conversation, learned from the
  // agent poll. The FALLBACK handle, not the primary one: `/clear` mints a new
  // conversation id without restarting the process, so the pid is what carries
  // the row across it — but parking moves the conversation to a different
  // process entirely, so the id wins when both are on offer (see findEntry).
  // Not persisted — a live fact, and it can change mid-session.
  // (The PTY's own pid is useless here: claude is its grandchild.)
  claudePid: number | null
  // The polled `startedAt` for that pid, kept only to defeat Windows pid reuse —
  // a recycled pid belonging to some other claude has a different start time.
  claudeStartedAt: number | null
  // How many subagents this session has in flight, counted from
  // SubagentStart/SubagentStop. Decides whether the end of a MAIN turn lands on
  // `delegating` or `idle`. Live runtime state like claudePid — never persisted,
  // and self-healing: the poll zeroes it whenever the CLI confirms the session
  // has nothing running at all.
  subagentCount: number
  // A turn the hooks have opened and not yet closed: UserPromptSubmit sets it,
  // Stop/StopFailure (and a Ctrl+C interrupt) clear it. This is what lets the
  // poll's `busy` mean something: on its own it cannot tell an agent from a
  // background shell, but while a turn is KNOWN to be open it corroborates
  // rather than guesses. See applyAgents.
  turnOpen: boolean
  // Consecutive `idle` samples from the poll, counted since the turn opened
  // (UserPromptSubmit zeroes it). One is not evidence a turn ended — a single
  // transient idle mid-turn used to green the dot for the rest of that turn,
  // because red only ever comes from UserPromptSubmit and that had already been
  // spent.
  idleTicks: number
  // Pure observation, for the Session tab — none of these feed the dot.
  // When the CURRENT status was set (setStatus). A dot stuck on the wrong
  // colour is only diagnosable if you can see how long it has been stuck.
  statusSince: number
  // The last turn-boundary hook this session received, and when. Makes the
  // otherwise invisible hook channel visible — including SubagentStart/Stop,
  // whose firing the tower currently takes on faith.
  lastHook: HookEvent | null
  lastHookAt: number | null
  // The last raw `claude agents --json` entry that matched this session. Kept
  // verbatim: its `status` is the one the tower deliberately ignores for red
  // and amber, and seeing it disagree with our dot is the point of the tab.
  agentEntry: AgentEntry | null
  agentEntryAt: number | null
  // Set on sessions restored from the state JSON: spawn with --resume.
  resumeId: string | null
  // Set on sessions the repo card spawns into a fresh worktree: pass
  // --worktree <name> ('' = let Claude auto-name) at spawn. PENDING state —
  // while set, the tower parks the row on a synthetic branch row for the
  // destination; the first agent poll's cwd adopts and clears it (the real
  // row takes over). Persisted only while pending and named, so a parked
  // never-prompted session survives restart and re-arms --worktree.
  spawnWorktree: string | null
  // Which pane tab is showing: the live terminal, the read-only conversation
  // preview, the session inspector, or the notes scratchpad (the last three
  // are Claude sessions only). Transient — not persisted.
  view: 'terminal' | 'preview' | 'info' | 'notes'
  // Free text the user keeps about this session (the Notes tab). Plain text,
  // no format, no file of its own — it persists as a field on the session in
  // the state JSON, so it survives a restart and dies when the row is closed,
  // exactly like the row's other remembered facts.
  notes: string
  // Cosmetic "revisit later" flag overlaid on the status dot (both types).
  // Purely visual — no effect on sorting/focus/logic. Persisted so it survives
  // restart; auto-cleared when the underlying status changes color (setStatus).
  todo: boolean
  // A relaunch is in flight: the kill has been sent and this row is waiting for
  // its own PTY's exit before the resumed spawn goes up (relaunchSession).
  // Transient by nature — it lives for the length of one process death.
  relaunching: boolean
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
  // Settings toggle: draw the status dot at all. On by default — turning it
  // off leaves the rows text-only (and takes the TODO toggle with it, the
  // dot being its only affordance).
  statusDot: boolean
  // Settings toggle: paint the leading glyph of a row's title by which glyph
  // it is (see glyphLead) — nothing to do with the dot's status colors.
  // Off by default.
  glyphColor: boolean
  // WHICH TECHNIQUE COLOURS THE DOT. 'hooks' is the default and the documented
  // one: turn-boundary hooks with the agent poll as a green floor. 'screen'
  // hands the dot to the screen scan instead (screen.ts) — one technique at a
  // time, deliberately, so a disagreement between them can never be something
  // the user has to untangle by eye.
  statusSource: 'hooks' | 'screen'
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
  statusDot: true,
  glyphColor: false,
  statusSource: 'hooks',
  font: DEFAULT_FONT_ID,
  uiFont: DEFAULT_UI_FONT_ID,
  previewFont: DEFAULT_UI_FONT_ID
})

// Claude Code's animated title spinner: the asterisk churn (✳ ✶ ✻ …) it
// originally used PLUS the braille frames (⠀-⣿) newer builds also cycle
// through. Cosmetic only — status no longer reads the title at all (it is
// polled, see applyAgents).
const SPINNER_LEAD = /^[✳✶✻✽·∴※+*●○◐◑⠀-⣿]+\s*/u

// The two families a leading title glyph can belong to, for the "Color title
// glyph" setting: Claude's asterisk/star churn and its circle frames. The
// glyph alone decides the color — this reads nothing about session status, and
// borrows none of the dot palette. Anything else (braille frames, a shell
// title, a user label) classifies as null and renders in the row's own ink.
const GLYPH_FAMILIES = [
  { family: 'star', match: /^[✳✶✻✽✢✱∗※∴*+]+/u },
  { family: 'circle', match: /^[●○◐◑◒◓◔◕]+/u }
] as const

export type GlyphLead = { glyph: string; family: 'star' | 'circle' }

// Split a row label into its leading glyph run and the rest. The FIRST
// character picks the family; the run is every following character from that
// same family, so a multi-frame lead ("✻✶ churning") paints as one glyph
// rather than half-colored. Null when the label doesn't start with one.
export function glyphLead(label: string): GlyphLead | null {
  for (const { family, match } of GLYPH_FAMILIES) {
    const hit = match.exec(label)
    if (hit) return { glyph: hit[0], family }
  }
  return null
}

// Git Bash prefixes the cwd with the MSYS system name (MINGW64:). That is the
// terminal describing itself, not the session, so it comes off everywhere.
const MSYS_LEAD = /^(MINGW64|MINGW32|MSYS|UCRT64|CLANG64|CLANGARM64):\s*/

// What the TOWER shows: the live terminal title with only the MSYS prefix off.
// Claude Code's spinner survives on purpose — a row then reads exactly what the
// Session tab's "Terminal title" reads, churn included. No session-type branch
// needed: a shell never emits the spinner, Claude never emits MINGW64:.
export function towerTitle(title: string): string {
  return title.replace(MSYS_LEAD, '')
}

// The same title read as a NAME — spinner frames off as well. For the places a
// title is proposed as one (the rename prefill, which types it into a live
// session) or matched as one, all of which want the stable string rather than
// whichever frame was current.
export function cleanTitle(title: string): string {
  return title.replace(SPINNER_LEAD, '').replace(MSYS_LEAD, '')
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
    claudePid: null,
    claudeStartedAt: null,
    subagentCount: 0,
    turnOpen: false,
    idleTicks: 0,
    statusSince: Date.now(),
    lastHook: null,
    lastHookAt: null,
    agentEntry: null,
    agentEntryAt: null,
    resumeId: init.resumeId ?? null,
    spawnWorktree: init.worktree ?? null,
    view: 'terminal',
    todo: false,
    notes: '',
    relaunching: false
  }
}

// The single choke point for status changes — every path that moves a session's
// status (the agent poll, exit) goes through here so the cosmetic
// TODO flag can auto-clear "the next time the underlying status changes color"
// (issue #3). Each status maps to a distinct dot color, so a value change IS a
// color change; restore sets status/todo directly (not via here) so a relaunch
// never counts as the clearing change.
export function setStatus(session: Session, next: Session['status']): void {
  if (session.todo && next !== session.status) session.todo = false
  // A turn just ended — the files likely changed with it, and idle is exactly
  // when "safe to merge/close?" gets asked, so refresh this cwd's branch
  // state (observation-driven cadence; window focus covers everything else,
  // no polling). Deliberately NOT on exited: after Claude's worktree cleanup
  // the dir is gone, and a refresh would flip the row into a plain folder.
  if (next === 'idle' && next !== session.status) loadGitInfo(session.cwd)
  // Stamped only on a real change, so the Session tab's "age in status" reads
  // how long the dot has been THIS colour, not how long since the last tick
  // re-asserted it.
  if (next !== session.status) session.statusSince = Date.now()
  session.status = next
}

// Status writes that belong to the DEFAULT technique. When the screen scan owns
// the dot instead, the hooks and the poll keep every bit of their bookkeeping —
// following a `/clear` to its new conversation id, adopting a spawned worktree's
// cwd, tracking the claude pid, retaining the raw entry the Session tab reads —
// and only stop painting. Two techniques writing one dot is the disagreement the
// status rewrite spent three attempts removing; it is not coming back as a
// setting.
function setStatusFromHooks(session: Session, next: Session['status']): void {
  if (ui.statusSource !== 'hooks') return
  setStatus(session, next)
}

// The screen scan's verdict for one session (Terminal.svelte hands it over on a
// debounce). Null never reaches here — the scanner drops "no opinion" so the dot
// simply holds, which is how a TUI change degrades: a stale colour, not a wrong
// one. An exited row is final, and a shell has no screen state to read.
export function applyScreen(key: number, state: ScreenState): void {
  if (ui.statusSource !== 'screen') return
  const session = sessions.find((s) => s.key === key)
  if (!session || session.type !== 'claude' || session.status === 'exited') return
  setStatus(session, state)
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
// (the folder picker uses backslashes; git and agent entries may not) — one
// dir, several spellings. Used wherever a path from a new source meets the
// cwds we already hold, so the tower never grows a duplicate group.
export function sameDir(a: string, b: string): boolean {
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

// dir given: spawn there (group header + buttons). No dir: OS folder picker.
// worktree set (repo cards only): spawn claude with --worktree <name> ('' =
// auto-name) — Claude Code creates and enters the worktree; the agent poll
// then re-points the session's cwd to it (applyAgents).
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

// Mirrors AgentEntry in src/main/agents.ts (the renderer can't import from main).
export interface AgentEntry {
  sessionId?: string
  pid?: number
  status?: string
  cwd?: string
  kind?: string
  startedAt?: number
}

// `/clear` (and an in-TUI `/resume`) makes Claude Code mint a new conversation
// id + transcript file mid-session. The poll follows the claude PID, which does
// NOT change, so we still find the session; when the entry's id diverges from
// the one we hold, follow it — adopt the new id, forget the old transcript tail
// and preview cache, and let the Preview's watch re-point (its sessionId prop
// is this id). Without this the preview froze on the pre-clear conversation
// (issue #2).
function switchClaudeSession(session: Session, nextId: string): void {
  const prev = session.claudeSessionId
  if (prev) {
    delete previewItems[prev]
    // window is absent in the unit-test env; the store is otherwise pure.
    globalThis.window?.arc?.transcript.drop(prev)
  }
  session.claudeSessionId = nextId
  // A new conversation inherits no open turn from the old one.
  session.turnOpen = false
  session.idleTicks = 0
}

// How many consecutive `idle` samples end a turn the hooks opened. The poll runs
// about once a second, so this is ~3s of the CLI holding idle before the floor
// overrides an open turn — long enough that a single blink cannot green a
// working session, short enough that a missed Stop still self-heals quickly.
// One sample is still enough when no turn is open, which is the common case.
const IDLE_TICKS_TO_END_TURN = 3

// Mirrors HookEvent in src/main/status.ts (the renderer can't import from main).
export type HookEvent =
  | 'UserPromptSubmit'
  | 'PermissionRequest'
  | 'Notification'
  | 'Stop'
  | 'StopFailure'
  | 'SubagentStart'
  | 'SubagentStop'

// Where a session lands when its MAIN turn ends: still delegating if subagents
// are working, otherwise your turn.
function statusAfterTurn(session: Session): Session['status'] {
  return session.subagentCount > 0 ? 'delegating' : 'idle'
}

// The turn-boundary half. Hooks are the ONLY source that distinguishes "the
// agent is driving" from "this session merely has something running" — the poll
// cannot (it reports busy for a finished turn holding a background shell), which
// is why red and amber are decided here and nowhere else.
//
// A busy main agent always wins: UserPromptSubmit paints red regardless of how
// many subagents are in flight, so `delegating` can only ever appear after the
// main turn ends. `PostToolUse` is deliberately not subscribed (see status.ts) —
// turn start and end are the only edges the dot needs.
export function applyHook(
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
  // A --worktree spawn's PTY starts at the repo root but the session lives in
  // the worktree Claude creates; the payload's cwd is the truth (the poll's
  // sibling path is applyAgents, the spawn-echo one applySpawnCwd).
  if (cwd && !sameDir(session.cwd, cwd)) {
    session.cwd = cwd
    session.spawnWorktree = null
    touchDir(cwd)
  }
  session.lastHook = event
  session.lastHookAt = Date.now()
  switch (event) {
    case 'UserPromptSubmit':
      session.turnOpen = true
      // The idle streak counts from HERE, or the floor's debounce is a fiction:
      // a session sitting at its prompt (the normal way to start a turn) has
      // been idle for minutes, so a counter carried across the boundary is
      // already past the threshold and the first idle sample of the new turn —
      // one that merely beat the CLI's flip to `busy` — would close the turn
      // the guard was written to protect.
      session.idleTicks = 0
      setStatusFromHooks(session, 'running')
      break
    case 'PermissionRequest':
    case 'Notification':
      setStatusFromHooks(session, 'waiting')
      break
    // Both ends of a turn: Stop is the normal one, StopFailure is an API error —
    // which fires NO Stop, so without it the dot would stay red forever.
    case 'Stop':
    case 'StopFailure':
      session.turnOpen = false
      setStatusFromHooks(session, statusAfterTurn(session))
      break
    case 'SubagentStart':
      session.subagentCount += 1
      break
    case 'SubagentStop': {
      session.subagentCount = Math.max(0, session.subagentCount - 1)
      // The last subagent finishing ends the delegation — but never touch a red
      // or amber dot: the main agent is driving or asking, and that outranks it.
      if (session.status === 'delegating' && session.subagentCount === 0) {
        setStatusFromHooks(session, 'idle')
      }
      break
    }
  }
}

// Which polled entry is this session? THE CONVERSATION FIRST, the process
// second — because a tower row is a conversation, and a conversation does not
// always stay in the process we spawned it in.
//
// Measured 2026-08-21: parking a session ("moved to the background from this
// window") hands its conversation to a NEW claude process — a `kind: background`
// entry with its own pid, carrying the conversation's id — while the interactive
// process we spawned stays alive and reports `idle` for as long as it is parked.
// Matching pid-first pinned the row to that idle husk, so the floor greened a
// session that was working and no `busy` could ever restore red.
//
// The pid stays as the fallback, and is still load-bearing: `/clear` mints a new
// conversation id in the SAME process and nothing announces it until the next
// hook, so an entry carrying an id we have never seen, on the pid we know, is
// that clear — and applyAgents adopts the new id off it.
function findEntry(session: Session, entries: AgentEntry[]): AgentEntry | undefined {
  const byConversation = session.claudeSessionId
    ? entries.find((entry) => entry.sessionId === session.claudeSessionId)
    : undefined
  if (byConversation) return byConversation
  if (session.claudePid === null) return undefined
  return entries.find(
    (entry) =>
      entry.pid === session.claudePid &&
      // Windows recycles pids, so a known pid must also match the start time
      // recorded with it — a recycled one belongs to some other claude.
      (session.claudeStartedAt === null ||
        entry.startedAt === undefined ||
        entry.startedAt === session.claudeStartedAt)
  )
}

// One tick of `claude agents --json`: every session on the machine, as a LEVEL
// rather than an event. Its job here is narrow and deliberately lopsided.
//
// `idle` is trusted absolutely: it means the CLI sees nothing running in that
// session at all — no turn, no tool, no subagent, no shell — so it forces green
// and zeroes the subagent count. That is the self-healing floor, and it is what
// hooks alone never had: a missed `Stop`, or an interrupt (which fires no hook
// whatsoever), can no longer leave a dot red until the next prompt.
//
// `busy` and `waiting` are IGNORED for the dot. Measured, not assumed: a session
// whose turn has ended but which still owns a background shell reports `busy`
// indefinitely (90/90 samples over 205s), and shells are not "the agent is
// driving". The poll cannot tell the two apart — the entry carries no shell or
// agent count — so it must never paint red or amber. Hooks own those.
//
// The entry's identity fields are used unconditionally though: `sessionId`
// follows a `/clear` to the new transcript, `cwd` is how a `--worktree`
// session's real directory reaches the tower, and `pid` follows a parked
// conversation into the background process now running it (findEntry).
export function applyAgents(entries: AgentEntry[]): void {
  for (const session of sessions) {
    if (session.type !== 'claude' || session.status === 'exited') continue
    // A session with neither handle yet (spawned, first poll not matched) can't
    // be identified — skip rather than match something else by accident.
    if (session.claudePid === null && !session.claudeSessionId) continue

    const entry = findEntry(session, entries)
    if (!entry) continue
    // Kept verbatim for the Session tab before anything is read off it — the
    // raw `busy` this channel reports is exactly what the dot refuses to use.
    session.agentEntry = entry
    session.agentEntryAt = Date.now()

    // Follow the conversation onto whatever process is running it: this pid
    // carries the row across a `/clear` (same process, new id), and adopting a
    // background job's pid is how the row leaves the husk it was parked out of.
    if (entry.pid !== undefined) {
      session.claudePid = entry.pid
      session.claudeStartedAt = entry.startedAt ?? null
    }
    if (entry.sessionId && session.claudeSessionId !== entry.sessionId) {
      switchClaudeSession(session, entry.sessionId)
    }
    // A --worktree spawn's PTY starts at the repo root, but the session lives
    // in the worktree Claude creates — the entry's cwd is the truth, so follow
    // it (the spawn-echo sibling is applySpawnCwd). The reactive cwd re-groups
    // the tower row; an open Preview re-arms on the change and main's
    // transcript watch re-points a tail whose path changed. Adoption also
    // retires the pending spawnWorktree flag: the synthetic parked row hands
    // over to the real one.
    if (entry.cwd && !sameDir(session.cwd, entry.cwd)) {
      session.cwd = entry.cwd
      session.spawnWorktree = null
      touchDir(entry.cwd)
    }
    // The floor. `idle` still greens and `busy` still cannot paint red on its
    // own, but neither is applied blind any more.
    if (entry.status === 'idle') {
      session.idleTicks += 1
      // One idle sample is not proof a turn ended. Measured in the field: a
      // single transient idle landed mid-turn, forced green, and the dot stayed
      // green for the remaining 14 minutes of that turn — red comes only from
      // UserPromptSubmit, which that turn had already spent. So while a turn is
      // open the floor has to see the CLI HOLD idle, not blink it.
      if (!session.turnOpen || session.idleTicks >= IDLE_TICKS_TO_END_TURN) {
        session.subagentCount = 0
        session.turnOpen = false
        setStatusFromHooks(session, 'idle')
      }
    } else {
      session.idleTicks = 0
      // `busy` stays untrusted as a general signal — it also describes a
      // finished turn still holding a background shell, which is not the agent
      // driving. But when the hooks say a turn is OPEN and the dot is somehow
      // green, both channels agree work is happening and the green is the thing
      // that must be wrong, so restore red. Amber and delegating are hook-owned
      // and left alone.
      if (session.turnOpen && entry.status === 'busy' && session.status === 'idle') {
        setStatusFromHooks(session, 'running')
      }
    }
  }
}

// The one piece of keystroke inference that survives, and only because no other
// channel covers it: NO hook fires on a user interrupt, and the poll's idle floor
// can't help when the session still owns a background shell (it reports busy
// forever, so the dot would sit red until the next prompt). Ctrl+C is the
// unambiguous cancel, so it greens immediately.
//
// Esc is deliberately NOT handled: the same lone 0x1b also closes the
// slash-command menu / `/btw` overlay without stopping the turn, so it would
// green a busy Claude — that is issue #6, and it stays fixed by not guessing.
// Observation only; the bytes pass through to the PTY untouched, and the next
// hook or poll tick overrules this.
export function nudgeStatusFromKey(key: number, data: string): void {
  const session = sessions.find((s) => s.key === key)
  if (!session || session.type !== 'claude' || session.status === 'exited') return
  if (data === '\x03' && session.status !== 'idle') {
    // An interrupt kills the main turn AND its subagents, so the count goes
    // too. The turn is as over as a Stop would have made it — without this the
    // poll's `busy` (a shell outliving the interrupt) would re-paint red.
    session.turnOpen = false
    session.subagentCount = 0
    setStatusFromHooks(session, 'idle')
  }
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

// Where a session's row is headed: a pending worktree spawn counts as its
// destination — so the reopen menu doesn't offer a worktree that's already
// being reopened, even though the poll hasn't confirmed the move yet.
export function sessionTargetCwd(session: Session): string {
  return session.spawnWorktree
    ? `${session.cwd}/.claude/worktrees/${session.spawnWorktree}`
    : session.cwd
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
  // Absent → the default, which for the dot is ON (unlike the other two).
  ui.statusDot = saved.statusDot ?? true
  ui.glyphColor = saved.glyphColor ?? false
  ui.statusSource = saved.statusSource ?? 'hooks'
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
      resumeId: s.type === 'claude' ? s.claudeSessionId : null,
      // A parked never-prompted worktree spawn re-arms --worktree; adoption
      // cleared the flag for established sessions, so it never double-passes.
      worktree: (s.type === 'claude' && s.spawnWorktree) || undefined
    })
    // Restore the TODO flag directly (not via setStatus) — the spawn's status
    // defaults must not count as the color change that would clear it.
    restored.todo = s.todo ?? false
    // Absent for every session written before the Notes tab existed, and for
    // every session whose notes are empty (see snapshotState).
    restored.notes = s.notes ?? ''
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
    statusDot: ui.statusDot,
    glyphColor: ui.glyphColor,
    statusSource: ui.statusSource,
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
      todo: s.todo,
      // An empty editor is not state — only text anyone actually typed is
      // written, so the file doesn't grow a `"notes": ""` per session.
      notes: s.notes || undefined,
      // Only a NAMED pending flag persists: restoring '' (auto-name) would
      // mint a second random worktree — the orphan stays visible in the
      // reopen menu instead.
      spawnWorktree: s.spawnWorktree || null
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

// Relaunch (row menu): end this session's Claude process and bring the SAME
// conversation back up in a fresh one. It is exactly what a restart already
// does to every row — createSession with a resumeId, the blessed `--resume`
// spawn — applied to one row on demand, so it adds no spawn-line deviation of
// its own. Claude Code has the same idea for its background sessions
// (`claude respawn`, "so it runs the current Claude Code version").
//
// Why it can't be a plain kill-and-swap in one flush: `claude --resume <id>`
// REFUSES while that id is still live. Verified on 2.1.261 —
//   Error: Session <id> is running as a background session (9b1f46e0). Run
//   `claude attach …` … or `claude stop …` first to resume it here. Add
//   --fork-session to branch off a copy instead.
// — and it resumed cleanly, same id, the moment the process was stopped. So the
// new spawn has to WAIT for the old process's death rather than race it. Two
// steps joined by the PTY's own exit event: arm here, swap in finishRelaunch.
export function relaunchSession(key: number): void {
  const session = sessions.find((s) => s.key === key)
  // No conversation id, nothing to resume — the menu hides the item in that
  // window (it lasts from spawn until the PTY answers, milliseconds).
  if (!session || session.type !== 'claude' || !session.claudeSessionId) return
  // Nothing alive to wait for: a spawn that errored, or a process that already
  // died. The conversation is still on disk, so go straight to the swap.
  if (session.status === 'exited' || !session.ptyId) {
    swapInRelaunch(session)
    return
  }
  session.relaunching = true
  // window is absent in the unit-test env; the store is otherwise pure.
  globalThis.window?.arc?.pty.kill(session.ptyId)
}

// A PTY reported its exit (App's onExited). Returns whether that exit was a
// relaunch's — in which case it is NOT the session ending, and the caller must
// not mark the row exited: `setStatus(_, 'exited')` would clear the TODO flag
// this row is about to carry across.
export function finishRelaunch(key: number): boolean {
  const session = sessions.find((s) => s.key === key)
  if (!session?.relaunching) return false
  swapInRelaunch(session)
  return true
}

// The swap itself: a new row, in the old row's place, resuming its conversation.
// A new key (so the keyed {#each} tears the old terminal down and mounts a fresh
// one) but the same row as far as the user is concerned — everything they put on
// it rides across. The preview cache and main's transcript tail are deliberately
// NOT dropped the way closeSession drops them: the conversation id is unchanged,
// so the tail is still the right tail and the resumed session appends to it.
function swapInRelaunch(session: Session): void {
  const index = sessions.indexOf(session)
  if (index === -1) return
  const next = createSession({
    type: 'claude',
    cwd: session.cwd,
    resumeId: session.claudeSessionId,
    // Mirrors restoreState: a NAMED pending worktree re-arms --worktree (a
    // resume with a transcript ignores it anyway), '' would mint a second
    // random one.
    worktree: session.spawnWorktree || undefined
  })
  // todo is set directly, not through setStatus — same rule restore follows, so
  // the fresh spawn's status defaults never count as the colour change that
  // clears the flag.
  next.todo = session.todo
  next.notes = session.notes
  next.view = session.view
  sessions.splice(index, 1, next)
  if (ui.focused === session.key) ui.focused = next.key
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
