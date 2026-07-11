import { contextBridge } from 'electron'

// Minimal, explicit API surface — the only bridge between renderer and main.
// PTY methods (spawn / write / onData / resize / kill) land in Phase 2.
contextBridge.exposeInMainWorld('arc', {
  electronVersion: process.versions.electron
})
