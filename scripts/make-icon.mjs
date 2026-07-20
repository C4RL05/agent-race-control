// Generates build/icon.ico — run with:  npx electron scripts/make-icon.mjs
//
// A hidden Electron window rasterizes the app icon SVG
// (src/renderer/src/assets/arc.svg — the same file App.svelte rasterizes at
// runtime for the window/taskbar icon; one source, zero drift) at every ICO
// size, and this script composes the PNGs into a PNG-compressed ICO by hand
// (valid since Windows Vista). No image dependencies; the .ico is checked
// in — regenerate when the SVG changes.
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'src', 'renderer', 'src', 'assets', 'arc.svg'), 'utf8')
const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
const SIZES = [16, 24, 32, 48, 64, 128, 256]

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  const pngs = await win.webContents.executeJavaScript(`
    (async () => {
      const img = new Image()
      img.src = ${JSON.stringify(svgUrl)}
      await img.decode()
      return ${JSON.stringify(SIZES)}.map((size) => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        // letterboxed: the SVG viewBox isn't square — stretching would
        // distort the helmet (only the ratio of naturalWidth/Height matters)
        const iw = img.naturalWidth || 1
        const ih = img.naturalHeight || 1
        const fit = Math.min(size / iw, size / ih)
        const w = iw * fit
        const h = ih * fit
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
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
