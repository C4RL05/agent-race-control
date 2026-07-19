// Automated documentation screenshots — run with:  npm run screenshots
// (or `node scripts/screenshot.mjs` after `npm run build`).
//
// Drives the REAL app via playwright-core: no demo mode, no fake code paths
// in the app (see the kickoff doc's screenshot-harness + user-guide sections).
// The scene is staged only through channels the app already treats as truth:
//   - a crafted state.json in a scratch profile (the blessed dev-only
//     ARC_USERDATA override) restores the tower rows,
//   - every row is a real process — real claudes idling at their prompt
//     (zero tokens), real Git Bash shells — named through the real rename flow,
//   - status variety comes from synthetic hook POSTs to the app's own
//     localhost status server: its observations are staged, the app never is,
//   - the hero conversation is genuinely real: one haiku prompt on a fresh
//     run; reruns --resume the pinned session ids and spend nothing,
//   - branch rows and their state markers come from a real scratch repo
//     (`pitwall`) with hand-made worktrees — the STAGING SCRIPT runs git,
//     the app still never does (the arm's-length rule constrains the app,
//     not dev tooling).
// Every scene is captured in BOTH themes (dark first — the staged mode —
// then light via the real Settings modal); the user guide embeds the pairs
// with <picture media="(prefers-color-scheme: dark)"> so GitHub serves the
// shot matching the reader's theme.
// Transcript droppings under ~/.claude/projects/ for the staging cwds are
// accepted (a hermetic CLAUDE_CONFIG_DIR would demand a fresh login).
// Delete .screenshot-profile/ to restage the scene from scratch.
import { _electron } from 'playwright-core'
import electronPath from 'electron'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
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
// resumes the hero conversation instead of prompting again. Merge-with-new so
// scene growth never invalidates the ids (and transcripts) already staged.
mkdirSync(profileDir, { recursive: true })
const idsPath = join(profileDir, 'ids.json')
const stored = existsSync(idsPath) ? JSON.parse(readFileSync(idsPath, 'utf8')) : {}
const ids = {
  hero: stored.hero ?? randomUUID(),
  busy: stored.busy ?? randomUUID(),
  login: stored.login ?? randomUUID(),
  palette: stored.palette ?? randomUUID(),
  notes: stored.notes ?? randomUUID()
}
writeFileSync(idsPath, JSON.stringify(ids, null, 2))

// --- the demo repo: real branches, real worktrees, real markers ---
// A scratch repo the worktree scenes point their cameras at. Built once
// (idempotent — delete the profile dir to restage) with Claude Code's own
// worktree layout: `.claude/worktrees/<name>` on branch `worktree-<name>`.
// The commit graph is arranged so the branch-state markers show real life:
//   worktree-login-form  — 1 own commit, main advanced once, a dirty file
//                          → ● ↑1 ↓1
//   worktree-dark-mode   — 2 own commits on top of main's tip → ↑2
//   main                 — clean (its .gitignore hides .claude/, the same
//                          setup the guide recommends)
//   worktree-onboarding / worktree-billing — no sessions: reopen-menu fodder.
const demoRepo = join(profileDir, 'pitwall')
const wtLogin = join(demoRepo, '.claude', 'worktrees', 'login-form')
const wtPalette = join(demoRepo, '.claude', 'worktrees', 'dark-mode')
// The plain-folder card must live OUTSIDE any git repo — anywhere inside the
// checkout (the profile dir included) is still the agent-race-control work
// tree, and the app would rightly group it as a branch row of THIS repo's
// card (found the hard way: it shifted every tower index). The OS temp dir is
// the nearest genuinely repo-free ground; only the basename shows in shots.
const notesDir = join(tmpdir(), 'agent-race-control-screenshots', 'notes')

function git(cwd, ...args) {
  execFileSync(
    'git',
    ['-c', 'user.name=Screenshot Harness', '-c', 'user.email=screenshots@invalid', ...args],
    { cwd, stdio: 'ignore' }
  )
}

