# Agent Race Control — Kickoff Brief

You are helping me build a small, focused desktop app from scratch. Read this whole brief first, then **restate the plan and your assumptions back to me and wait for my confirmation before writing any code.** Work in phases; pause for my sign-off at the end of each phase.

## What we're building

**Agent Race Control** (package/repo slug: `agent-race-control`) is a session-aware terminal cockpit for Claude Code on **native Windows**.

The problem it solves is concrete: I run several Claude Code sessions at once, each in its own terminal window — plus more terminals for `npm run dev`, builds, and the like — and I waste time hunting the Windows taskbar for the right one. Agent Race Control consolidates **all of it** into **one window, one taskbar icon**: every Claude Code session *and* the plain shells I run alongside them. An overview I can glance at and a terminal I can drive, together. If a terminal is open, it lives in Agent Race Control.

## Non-negotiable ethos: minimal

Minimalism is a hard requirement, not a preference. I evaluated the existing tools (Kanban Code, Nimbalyst, claude-code-kanban, and others) and rejected them as bloated. The bloat was never the embedded terminals — it was everything bolted around them. **Agent Race Control is Windows Terminal, except each tab knows whether it's a Claude Code session — and shows its name, color, and status — or a plain shell. Nothing more.**

### Explicitly OUT of scope (do not build these, and flag me if you're tempted)
- No git worktree or branch management — I have git.
- No PR / GitHub integration.
- No kanban columns or drag-and-drop.
- No task-dependency graphs.
- No theme gallery — one clean look. (A **light / dark / system** appearance toggle is in scope; a gallery of decorative themes is not.)
- No database — small JSON files for local state, nothing heavier.

Every "wouldn't it be nice" gets checked against this list. When in doubt, leave it out and ask.

## Non-negotiable ethos: full-fidelity Claude Code

Agent Race Control must run the **unmodified `claude` CLI in a real pseudo-terminal** — it does not wrap, proxy, embed via SDK/headless mode, or reimplement Claude Code. This is the single most important design constraint, and it's *why* Agent Race Control exists: a real PTY session is indistinguishable from launching `claude` in Windows Terminal, so **every feature the terminal has is present by construction** — remote control, rewind/checkpoints, `--resume`, slash commands (including `/btw` side questions and their overlay keys), **background agents and the agent view** (left-arrow detach/switch, `/attach`, `claude agents` — discovery is file-based under `~/.claude/jobs/` + a per-user supervisor daemon, so it's launch-method-agnostic), plan mode, hooks, MCP, mouse and keyboard interaction, true color, hyperlinks — all of it, 100% identical.

Other tools (Kanban Code, the Claude desktop app, GitKraken Kepler, etc.) integrate Claude Code through the SDK, headless mode, or a non-TTY wrapper, so those interactive features are missing or degraded. Agent Race Control deliberately does **not** do that. The burden on us is therefore inverted: our job is to **not interfere**. Concretely:

