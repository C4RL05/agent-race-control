/// <reference types="svelte" />
/// <reference types="vite/client" />

// Shape persisted to the state JSON in userData.
// v1 defaulted session names to the cwd basename; v2 names are pure user
// labels (restoreState migrates v1 names away once).
interface PersistedState {
  version: 1 | 2
  mode: 'system' | 'light' | 'dark'
  towerWidth?: number
  // Legacy key — towerWidth was persisted as railWidth before the rename.
  railWidth?: number
  focusedIndex: number
  dirOrder?: string[]
  dirColors?: Record<string, string>
  recentDirs?: string[]
  sessions: Array<{
    type: 'shell' | 'claude'
    name: string
    cwd: string
    claudeSessionId: string | null
  }>
}

// One entry of the read-only conversation preview (see src/main/transcript.ts).
type PreviewItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; label: string }

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
    pty: {
      spawn: (opts: {
        cols: number
        rows: number
        type?: 'shell' | 'claude'
        cwd?: string
        resume?: string
      }) => Promise<{ id: string; claudeSessionId?: string; cwd: string } | { error: string }>
      write: (id: string, data: string) => void
      resize: (id: string, cols: number, rows: number) => void
      kill: (id: string) => void
      onData: (callback: (id: string, data: string) => void) => () => void
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
    transcript: {
      watch: (sessionId: string, cwd: string) => void
      unwatch: (sessionId: string) => void
      onItems: (
        callback: (sessionId: string, items: PreviewItem[], reset: boolean) => void
      ) => () => void
    }
    status: {
      onChange: (
        callback: (claudeSessionId: string, status: 'running' | 'waiting' | 'idle') => void
      ) => () => void
    }
  }
}
