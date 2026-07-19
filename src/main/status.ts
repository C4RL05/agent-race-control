import { app } from 'electron'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomBytes } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The `waiting` signal, without touching the user's global Claude config:
// each Agent Race Control Claude session gets per-session hooks via `--settings <file>`,
// and those hooks POST their JSON payloads to this localhost server.
// Observability only — every request is answered 200 `{}` immediately, so
// hooks never block, deny, or modify anything Claude does.
//
// Each session gets its OWN hook URL (a session token in the path), not one
// shared URL — because Claude Code mints a NEW session_id + transcript file on
// `/clear`, and the `--settings` file is read once at process start, so a
// baked-in per-session URL keeps receiving that session's hooks no matter how
// the conversation id changes. The server routes by the stable URL token and
// forwards the payload's CURRENT session_id, so the renderer can follow a
// `/clear` to the new transcript (see applyStatus + issue #2).

// The hook events each Agent Race Control Claude session POSTs here. Main only
// forwards them (minus the idle_prompt nag, filtered below); the renderer's
// status state machine owns what each one MEANS for the dot (applyStatus in
// sessions.svelte.ts) — one owner, co-located with the keystroke nudge. It
// needs the raw event, not a pre-mapped status, to reject an out-of-order
// PostToolUse that would otherwise resurrect a just-finished turn.
export type HookEvent =
  'UserPromptSubmit' | 'PostToolUse' | 'PermissionRequest' | 'Notification' | 'Stop'

const HOOK_EVENTS: HookEvent[] = [
  'UserPromptSubmit',
  'PostToolUse',
  'PermissionRequest',
  'Notification',
  'Stop'
]

// Set once the server is listening: the secret path token (anti-spoof) and the
// bound port. writeSessionHooks needs both to build a session's hook URL.
let server: { token: string; port: number } | null = null

// Per-session `--settings` files live here, one per spawn. Wiped on startup so
// a crash or force-quit can't leave a spawned claude POSTing to a dead server's
// URL on the next run (the port would differ anyway).
function hooksDir(): string {
  return join(app.getPath('userData'), 'arc-hooks')
}

// Write a session's `--settings` file and return its path. The URL carries the
// anti-spoof server token AND a per-session hookToken; the server routes by the
// latter. Called at spawn (pty.ts) with the session's spawn id as the token —
// stable for the process's life even as `/clear` changes the conversation id.
export function writeSessionHooks(hookToken: string): string | null {
  if (!server) return null
  const url = `http://127.0.0.1:${server.port}/hook/${server.token}/${hookToken}`
  const hooks: Record<string, unknown[]> = {}
  for (const event of HOOK_EVENTS) {
    hooks[event] = [{ hooks: [{ type: 'http', url }] }]
  }
  const path = join(hooksDir(), `${hookToken}.json`)
  writeFileSync(path, JSON.stringify({ hooks }, null, 2))
  return path
}

export function startStatusServer(
  onEvent: (hookToken: string, claudeSessionId: string, event: HookEvent, cwd: string) => void
): Promise<void> {
  // Secret path token (anti-spoof) shared by every session's URL; the trailing
  // path segment is the per-session hookToken the server routes on.
  const token = randomBytes(16).toString('hex')
  const route = new RegExp(`^/hook/${token}/([^/?]+)`)

  return new Promise((resolve) => {
    const httpServer = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{}')
        const match = req.url ? route.exec(req.url) : null
        if (!match) return
        const hookToken = match[1]
        try {
          const payload = JSON.parse(body) as {
            session_id?: string
            hook_event_name?: string
            notification_type?: string
            // The session's real working directory. A --worktree spawn starts
            // at the repo root and enters the worktree Claude creates — this
            // field is how the renderer follows it (applyStatus).
            cwd?: string
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
          const event = payload.hook_event_name
          if (payload.session_id && event && (HOOK_EVENTS as string[]).includes(event)) {
            onEvent(hookToken, payload.session_id, event as HookEvent, payload.cwd ?? '')
          }
        } catch {
          // malformed payload — ignore
        }
      })
    })

    httpServer.unref()
    httpServer.listen(0, '127.0.0.1', () => {
      const port = (httpServer.address() as AddressInfo).port
      server = { token, port }
      // Start clean: a per-run dir of per-session settings files.
      rmSync(hooksDir(), { recursive: true, force: true })
      mkdirSync(hooksDir(), { recursive: true })
      resolve()
    })
  })
}