- Spawn the real `claude` binary in a real PTY (ConPTY via `node-pty`); never intercept, rewrite, or filter the byte stream in either direction.
- Pass **all keystrokes** straight through to the PTY — including chord/escape sequences Agent Race Control might otherwise want (e.g. Esc-Esc for rewind, Ctrl+C, Ctrl+R). App-level shortcuts must not shadow anything Claude Code uses.
- **Zero new muscle memory.** Inside the terminal, Agent Race Control invents no shortcuts of its own — it follows stock Windows Terminal conventions (e.g. Ctrl+Shift+C/V and right-click for copy/paste; Ctrl+C is Claude's interrupt, untouched; **Ctrl+= / Ctrl+- / Ctrl+0 zoom the window** — the same keys Windows Terminal and VS Code bind, consciously shadowing the rare readline undo chord). Moving between Agent Race Control and a regular terminal must require no change in habits, in either direction.
- Pass through the full environment, a correct `TERM` (`xterm-256color`), accurate rows/cols on every resize, clipboard copy/paste, and OSC-8 hyperlinks. One deliberate carve-out: strip the env vars an enclosing Claude Code session injects into its children (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, …) — fidelity means matching a *fresh terminal*, not the launcher's ancestry, and leaked markers make spawned claudes act as nested child sessions (which silently disables transcript persistence — no resume). Found the hard way.
- Dropping a file on the terminal pastes its quoted path at the cursor — the same bytes Windows Terminal sends, and how images/files get handed to Claude Code in a terminal. (The window itself never navigates: `will-navigate` is blocked.)
- Never steer Claude Code's appearance: no `COLORFGBG`, theme flags, or config injection. Agent Race Control's light/dark toggle themes Agent Race Control's chrome only (see *Appearance*). Claude Code picks its own theme.
- If a feature works in Windows Terminal but not in Agent Race Control, that's a bug in Agent Race Control — not a feature we chose to omit.

## Layout

- **Left rail:** a list of every session showing its name, a color dot, and a status indicator.
- **Right pane:** one terminal, showing whichever session I clicked in the rail.
- The rail is the overview; the pane is the cockpit. Same window. Glance to find, click to drive.
- Visual reference: **F1 timing tables** — a column of colored entries with names and live status, the whole race readable at a glance; click one to go on board.

### Folders (grouping only)
- The rail supports **one level** of folders: create from the toolbar, rename (double-click), delete (sessions fall back to the default folder — never killed). A default folder (id 0) always exists, takes new sessions, renamable but not deletable.
- **Drag & drop:** drag sessions between/within folders; drag folder headers to reorder folders. Persisted in the state JSON.
- Boundary, stated explicitly: folders are *visual grouping* — no nesting, no kanban semantics, no per-folder behavior. The moment a folder means anything beyond "these rows sit together," it's out of scope.

### Two session types
- **Claude session** — bash that `exec`s straight into `claude` (see spawn spec below). The PTY *is* the Claude process: when claude exits, the session is exited. Full status set.
- **Shell session** — a plain interactive Git Bash, for `npm run dev`, builds, git, or anything else. This is what makes Agent Race Control the *only* terminal window I need — without it I'd still have stray terminals on the taskbar, defeating the point. Status is `running`/`exited` only.
- Both types live in the same rail, same look: name, color dot, status. New-session UI offers exactly these two choices. A shell session is not a degraded Claude session — it's a first-class terminal.

### Appearance (light / dark / system)
- Three modes only: **System** (follow the OS, default), **Light**, **Dark**. This is a single appearance toggle, not a theme gallery.
- Use the **GitHub themes**: **GitHub Light** (`github-light-default`) for light, **GitHub Dark** (`github-dark-default`) for dark. Pull the exact hex values from GitHub's Primer primitives when implementing — don't trust memory for the palette.
- The mode themes the **Agent Race Control chrome only**: the Svelte rail UI, plus the xterm foreground/background + 16 ANSI colors, all set from the chosen GitHub palette. No per-color customization.
- `System` follows the OS via Electron's `nativeTheme` (`shouldUseDarkColors` / `updated` event) and flips live when Windows changes.
- Persist the chosen mode in the state JSON.

### Claude Code stays pure — Agent Race Control never steers its theme
- Agent Race Control does **not** hint, force, or sync Claude Code's internal theme. No `COLORFGBG`, no config injection, no theme flags. Claude Code renders exactly however it would in Windows Terminal.
- This is a direct consequence of the full-fidelity ethos: Agent Race Control sets a genuine terminal palette (the GitHub colors above) and stops there. If Claude Code auto-detects the real terminal background and adjusts, that's *Claude* reading the true environment — which is correct and pure. Agent Race Control's appearance toggle and Claude Code's own theme are independent by design, and that's fine even if they don't match.

## Stack (decided — don't re-litigate unless you hit a real blocker)

- **Electron + TypeScript.**
- **Terminal UI:** `@xterm/xterm` (note the `@xterm` scope — the bare `xterm` package is legacy) plus `@xterm/addon-fit` for resize and `@xterm/addon-clipboard` for **OSC 52** — Claude Code copies to the system clipboard via OSC 52 (e.g. `/btw`'s `c` key), and xterm.js only honors it with this addon. (Verify addon compat with xterm 6 in Phase 2.)
- **PTY backend:** `node-pty` (a full pseudo-terminal is required because Claude Code is a full-screen TUI — plain `child_process` won't do).
- **Rail / renderer UI:** **Svelte** (with TypeScript). Chosen deliberately: Svelte compiles to small vanilla JS with ~no runtime, so it keeps the dependency/footprint story consistent with the minimal ethos while giving us real reactivity for the rail and appearance state. No React.
- **Bundler:** Svelte needs a compile step, so we add one — **Vite**, via **`electron-vite`** (main + preload + renderer configs, HMR in dev). This is the one new moving part the Svelte decision brings; keep the config stock and minimal.
- **Scaffold (decided):** hand-rolled, with the official electron-vite svelte-ts template open as a *reference* — not template-and-trim. Every file in commit 1 exists because we wrote it. (The template's `@electron-toolkit/preload` pattern exposes a general `electronAPI` — conflicts with our minimal explicit contextBridge, so it'd be ripped out anyway.) Escape hatch: if the hand-rolled config fights us in Phase 1, fall back to template-and-trim and say so.
- **Icons:** Google **Material Symbols** (outlined set), self-hosted via the `material-symbols` npm package — bundled locally, never from a CDN (CSP + offline).
- **State:** a small JSON file in Electron's `userData` dir. No localStorage, no DB.

### Technical specifics that are easy to get wrong — get these right
- `node-pty` is a **native module** — but since v1.1 it's **Node-API** and ships **prebuilt Windows binaries** (`prebuilds/win32-x64/`: `pty.node`, `conpty.node`, `winpty.dll`, `winpty-agent.exe`). Node-API is ABI-stable across Node *and* Electron, so **no `@electron/rebuild` step is needed** — the old "rebuild for Electron's ABI" advice is obsolete for this package. (Verified the hard way: the 1.1.0 npm tarball can't even be gyp-rebuilt on Windows — it ships without winpty's `GetCommitHash.bat`. Prebuilds are the only supported path from the tarball.) Caveat: the loader prefers `build/Release` over `prebuilds/`, so never leave a stale/partial `build/` dir inside `node_modules/node-pty`. On Windows it uses ConPTY under the hood, which renders Claude Code's TUI correctly.
- **Security model:** `contextIsolation: true`, `nodeIntegration: false`. Run `node-pty` in the **main process**; expose a minimal, explicit API to the renderer via a **preload `contextBridge`** (e.g. `spawn`, `write`, `onData`, `resize`, `kill`). Shuttle bytes over IPC — keystrokes renderer→main, output main→renderer, plus resize events.
- **Shell (decided, non-negotiable):** spawn **Git Bash** (`bash.exe`) via node-pty and run `claude` inside it — Git Bash is Claude Code's recommended shell on Windows. Every terminal Agent Race Control opens is a Git Bash session; we do not offer PowerShell/cmd/WSL as alternatives.
- **Bash resolution (decided):** adopt VS Code's battle-tested algorithm (`terminalProfiles.ts`) essentially verbatim. **Never PATH-resolve `bash.exe`** — on Windows that can hit the WSL stub (`WindowsApps\bash.exe`) or legacy WSL launcher (`System32\bash.exe`). Instead:
  1. PATH-resolve **`git.exe`** (no WSL doppelgänger, and it's the Git the user actually uses) and walk up from `<root>\cmd\git.exe` to the install root.
  2. Add standard install roots from env vars (`ProgramW6432`, `ProgramFiles`, `ProgramFiles(X86)`, `%LOCALAPPDATA%\Programs`) and the scoop locations (`scoop\apps\git\current`, `scoop\apps\git-with-openssh\current`).
  3. For each root, try `bin\bash.exe` first (the wrapper that sets up the MSYS env — never `git-bash.exe`, which spawns its own mintty window), then `usr\bin\bash.exe`. **First path that exists wins.**
  4. No registry lookup — keeps deps at zero and matches VS Code.
  5. If nothing is found, fail loudly with a clear "Git Bash not found" error. Optional `bashPath` override key in the state JSON as an escape hatch (no UI for it).
- **Spawn spec (decided):** always a **login interactive** shell — sources the user's profile, so PATH (e.g. `~/.local/bin` where `claude` lives) resolves byte-for-byte as in a regular Git Bash terminal; same args VS Code uses for its Git Bash profile.
  - **Shell session:** `bash.exe --login -i`
  - **Claude session:** `bash.exe --login -i -c 'exec claude --session-id <uuid> --settings <Agent Race Control-hooks-file>'` (resume: `--resume <uuid>` instead of `--session-id`). The `--login` still sources the profile before `-c` runs, so `claude` resolves from the user's real PATH; `exec` makes bash *become* claude, so the PTY's lifetime **is** the claude process's lifetime — `running`/`exited` fall straight out of the PTY with no child-process tracking. Deliberate consequence: when claude exits, the session ends rather than dropping to a prompt — the rail models Claude sessions, not shells; if I want a shell, I open a shell session.
  - The two extra flags are the *only* deviation from a bare `claude` launch, and both are user-typeable CLI arguments, not config mutation: `--session-id` pins the id Agent Race Control already needs for resume, and `--settings` adds the observability-only status hooks (see open items). Claude's behavior is otherwise byte-identical.
- **Session files live on disk** at `%USERPROFILE%\.claude\projects\<encoded-project-path>\<session-id>.jsonl` (the encoded path is the absolute project path with separators replaced by dashes). Useful for names/status, but note the key advantage below.
- **Status — keep it simple.** Because Agent Race Control *spawns* the sessions, it owns each PTY, so `running` / `exited` are known directly from the process. For the `waiting-for-input` signal, wire a lightweight Claude Code **hook** (Notification / Stop) that writes a small marker Agent Race Control watches. Target status set: `running`, `waiting`, `idle`, `exited` for Claude sessions; shell sessions are just `running` / `exited`. Don't over-model it.
- **Name & color:** name is a user-editable label per session (the rail also shows the session's *own* live name from the terminal title). Color is app-assigned at spawn from the same 8-color vocabulary as Claude Code's `/color` (red/blue/green/yellow/purple/orange/pink/cyan). **Left-click the dot** re-types `/color <current>` into that session (re-sync — e.g. after a resume reset Claude's runtime-only color); **right-click** opens a color menu, and picking one sets the dot *and* types `/color <name>` into the session, so Claude's agent view tints to match. This is the one blessed form of writing into a session: user-initiated, visible in the TUI, a public command — not aRC acting on its own. Known asymmetries (verified empirically; upstream: claude-code#41466/#49293): `/color` set *inside* the TUI can't be read back (lands in no file, no escape sequence), so sync is one-way app→session; Claude's color is runtime-only and resets on resume while the rail dot persists; and a click while that session's input box holds a draft would append to it — visible and recoverable, but real. Persist name and color in the state JSON.
- **Persistence across restarts:** the PTY is a child of Agent Race Control, so closing Agent Race Control ends the process — but the Claude Code *session* persists on disk. On relaunch, reopen a session with `claude --resume <session-id>`. This gives tmux-like continuity **without tmux** (I'm deliberately off WSL/tmux).

## Verify before you rely on memory
Package names and Electron/node-pty build details drift across versions. Confirm current `@xterm/*` and `node-pty` versions against npm before writing install steps. (This section already paid out twice: `@sveltejs/vite-plugin-svelte` 7.x needs Vite 8 which electron-vite doesn't support — we pin plugin 6.x + Vite 7 — and node-pty 1.1's Node-API prebuilds made `@electron/rebuild` obsolete.)

## Build order (pause for my confirmation after each phase)

1. **Scaffold.** Electron + TS + **Svelte via `electron-vite`** (main / preload / renderer), secure `BrowserWindow` config, empty window that launches. Confirm it runs in dev (HMR) and as a build.
2. **One terminal.** node-pty ↔ xterm wired through IPC, running Git Bash. I can type, output renders, resize works, keystrokes/escape sequences pass through untouched. Verify the prebuilt Node-API binary loads and drives ConPTY inside Electron here.
3. **Claude Code in it.** Run `claude` in the pane; confirm the full TUI renders cleanly and interactive features (rewind, slash commands, `/btw` — including its `c` copy-to-clipboard via OSC 52, the agent view — left-arrow detach, `/attach`, backgrounding, remote control, `--resume`) behave exactly as in Windows Terminal.
4. **Rail + multiple sessions.** Left rail lists sessions (name, color dot, status placeholder); click to focus its terminal; spawn-new of **either type** (Claude session or shell session) and close. Add the **light / dark / system** appearance toggle here, theming both rail and xterm palette.
5. **Real status.** PTY-derived `running`/`exited` plus the `waiting` signal (hook marker, or the supervisor's jobs-dir state — see open items).
6. **Persistence.** Save session type, names/colors/session-ids/working dirs/appearance mode to the state JSON. On relaunch: Claude sessions reopen via `claude --resume <id>`; shell sessions reopen as fresh shells with the same name/color/cwd (shells have no resume — that's fine).

## Open items — decide along the way (flagged, not decided)

These were flagged during planning; resolve each when its build phase arrives rather than up front:

- ~~**Scoping the `waiting` hook**~~ **RESOLVED (Phase 5):** the jobs dir turned out to hold *background agents only* — foreground sessions never appear there. Instead: each Agent Race Control Claude session is spawned with `--settings <Agent Race Control-hooks-file>` (empirically verified: hooks fire from `--settings`), whose hooks (`UserPromptSubmit`/`PostToolUse` → running, `Notification` → waiting, `Stop` → idle) POST their JSON to a token-guarded localhost server in Agent Race Control's main process. Observability-only (always answered 200 `{}`), per-session, zero global config, zero files, zero polling.
- ~~**PTY → session-id mapping**~~ **RESOLVED (Phase 5, early):** `claude --session-id <uuid>` exists — Agent Race Control generates the UUID at spawn, so the mapping is deterministic. Verified: the id appears in hook payloads and names the transcript file. `--resume <that-uuid>` is Phase 6 plumbing only.
- **Agent view vs. the rail model** — left-arrow detach, `/attach`, and in-session `/resume` all mean a single PTY can *switch* which Claude conversation it displays, while the rail keeps the session-id pinned at spawn. Consequence (observed in v1 testing): content added after an in-session `/resume` lands in the switched-to conversation, so relaunch restores the pinned id, not what you were last looking at. The rail models *terminals Agent Race Control spawned*, not the machine-wide conversation graph — accepted v1 limitation; revisit only if it bites in daily use. (Post-v1)
- ~~**New-session working directory**~~ **RESOLVED (Phase 4):** OS folder picker on every spawn, remembering the last-picked directory as the dialog's start point. Recent-dirs list optional with Phase 6 persistence.
- **PTY → session-id mapping** — resume requires knowing which session-id belongs to which spawned terminal; check whether `claude` accepts a caller-supplied id at launch before resorting to watching the projects dir. (Phase 6)
- **Remote-control verification** — should work by construction, but it's network/backend-dependent; verify explicitly from inside Agent Race Control. (Phase 3 checklist)
- **Single-instance lock** — second launch should focus the existing window (`requestSingleInstanceLock`). (Phase 1)
- **Terminal font** — a monospace with solid box-drawing/glyph coverage; and per-session dot colors must stay legible in both GitHub palettes. (Phase 2/4)
- **Packaging / installer** — an installed app (electron-builder) is wanted, but explicitly **not v1**. Run from local build until then; add packaging as its own post-v1 phase. (Post-v1)

## Definition of done (v1)
One window. Rail of sessions — Claude Code sessions with name, color, and live status, plus plain shell sessions for everything else — so no other terminal window needs to exist. Click a session to drive it. Spawn (either type), close, and resume. Nothing on the out-of-scope list. That's it — ship it and stop.

---

**Start by restating this plan in your own words, listing any assumptions or open questions, and proposing the Phase 1 project structure. Then wait for my go-ahead.**
