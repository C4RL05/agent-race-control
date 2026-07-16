<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import { previewItems } from './sessions.svelte'

  // Read-only conversation preview: a pure view of the per-session item
  // cache the store fills from main's transcript tail (the stream is routed
  // once, in App — see applyPreviewItems). Mounting arms the tail,
  // unmounting only disarms it — the cache and main's byte offset both
  // survive, so remounting renders instantly from memory and ships just the
  // delta. Observation only — nothing here can write to the session.
  let { sessionId, cwd, fontFamily }: { sessionId: string; cwd: string; fontFamily: string } =
    $props()

  const items = $derived(previewItems[sessionId] ?? [])
  let scroller: HTMLDivElement

  // Auto-scroll to the live tail unless the user has scrolled up to read.
  let stick = true

  function onScroll(): void {
    stick = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 32
  }

  // Conversation content is untrusted input — never inject unsanitized HTML.
  // style is forbidden on top of the defaults: inline CSS (position:fixed,
  // z-index) would let rendered content overlay and spoof the app's own UI.
  function render(text: string): string {
    return DOMPurify.sanitize(marked.parse(text, { async: false }), { FORBID_ATTR: ['style'] })
  }

  onMount(() => {
    window.arc.transcript.watch(sessionId, cwd)
    return () => window.arc.transcript.unwatch(sessionId)
  })

  // Follow appended items — and the initial cached render — unless the user
  // has scrolled up.
  $effect(() => {
    void items.length
    if (stick) void tick().then(() => scroller?.scrollTo({ top: scroller.scrollHeight }))
  })
</script>

<div class="preview" style:--mono={fontFamily} bind:this={scroller} onscroll={onScroll}>
  {#if items.length === 0}
    <div class="empty">No conversation yet.</div>
  {:else}
    {#each items as item}
      {#if item.kind === 'assistant'}
        <div class="assistant">{@html render(item.text)}</div>
      {:else}
        <div class="user">{item.text}</div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .preview {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.55;
    user-select: text;
    overflow-wrap: break-word;
  }

  /* .empty comes from App.svelte's shared :global rule */

  .user {
    margin: 16px 0 10px;
    padding: 6px 10px;
    border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0;
    background: var(--bg-subtle);
    white-space: pre-wrap;
  }

  .preview > :first-child {
    margin-top: 0;
  }

  .assistant {
    margin: 10px 0;
  }

  /* Markdown body — minimal GitHub-flavored styling off the chrome vars. */
  .assistant :global(p) {
    margin: 8px 0;
  }

  .assistant :global(h1),
  .assistant :global(h2),
  .assistant :global(h3),
  .assistant :global(h4),
  .assistant :global(h5),
  .assistant :global(h6) {
    margin: 14px 0 6px;
    font-size: 1em;
    font-weight: 700;
  }

  .assistant :global(h1) {
    font-size: 1.15em;
  }

  .assistant :global(h2) {
    font-size: 1.05em;
  }

  .assistant :global(code) {
    font-family: var(--mono);
    font-size: 11.5px;
    background: var(--bg-subtle);
    padding: 1px 4px;
    border-radius: 4px;
  }

  .assistant :global(pre) {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    overflow-x: auto;
  }

  .assistant :global(pre code) {
    background: none;
    padding: 0;
  }

  .assistant :global(ul),
  .assistant :global(ol) {
    margin: 8px 0;
    padding-left: 22px;
  }

  .assistant :global(blockquote) {
    margin: 8px 0;
    padding-left: 10px;
    border-left: 3px solid var(--border);
    color: var(--fg-muted);
  }

  .assistant :global(a) {
    color: var(--accent);
  }

  .assistant :global(table) {
    border-collapse: collapse;
    display: block;
    overflow-x: auto;
  }

  .assistant :global(th),
  .assistant :global(td) {
    border: 1px solid var(--border);
    padding: 3px 8px;
  }

  .assistant :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
  }

  .assistant :global(img) {
    max-width: 100%;
  }
</style>
