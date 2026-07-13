// Generates build/icon.ico — run with:  npx electron scripts/make-icon.mjs
//
// A hidden Electron window draws the EXACT canvas the running app draws for
// its window/taskbar icon (App.svelte: sports_motorsports glyph, weight 300,
// white on black) at every ICO size, and this script composes the PNGs into
// a PNG-compressed ICO by hand (valid since Windows Vista). No image
// dependencies; the .ico is checked in — regenerate when the drawing changes.
import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fontUrl = pathToFileURL(
  join(root, 'node_modules', 'material-symbols', 'material-symbols-outlined.woff2')
).href
const SIZES = [16, 24, 32, 48, 64, 128, 256]

app.whenReady().then(async () => {
  // webSecurity off only so the about:blank page may load the file:// font —
  // a throwaway build-script window, nothing app-like.
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } })
  await win.loadURL('about:blank')
  const pngs = await win.webContents.executeJavaScript(`
    (async () => {
      const face = new FontFace('Material Symbols Outlined', 'url(${fontUrl})', {
        weight: '100 700'
      })
      await face.load()
      document.fonts.add(face)
      return ${JSON.stringify(SIZES)}.map((size) => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#ffffff'
        ctx.font = '300 ' + Math.round(size * 0.875) + 'px "Material Symbols Outlined"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('sports_motorsports', size / 2, size * 0.54)
        return canvas.toDataURL('image/png').split(',')[1]
      })
    })()
  `)

  // ICO layout: ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per image +
  // the image payloads (raw PNG blobs) back to back.
  const images = pngs.map((b64, i) => ({ size: SIZES[i], data: Buffer.from(b64, 'base64') }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const image of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 0) // width, 0 = 256
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 1) // height, 0 = 256
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(image.data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += image.data.length
    entries.push(entry)
  }
  mkdirSync(join(root, 'build'), { recursive: true })
  const icoPath = join(root, 'build', 'icon.ico')
  writeFileSync(icoPath, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]))
  console.log(`${icoPath} written (${SIZES.join('/')}px)`)
  app.exit(0)
})
