import { app } from 'electron'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The `waiting` signal, without touching the user's global Claude config:
// each Agent Race Control Claude session gets per-session hooks via `--settings <file>`,
// and those hooks POST their JSON payloads to this localhost server.
// Observability only — every request is answered 200 `{}` immediately, so
// hooks never block, deny, or modify anything Claude does.

export type ClaudeStatus = 'running' | 'waiting' | 'idle'

// PermissionRequest fires the instant a dialog appears (permission dialogs
// AND AskUserQuestion); the permission_prompt Notification trails it by ~6s
// (it's the OS-notification pathway). Notification stays mapped as the
// safety net for any other needs-input notification type.
const EVENT_STATUS: Record<string, ClaudeStatus> = {
  UserPromptSubmit: 'running',
  PostToolUse: 'running',
  PermissionRequest: 'waiting',
  Notification: 'waiting',
  Stop: 'idle'
}

const HOOK_EVENTS = Object.keys(EVENT_STATUS)

let settingsPath: string | null = null

// Path passed as `claude --settings <path>` for sessions this app spawns.
export function getHookSettingsPath(): string | null {
  return settingsPath
}

export function startStatusServer(
  onStatus: (claudeSessionId: string, status: ClaudeStatus) => void
): Promise<void> {
  // Random token in the URL path so other local processes can't spoof status.
  const token = randomBytes(16).toString('hex')

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{}')
        if (req.url !== `/hook/${token}`) return
        try {
          const payload = JSON.parse(body) as {
            session_id?: string
            hook_event_name?: string
            notification_type?: string
          }
          // The 60s idle nag (type idle_prompt, "Claude is waiting for your
          // input" — verified empirically) is not a needs-input signal: Stop
          // already reported idle, and mapping the nag to waiting was a false
          // amber on every session left alone for a minute.
          if (
            payload.hook_event_name === 'Notification' &&
            payload.notification_type === 'idle_prompt'
          ) {
            return
          }
          const status = payload.hook_event_name && EVENT_STATUS[payload.hook_event_name]
          if (payload.session_id && status) onStatus(payload.session_id, status)
        } catch {
          // malformed payload — ignore
        }
      })
    })

    server.unref()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      const url = `http://127.0.0.1:${port}/hook/${token}`
      const hooks: Record<string, unknown[]> = {}
      for (const event of HOOK_EVENTS) {
        hooks[event] = [{ hooks: [{ type: 'http', url }] }]
      }
      settingsPath = join(app.getPath('userData'), 'arc-hooks.json')
      writeFileSync(settingsPath, JSON.stringify({ hooks }, null, 2))
      resolve()
    })
  })
}
