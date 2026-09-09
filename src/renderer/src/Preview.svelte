<script module lang="ts">
  import { marked } from 'marked'

  // The two things this file adds to marked's code fences, both registered at
  // module scope so they run once rather than per preview mount.
  //
  // Diff coloring (issue #1): the reducer emits Edit/MultiEdit as ```diff
  // blocks with `+ `/`- ` prefixes (transcript.ts), and a `diff`-language fence
  // renders each line as a block span tinted by its leading marker. Write
  // listings carry a real language and stay plain.
  //
  // The file NAME (2026-09-09): a block the session wrote arrives with its
  // name in the fence info string, and is drawn as a tab welded to the top of
  // the code that folds it. Anything else — a fence in Claude's own prose —
  // falls through to marked's default (return false) untouched.
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

  // A code fence's info string, in the one shape the reducer emits:
  // `<lang>` alone, or `<lang> title="<file name>"` when the block is a file
  // the session wrote (transcript.ts). `\S*` may match empty, which is how an
  // unknown extension — no language at all — still parses its title.
  const INFO = /^(\S*)\s*title="([^"]*)"\s*$/

  function splitInfo(info: string): { lang: string; title: string } {
    const match = INFO.exec(info)
    if (match) return { lang: match[1], title: match[2] }
    return { lang: info.split(/\s+/)[0] ?? '', title: '' }
  }

  // marked's own default, reproduced because a titled block has to be wrapped
  // and `return false` (fall through to the default) can't be wrapped.
  function plainCode(text: string, lang: string): string {
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${cls}>${escapeHtml(text.replace(/\n$/, ''))}\n</code></pre>`
  }

  // The file name as a TAB on the code rather than a line of prose above it:
  // one <details> whose <summary> is the tab, so the same thing that names the
  // block folds it. Native disclosure — no script inside rendered content, and
  // DOMPurify passes details/summary.
  //
  // FOLDED by default (no `open`). The preview is for reading the
  // conversation, and a file listing is the one thing in it that can run to
  // hundreds of lines — expanded, a single Write buries the prose either side
  // of it. The tab keeps saying what was written, so nothing is hidden that
  // the reader has to go looking for; the code is one click away when it is
  // the code they actually came for.
  function fileBlock(title: string, block: string): string {
    return `<details class="file"><summary class="file-tab">${escapeHtml(title)}</summary>${block}</details>`
  }

  marked.use({
    renderer: {
      code(token) {
        const { lang, title } = splitInfo((token.lang ?? '').trim())
        // Neither ours: let marked render it exactly as it always has.
        if (lang !== 'diff' && !title) return false
        const block = lang === 'diff' ? renderDiff(token.text) : plainCode(token.text, lang)
        return title ? fileBlock(title, block) : block
      }
    }
  })
</script>

<script lang="ts">
  import { tick } from 'svelte'
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
    kind = 'claude',
    proseFont,
    codeFont
  }: {
    sessionId: string
    cwd: string
    // Which agent wrote this transcript — main uses it to pick both the file
    // and the fold, the only two things that differ between them.
    kind?: 'claude' | 'codex'
    proseFont: string
    codeFont: string
  } = $props()

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

  // Arm the tail for the current conversation id, re-arming if it changes —
  // `/clear` re-points sessionId to a fresh transcript mid-mount (issue #2), so
  // the cleanup disarms the old id and the re-run watches the new one.
  $effect(() => {
    const id = sessionId
    window.arc.transcript.watch(id, cwd, kind)
    return () => window.arc.transcript.unwatch(id)
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

  /* A file the session wrote: <details> whose <summary> is a tab welded to the
     top-left of the block. The tab is where the name used to sit as a line of
     prose — same information, but attached to the thing it names, and clicking
     it folds the code. `display: flex` on the summary is what drops the native
     disclosure triangle; the chevron below replaces it. */
  .assistant :global(details.file) {
    margin: 8px 0;
  }

  .assistant :global(details.file > summary) {
    display: flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    background: var(--bg-subtle);
    color: var(--fg-muted);
    font-family: var(--mono);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    user-select: none;
  }

  .assistant :global(details.file > summary:hover) {
    color: var(--fg);
  }

  /* Folded, the tab is all there is, so it closes itself into a whole pill. */
  .assistant :global(details.file:not([open]) > summary) {
    border-bottom: 1px solid var(--border);
    border-radius: 6px;
  }

  /* The app's own caret glyph, drawn from the Material Symbols ligature the
     rest of the chrome uses — reachable here because the face is registered
     app-wide, and this is rendered content that must not carry markup of its
     own. Points down when open, right when folded. */
  .assistant :global(details.file > summary::before) {
    content: 'expand_more';
    flex: none;
    font-family: 'Material Symbols Outlined';
    font-size: 14px;
    font-weight: normal;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    white-space: nowrap;
    direction: ltr;
    font-feature-settings: 'liga';
    font-variation-settings: 'wght' 300;
    transition: transform 0.12s;
  }

  .assistant :global(details.file:not([open]) > summary::before) {
    transform: rotate(-90deg);
  }

  /* The block loses the corner the tab sits on, and the margin that would
     otherwise open a gap between the two — the details owns the spacing. */
  .assistant :global(details.file > pre) {
    margin: 0;
    border-top-left-radius: 0;
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
