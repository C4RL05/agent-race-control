/// <reference types="svelte" />
/// <reference types="vite/client" />

// Shape persisted to the state JSON in userData.
interface PersistedState {
  version: 1
  mode: 'system' | 'light' | 'dark'
  railWidth?: number
  focusedIndex: number
  dirOrder?: string[]
  dirColors?: Record<string, string>
  sessions: Array<{
    type: 'shell' | 'claude'
    name: string
    cwd: string
    claudeSessionId: string | null
  }>
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
    pty: {
      spawn: (opts: {
        cols: number
        rows: number
        type?: 'shell' | 'claude'
        cwd?: string
        resume?: string
      }) => Promise<{ id: string; claudeSessionId?: string } | { error: string }>
      write: (id: string, data: string) => void
      resize: (id: string, cols: number, rows: number) => void
      kill: (id: string) => void
      onData: (callback: (id: string, data: string) => void) => () => void
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
    status: {
      onChange: (
        callback: (claudeSessionId: string, status: 'running' | 'waiting' | 'idle') => void
      ) => () => void
    }
  }
}
