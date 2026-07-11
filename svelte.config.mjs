import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Enables lang="ts" in .svelte files (transpiled by esbuild via Vite).
  preprocess: vitePreprocess()
}