if (!existsSync(join(demoRepo, '.git'))) {
  mkdirSync(join(demoRepo, 'src'), { recursive: true })
  git(demoRepo, 'init', '-b', 'main')
  writeFileSync(join(demoRepo, '.gitignore'), '.claude/\nnode_modules/\n')
  writeFileSync(
    join(demoRepo, 'package.json'),
    JSON.stringify({ name: 'pitwall', version: '0.1.0', private: true }, null, 2) + '\n'
  )
  writeFileSync(
    join(demoRepo, 'src', 'server.js'),
    "import { createServer } from 'node:http'\n\ncreateServer(handler).listen(3000)\n"
  )
  writeFileSync(join(demoRepo, 'README.md'), '# pitwall\n\nRace-weekend telemetry, for humans.\n')
  git(demoRepo, 'add', '-A')
  git(demoRepo, 'commit', '-m', 'Scaffold the API server')

  // login-form branches here — then main advances, leaving it one behind.
  git(demoRepo, 'worktree', 'add', '-b', 'worktree-login-form', wtLogin)
  writeFileSync(
    join(wtLogin, 'src', 'login.js'),
    'export function login(user) {\n  return session(user)\n}\n'
  )
  git(wtLogin, 'add', '-A')
  git(wtLogin, 'commit', '-m', 'Add the login route')

  appendFileSync(join(demoRepo, 'src', 'server.js'), "\nserver.on('request', logRequest)\n")
  git(demoRepo, 'add', '-A')
  git(demoRepo, 'commit', '-m', 'Wire request logging')

  // dark-mode branches from main's new tip — two commits ahead, none behind.
  git(demoRepo, 'worktree', 'add', '-b', 'worktree-dark-mode', wtPalette)
  writeFileSync(join(wtPalette, 'src', 'theme.js'), "export const dark = { bg: '#0d1117' }\n")
  git(wtPalette, 'add', '-A')
  git(wtPalette, 'commit', '-m', 'Add the dark palette')
  writeFileSync(join(wtPalette, 'src', 'store.js'), 'export function persistTheme(mode) {}\n')
  git(wtPalette, 'add', '-A')
  git(wtPalette, 'commit', '-m', 'Persist the theme choice')

  // Parked worktrees — sessions never open here, so the reopen menu has
  // something real to list.
  git(
    demoRepo,
    'worktree',
    'add',
    '-b',
    'worktree-onboarding',
    join(demoRepo, '.claude', 'worktrees', 'onboarding')
  )
  git(
    demoRepo,
    'worktree',
    'add',
    '-b',
    'worktree-billing',
    join(demoRepo, '.claude', 'worktrees', 'billing')
  )

  // The dirty file lands last so no staging commit sweeps it up.
  appendFileSync(join(wtLogin, 'src', 'login.js'), '\nexport function logout(user) {}\n')
}
mkdirSync(notesDir, { recursive: true })
writeFileSync(join(notesDir, 'release-notes.md'), '# Release notes\n')

