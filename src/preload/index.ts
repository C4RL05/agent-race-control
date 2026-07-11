import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

// Minimal, explicit API surface — the only bridge between renderer and main.
contextBridge.exposeInMainWorld('arc', {
  electronVersion: process.versions.electron,
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  pty: {
    spawn: (opts: {
      cols: number
      rows: number
      type?: 'shell' | 'claude'
      cwd?: string
    }): Promise<{ id: string } | { error: string }> => ipcRenderer.invoke('pty:spawn', opts),
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
  }
})
