import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
// Type-only: erased at build, so no runtime coupling to main.
import type { PreviewItem } from '../main/transcript'
import type { HookEvent } from '../main/status'
import type { GitInfo, WorktreeEntry } from '../main/git'

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
      type?: 'shell' | 'claude'
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
    onExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, id: string, exitCode: number): void => {
        callback(id, exitCode)
      }
      ipcRenderer.on('pty:exit', listener)
      return () => ipcRenderer.removeListener('pty:exit', listener)
    }
  },
  transcript: {
    watch: (sessionId: string, cwd: string): void => {
      ipcRenderer.send('transcript:watch', sessionId, cwd)
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
  }
})
