<script module lang="ts">
  import { marked } from 'marked'

  // Diff coloring (issue #1). The reducer emits Edit/MultiEdit as ```diff
  // blocks with `+ `/`- ` prefixes (transcript.ts) — this is the highlighter
  // that was missing. A `diff`-language fence renders each line as a block
  // span tinted by its leading marker; every other code block falls through to
  // marked's default (return false), so full-file Write listings stay plain.
  // Registered at module scope so it runs once, not per preview mount.
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // `+`/`-` mark added/removed; `+++`/`---` (file headers), `@@`, and context
  // lines stay neutral, so a hand-written ```diff in prose colors correctly
  // too. We build raw HTML, so escape the line ourselves; DOMPurify keeps the
  // classes. Empty lines get a zero-width space to preserve their height.
  function renderDiff(text: string): string {
    const html = text
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => {
        const cls = /^\+(?!\+\+)/.test(line)
          ? ' diff-add'
          : /^-(?!--)/.test(line)
            ? ' diff-del'
            : ''
        return `<span class="dl${cls}">${escapeHtml(line) || '&#8203;'}</span>`
      })
      .join('')
    return `<pre class="diff"><code class="language-diff">${html}</code></pre>`
  }

  marked.use({
    renderer: {
      code(token) {
        if ((token.lang ?? '').split(/\s+/)[0] === 'diff') return renderDiff(token.text)
        return false
      }
    }
  })
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import DOMPurify from 'dompurify'
  import { previewItems } from './sessions.svelte'

  // Read-only conversation preview: a pure view of the per-session item
  // cache the store fills from main's transcript tail (the stream is routed
  // once, in App — see applyPreviewItems). Mounting arms the tail,
  // unmounting only disarms it — the cache and main's byte offset both
  // survive, so remounting renders instantly from memory and ships just the
  // delta. Observation only — nothing here can write to the session.
  // proseFont (sans, the Preview picker) styles the conversation text; codeFont
  // (the terminal mono) styles code spans/blocks via --mono — code stays mono.
  let {
    sessionId,
    cwd,
    proseFont,
    codeFont
  }: { sessionId: string; cwd: string; proseFont: string; codeFont: string } = $props()

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

<div
  class="preview"
  style:font-family={proseFont}
  style:--mono={codeFont}
  bind:this={scroller}
  onscroll={onScroll}
>
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

  /* Diff blocks (issue #1) — faint per-line tint, green added / red deleted,
     from the theme's success/danger tokens via color-mix so it tracks
     light/dark. The +/- prefixes stay the non-color signal. code is
     inline-block/min-width:100% so each line's tint bleeds to the block edges
     and across horizontal scroll; the pre keeps vertical padding only, which
     also keeps the tint clear of the rounded corners. */
  .assistant :global(pre.diff) {
    padding: 8px 0;
  }

  .assistant :global(pre.diff code) {
    display: inline-block;
    min-width: 100%;
    box-sizing: border-box;
  }

  .assistant :global(pre.diff .dl) {
    display: block;
    padding: 0 10px;
    box-sizing: border-box;
  }

  .assistant :global(pre.diff .diff-add) {
    background: color-mix(in srgb, var(--success) 15%, transparent);
  }

  .assistant :global(pre.diff .diff-del) {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
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
