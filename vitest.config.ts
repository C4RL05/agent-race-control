import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Unit tests for pure logic only (see CLAUDE.md) — no component tests, no
// E2E; the terminal surface is verified by running the app. The svelte
// plugin lets tests import runes modules (sessions.svelte.ts) directly;
// 'browser' resolves svelte to its client runtime so $state behaves as it
// does in the app.
export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    include: ['src/**/*.test.ts']
  }
})
