<script lang="ts">
  import { gitInfo, type Session } from './sessions.svelte'

  // The Session tab: everything the app knows about one running Claude session,
  // as read-only labeled text. It is an instrument panel, not a feature — the
  // one control on it copies what is already on screen, and nothing here writes
  // anywhere else.
  //
  // Three sources, deliberately shown side by side rather than reconciled:
  //   - the store (our computed status, the hook we last saw, the raw poll entry)
  //   - ~/.claude/sessions/<pid>.json, via main
  //   - the transcript, folded to metadata by main
  // The disagreements ARE the content: our dot next to the poll's raw `busy`,
  // the hook-counted subagents next to the transcript-counted ones. Both file
  // sources are Claude Code internals, so every field is best-effort and
  // missing renders as an em dash.
  let { session, codeFont }: { session: Session; codeFont: string } = $props()

  let info = $state<SessionInfo | null>(null)
  // Ticks once a second so the "age" readouts count up on their own — a dot
  // stuck on the wrong colour is only diagnosable if you can watch it stick.
  let now = $state(Date.now())

  const facts = $derived(info?.facts ?? null)
  const live = $derived(info?.live ?? null)
  const git = $derived(gitInfo[session.cwd] ?? null)

  // Re-arms on /clear (claudeSessionId changes) and on a --worktree cwd
  // adoption, so the fold main keeps is always the current conversation's.
  $effect(() => {
    const sessionId = session.claudeSessionId
    const cwd = session.cwd
    const pid = session.claudePid
    if (!sessionId) return
    let alive = true
    const load = (): void => {
      void window.arc.info.get({ sessionId, cwd, pid }).then((next) => {
        if (alive) info = next
      })
    }
    load()
    // Pull-only, and only while this tab is mounted — a closed tab costs main
    // nothing. 2s is a reading cadence: the numbers here are for inspection,
    // not for the dot, which has its own 1s floor.
    const timer = setInterval(load, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  })

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  const DASH = '—'

  function text(value: string | undefined | null): string {
    return value ? value : DASH
  }

  function count(value: number | null | undefined): string {
    return typeof value === 'number' ? value.toLocaleString() : DASH
  }

  // Coarse on purpose: 40.3k, not 40,317. This mirrors what Claude Code's own
  // status line shows, and the exact figure never matters at a glance.
  function tokens(value: number | null | undefined): string {
    if (typeof value !== 'number') return DASH
    if (value < 1000) return String(value)
    return `${(value / 1000).toFixed(1)}k`
  }

  function duration(ms: number | null | undefined): string {
    if (typeof ms !== 'number' || ms < 0) return DASH
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ${s % 60}s`
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }

  function since(at: number | null | undefined): string {
    return typeof at === 'number' ? duration(now - at) : DASH
  }

  function stamp(at: number | string | null | undefined): string {
    if (at === null || at === undefined || at === '') return DASH
    const date = new Date(at)
    return Number.isNaN(date.getTime()) ? DASH : date.toLocaleString()
  }

  function bytes(value: number | null | undefined): string {
    if (typeof value !== 'number') return DASH
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  // The one comparison the whole tab exists for: what we paint vs what the CLI
  // reports. They are ALLOWED to differ — the poll says `busy` for a finished
  // turn still holding a background shell — so this is a note, not a warning.
  const disagrees = $derived(
    !!session.agentEntry?.status &&
      session.agentEntry.status !== session.status &&
      !(session.agentEntry.status === 'busy' && session.status === 'running')
  )

  // The pane is DATA, not markup: one array feeds both the rendered rows and
  // the clipboard text. Copying is only worth having if the paste is the same
  // reading you were looking at — two renderers would drift, and a diagnosis
  // built on a field that only exists in one of them is worse than none.
  type InfoRow = { label: string; value: string; prose?: boolean; dot?: string }
  type InfoSection = { heading: string; rows: InfoRow[]; note?: string }

  const report = $derived.by((): InfoSection[] => {
    const sections: InfoSection[] = [
      {
        heading: 'Status',
        rows: [
          {
            label: 'Tower dot',
            value: `${session.status}${session.todo ? ' · todo' : ''}`,
            dot: session.status
          },
          { label: 'Age in status', value: since(session.statusSince) },
          {
            label: 'Poll reports',
            value: `${text(session.agentEntry?.status ?? live?.status)}${
              disagrees ? '  (differs — expected while a shell or subagent outlives the turn)' : ''
            }`
          },
          { label: 'Poll seen', value: since(session.agentEntryAt) },
          {
            label: 'Last hook',
            value: session.lastHook
              ? `${session.lastHook}  ·  ${since(session.lastHookAt)} ago`
              : DASH
          },
          { label: 'Age in CLI status', value: since(live?.statusUpdatedAt) }
        ]
      },
      {
        heading: 'Identity',
        rows: [
          { label: 'Terminal title', value: text(session.title) },
          { label: 'Conversation title', value: text(facts?.aiTitle) },
          {
            label: 'CLI name',
            value: live?.name
              ? `${live.name}${live.nameSource ? `  (${live.nameSource})` : ''}`
              : DASH
          },
          { label: 'Slug', value: text(facts?.slug) },
          { label: 'Conversation id', value: text(session.claudeSessionId) },
          { label: 'Spawn id (hook route)', value: text(session.hookToken) },
          {
            label: 'Claude pid',
            value: session.claudePid === null ? DASH : String(session.claudePid)
          },
          { label: 'Claude started', value: stamp(session.claudeStartedAt) },
          { label: 'Uptime', value: since(session.claudeStartedAt) },
          { label: 'PTY id', value: text(session.ptyId) },
          {
            label: 'Kind',
            value: live?.kind
              ? `${live.kind}${live.entrypoint ? ` · ${live.entrypoint}` : ''}`
              : DASH
          }
        ]
      },
      {
        heading: 'Conversation',
        rows: [
          { label: 'Model', value: text(facts?.model) },
          { label: 'Effort', value: text(facts?.effort) },
          { label: 'Permission mode', value: text(facts?.permissionMode) },
          { label: 'Mode', value: text(facts?.mode) },
          { label: 'Turns', value: count(facts?.turns) },
          { label: 'Last turn', value: duration(facts?.lastTurnMs) },
          { label: 'Messages', value: count(facts?.messageCount) },
          {
            label: 'Context',
            value:
              facts?.contextTokens === null || facts?.contextTokens === undefined
                ? DASH
                : `${tokens(facts.contextTokens)} tokens`
          },
          {
            label: 'Last output',
            value:
              facts?.outputTokens === null || facts?.outputTokens === undefined
                ? DASH
                : `${tokens(facts.outputTokens)} tokens${
                    facts.thinkingTokens ? ` · ${tokens(facts.thinkingTokens)} thinking` : ''
                  }`
          },
          { label: 'Service tier', value: text(facts?.serviceTier) },
          {
            label: 'Compactions',
            value:
              facts && facts.compactions > 0
                ? `${facts.compactions}  ·  last ${facts.compactTrigger || 'unknown'}: ${tokens(
                    facts.compactPreTokens
                  )} → ${tokens(facts.compactPostTokens)}`
                : count(facts?.compactions)
          },
          { label: 'Claude Code', value: text(live?.version ?? facts?.version) },
          { label: 'Last transcript entry', value: stamp(facts?.lastEntryAt) }
        ]
      },
      {
        heading: 'In flight',
        // Two independent counts of the same thing, on purpose. The hook count
        // is an edge tally (SubagentStart/Stop) and is what decides the
        // delegating dot; the transcript count is a level re-derived from the
        // file. When they disagree, the hook channel is the one that drifted.
        rows: [
          { label: 'Subagents (hooks)', value: String(session.subagentCount) },
          {
            label: 'Subagents (transcript)',
            value: facts
              ? `${facts.subagentsOpen} open  ·  ${facts.subagentsStarted} started`
              : DASH
          },
          {
            label: 'Background shells',
            value: facts ? `${facts.shellsOpen} open  ·  ${facts.shellsStarted} started` : DASH
          },
          { label: 'Queued prompts', value: count(facts?.queued) },
          {
            label: 'Hooks at last turn end',
            value:
              facts && facts.lastHooks.length > 0
                ? facts.lastHooks.map((hook) => `${hook.command} (${hook.durationMs}ms)`).join('\n')
                : DASH
          },
          { label: 'Hook errors', value: count(facts?.hookErrors) }
        ],
        note:
          'Open = started in this conversation and never recorded as finished. A run the app ' +
          'outlived leaves its shell counted here; the poll line above is the authority on ' +
          'whether anything is actually running.'
      },
      {
        heading: 'Place',
        rows: [
          { label: 'Working directory', value: session.cwd },
          { label: 'Repo', value: git?.isRepo ? git.repoName : DASH },
          { label: 'Worktree', value: git?.isRepo ? text(git.worktreeName) : DASH },
          { label: 'Branch', value: git?.isRepo ? text(git.branch) : DASH },
          {
            label: 'Branch state',
            value: git?.isRepo
              ? `${git.dirty ? 'dirty' : 'clean'}${
                  git.base ? `  ·  ↑${git.ahead} ↓${git.behind} vs ${git.base}` : ''
                }`
              : DASH
          },
          { label: 'Transcript', value: info ? info.transcriptPath : DASH },
          {
            label: 'Transcript size',
            value:
              info?.transcriptBytes === null || info?.transcriptBytes === undefined
                ? 'not written yet'
                : bytes(info.transcriptBytes)
          },
          { label: 'Resume id', value: text(session.resumeId) },
          {
            label: 'Pending worktree',
            value: session.spawnWorktree === null ? DASH : `'${session.spawnWorktree}'`
          },
          { label: 'Remote control', value: text(facts?.bridgeUrl || live?.bridgeSessionId) }
        ]
      }
    ]

    // Claude Code's own written summary of where this session got to. Not ours,
    // not derived — it just happens to be the single most useful line in the
    // transcript.
    const latest: InfoRow[] = []
    if (facts?.lastPrompt)
      latest.push({ label: 'Last prompt', value: facts.lastPrompt, prose: true })
    if (facts?.awaySummary)
      latest.push({ label: 'Session summary', value: facts.awaySummary, prose: true })
    if (latest.length > 0) sections.push({ heading: 'Latest', rows: latest })

    return sections
  })

  // Plain text, deliberately NOT fenced: a copied prompt can contain a fence of
  // its own, and one broken block costs more than the alignment it buys. Labels
  // are padded so the paste reads as the same two columns the pane does.
  const LABEL_WIDTH = 24

  function reportText(): string {
    const lines = ['Agent Race Control — session info', stamp(Date.now()), '']
    for (const section of report) {
      lines.push(`## ${section.heading}`)
      for (const { label, value, prose } of section.rows) {
        // Prose and the hook list are already multi-line; padding them into a
        // column would wrap into nonsense, so they get a block instead.
        if (prose || value.includes('\n')) {
          lines.push(`${label}:`)
          for (const line of value.split('\n')) lines.push(`  ${line}`)
        } else {
          lines.push(`${label.padEnd(LABEL_WIDTH)}${value}`)
        }
      }
      // The note travels with the numbers it disambiguates — a paste is read by
      // someone who cannot see this pane.
      if (section.note) lines.push(`(${section.note})`)
      lines.push('')
    }
    return lines.join('\n')
  }

  // The button is the only feedback surface here, so a rejected write has to
  // say so rather than look like success.
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle')
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  function copyAll(): void {
    const settle = (next: 'copied' | 'failed'): void => {
      copyState = next
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copyState = 'idle'), 1600)
    }
    navigator.clipboard.writeText(reportText()).then(
      () => settle('copied'),
      () => settle('failed')
    )
  }

  $effect(() => () => {
    if (copyTimer) clearTimeout(copyTimer)
  })
