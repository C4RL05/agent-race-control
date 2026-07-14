// Automated documentation screenshots — run with:  npm run screenshots
// (or `node scripts/screenshot.mjs` after `npm run build`).
//
// Drives the REAL app via playwright-core: no demo mode, no fake code paths
// in the app (see the kickoff doc's screenshot-harness section). The scene is
// staged only through channels the app already treats as truth:
//   - a crafted state.json in a scratch profile (the blessed dev-only
//     ARC_USERDATA override) restores the tower rows,
//   - every row is a real process — real claudes idling at their prompt
//     (zero tokens), a real Git Bash — named through the real rename flow,
//   - status variety comes from synthetic hook POSTs to the app's own
//     localhost status server: its observations are staged, the app never is,
//   - the hero conversation is genuinely real: one haiku prompt on a fresh
//     run; reruns --resume the pinned session ids and spend nothing.
// Transcript droppings under ~/.claude/projects/ for the staging cwds are
// accepted (a hermetic CLAUDE_CONFIG_DIR would demand a fresh login).
// Delete .screenshot-profile/ to restage the scene from scratch.
import { _electron } from 'playwright-core'
import electronPath from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profileDir = join(root, '.screenshot-profile')
const imagesDir = join(root, 'images')

if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('No build output — run `npm run screenshots` (or `npm run build` first).')
  process.exit(1)
}

// Stable session ids across runs — that's what makes reruns free: the app
// resumes the hero conversation instead of prompting again.
mkdirSync(profileDir, { recursive: true })
const idsPath = join(profileDir, 'ids.json')
const ids = existsSync(idsPath)
  ? JSON.parse(readFileSync(idsPath, 'utf8'))
  : { hero: randomUUID(), busy: randomUUID(), review: randomUUID(), notes: randomUUID() }
writeFileSync(idsPath, JSON.stringify(ids, null, 2))

// The scene: two directory groups, five rows, every traffic light on screen.
// Row order here IS tower order (state.json sessions × dirOrder).
const docsDir = join(root, 'docs')
const scene = [
  { type: 'claude', name: '', cwd: root, claudeSessionId: ids.hero }, // hero — named by its real conversation
  {
    type: 'claude',
    name: '',
    cwd: root,
    claudeSessionId: ids.busy,
    rename: 'Refactor the spawn flow'
  },
  { type: 'shell', name: 'dev server', cwd: root, claudeSessionId: null },
  {
    type: 'claude',
    name: '',
    cwd: docsDir,
    claudeSessionId: ids.review,
    rename: 'Update the kickoff doc'
  },
  {
    type: 'claude',
    name: '',
    cwd: docsDir,
    claudeSessionId: ids.notes,
    rename: 'Write release notes'
  }
]

// Crafted through the app's own persistence door (state v2) — restoring it
// is a real code path, exercised exactly as a user relaunch would.
writeFileSync(
  join(profileDir, 'state.json'),
  JSON.stringify(
    {
      version: 2,
      mode: 'dark',
      towerWidth: 260,
      focusedIndex: 0,
      dirOrder: [root, docsDir],
      dirColors: { [root]: '#388bfd', [docsDir]: '#db6d28' },
      recentDirs: [root, docsDir],
      sessions: scene.map(({ type, name, cwd, claudeSessionId }) => ({
        type,
        name,
        cwd,
        claudeSessionId
      }))
    },
    null,
    2
  )
)

// Same encoding rule as transcriptPath() in src/main/transcript.ts (the
// single owner in app code — a plain-node script can't import it).
const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const heroTranscript = join(
  configDir,
  'projects',
  root.replace(/[^a-zA-Z0-9]/g, '-'),
  `${ids.hero}.jsonl`
)
const heroIsFresh = !existsSync(heroTranscript)

const env = { ...process.env, ARC_USERDATA: profileDir }
delete env.ELECTRON_RENDERER_URL // never attach to a running dev server's renderer

const electronApp = await _electron.launch({
  executablePath: electronPath,
  args: [root],
  cwd: root,
  env
})
const page = await electronApp.firstWindow()
const rows = page.locator('.tower-body .row')
await rows.nth(scene.length - 1).waitFor({ timeout: 30_000 })

// Text content of the focused session's terminal (xterm's DOM renderer keeps
// the visible rows as text; it renders NBSPs for padding).
async function terminalText() {
  return page.evaluate(() => {
    const host = [...document.querySelectorAll('.pane .host')].find(
      (h) => h.style.display !== 'none'
    )
    return (host?.querySelector('.xterm-rows')?.textContent ?? '').replace(/\u00a0/g, ' ')
  })
}

// A claude row is ready when its composer chevron (❯) is on screen. The
// bottom-bar hint text is NOT a marker — it varies by version and mode
// ("? for shortcuts", "⏵⏵ auto mode on…"; verified empirically on v2.1.207).
// A first run in a not-yet-trusted staging dir shows the trust dialog first,
// whose option selector is also a chevron — so that check wins: Enter takes
// the default ("Yes, proceed"), exactly what a user would type; at an idle
// prompt the same Enter is a no-op.
async function waitForClaudePrompt(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const text = await terminalText()
    if (/trust the files/i.test(text)) {
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1500)
    } else if (text.includes('❯')) {
      return
    }
    await page.waitForTimeout(500)
  }
  throw new Error('claude never reached its prompt; last terminal text:\n' + (await terminalText()))
}

