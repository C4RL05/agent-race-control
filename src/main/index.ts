import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { registerPtyHandlers, killAllPtys } from './pty'
import { startStatusServer } from './status'

// One window, one taskbar icon — a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let win: BrowserWindow | null = null

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
    win.on('closed', () => {
      win = null
    })

    // The renderer never opens new windows.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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
  // dialog's starting point (in-memory only — persistence is Phase 6).
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

  app.whenReady().then(async () => {
    await startStatusServer((claudeSessionId, status) => {
      win?.webContents.send('session:status', claudeSessionId, status)
    })
    registerPtyHandlers(() => win?.webContents ?? null)
    createWindow()
  })

  app.on('will-quit', () => {
    killAllPtys()
  })

  // Windows-only app: closing the window quits.
  app.on('window-all-closed', () => {
    app.quit()
  })
}
