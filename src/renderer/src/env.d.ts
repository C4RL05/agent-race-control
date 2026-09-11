/// <reference types="svelte" />
/// <reference types="vite/client" />

// Shape persisted to the state JSON in userData. Pre-1.0 no-compat policy:
// a schema change bumps version and older files are discarded on load.
interface PersistedState {
  version: 2
  mode: 'system' | 'light' | 'dark'
  // Optional/additive — absent means false, so it needs no version bump
  // (the no-compat policy governs breaking changes, not compatible ones).
  statusRgb?: boolean
  // Draw the status dot at all. The one toggle whose default is ON, so absent
  // must read as true (see restoreState).
  statusDot?: boolean
  // Paint a row title's leading glyph by which glyph it is.
  glyphColor?: boolean
  // Which technique colours the status dot. Absent → 'hooks', the default.
  statusSource?: 'hooks' | 'screen'
  // How the tower's cards paint: how much colour the selected card's wash
  // carries, how much the rest carry, and which colour edge they wear. Absent →
  // 0.5 / 0.1 / 'tab'. All three are validated on restore rather than trusted —
  // the washes feed color-mix.
  cardWash?: 0.1 | 0.5 | 1
  cardWashRest?: 0 | 0.1 | 0.5 | 1
  cardEdge?: 'tab' | 'outline' | 'none'
  // Light mode only: paint the selected card with the DARK palette's ground and
  // text. Absent → false.
  cardDark?: boolean
  // Selected font ids (see theme.ts FONTS/UI_FONTS). Absent → the default.
  font?: string
  uiFont?: string
  previewFont?: string
  towerWidth?: number
  focusedIndex: number
  dirOrder?: string[]
  dirColors?: Record<string, string>
  // Group keys whose card is collapsed to its title (issue #5). Additive/
  // optional; a stale key (group gone) is harmless — it just never matches.
  collapsed?: string[]
  // Group keys whose ARCHIVE section is unfolded — the inverse sense of
  // `collapsed` above, because an archive folds by default (see the store).
  // Additive/optional; a stale key is harmless.
  expandedArchives?: string[]
  // Per-pane text zoom STEPS (see the store's paneZoom), each a half of a
  // window-zoom level. Additive/optional and written only for panes the user
  // moved off 0; an unknown key is ignored on restore, and the value is
  // clamped there rather than trusted.
  paneZoom?: Record<string, number>
  recentDirs?: string[]
  sessions: Array<{
    type: 'shell' | 'claude' | 'codex'
    name: string
    cwd: string
    claudeSessionId: string | null
    // Cosmetic TODO flag (issue #3) — additive/optional, absent → false.
    todo?: boolean
    // Cosmetic archive flag — additive/optional, and written only when true
    // (absent → the row is not archived).
    archived?: boolean
    // Pending --worktree spawn still awaiting its hook cwd-follow (named
    // only) — additive/optional; restore re-arms the flag.
    spawnWorktree?: string | null
    // The Notes tab's text — additive/optional, and written only when the
    // user typed something (absent → an empty editor).
    notes?: string
  }>
}

// One entry of the read-only conversation preview. Hand-copied from
// src/main/transcript.ts (the exported source of truth, which preload
// imports directly): the renderer program deliberately excludes node types,
// so it cannot import from main — keep this copy in sync by hand.
type PreviewItem = { kind: 'user'; text: string } | { kind: 'assistant'; text: string }

// Read-only git info for the tower's repo→branch tree — hand-copied from
// src/main/git.ts (GitInfo), same can't-import-from-main reason as PreviewItem.
type GitInfo = {
  isRepo: boolean
  repoRoot: string
  repoName: string
  worktreeName: string
  branch: string
  // Branch state markers: dirty tree + ahead/behind vs base ('' = none).
  dirty: boolean
  ahead: number
  behind: number
  base: string
}

// One worktree from `git worktree list` (reopen menu) — hand-copied from
// src/main/git.ts (WorktreeEntry), same reason.
type WorktreeEntry = {
  path: string
  branch: string
  locked: boolean
}

