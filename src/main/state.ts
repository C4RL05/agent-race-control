import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The state JSON in userData — the app's only persistence. No DB.

export interface PersistedSession {
  type: 'shell' | 'claude'
  name: string
  cwd: string
  claudeSessionId: string | null
}

export interface AppState {
  // Pre-1.0 no-compat policy (see the kickoff doc): a schema change bumps
  // this and loadState discards older files — factory reset, no migrations.
  version: 2
  mode: 'system' | 'light' | 'dark'
  // Optional/additive — absent means false, so it needs no version bump
  // (the no-compat policy governs breaking changes, not compatible ones).
  statusRgb?: boolean
  towerWidth?: number
  zoomLevel?: number
  focusedIndex: number
  dirOrder?: string[]
  dirColors?: Record<string, string>
  recentDirs?: string[]
  sessions: PersistedSession[]
  lastPickedDir?: string
}

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

export function loadState(): AppState | null {
  try {
    const state = JSON.parse(readFileSync(statePath(), 'utf8')) as AppState
    return state.version === 2 ? state : null
  } catch {
    return null
  }
}

let pending: AppState | null = null
let writeTimer: NodeJS.Timeout | null = null

export function saveState(state: AppState): void {
  pending = state
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(flushState, 300)
}

export function flushState(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  if (!pending) return
  try {
    writeFileSync(statePath(), JSON.stringify(pending, null, 2))
  } catch {
    // best-effort — never crash over state persistence
  }
}