// The real rename flow: double-click the row name, type, Enter — which
// injects /rename into the real claude at its idle prompt and shows the
// optimistic title. Skipped when a resumed conversation already carries the
// name in its terminal title.
async function renameRow(index, name) {
  const row = rows.nth(index)
  await row.click()
  await waitForClaudePrompt()
  if ((await row.locator('.name').textContent())?.trim() === name) return
  // Hooks are blind to dialog dismissals — if the row isn't idle (a trust
  // dialog was answered), a lone Esc is the app's own documented nudge back
  // to idle, and a no-op for claude itself.
  if (!(await row.locator('.dot.idle').isVisible())) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  await row.locator('.name').dblclick()
  await row.locator('input.rename').fill(name)
  await row.locator('input.rename').press('Enter')
}

for (const [index, entry] of scene.entries()) {
  if (entry.rename) await renameRow(index, entry.rename)
}

// The hero conversation is real: one prompt on the craft of the haiku —
// artistic over dense, sized so the WHOLE session — Claude Code's welcome
// logo included — stays in frame, while the pointers give the Preview real
// markdown (bullets, bold, a quoted example). The status dot doubles as the
// turn's completion signal (UserPromptSubmit → running, Stop → idle). Rerun:
// --resume already restored the whole conversation, spend nothing — which
// also means: after editing PROMPTS, delete .screenshot-profile/ to restage.
const PROMPTS = ['What makes a great haiku? A few short pointers']

// Focus the visible terminal WITHOUT clicking inside claude's TUI — a real
// click can leak mouse-tracking bytes into the composer as stray text
// (verified empirically: a parked click left a stray "vi"). Focusing xterm's
// helper textarea is exactly what a row click triggers (term.focus()).
async function focusTerminal() {
  await page.evaluate(() => {
    const host = [...document.querySelectorAll('.pane .host')].find(
      (h) => h.style.display !== 'none'
    )
    host?.querySelector('.xterm-helper-textarea')?.focus()
  })
}

await rows.nth(0).click()
await waitForClaudePrompt()
if (heroIsFresh) {
  await focusTerminal()
  for (const prompt of PROMPTS) {
    await page.keyboard.type(prompt, { delay: 25 })
    await page.keyboard.press('Enter')
    await rows
      .nth(0)
      .locator('.dot.running')
      .waitFor({ timeout: 30_000 })
      .catch(() => {}) // a fast turn can slip past the poll — idle below decides
    await rows.nth(0).locator('.dot.idle').waitFor({ timeout: 240_000 })
    // let the TUI settle back at its composer before the next prompt
    await page.waitForTimeout(750)
  }
}

// Traffic-light variety for the background rows, staged through the app's
// own observability channel: POST the same JSON a real hook would to the
// URL the app wrote into the scratch profile's hook settings.
const hookUrl = JSON.parse(readFileSync(join(profileDir, 'arc-hooks.json'), 'utf8')).hooks
  .UserPromptSubmit[0].hooks[0].url
async function postStatus(sessionId, event) {
  await fetch(hookUrl, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, hook_event_name: event })
  })
}
await postStatus(ids.busy, 'UserPromptSubmit') // running — red
await postStatus(ids.review, 'PermissionRequest') // waiting — amber
await rows.nth(1).locator('.dot.running').waitFor({ timeout: 5_000 })
await rows.nth(3).locator('.dot.waiting').waitFor({ timeout: 5_000 })

mkdirSync(imagesDir, { recursive: true })
// The outline is BAKED INTO the PNG — GitHub strips inline styles from
// README markdown, so a border can't live there. Drawn on a canvas inside
// the already-running page (no image dependencies, same trick as
// make-icon.mjs), in the theme's own Primer border color: without it the
// dark shot's #0d1117 dissolves into GitHub dark's identical background.
async function shot(name, border) {
  const path = join(imagesDir, name)
  // animations disabled: the waiting dot's pulse rests at full opacity
  const capture = await page.screenshot({ animations: 'disabled' })
  const dataUrl = await page.evaluate(
    async ([b64, color]) => {
      // createImageBitmap from a Blob, not <img src="data:...">: the app's
      // CSP (default-src 'self') rightly blocks data: URLs, but a Blob
      // decode performs no resource load, so no policy applies.
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, bitmap.width - 2, bitmap.height - 2)
      return canvas.toDataURL('image/png')
    },
    [capture.toString('base64'), border]
  )
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log(path)
}

// Every shot should read "I'm working", not "I just clicked something":
// Playwright leaves the pointer on its last click target, whose hover
// styling (theme button accent, a row's × close button) would leak into the
// frame — rest it over the tower's empty lower half. A move, never a click
// (see focusTerminal).
async function parkPointer() {
  await page.mouse.move(150, 700)
  await page.waitForTimeout(250)
}

// Shot list (decided 2026-07-13): dark + light of the hero terminal view,
// plus one Preview-tab shot.
await rows.nth(0).click()
await focusTerminal()
await parkPointer()
await shot('arc-hero-dark.png', '#30363d')

await page.locator('.host:visible .tab', { hasText: 'Preview' }).click()
await page.locator('.preview .user').first().waitFor({ timeout: 30_000 })
await parkPointer()
await shot('arc-preview.png', '#30363d')
await page.locator('.host:visible .tab', { hasText: 'Terminal' }).click()

// Theme cycles system → light → dark; crafted state starts dark, two clicks
// land on light.
const themeButton = page.locator('button[title^="Theme"]')
await themeButton.click()
await themeButton.click()
await focusTerminal()
await parkPointer()
await shot('arc-hero-light.png', '#d0d7de')

// Quit through the real path — will-quit kills the PTYs, no orphaned conpty.
await electronApp.evaluate(({ app }) => app.quit())
await electronApp.waitForEvent('close', { timeout: 15_000 }).catch(() => electronApp.close())
