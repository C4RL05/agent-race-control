import { DOT_COLORS, type Mode } from './theme'

export interface Session {
  key: number
  type: 'shell' | 'claude'
  cwd: string
  name: string
  color: string
  // Claude sessions use the full set; shell sessions only running/exited.
  status: 'running' | 'waiting' | 'idle' | 'exited'
  ptyId: string | null
  claudeSessionId: string | null
  // Set on sessions restored from the state JSON: spawn with --resume.
  resumeId: string | null
}

let nextKey = 1
let colorIndex = 0

export const sessions = $state<Session[]>([])

export const ui = $state<{ focused: number | null; mode: Mode }>({
  focused: null,
  mode: 'system'
})

export async function newSession(type: 'shell' | 'claude'): Promise<void> {
  const cwd = await window.arc.pickFolder()
  if (!cwd) return
  const name = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
  const session: Session = {
    key: nextKey++,
    type,
    cwd,
    name,
    color: DOT_COLORS[colorIndex++ % DOT_COLORS.length],
    // Claude starts at its prompt (idle); a shell is simply alive (running).
    status: type === 'claude' ? 'idle' : 'running',
    ptyId: null,
    claudeSessionId: null,
    resumeId: null
  }
  sessions.push(session)
  ui.focused = session.key
}

export function applyStatus(claudeSessionId: string, status: 'running' | 'waiting' | 'idle'): void {
  const session = sessions.find((s) => s.claudeSessionId === claudeSessionId)
  if (session && session.status !== 'exited') session.status = status
}

// --- persistence ---

export async function restoreState(): Promise<void> {
  const saved = await window.arc.state.load()
  if (!saved) return
  ui.mode = saved.mode
  for (const s of saved.sessions) {
    sessions.push({
      key: nextKey++,
      type: s.type,
      cwd: s.cwd,
      name: s.name,
      color: s.color,
      status: s.type === 'claude' ? 'idle' : 'running',
      ptyId: null,
      claudeSessionId: null,
      // Claude sessions resume their conversation; shells just reopen fresh.
      resumeId: s.type === 'claude' ? s.claudeSessionId : null
    })
    colorIndex++
  }
  ui.focused = sessions[saved.focusedIndex]?.key ?? sessions[0]?.key ?? null
}

// Exited sessions are not persisted — a session that ended is gone.
export function snapshotState(): PersistedState {
  const alive = sessions.filter((s) => s.status !== 'exited')
  const focusedIndex = Math.max(
    0,
    alive.findIndex((s) => s.key === ui.focused)
  )
  return {
    version: 1,
    mode: ui.mode,
    focusedIndex,
    sessions: alive.map((s) => ({
      type: s.type,
      name: s.name,
      color: s.color,
      cwd: s.cwd,
      claudeSessionId: s.claudeSessionId
    }))
  }
}

export function closeSession(key: number): void {
  const index = sessions.findIndex((s) => s.key === key)
  if (index === -1) return
  sessions.splice(index, 1)
  if (ui.focused === key) {
    ui.focused = sessions[Math.min(index, sessions.length - 1)]?.key ?? null
  }
}

export function cycleColor(session: Session): void {
  const index = DOT_COLORS.indexOf(session.color)
  session.color = DOT_COLORS[(index + 1) % DOT_COLORS.length]
}
