import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { registerPtyHandlers, killAllPtys, hasClaudeSessions } from './pty'
import { applyLoginPath } from './login-path'
import { startAgentPolling, stopAgentPolling } from './agents'
import { startStatusServer } from './status'
import { registerTranscriptHandlers, disposeAllTails } from './transcript'
import { registerSessionInfoHandlers } from './sessioninfo'
import { loadState, saveState, flushState } from './state'
import type { AppState } from './state'
import { getGitInfo, listWorktrees } from './git'

// Blessed dev-only deviation (screenshot harness, see the kickoff doc): a
// scratch profile so staged runs never touch the real tower. Must be set
// before the single-instance lock below — userData is the lock's identity,
// so a harness run and the real app can coexist.
if (!app.isPackaged && process.env['ARC_USERDATA']) {
  app.setPath('userData', process.env['ARC_USERDATA'])
}

// One window, one taskbar icon — a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let win: BrowserWindow | null = null

  // Windows first, macOS in progress: every host difference in this file reads
  // off this one flag, and each is a Cmd-vs-Ctrl or a lifecycle rule.
  const isMac = process.platform === 'darwin'

  // Everything a renderer page owns in this process — one list, shared by
  // both teardown hooks (page reload and quit), so a future per-page
  // resource can't be released in one and leaked in the other.
  function releasePageResources(): void {
    killAllPtys()
    disposeAllTails()
  }

  // Window zoom, VS Code style (each level = ±20%). Persisted via the state
  // JSON (merged in main, like lastPickedDir).
  let zoomLevel = 0
  let lastState: AppState | null = null

  function applyZoom(delta: number | null): void {
    zoomLevel = delta === null ? 0 : Math.max(-3, Math.min(4, zoomLevel + delta))
    win?.webContents.setZoomLevel(zoomLevel)
    // The renderer keeps its own per-pane zoom levels on top of this one, and
    // these keys mean "size the app": tell it to drop them back to 0 so the
    // whole window is once again at one size. Sent on every press, including a
    // press that hits the clamp — the panes still have to come back into line.
    win?.webContents.send('zoom:sync')
    if (lastState) saveState({ ...lastState, zoomLevel })
  }

  // The application menu — the one piece of chrome that differs by host.
  //
  // Windows keeps NO menu: Electron's default menu accelerators (Ctrl+R
  // reload, Ctrl+W close, Ctrl+Shift+I, ...) fire even with the menu bar
  // hidden — they shadow terminal keystrokes (zero-shadow rule) and an
  // accidental reload duplicates restored sessions and orphans PTYs.
  //
  // macOS gets one, and it costs the zero-shadow rule nothing: every Mac
  // accelerator is Cmd-based, and Cmd is not a modifier any TUI reads. Without
  // a menu a Mac has no Cmd+Q and — the one that actually hurts — no clipboard
  // anywhere in the app, because on that platform Cut/Copy/Paste ARE menu
  // roles: the Notes tab, the rename field and the filter box all lose Cmd+V.
  // Deliberately absent, each for a reason that outlives the platform:
  //   - Close (Cmd+W). The window IS every session in the tower, and closing
  //     it kills them all (see the `closed` handler). The red button and Cmd+Q
  //     already do that deliberately; a menu item one key away from Cmd+E does
  //     not deserve to.
  //   - Reload. The same orphaning reason Windows has no menu at all.
  //   - View > Zoom. The zoom keys are owned by before-input-event below, on
  //     both hosts — a menu role as a second owner zooms twice on one press.
  function applyApplicationMenu(): void {
    if (!isMac) {
      Menu.setApplicationMenu(null)
      return
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' }
          ]
        },
        { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] }
      ])
    )
  }

  function createWindow(): void {
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    win.on('ready-to-show', () => win?.show())
    // Fallback: some Electron/GPU states never fire ready-to-show even after
    // a successful load — never leave the window invisible.
    win.webContents.once('did-finish-load', () => {
      if (win && !win.isVisible()) win.show()
    })
    win.on('closed', () => {
      win = null
      // The page IS the running tower: xterm's buffers live there, and nothing
      // can re-attach a PTY to a new page (see did-start-navigation). On
      // Windows the quit that follows would do this anyway; on macOS the app
      // stays in the Dock, so without it every agent keeps running with no
      // window left to reach it from. Re-opening restores from the state JSON
      // exactly as a launch does — Claude rows resume their transcripts, codex
      // rows `codex resume`, shells come up fresh.
      flushState()
      releasePageResources()
    })

    // The renderer never opens new windows — http(s) targets (links in the
    // conversation preview) go to the OS browser instead. Scheme-restricted:
    // never hand shell.openExternal anything else.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })

    // ...and never navigates away (also stops file drops from navigating to
    // the dropped file — the Terminal pastes its path instead). Same http(s)
    // escape hatch: a plain click on a preview link lands here.
    win.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      if (/^https?:/i.test(url)) void shell.openExternal(url)
    })

    // If the renderer ever reloads (dev), the old page's PTYs and transcript
    // watchers would be orphaned in this process — release them; the new
    // page respawns and re-subscribes via state on its own.
    win.webContents.on('did-start-navigation', (event) => {
      if (event.isMainFrame && !event.isSameDocument) releasePageResources()
    })

    // Chrome-level keys. Zoom follows the host's own convention — Ctrl+= /
    // Ctrl+- / Ctrl+0 on Windows (Windows Terminal, VS Code), Cmd+= / Cmd+- /
    // Cmd+0 on macOS — the one deliberate set of shadowed keys. Only ever the
    // host's own: the other modifier must be absent, so Ctrl+- on a Mac stays
    // a keystroke the TUI is entitled to.
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.alt) return
      if (isMac ? !input.meta || input.control : !input.control || input.meta) return
      if (input.key === '+' || input.key === '=') {
        event.preventDefault()
        applyZoom(1)
      } else if (input.key === '-' || input.key === '_') {
        event.preventDefault()
        applyZoom(-1)
      } else if (input.key === '0') {
        event.preventDefault()
        applyZoom(null)
      }
    })

    // Dev-only devtools access (the menu carries no View item on either host).
    // Cmd+Alt+I alongside F12 on macOS, where a laptop's F12 needs Fn and is
    // usually the system's volume key: matched on `code`, since Alt on that
    // host rewrites `key` to the character the option layer produces.
    if (!app.isPackaged) {
      win.webContents.on('before-input-event', (_event, input) => {
        if (input.type !== 'keyDown') return
        if (input.key === 'F12' || (isMac && input.meta && input.alt && input.code === 'KeyI')) {
          win?.webContents.toggleDevTools()
        }
      })
    }

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  // New-session working directory picker; remembers the last pick as the
  // dialog's starting point (persisted via the state JSON).
  let lastPickedDir: string | undefined
  ipcMain.handle('dialog:pickFolder', async () => {
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose the session working directory',
      properties: ['openDirectory'],
      defaultPath: lastPickedDir
    })
    const picked = result.canceled ? null : (result.filePaths[0] ?? null)
    if (picked) lastPickedDir = picked
    return picked
  })

  ipcMain.on('shell:openPath', (_event, path: string) => {
    void shell.openPath(path)
  })

  // Read-only git observability for the tower's repo→branch tree (issue #5).
  // getGitInfo is fail-open, so this handler never rejects.
  ipcMain.handle('git:info', (_event, cwd: string) => getGitInfo(cwd))

  // Read-only worktree list for the repo card's reopen menu (fail-open too).
  ipcMain.handle('git:worktrees', (_event, repoRoot: string) => listWorktrees(repoRoot))

  // Window/taskbar icon, scaled by the renderer from the bundled pixel-art
  // PNG (src/renderer/src/assets/arc.png — the same file make-icon.mjs bakes
  // into build/icon.ico for the packaged .exe). Multi-resolution so Windows
  // gets a crisp raster at every DPI size.
  ipcMain.on(
    'app:setIcon',
    (_event, representations: Array<{ scaleFactor: number; dataURL: string }>) => {
      const icon = nativeImage.createEmpty()
      for (const rep of representations) {
        icon.addRepresentation({ scaleFactor: rep.scaleFactor, dataURL: rep.dataURL })
      }
      win?.setIcon(icon)
    }
  )

  ipcMain.handle('state:load', () => {
    const state = loadState()
    if (state?.lastPickedDir) lastPickedDir = state.lastPickedDir
    if (state?.zoomLevel !== undefined) {
      zoomLevel = state.zoomLevel
      win?.webContents.setZoomLevel(zoomLevel)
    }
    return state
  })

  ipcMain.on('state:save', (_event, state: AppState) => {
    lastState = state
    saveState({ ...state, lastPickedDir, zoomLevel })
  })

  app
    .whenReady()
    .then(async () => {
      // FIRST, and awaited: repair this process's PATH before anything can spawn.
      // A Finder-launched macOS app has launchd's PATH and a Windows app can have
      // a stale environment block — login-path.ts carries both measurements. One
      // repair here covers every later caller (git.ts, and the absolute `claude`
      // agents.ts resolves), and it can only ever add entries, so a failure costs
      // nothing.
      const path = await applyLoginPath()
      console.log(
        path.applied
          ? `[arc] PATH repaired: ${path.path}`
          : `[arc] PATH left as inherited: ${path.reason}`
      )

      // Two channels, deliberately unequal (see the kickoff doc): hooks carry the
      // TURN boundaries — instant and precise — while the poll is only a floor,
      // because `claude agents --json` reports `busy` for a finished turn that
      // still owns a background shell and so can never colour the dot red.
      await startStatusServer((hookToken, claudeSessionId, event, cwd) => {
        win?.webContents.send('session:status', hookToken, claudeSessionId, event, cwd)
      })
      registerPtyHandlers(() => win?.webContents ?? null)
      registerTranscriptHandlers(() => win?.webContents ?? null)
      // Pull-only, and only while the Session tab is open (see sessioninfo.ts).
      registerSessionInfoHandlers()
      // One `claude agents --json` per tick for the whole tower, and only while a
      // Claude PTY is alive (see agents.ts).
      startAgentPolling(hasClaudeSessions, (entries) => {
        win?.webContents.send('session:agents', entries)
      })
      applyApplicationMenu()
      createWindow()

      // macOS: clicking the Dock icon with no window open brings the tower
      // back. Registered inside whenReady, after the IPC handlers the restored
      // page calls the moment it loads — an activate can never race them.
      app.on('activate', () => {
        if (!win) createWindow()
      })
    })
    // Startup is now an async chain with an await at the top of it, so a throw
    // anywhere in it would leave the app running with no window and nothing
    // printed. Nothing above currently rejects — applyLoginPath catches
    // everything by design — but "the first thing that runs is awaited" is
    // exactly the shape where a later edit makes that untrue silently.
    .catch((err: unknown) => {
      console.error('[arc] startup failed', err)
      app.quit()
    })

  app.on('will-quit', () => {
    flushState()
    stopAgentPolling()
    releasePageResources()
  })

  // Closing the window quits — except on macOS, where an app with no window is
  // a normal resting state and quitting is Cmd+Q's job. The sessions are gone
  // either way (the `closed` handler releases them); what survives here is the
  // Dock icon that brings them back.
  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })
}
