import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Vite's dev-server file allow-list is rooted at the project directory. A git
// worktree has no node_modules of its own — Node resolves them from the main
// checkout several levels up — so the bundled webfonts land OUTSIDE the
// allow-list and the dev server 403s them, which shows up as a UI full of
// missing icon glyphs. Walk up to whichever directory actually owns
// node_modules and allow that too. In a normal checkout this resolves to the
// project directory itself and changes nothing; dev server only, since a
// packaged build serves from the asar.
function nodeModulesOwner(from: string): string {
  let dir = from
  for (;;) {
    if (existsSync(join(dir, 'node_modules'))) return dir
    const up = dirname(dir)
    if (up === dir) return from
    dir = up
  }
}

const projectRoot = dirname(fileURLToPath(import.meta.url))
const depsRoot = nodeModulesOwner(projectRoot)

// Entry points follow electron-vite conventions:
//   main    -> src/main/index.ts
//   preload -> src/preload/index.ts
//   renderer-> src/renderer/index.html
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [svelte()],
    server: { fs: { allow: [projectRoot, depsRoot] } }
  }
})
