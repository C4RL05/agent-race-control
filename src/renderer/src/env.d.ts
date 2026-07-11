/// <reference types="svelte" />
/// <reference types="vite/client" />

// The preload contextBridge API — the renderer's only window into main.
interface Window {
  arc: {
    electronVersion: string
    pickFolder: () => Promise<string | null>
    pty: {
      spawn: (opts: {
        cols: number
        rows: number
        type?: 'shell' | 'claude'
        cwd?: string
      }) => Promise<{ id: string } | { error: string }>
      write: (id: string, data: string) => void
      resize: (id: string, cols: number, rows: number) => void
      kill: (id: string) => void
      onData: (callback: (id: string, data: string) => void) => () => void
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
  }
}
