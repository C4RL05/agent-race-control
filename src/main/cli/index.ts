// The agent CLIs the app can drive, and everything that differs between them.
//
// Both are spawned the same way — an unmodified CLI in a real ConPTY, inside a
// login bash so it resolves from the user's own PATH — and the app never
// intercepts, rewrites or steers the byte stream for either. What differs is
// narrow and lives here: the command line, how a session's id is come by, and
// where its transcript is written. Everything else in main (the PTY registry,
// the tail machinery, state, git) is shared and knows nothing about which CLI
// it is serving.
//
// Two agents is where an abstraction earns its keep and no more: this is a
// record of the differences, not a plugin system.

export type AgentKind = 'claude' | 'codex'
export type SessionType = 'shell' | AgentKind

export interface SpawnRequest {
  cwd: string
  // The conversation to continue. For claude this is also the id we pin on a
  // FRESH spawn; for codex an id only ever comes from a previous session.
  resumeId?: string
  // Whether that conversation actually has a transcript on disk. A session
  // that never exchanged a prompt has none, and resuming it errors.
  resumable: boolean
  // Ask the CLI to create and enter a fresh git worktree ('' = let it choose
  // the name). Claude only — see `capabilities`.
  worktree?: string
  // The per-session hook settings file, when the CLI takes one.
  hookSettings?: string
}

export interface CliAdapter {
  kind: AgentKind
  // The bare executable name. Resolved by the login shell from the user's PATH,
  // never by us — the same rule that keeps a spawned session identical to one
  // started in Windows Terminal.
  command: string

  // How a session's conversation id comes to be known.
  //   pinned     — we mint a UUID and pass it at spawn, so it is known before
  //                the process starts and is stable for its life.
  //   discovered — the CLI mints its own and writes it to disk; we learn it by
  //                watching for the session file our spawn produced.
  identity: 'pinned' | 'discovered'

  // What the row may offer for this CLI. The UI reads these rather than
  // branching on the kind, so a missing capability hides an affordance instead
  // of producing one that silently does nothing.
  capabilities: {
    // `--worktree <name>` at spawn (the repo card's fresh-worktree button).
    worktree: boolean
    // Turn-boundary hooks via a settings file (the red/amber channel).
    hooks: boolean
    // A conversation name typed into the TUI (`/rename`) and a session colour
    // (`/color`) — the two blessed forms of writing into a session.
    rename: boolean
    color: boolean
    // Whether the terminal title carries the CONVERSATION name. Claude's does;
    // codex sets the title to the working directory's basename, so the tower
    // has to get a codex row's name from elsewhere (see nameSource).
    titleIsConversationName: boolean
  }

  // The command line handed to `bash --login -i -c`.
  spawnCommand(request: SpawnRequest): string
}

const claude: CliAdapter = {
  kind: 'claude',
  command: 'claude',
  identity: 'pinned',
  capabilities: {
    worktree: true,
    hooks: true,
    rename: true,
    color: true,
    titleIsConversationName: true
  },
  spawnCommand({ resumeId, resumable, worktree, hookSettings }) {
    // Fresh session: pin our own UUID, which is both the resume handle and the
    // join key against `claude agents --json`. Restored: --resume it, but only
    // when a transcript exists; else fresh under the same id.
    let cmd = resumable
      ? `exec claude --resume ${resumeId}`
      : `exec claude --session-id ${resumeId}`
    // Fresh spawns only — a resumed session's cwd already IS its worktree.
    if (!resumable && worktree !== undefined) {
      const name = worktree.replace(/'/g, '')
      cmd += name ? ` --worktree '${name}'` : ' --worktree'
    }
    if (hookSettings) cmd += ` --settings '${hookSettings.replace(/\\/g, '/')}'`
    return cmd
  }
}

const codex: CliAdapter = {
  kind: 'codex',
  command: 'codex',
  // Verified on codex-cli 0.153.4: there is no `--session-id`. The id is minted
  // by codex and written into the rollout it opens, so the app learns it after
  // the fact by matching that file's cwd against the one it spawned in
  // (see codex.ts). Consequence, and it is a real one: between spawn and the
  // first match a codex row has no conversation id, so nothing keyed on the id
  // — preview, resume — is available for that moment.
  identity: 'discovered',
  capabilities: {
    // `codex --help` on 0.153.4 offers no worktree flag; the repo card's
    // fresh-worktree button stays claude-only rather than shelling out to git
    // ourselves, which the out-of-scope list forbids outright.
    worktree: false,
    // No `--settings` hook channel. Codex's status comes from its own screen
    // and title instead (the herdr technique) — see the renderer's screen.ts.
    hooks: false,
    // Unverified on this build, so not offered. A menu item that types a
    // command the TUI does not understand would put stray text in the
    // composer, which is worse than the item not being there.
    rename: false,
    color: false,
    // Measured: codex sets the title to the working directory's basename
    // ("⠹ my-project"), not the conversation name.
    titleIsConversationName: false
  },
  spawnCommand({ resumeId, resumable }) {
    // `codex resume <uuid>` continues a recorded session. Without a recorded
    // one there is nothing to resume, so start fresh and let codex mint an id.
    return resumable && resumeId ? `exec codex resume ${resumeId}` : 'exec codex'
  }
}

export const CLIS: Record<AgentKind, CliAdapter> = { claude, codex }

export function isAgent(type: SessionType | undefined): type is AgentKind {
  return type === 'claude' || type === 'codex'
}

export function adapterFor(type: SessionType | undefined): CliAdapter | null {
  return isAgent(type) ? CLIS[type] : null
}
