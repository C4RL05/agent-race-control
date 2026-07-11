import { DOT_COLORS, type Mode } from './theme'

export interface Session {
  key: number
  type: 'shell' | 'claude'
  cwd: string
  name: string
  color: string
  status: 'running' | 'exited'
  ptyId: string | null
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
    status: 'running',
    ptyId: null
  }
  sessions.push(session)
  ui.focused = session.key
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
