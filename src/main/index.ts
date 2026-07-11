import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { registerPtyHandlers, killAllPtys } from './pty'
import { startStatusServer } from './status'
import { loadState, saveState, flushState } from './state'
import type { AppState } from './state'

// One window, one taskbar icon — a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let win: BrowserWindow | null = null

  // Window zoom, VS Code style (each level = ±20%). Persisted via the state
  // JSON (merged in main, like lastPickedDir).
  let zoomLevel = 0
  let lastState: AppState | null = null

  function applyZoom(delta: number | null): void {
    zoomLevel = delta === null ? 0 : Math.max(-3, Math.min(4, zoomLevel + delta))
    win?.webContents.setZoomLevel(zoomLevel)
    if (lastState) saveState({ ...lastState, zoomLevel })
  }

  // No application menu: Electron's default menu accelerators (Ctrl+R reload,
  // Ctrl+W close, Ctrl+Shift+I, ...) fire even with the menu bar hidden —
  // they shadow terminal keystrokes (zero-shadow rule) and an accidental
  // reload duplicates restored sessions and orphans PTYs.
  Menu.setApplicationMenu(null)

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
    })

    // The renderer never opens new windows.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    // ...and never navigates away (also stops file drops from navigating to
    // the dropped file — the Terminal pastes its path instead).
    win.webContents.on('will-navigate', (event) => event.preventDefault())

    // If the renderer ever reloads (dev), the old page's PTYs would be
    // orphaned in this process — kill them; the new page respawns via state.
    win.webContents.on('did-start-navigation', (event) => {
      if (event.isMainFrame && !event.isSameDocument) killAllPtys()
    })

    // Chrome-level keys. Zoom follows Windows Terminal / VS Code convention
    // (Ctrl+= / Ctrl+- / Ctrl+0) — the one deliberate set of shadowed keys.
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return
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

    // Dev-only devtools access (no menu = no default accelerator).
    if (!app.isPackaged) {
      win.webContents.on('before-input-event', (_event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
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

  // Window/taskbar icon, rendered by the renderer from the bundled Material
  // Symbols font (sports_score — the checkered flag). Multi-resolution so
  // Windows gets a crisp raster at every DPI size. No icon asset to ship.
  // The packaged .exe will need a real .ico at packaging time (post-v1).
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

  app.whenReady().then(async () => {
    await startStatusServer((claudeSessionId, status) => {
      win?.webContents.send('session:status', claudeSessionId, status)
    })
    registerPtyHandlers(() => win?.webContents ?? null)
    createWindow()
  })

  app.on('will-quit', () => {
    flushState()
    killAllPtys()
  })

  // Windows-only app: closing the window quits.
  app.on('window-all-closed', () => {
    app.quit()
  })
}