// The scene: three cards — the live agent-race-control repo, the pitwall
// demo repo (main + two feature worktrees), a plain folder — seven rows,
// every traffic light plus the TODO flag on screen. Row order here IS tower
// order (state.json sessions × dirOrder).
const scene = [
  { type: 'claude', cwd: root, id: ids.hero }, // hero — named by its real conversation
  { type: 'claude', cwd: root, id: ids.busy, rename: 'Refactor the spawn flow' },
  { type: 'shell', cwd: root, name: 'dev server' },
  { type: 'shell', cwd: demoRepo, name: 'vitest --watch' },
  { type: 'claude', cwd: wtLogin, id: ids.login, rename: 'Build the login form' },
  { type: 'claude', cwd: wtPalette, id: ids.palette, rename: 'Dark mode palette' },
  { type: 'claude', cwd: notesDir, id: ids.notes, rename: 'Write release notes', todo: true }
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
      dirOrder: [root, demoRepo, wtLogin, wtPalette, notesDir],
      dirColors: {
        [root]: '#388bfd',
        [demoRepo]: '#db6d28',
        [wtLogin]: '#db6d28',
        [wtPalette]: '#db6d28',
        [notesDir]: '#a371f7'
      },
      recentDirs: [root, demoRepo, notesDir],
      sessions: scene.map((s) => ({
        type: s.type,
        name: s.name ?? '',
        cwd: s.cwd,
        claudeSessionId: s.id ?? null,
        todo: s.todo ?? false,
        spawnWorktree: null
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

// Tower order isn't final until every cwd's git info lands (a repo's cwds
// cluster into their card only then) — and every rows.nth() below assumes the
// final order. The pitwall markers double as the settled signal: they render
// last, once the demo repo's branch rows exist AND their status/rev-list
// calls resolved.
// The handle is the card's data-group-key (its git-spelled repo root), NOT a
// hasText filter: the naming scene swaps the title label for the input, and
// with the label gone a text-matched locator stops resolving mid-scene.
const pitwallCard = page.locator('.card[data-group-key$="/pitwall"]')
await pitwallCard.locator('.branch-state', { hasText: '↑1' }).waitFor({ timeout: 15_000 })
await pitwallCard.locator('.branch-state', { hasText: '↑2' }).waitFor({ timeout: 15_000 })

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
  if (!(await row.locator('.dot.idle, .dot.todo').isVisible())) {
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

// The hero conversation is real: one prompt comparing F1 tyre compounds —
// on-brand, and sized so the WHOLE session — Claude Code's welcome logo
// included — stays in frame, while the answer gives the Preview real
// markdown variety (a table, section headers, bullets, bold). The status
// dot doubles as the turn's completion signal (UserPromptSubmit → running,
// Stop → idle). Rerun: --resume already restored the whole conversation,
// spend nothing — which also means: after editing PROMPTS, delete
// .screenshot-profile/ to restage.
const PROMPTS = [
  'Compare the three dry F1 tyre compounds in a small markdown table, then a couple of short bulleted sections on how to use them in a race, and one bold takeaway'
]

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
// URL the app wrote into the scratch profile's hook settings. Since the
// /clear fix those are PER-SESSION files — arc-hooks/<hookToken>.json, the
// hook token being the pinned spawn id — each carrying its own routed URL.
function hookUrlFor(sessionId) {
  return JSON.parse(readFileSync(join(profileDir, 'arc-hooks', `${sessionId}.json`), 'utf8')).hooks
    .UserPromptSubmit[0].hooks[0].url
}
async function postStatus(sessionId, event) {
  await fetch(hookUrlFor(sessionId), {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, hook_event_name: event })
  })
}
await postStatus(ids.busy, 'UserPromptSubmit') // running — red
await postStatus(ids.login, 'PermissionRequest') // waiting — amber
await rows.nth(1).locator('.dot.running').waitFor({ timeout: 5_000 })
await rows.nth(4).locator('.dot.waiting').waitFor({ timeout: 5_000 })

mkdirSync(imagesDir, { recursive: true })
// The outline is BAKED INTO the PNG — GitHub strips inline styles from
// README markdown, so a border can't live there. Drawn on a canvas inside
// the already-running page (no image dependencies, same trick as
// make-icon.mjs), in the theme's own Primer border color: without it the
// dark shot's #0d1117 dissolves into GitHub dark's identical background.
async function shot(name, border, clip) {
  const path = join(imagesDir, name)
  // animations disabled: the waiting dot's pulse rests at full opacity
  const capture = await page.screenshot({ animations: 'disabled', ...(clip ? { clip } : {}) })
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

// A crop around one or more elements, clamped to the window — the union box
// plus breathing room, so menu shots keep their anchor in frame.
async function cropAround(locators, pad = 12) {
  const boxes = []
  for (const l of locators) {
    const b = await l.boundingBox()
    if (b) boxes.push(b)
  }
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad)
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad)
  const right = Math.min(w, Math.max(...boxes.map((b) => b.x + b.width)) + pad)
  const bottom = Math.min(h, Math.max(...boxes.map((b) => b.y + b.height)) + pad)
  return { x, y, width: right - x, height: bottom - y }
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

// --- the shot list (expanded 2026-07-19 for the user guide) ---
// Seven scenes, each captured in both themes; the guide embeds the pairs via
// <picture> so the reader's theme picks the matching one.
const BORDERS = { dark: '#30363d', light: '#d0d7de' }

async function captureTheme(theme) {
  const border = BORDERS[theme]

  // 1 — hero: the whole cockpit, terminal on the real conversation.
  await rows.nth(0).click()
  await focusTerminal()
  await parkPointer()
  await shot(`arc-hero-${theme}.png`, border)

  // 2 — the Preview tab on the same conversation.
  await page.locator('.host:visible .tab', { hasText: 'Preview' }).click()
  await page.locator('.preview .user').first().waitFor({ timeout: 30_000 })
  await parkPointer()
  await shot(`arc-preview-${theme}.png`, border)
  await page.locator('.host:visible .tab', { hasText: 'Terminal' }).click()

  // 3 — the repo card: branch rows, worktree names, state markers. Tight
  // 6px pad: the default 12 reaches into the neighboring cards' edges.
  await parkPointer()
  await shot(`arc-worktrees-${theme}.png`, border, await cropAround([pitwallCard], 6))

  // 4 — naming a fresh worktree (the create_new_folder button's inline field).
  // The spawn cluster is visibility:hidden until its title row is hovered —
  // Playwright's actionability check runs BEFORE its own hover, so reveal the
  // cluster explicitly first. Once the field has focus, :focus-within keeps
  // the cluster visible, so the pointer can park without changing the frame.
  await pitwallCard.locator('.card-title').hover()
  await pitwallCard.locator('button[title="New Claude session in a fresh worktree"]').click()
  const nameField = pitwallCard.locator('input.rename')
  await nameField.waitFor({ timeout: 5_000 })
  await nameField.type('telemetry', { delay: 15 })
  await parkPointer()
  await shot(`arc-worktree-new-${theme}.png`, border, await cropAround([pitwallCard], 6))
  await nameField.press('Escape')

  // 5 — the reopen menu listing parked worktrees (same hover-first dance).
  await pitwallCard.locator('.card-title').hover()
  await pitwallCard.locator('button[title="Reopen a worktree"]').click()
  const menu = page.locator('.menu')
  await menu.locator('.menu-item', { hasText: 'billing' }).waitFor({ timeout: 10_000 })
  await parkPointer()
  await shot(`arc-reopen-${theme}.png`, border, await cropAround([pitwallCard, menu]))
  await page.keyboard.press('Escape')

  // 6 — the session context menu.
  await rows.nth(0).click({ button: 'right' })
  await menu.waitFor({ timeout: 5_000 })
  await parkPointer()
  await shot(`arc-session-menu-${theme}.png`, border, await cropAround([rows.nth(0), menu]))
  await page.keyboard.press('Escape')

  // 7 — the Settings modal (theme + status RGB + fonts).
  await page.locator('button[title="Settings"]').click()
  const modal = page.locator('.settings-modal')
  await modal.waitFor({ timeout: 5_000 })
  await parkPointer()
  await shot(`arc-settings-${theme}.png`, border, await cropAround([modal], 24))
  await page.keyboard.press('Escape')

  // Leave the keyboard with the terminal, as a user would find it.
  await focusTerminal()
}

// Dark is the staged mode; flip to light through the real Settings modal
// (the app's actual theme control) for the second pass.
await captureTheme('dark')
await page.locator('button[title="Settings"]').click()
await page.locator('.settings-modal .menu-item', { hasText: 'Light' }).click()
await page.keyboard.press('Escape')
await captureTheme('light')

// Quit through the real path — will-quit kills the PTYs, no orphaned conpty.
await electronApp.evaluate(({ app }) => app.quit())
await electronApp.waitForEvent('close', { timeout: 15_000 }).catch(() => electronApp.close())