// Everything knowable about one running Claude session, for the pane's Session
// tab — hand-copied from src/main/sessioninfo.ts, same can't-import-from-main
// reason as PreviewItem. Both underlying formats are Claude Code internals, so
// every field is best-effort: '' / null means "not known", never an error.
type LiveSession = {
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

type TranscriptFacts = {
  aiTitle: string
  slug: string
  mode: string
  permissionMode: string
  model: string
  effort: string
  version: string
  gitBranch: string
  turns: number
  lastTurnMs: number | null
  messageCount: number | null
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
  queued: number
  subagentsStarted: number
  subagentsOpen: number
  shellsStarted: number
  shellsOpen: number
  lastHooks: Array<{ command: string; durationMs: number }>
  hookErrors: number
  lastEntryAt: string
}

type SessionInfo = {
  live: LiveSession | null
  facts: TranscriptFacts | null
  transcriptPath: string
  transcriptBytes: number | null
}

// The preload contextBridge API — the renderer's only window into main.
interface Window {
  arc: {
    electronVersion: string
    pickFolder: () => Promise<string | null>
    openInExplorer: (path: string) => void
    getPathForFile: (file: File) => string
    setAppIcon: (representations: Array<{ scaleFactor: number; dataURL: string }>) => void
    state: {
      load: () => Promise<PersistedState | null>
      save: (state: PersistedState) => void
    }
    git: {
      info: (cwd: string) => Promise<GitInfo>
      worktrees: (repoRoot: string) => Promise<WorktreeEntry[]>
    }
    pty: {
      spawn: (opts: {
        cols: number
        rows: number
        type?: 'shell' | 'claude' | 'codex'
        cwd?: string
        resume?: string
        // Spawn claude with --worktree: Claude Code creates-and-enters a fresh
        // git worktree ('' = auto-name). The app never runs the git itself.
        worktree?: string
      }) => Promise<{ id: string; claudeSessionId?: string; cwd: string } | { error: string }>
      write: (id: string, data: string) => void
      resize: (id: string, cols: number, rows: number) => void
      kill: (id: string) => void
      onData: (callback: (id: string, data: string) => void) => () => void
      onSession: (
        callback: (id: string, sessionId: string, name: string | null) => void
      ) => () => void
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
    transcript: {
      // watch arms the session's persistent tail; unwatch only disarms it
      // (byte offset survives); drop forgets it — the session closed.
      watch: (sessionId: string, cwd: string, kind?: 'claude' | 'codex') => void
      unwatch: (sessionId: string) => void
      drop: (sessionId: string) => void
      onItems: (
        callback: (sessionId: string, items: PreviewItem[], reset: boolean) => void
      ) => () => void
    }
    // Everything knowable about one session, for the Session tab
    // (src/main/sessioninfo.ts). PULL, not push: main computes nothing unless
    // an open tab asks, and nothing it returns ever colours the status dot.
    info: {
      get: (opts: { sessionId: string; cwd: string; pid: number | null }) => Promise<SessionInfo>
    }
    // Turn-boundary hooks (HookEvent in src/main/status.ts, hand-copied — the
    // renderer can't import from main). hookToken is the session's stable spawn
    // id; claudeSessionId is the payload's CURRENT conversation id, which
    // changes on `/clear`; cwd is how a --worktree session's real directory
    // reaches the tower. These are what colour the dot red/amber — the poll
    // below cannot (see applyAgents).
    status: {
      onChange: (
        callback: (
          hookToken: string,
          claudeSessionId: string,
          event:
            | 'UserPromptSubmit'
            | 'PermissionRequest'
            | 'Notification'
            | 'Stop'
            | 'StopFailure'
            | 'SubagentStart'
            | 'SubagentStop',
          cwd: string
        ) => void
      ) => () => void
    }
    // Ctrl+=/−/0 fired in main, which owns the window zoom. The per-pane zoom
    // levels are offsets on top of it, so this is the cue to reset them.
    zoom: {
      onSync: (callback: () => void) => () => void
    }
    // One tick of `claude agents --json` (src/main/agents.ts, hand-copied —
    // the renderer can't import from main): EVERY active session on the
    // machine, not just ours. Each entry carries the session's live `status`,
    // its CURRENT conversation id (`sessionId` changes on `/clear`) and its
    // real `cwd` (how a --worktree session's directory reaches the tower).
    // applyAgents matches the sessions we own and ignores the rest — and uses
    // only `idle` for the dot, because `busy` here includes a finished turn that
    // still owns a background shell.
    agents: {
      onUpdate: (
        callback: (
          entries: Array<{
            sessionId?: string
            pid?: number
            status?: string
            cwd?: string
            kind?: string
            startedAt?: number
          }>
        ) => void
      ) => () => void
    }
  }
}
