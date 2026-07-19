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
  recentDirs?: string[]
  sessions: Array<{
    type: 'shell' | 'claude'
    name: string
    cwd: string
    claudeSessionId: string | null
    // Cosmetic TODO flag (issue #3) — additive/optional, absent → false.
    todo?: boolean
    // Pending --worktree spawn still awaiting its hook cwd-follow (named
    // only) — additive/optional; restore re-arms the flag.
    spawnWorktree?: string | null
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
}

// One worktree from `git worktree list` (reopen menu) — hand-copied from
// src/main/git.ts (WorktreeEntry), same reason.
type WorktreeEntry = {
  path: string
  branch: string
  locked: boolean
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
        type?: 'shell' | 'claude'
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
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
    transcript: {
      // watch arms the session's persistent tail; unwatch only disarms it
      // (byte offset survives); drop forgets it — the session closed.
      watch: (sessionId: string, cwd: string) => void
      unwatch: (sessionId: string) => void
      drop: (sessionId: string) => void
      onItems: (
        callback: (sessionId: string, items: PreviewItem[], reset: boolean) => void
      ) => () => void
    }
    // hookToken is the session's stable URL routing token (its spawn id);
    // claudeSessionId is the payload's CURRENT conversation id, which changes
    // on `/clear`. event is Claude Code's hook name (HookEvent in
    // src/main/status.ts, hand-copied — the renderer can't import from main);
    // cwd is the payload's working directory — how a --worktree session's real
    // cwd reaches the tower. applyStatus in sessions.svelte.ts maps each event
    // to a dot state and follows a changed conversation id / cwd.
    status: {
      onChange: (
        callback: (
          hookToken: string,
          claudeSessionId: string,
          event: 'UserPromptSubmit' | 'PostToolUse' | 'PermissionRequest' | 'Notification' | 'Stop',
          cwd: string
        ) => void
      ) => () => void
    }
  }
}
