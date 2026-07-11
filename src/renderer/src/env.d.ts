/// <reference types="svelte" />
/// <reference types="vite/client" />

// The preload contextBridge API — the renderer's only window into main.
interface Window {
  arc: {
    electronVersion: string
  }
}
