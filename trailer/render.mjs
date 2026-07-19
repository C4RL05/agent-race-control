// Headless render:  npm run render  (vite dev server must NOT already be
// running — this script owns one on a free port).
//
// Motion Canvas has no render CLI — rendering lives behind the editor's
// Render button — so this drives the editor in a real browser via
// playwright-core (the same pattern as the app's screenshot harness) and
// waits for the FFmpeg exporter to finish writing output/.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const outputDir = join(root, 'output')
// A fresh port per run: a crashed run's vite tree can outlive its taskkill,
// and a stale server on a fixed port would silently serve THIS run too.
const PORT = 9200 + Math.floor(Math.random() * 500)

console.log('starting vite…')
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe']
})
server.stdout.on('data', () => {})
server.stderr.on('data', (chunk) => process.stderr.write(chunk))
// Readiness = the port answers, not a parsed banner — stdout capture of a
// shell-wrapped npx on Windows is not reliable.
async function serverUp() {
  const started = Date.now()
  for (;;) {
    if (Date.now() - started > 60_000) throw new Error('vite never came up')
    try {
      const res = await fetch(`http://localhost:${PORT}/`)
      if (res.ok) return
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

let browser
try {
  await serverUp()

  // A real installed browser — playwright-core downloads nothing. Chrome
  // first, Edge as the always-present Windows fallback.
  for (const channel of ['chrome', 'msedge']) {
    try {
      browser = await chromium.launch({ channel, headless: true })
      break
    } catch {
      /* try the next channel */
    }
  }
  if (!browser) throw new Error('neither Chrome nor Edge is available to playwright')

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[editor]', m.text())
  })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 60_000 })

  const renderButton = page.locator('button', { hasText: 'Render' }).first()
  await renderButton.waitFor({ timeout: 30_000 })
  // Force every face the scenes use to actually load before rendering.
  // Canvas measureText does NOT trigger @font-face fetches, so an unloaded
  // font makes the first scene cache fallback metrics — the icon ligature
  // then draws where the raw 'sports_motorsports' string would sit
  // (verified: intro glyph off-tile, outro fine once the font had landed).
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('300 100px "Material Symbols Outlined"'),
      document.fonts.load('400 100px Inter'),
      document.fonts.load('700 100px Inter'),
      document.fonts.load('400 100px "JetBrains Mono"'),
      document.fonts.load('700 100px "JetBrains Mono"')
    ])
    await document.fonts.ready
  })
  // Let the project fully evaluate (scene metas, images) before rendering —
  // the editor is interactive well before assets settle.
  await page.waitForTimeout(3_000)

  // The exporter may OVERWRITE a prior run's project.mp4 rather than mint a
  // new name — detect by mtime advancing past the click, not by name novelty.
  const renderStart = Date.now()
  console.log('rendering…')
  await renderButton.click()

  // Completion = the editor is back out of its rendering state (a button
  // reading exactly "Render" again — checked via evaluate, which can't time
  // out on a mid-render DOM) AND the new mp4's size has stopped growing
  // (ffmpeg flushes in bursts, so size alone plateaus mid-render).
  const started = Date.now()
  let mp4 = null
  let lastSize = -1
  let stable = 0
  for (;;) {
    if (Date.now() - started > 15 * 60_000) throw new Error('render timed out after 15 min')
    await new Promise((r) => setTimeout(r, 2_000))
    if (!mp4 && existsSync(outputDir)) {
      mp4 =
        readdirSync(outputDir).find(
          (f) =>
            f.endsWith('.mp4') && statSync(join(outputDir, f)).mtimeMs > renderStart - 5_000
        ) ?? null
      if (mp4) console.log('exporter writing', mp4)
    }
    if (!mp4) continue
    const size = statSync(join(outputDir, mp4)).size
    stable = size === lastSize && size > 0 ? stable + 1 : 0
    lastSize = size
    const idle = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(
        (b) => (b.textContent ?? '').trim().toLowerCase() === 'render'
      )
    )
    if (idle && stable >= 2) break
  }

  const final = join(outputDir, 'agent-race-control-trailer.mp4')
  if (mp4 !== 'agent-race-control-trailer.mp4') {
    // ffmpeg can hold its handle for a beat after the UI reports done —
    // retry the rename briefly instead of dying on Windows' EPERM.
    for (let attempt = 0; ; attempt++) {
      try {
        rmSync(final, { force: true })
        renameSync(join(outputDir, mp4), final)
        break
      } catch (error) {
        if (attempt >= 10) throw error
        await new Promise((r) => setTimeout(r, 1_000))
      }
    }
  }
  console.log('done:', final, `(${(statSync(final).size / 1e6).toFixed(1)} MB)`)
} finally {
  await browser?.close()
  server.kill()
  // npx on Windows leaves the tree alive after kill(); take it down by pid.
  spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true })
}
