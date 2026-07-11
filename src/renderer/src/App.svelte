<script lang="ts">
  import Terminal from './Terminal.svelte'
</script>

<div class="shell">
  <aside class="rail">
    <header class="rail-title">aRC</header>
    <div class="rail-body">
      <p class="placeholder">sessions</p>
    </div>
  </aside>
  <main class="pane">
    <Terminal />
  </main>
</div>

<style>
  :global(html, body, #app) {
    margin: 0;
    height: 100%;
  }

  .shell {
    display: flex;
    height: 100%;
    font-family: system-ui, sans-serif;
    /* Placeholder look; the GitHub light/dark palettes arrive in Phase 4. */
    background: #0d1117;
    color: #e6edf3;
  }

  .rail {
    display: flex;
    flex-direction: column;
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid #30363d;
  }

  .rail-title {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .rail-body {
    flex: 1;
    padding: 0 16px;
  }

  .pane {
    flex: 1;
    min-width: 0;
    padding: 8px;
  }

  .placeholder {
    font-size: 12px;
    color: #7d8590;
  }
</style>