</script>

<div class="info" style:--mono={codeFont}>
  <!-- Sticky, because the reason to copy usually occurs to you at the bottom of
       the pane. -->
  <div class="bar">
    <button
      class="copy"
      class:done={copyState === 'copied'}
      title="Copy every field below as text"
      onclick={copyAll}
    >
      <span class="material-symbols-outlined">
        {copyState === 'copied' ? 'check' : copyState === 'failed' ? 'error' : 'content_copy'}
      </span>
      {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy all'}
    </button>
  </div>

  {#each report as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      {#each section.rows as row (row.label)}
        <div class="row">
          <div class="label">{row.label}</div>
          <div class="value" class:mono={!row.prose} class:prose={row.prose}>
            {#if row.dot}<span class="dot {row.dot}"></span>{/if}{row.value}
          </div>
        </div>
      {/each}
      {#if section.note}
        <p class="note">{section.note}</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .info {
    height: 100%;
    overflow-y: auto;
    padding: 0 16px 24px;
    box-sizing: border-box;
    font-size: 12px;
    line-height: 1.5;
    /* Half the point of the tab is pasting a field into a bug report. */
    user-select: text;
  }

  /* Rides above the sections so Copy stays reachable at any scroll depth. */
  .bar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    padding: 8px 0 6px;
    background: var(--bg);
  }

  .copy {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-subtle);
    color: var(--fg-muted);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
  }

  .copy:hover {
    color: var(--fg);
  }

  .copy.done {
    color: var(--accent);
    border-color: var(--accent);
  }

  .copy .material-symbols-outlined {
    font-size: 13px;
  }

  section {
    margin-bottom: 18px;
  }

  h2 {
    margin: 0 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  /* Two columns, label ragged-right against a fixed gutter so every value in
     the pane starts on the same x — the tab is scanned down the value column. */
  .row {
    display: grid;
    grid-template-columns: 168px minmax(0, 1fr);
    gap: 10px;
    padding: 2px 0;
    align-items: baseline;
  }

  .label {
    color: var(--fg-muted);
    overflow-wrap: break-word;
  }

  .value {
    overflow-wrap: anywhere;
    /* Multi-line values (the hook list) keep their newlines. */
    white-space: pre-wrap;
  }

  .mono {
    font-family: var(--mono);
    font-size: 11.5px;
  }

  .note {
    grid-column: 1 / -1;
    margin: 6px 0 0;
    padding-left: 178px;
    color: var(--fg-muted);
    font-size: 11px;
  }

  /* Prose values — a prompt or Claude's own summary — read as text, not data. */
  .prose {
    padding: 6px 10px;
    border-left: 3px solid var(--border);
    border-radius: 0 6px 6px 0;
    background: var(--bg-subtle);
    color: var(--fg-muted);
  }

  /* The same dot as the tower row, minus the pulse: this is a legend for the
     colour, not a second place to watch for attention. */
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 7px;
    border-radius: 50%;
    background: var(--dot-idle);
    vertical-align: baseline;
  }

  .dot.running {
    background: var(--dot-running);
  }

  .dot.waiting,
  .dot.delegating {
    background: var(--dot-waiting);
  }

  .dot.exited {
    background: var(--border);
  }
</style>
