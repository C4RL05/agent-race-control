import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The state JSON in userData — the app's only persistence. No DB.

export interface PersistedSession {
  type: 'shell' | 'claude'
  name: string
  cwd: string
  claudeSessionId: string | null
  // The Notes tab's text. Optional/additive like the fields on AppState below:
  // absent means the user never typed any, so it needs no version bump.
  notes?: string
}

export interface AppState {
  // Pre-1.0 no-compat policy (see the kickoff doc): a schema change bumps
  // this and loadState discards older files — factory reset, no migrations.
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
  // Selected font ids (see the renderer's FONTS/UI_FONTS). Absent → the default.
  font?: string
  uiFont?: string
  previewFont?: string
  towerWidth?: number
  // Window zoom level (Ctrl+=/−/0), owned by main. The renderer's per-pane
  // offsets ride alongside it under `paneZoom`, in HALF levels, and are reset
  // to 0 whenever one of those keys fires.
  zoomLevel?: number
  paneZoom?: Record<string, number>
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
