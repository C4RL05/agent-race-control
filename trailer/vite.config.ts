import { defineConfig } from 'vite'
import motionCanvasPlugin from '@motion-canvas/vite-plugin'
import ffmpegPlugin from '@motion-canvas/ffmpeg'

// Both Motion Canvas plugins ship CJS with `exports.default`; imported from
// this ESM config the function arrives nested one level deep — unwrap it.
const unwrap = <T,>(m: T): T => ((m as { default?: T }).default ?? m) as T
const motionCanvas = unwrap(motionCanvasPlugin)
const ffmpeg = unwrap(ffmpegPlugin)

// The trailer imports the shipped doc screenshots straight from ../images —
// single source of truth, no copies — which needs an explicit reach above
// the vite root.
export default defineConfig({
  server: {
    fs: { allow: ['..'] }
  },
  plugins: [motionCanvas(), ffmpeg()]
})
