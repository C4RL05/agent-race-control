<script lang="ts">
  import { gitInfo, type Session } from './sessions.svelte'

  // The Session tab: everything the app knows about one running Claude session,
  // as read-only labeled text. It is an instrument panel, not a feature — no
  // controls, no actions, nothing here writes anywhere.
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
</script>

{#snippet row(label: string, value: string, mono = true)}
  <div class="row">
    <div class="label">{label}</div>
    <div class="value" class:mono>{value}</div>
  </div>
{/snippet}

{#snippet block(label: string, value: string)}
  <div class="row">
    <div class="label">{label}</div>
    <div class="value prose">{value}</div>
  </div>
{/snippet}

<div class="info" style:--mono={codeFont}>
  <section>
    <h2>Status</h2>
    <div class="row">
      <div class="label">Tower dot</div>
      <div class="value mono">
        <span class="dot {session.status}"></span>{session.status}{session.todo ? ' · todo' : ''}
      </div>
    </div>
    {@render row('Age in status', since(session.statusSince))}
    {@render row(
      'Poll reports',
      `${text(session.agentEntry?.status ?? live?.status)}${disagrees ? '  (differs — expected while a shell or subagent outlives the turn)' : ''}`
    )}
    {@render row('Poll seen', since(session.agentEntryAt))}
    {@render row(
      'Last hook',
      session.lastHook ? `${session.lastHook}  ·  ${since(session.lastHookAt)} ago` : DASH
    )}
    {@render row('Age in CLI status', since(live?.statusUpdatedAt))}
  </section>

  <section>
    <h2>Identity</h2>
    {@render row('Terminal title', text(session.title))}
    {@render row('Conversation title', text(facts?.aiTitle))}
    {@render row(
      'CLI name',
      live?.name ? `${live.name}${live.nameSource ? `  (${live.nameSource})` : ''}` : DASH
    )}
    {@render row('Slug', text(facts?.slug))}
    {@render row('Conversation id', text(session.claudeSessionId))}
    {@render row('Spawn id (hook route)', text(session.hookToken))}
    {@render row('Claude pid', session.claudePid === null ? DASH : String(session.claudePid))}
    {@render row('Claude started', stamp(session.claudeStartedAt))}
    {@render row('Uptime', since(session.claudeStartedAt))}
    {@render row('PTY id', text(session.ptyId))}
    {@render row(
      'Kind',
      live?.kind ? `${live.kind}${live.entrypoint ? ` · ${live.entrypoint}` : ''}` : DASH
    )}
  </section>

  <section>
    <h2>Conversation</h2>
    {@render row('Model', text(facts?.model))}
    {@render row('Effort', text(facts?.effort))}
    {@render row('Permission mode', text(facts?.permissionMode))}
    {@render row('Mode', text(facts?.mode))}
    {@render row('Turns', count(facts?.turns))}
    {@render row('Last turn', duration(facts?.lastTurnMs))}
    {@render row('Messages', count(facts?.messageCount))}
    {@render row(
      'Context',
      facts?.contextTokens === null || facts?.contextTokens === undefined
        ? DASH
        : `${tokens(facts.contextTokens)} tokens`
    )}
    {@render row(
      'Last output',
      facts?.outputTokens === null || facts?.outputTokens === undefined
        ? DASH
        : `${tokens(facts.outputTokens)} tokens${facts.thinkingTokens ? ` · ${tokens(facts.thinkingTokens)} thinking` : ''}`
    )}
    {@render row('Service tier', text(facts?.serviceTier))}
    {@render row(
      'Compactions',
      facts && facts.compactions > 0
        ? `${facts.compactions}  ·  last ${facts.compactTrigger || 'unknown'}: ${tokens(facts.compactPreTokens)} → ${tokens(facts.compactPostTokens)}`
        : count(facts?.compactions)
    )}
    {@render row('Claude Code', text(live?.version ?? facts?.version))}
    {@render row('Last transcript entry', stamp(facts?.lastEntryAt))}
  </section>

  <section>
    <h2>In flight</h2>
    <!-- Two independent counts of the same thing, on purpose. The hook count is
         an edge tally (SubagentStart/Stop) and is what decides the delegating
         dot; the transcript count is a level re-derived from the file. When they
         disagree, the hook channel is the one that drifted. -->
    {@render row('Subagents (hooks)', String(session.subagentCount))}
    {@render row(
      'Subagents (transcript)',
      facts ? `${facts.subagentsOpen} open  ·  ${facts.subagentsStarted} started` : DASH
    )}
    {@render row(
      'Background shells',
      facts ? `${facts.shellsOpen} open  ·  ${facts.shellsStarted} started` : DASH
    )}
    {@render row('Queued prompts', count(facts?.queued))}
    {@render row(
      'Hooks at last turn end',
      facts && facts.lastHooks.length > 0
        ? facts.lastHooks.map((hook) => `${hook.command} (${hook.durationMs}ms)`).join('\n')
        : DASH
    )}
    {@render row('Hook errors', count(facts?.hookErrors))}
    <p class="note">
      Open = started in this conversation and never recorded as finished. A run the app outlived
      leaves its shell counted here; the poll line above is the authority on whether anything is
      actually running.
    </p>
  </section>

  <section>
    <h2>Place</h2>
    {@render row('Working directory', session.cwd)}
    {@render row('Repo', git?.isRepo ? git.repoName : DASH)}
    {@render row('Worktree', git?.isRepo ? text(git.worktreeName) : DASH)}
    {@render row('Branch', git?.isRepo ? text(git.branch) : DASH)}
    {@render row(
      'Branch state',
      git?.isRepo
        ? `${git.dirty ? 'dirty' : 'clean'}${git.base ? `  ·  ↑${git.ahead} ↓${git.behind} vs ${git.base}` : ''}`
        : DASH
    )}
    {@render row('Transcript', info ? info.transcriptPath : DASH)}
    {@render row(
      'Transcript size',
      info?.transcriptBytes === null || info?.transcriptBytes === undefined
        ? 'not written yet'
        : bytes(info.transcriptBytes)
    )}
    {@render row('Resume id', text(session.resumeId))}
    {@render row(
      'Pending worktree',
      session.spawnWorktree === null ? DASH : `'${session.spawnWorktree}'`
    )}
    {@render row('Remote control', text(facts?.bridgeUrl || live?.bridgeSessionId))}
  </section>

  {#if facts?.lastPrompt || facts?.awaySummary}
    <section>
      <h2>Latest</h2>
      {#if facts.lastPrompt}
        {@render block('Last prompt', facts.lastPrompt)}
      {/if}
      <!-- Claude Code's own written summary of where this session got to. Not
           ours, not derived — it just happens to be the single most useful line
           in the transcript. -->
      {#if facts.awaySummary}
        {@render block('Session summary', facts.awaySummary)}
      {/if}
    </section>
  {/if}
</div>

<style>
  .info {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px 24px;
    box-sizing: border-box;
    font-size: 12px;
    line-height: 1.5;
    /* Half the point of the tab is pasting a field into a bug report. */
    user-select: text;
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
