<script lang="ts">
  import type { Session } from './sessions.svelte'

  // The Notes tab: a plain text scratchpad per Claude session — the original
  // Notepad, not an editor. No markdown, no toolbar, no formatting, no files
  // on disk of its own: the text is a field on the session, so it rides the
  // same state JSON as everything else the app remembers (the "no database"
  // rule; main debounces the write at 300ms, which is what makes binding
  // straight to the store cheap enough to do on every keystroke).
  //
  // Mounted for the life of the session and merely hidden between tab
  // switches, like the terminal and unlike Preview/Info — a textarea that
  // unmounts loses its undo history and scroll position, and losing Ctrl+Z by
  // looking at the terminal is not what a notepad does.
  let { session, codeFont, active }: { session: Session; codeFont: string; active: boolean } =
    $props()

  let area = $state<HTMLTextAreaElement | null>(null)

  // Ready to type the moment the tab is picked. Only when this pane is the
  // focused one AND showing notes, since every session keeps its own mounted.
  $effect(() => {
    if (active) area?.focus()
  })
</script>

<textarea
  bind:this={area}
  bind:value={session.notes}
  class="notes"
  style:font-family={codeFont}
  placeholder="Notes for this session"
  spellcheck="false"
  aria-label="Session notes"></textarea>

<style>
  .notes {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 12px 16px;
    border: none;
    outline: none;
    resize: none;
    background: var(--bg);
    color: var(--fg);
    font-size: 13px;
    line-height: 1.6;
    /* Notepad's own default. Off would mean a horizontal scrollbar on every
       long line, which is the one thing about Notepad nobody misses. */
    white-space: pre-wrap;
  }

  .notes::placeholder {
    color: var(--fg-muted);
  }
</style>
