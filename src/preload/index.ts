import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
// Type-only: erased at build, so no runtime coupling to main.
import type { PreviewItem } from '../main/transcript'
import type { AgentEntry } from '../main/agents'
import type { HookEvent } from '../main/status'
import type { GitInfo, WorktreeEntry } from '../main/git'
import type { SessionInfo } from '../main/sessioninfo'

// Minimal, explicit API surface — the only bridge between renderer and main.
contextBridge.exposeInMainWorld('arc', {
  electronVersion: process.versions.electron,
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  openInExplorer: (path: string): void => {
    ipcRenderer.send('shell:openPath', path)
  },
  // File.path no longer exists in the renderer — resolve dropped files here.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  setAppIcon: (representations: Array<{ scaleFactor: number; dataURL: string }>): void => {
    ipcRenderer.send('app:setIcon', representations)
  },
  state: {
    load: (): Promise<unknown> => ipcRenderer.invoke('state:load'),
    save: (state: unknown): void => {
      ipcRenderer.send('state:save', state)
    }
  },
  // Read-only branch/worktree info for the tower tree (issue #5) — always
  // resolves (main's getGitInfo is fail-open).
  git: {
    info: (cwd: string): Promise<GitInfo> => ipcRenderer.invoke('git:info', cwd),
    worktrees: (repoRoot: string): Promise<WorktreeEntry[]> =>
      ipcRenderer.invoke('git:worktrees', repoRoot)
  },
  pty: {
    spawn: (opts: {
      cols: number
      rows: number
      type?: 'shell' | 'claude' | 'codex'
      cwd?: string
      resume?: string
      worktree?: string
    }): Promise<{ id: string; claudeSessionId?: string; cwd: string } | { error: string }> =>
      ipcRenderer.invoke('pty:spawn', opts),
    write: (id: string, data: string): void => {
      ipcRenderer.send('pty:write', id, data)
    },
    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.send('pty:resize', id, cols, rows)
    },
    kill: (id: string): void => {
      ipcRenderer.send('pty:kill', id)
    },
    onData: (callback: (id: string, data: string) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, id: string, data: string): void => {
        callback(id, data)
      }
      ipcRenderer.on('pty:data', listener)
      return () => ipcRenderer.removeListener('pty:data', listener)
    },
    // A codex row's conversation id, which arrives AFTER the spawn: codex mints
    // its own and we learn it from the rollout it opens (main/codex.ts). Claude
    // rows never see this — theirs comes back from spawn itself.
    onSession: (
      callback: (id: string, sessionId: string, name: string | null) => void
    ): (() => void) => {
      const listener = (
        _event: IpcRendererEvent,
        id: string,
        sessionId: string,
        name: string | null
      ): void => {
        callback(id, sessionId, name)
      }
      ipcRenderer.on('pty:session', listener)
      return () => ipcRenderer.removeListener('pty:session', listener)
    },
    onExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, id: string, exitCode: number): void => {
        callback(id, exitCode)
      }
      ipcRenderer.on('pty:exit', listener)
      return () => ipcRenderer.removeListener('pty:exit', listener)
    }
  },
  transcript: {
    // kind selects both where the transcript lives and how a line folds into
    // preview items — the only two things that differ per agent.
    watch: (sessionId: string, cwd: string, kind?: 'claude' | 'codex'): void => {
      ipcRenderer.send('transcript:watch', sessionId, cwd, kind)
    },
    unwatch: (sessionId: string): void => {
      ipcRenderer.send('transcript:unwatch', sessionId)
    },
    drop: (sessionId: string): void => {
      ipcRenderer.send('transcript:drop', sessionId)
    },
    onItems: (
      callback: (sessionId: string, items: PreviewItem[], reset: boolean) => void
    ): (() => void) => {
      const listener = (
        _event: IpcRendererEvent,
        sessionId: string,
        items: PreviewItem[],
        reset: boolean
      ): void => {
        callback(sessionId, items, reset)
      }
      ipcRenderer.on('transcript:items', listener)
      return () => ipcRenderer.removeListener('transcript:items', listener)
    }
  },
  // Everything knowable about one session, for the pane's Session tab
  // (sessioninfo.ts). PULL, not push: nothing is computed unless that tab is
  // open and asks, and nothing it returns ever colours the status dot.
  info: {
    get: (opts: { sessionId: string; cwd: string; pid: number | null }): Promise<SessionInfo> =>
      ipcRenderer.invoke('session:info', opts)
  },
  // Turn-boundary hooks (status.ts): the raw event, routed by the session's
  // stable spawn token. These are what colour the dot red/amber.
  status: {
    onChange: (
      callback: (hookToken: string, claudeSessionId: string, event: HookEvent, cwd: string) => void
    ): (() => void) => {
      const listener = (
        _event: IpcRendererEvent,
        hookToken: string,
        claudeSessionId: string,
        event: HookEvent,
        cwd: string
      ): void => {
        callback(hookToken, claudeSessionId, event, cwd)
      }
      ipcRenderer.on('session:status', listener)
      return () => ipcRenderer.removeListener('session:status', listener)
    }
  },
  // Ctrl+=/−/0 fired (main owns the window zoom). The renderer's per-pane
  // zoom levels are offsets on top of it, so this is the cue to drop them
  // back to 0 and put every pane at the window's one size.
  zoom: {
    onSync: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback()
      }
      ipcRenderer.on('zoom:sync', listener)
      return () => ipcRenderer.removeListener('zoom:sync', listener)
    }
  },
  // Each tick of `claude agents --json` (agents.ts): the FULL list of active
  // sessions, machine-wide. The renderer matches the ones it owns and ignores
  // the rest — but only ever to force green, since `busy` here includes a
  // finished turn that still owns a background shell.
  agents: {
    onUpdate: (callback: (entries: AgentEntry[]) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, entries: AgentEntry[]): void => {
        callback(entries)
      }
      ipcRenderer.on('session:agents', listener)
      return () => ipcRenderer.removeListener('session:agents', listener)
    }
  }
})
