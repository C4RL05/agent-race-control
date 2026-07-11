# aRC — Kickoff Brief

You are helping me build a small, focused desktop app from scratch. Read this whole brief first, then **restate the plan and your assumptions back to me and wait for my confirmation before writing any code.** Work in phases; pause for my sign-off at the end of each phase.

## What we're building

**aRC** (package/repo slug: `agent-race-control`; display name "Race Control" / aRC) is a session-aware terminal cockpit for Claude Code on **native Windows**.

The problem it solves is concrete: I run several Claude Code sessions at once, each in its own terminal window — plus more terminals for `npm run dev`, builds, and the like — and I waste time hunting the Windows taskbar for the right one. aRC consolidates **all of it** into **one window, one taskbar icon**: every Claude Code session *and* the plain shells I run alongside them. An overview I can glance at and a terminal I can drive, together. If a terminal is open, it lives in aRC.

## Non-negotiable ethos: minimal

Minimalism is a hard requirement, not a preference. I evaluated the existing tools (Kanban Code, Nimbalyst, claude-code-kanban, and others) and rejected them as bloated. The bloat was never the embedded terminals — it was everything bolted around them. **aRC is Windows Terminal, except each tab knows whether it's a Claude Code session — and shows its name, color, and status — or a plain shell. Nothing more.**

### Explicitly OUT of scope (do not build these, and flag me if you're tempted)
- No git worktree or branch management — I have git.
- No PR / GitHub integration.
- No kanban columns or drag-and-drop.
- No task-dependency graphs.
- No theme gallery — one clean look. (A **light / dark / system** appearance toggle is in scope; a gallery of decorative themes is not.)
- No database — small JSON files for local state, nothing heavier.

Every "wouldn't it be nice" gets checked against this list. When in doubt, leave it out and ask.

## Non-negotiable ethos: full-fidelity Claude Code

aRC must run the **unmodified `claude` CLI in a real pseudo-terminal** — it does not wrap, proxy, embed via SDK/headless mode, or reimplement Claude Code. This is the single most important design constraint, and it's *why* aRC exists: a real PTY session is indistinguishable from launching `claude` in Windows Terminal, so **every feature the terminal has is present by construction** — remote control, rewind/checkpoints, `--resume`, slash commands (including `/btw` side questions and their overlay keys), **background agents and the agent view** (left-arrow detach/switch, `/attach`, `claude agents` — discovery is file-based under `~/.claude/jobs/` + a per-user supervisor daemon, so it's launch-method-agnostic), plan mode, hooks, MCP, mouse and keyboard interaction, true color, hyperlinks — all of it, 100% identical.

Other tools (Kanban Code, the Claude desktop app, GitKraken Kepler, etc.) integrate Claude Code through the SDK, headless mode, or a non-TTY wrapper, so those interactive features are missing or degraded. aRC deliberately does **not** do that. The burden on us is therefore inverted: our job is to **not interfere**. Concretely:

- Spawn the real `claude` binary in a real PTY (ConPTY via `node-pty`); never intercept, rewrite, or filter the byte stream in either direction.
- Pass **all keystrokes** straight through to the PTY — including chord/escape sequences aRC might otherwise want (e.g. Esc-Esc for rewind, Ctrl+C, Ctrl+R). App-level shortcuts must not shadow anything Claude Code uses.
- **Zero new muscle memory.** Inside the terminal, aRC invents no shortcuts of its own — it follows stock Windows Terminal conventions (e.g. Ctrl+Shift+C/V and right-click for copy/paste; Ctrl+C is Claude's interrupt, untouched). Moving between aRC and a regular terminal must require no change in habits, in either direction.
- Pass through the full environment, a correct `TERM` (`xterm-256color`), accurate rows/cols on every resize, clipboard copy/paste, and OSC-8 hyperlinks.
- Never steer Claude Code's appearance: no `COLORFGBG`, theme flags, or config injection. aRC's light/dark toggle themes aRC's chrome only (see *Appearance*). Claude Code picks its own theme.
- If a feature works in Windows Terminal but not in aRC, that's a bug in aRC — not a feature we chose to omit.

## Layout

- **Left rail:** a list of every session showing its name, a color dot, and a status indicator.
- **Right pane:** one terminal, showing whichever session I clicked in the rail.
- The rail is the overview; the pane is the cockpit. Same window. Glance to find, click to drive.

### Two session types
- **Claude session** — bash that `exec`s straight into `claude` (see spawn spec below). The PTY *is* the Claude process: when claude exits, the session is exited. Full status set.
- **Shell session** — a plain interactive Git Bash, for `npm run dev`, builds, git, or anything else. This is what makes aRC the *only* terminal window I need — without it I'd still have stray terminals on the taskbar, defeating the point. Status is `running`/`exited` only.
- Both types live in the same rail, same look: name, color dot, status. New-session UI offers exactly these two choices. A shell session is not a degraded Claude session — it's a first-class terminal.

### Appearance (light / dark / system)
- Three modes only: **System** (follow the OS, default), **Light**, **Dark**. This is a single appearance toggle, not a theme gallery.
- Use the **GitHub themes**: **GitHub Light** (`github-light-default`) for light, **GitHub Dark** (`github-dark-default`) for dark. Pull the exact hex values from GitHub's Primer primitives when implementing — don't trust memory for the palette.
- The mode themes the **aRC chrome only**: the Svelte rail UI, plus the xterm foreground/background + 16 ANSI colors, all set from the chosen GitHub palette. No per-color customization.
- `System` follows the OS via Electron's `nativeTheme` (`shouldUseDarkColors` / `updated` event) and flips live when Windows changes.
- Persist the chosen mode in the state JSON.

### Claude Code stays pure — aRC never steers its theme
- aRC does **not** hint, force, or sync Claude Code's internal theme. No `COLORFGBG`, no config injection, no theme flags. Claude Code renders exactly however it would in Windows Terminal.
- This is a direct consequence of the full-fidelity ethos: aRC sets a genuine terminal palette (the GitHub colors above) and stops there. If Claude Code auto-detects the real terminal background and adjusts, that's *Claude* reading the true environment — which is correct and pure. aRC's appearance toggle and Claude Code's own theme are independent by design, and that's fine even if they don't match.

## Stack (decided — don't re-litigate unless you hit a real blocker)

- **Electron + TypeScript.**
- **Terminal UI:** `@xterm/xterm` (note the `@xterm` scope — the bare `xterm` package is legacy) plus `@xterm/addon-fit` for resize and `@xterm/addon-clipboard` for **OSC 52** — Claude Code copies to the system clipboard via OSC 52 (e.g. `/btw`'s `c` key), and xterm.js only honors it with this addon. (Verify addon compat with xterm 6 in Phase 2.)
- **PTY backend:** `node-pty` (a full pseudo-terminal is required because Claude Code is a full-screen TUI — plain `child_process` won't do).
- **Rail / renderer UI:** **Svelte** (with TypeScript). Chosen deliberately: Svelte compiles to small vanilla JS with ~no runtime, so it keeps the dependency/footprint story consistent with the minimal ethos while giving us real reactivity for the rail and appearance state. No React.
- **Bundler:** Svelte needs a compile step, so we add one — **Vite**, via **`electron-vite`** (main + preload + renderer configs, HMR in dev). This is the one new moving part the Svelte decision brings; keep the config stock and minimal.
- **Scaffold (decided):** hand-rolled, with the official electron-vite svelte-ts template open as a *reference* — not template-and-trim. Every file in commit 1 exists because we wrote it. (The template's `@electron-toolkit/preload` pattern exposes a general `electronAPI` — conflicts with our minimal explicit contextBridge, so it'd be ripped out anyway.) Escape hatch: if the hand-rolled config fights us in Phase 1, fall back to template-and-trim and say so.
- **State:** a small JSON file in Electron's `userData` dir. No localStorage, no DB.

### Technical specifics that are easy to get wrong — get these right
- `node-pty` is a **native module**: after install, rebuild it for Electron's ABI with `@electron/rebuild`. Skipping this is the #1 cause of "works in Node, crashes in Electron." I have VS C++ build tools available. On Windows it uses ConPTY under the hood, which renders Claude Code's TUI correctly.
- **Security model:** `contextIsolation: true`, `nodeIntegration: false`. Run `node-pty` in the **main process**; expose a minimal, explicit API to the renderer via a **preload `contextBridge`** (e.g. `spawn`, `write`, `onData`, `resize`, `kill`). Shuttle bytes over IPC — keystrokes renderer→main, output main→renderer, plus resize events.
- **Shell (decided, non-negotiable):** spawn **Git Bash** (`bash.exe`) via node-pty and run `claude` inside it — Git Bash is Claude Code's recommended shell on Windows. Every terminal aRC opens is a Git Bash session; we do not offer PowerShell/cmd/WSL as alternatives.
- **Bash resolution (decided):** adopt VS Code's battle-tested algorithm (`terminalProfiles.ts`) essentially verbatim. **Never PATH-resolve `bash.exe`** — on Windows that can hit the WSL stub (`WindowsApps\bash.exe`) or legacy WSL launcher (`System32\bash.exe`). Instead:
  1. PATH-resolve **`git.exe`** (no WSL doppelgänger, and it's the Git the user actually uses) and walk up from `<root>\cmd\git.exe` to the install root.
  2. Add standard install roots from env vars (`ProgramW6432`, `ProgramFiles`, `ProgramFiles(X86)`, `%LOCALAPPDATA%\Programs`) and the scoop locations (`scoop\apps\git\current`, `scoop\apps\git-with-openssh\current`).
  3. For each root, try `bin\bash.exe` first (the wrapper that sets up the MSYS env — never `git-bash.exe`, which spawns its own mintty window), then `usr\bin\bash.exe`. **First path that exists wins.**
  4. No registry lookup — keeps deps at zero and matches VS Code.
  5. If nothing is found, fail loudly with a clear "Git Bash not found" error. Optional `bashPath` override key in the state JSON as an escape hatch (no UI for it).
- **Spawn spec (decided):** always a **login interactive** shell — sources the user's profile, so PATH (e.g. `~/.local/bin` where `claude` lives) resolves byte-for-byte as in a regular Git Bash terminal; same args VS Code uses for its Git Bash profile.
  - **Shell session:** `bash.exe --login -i`
  - **Claude session:** `bash.exe --login -i -c 'exec claude'` (resume: `... -c 'exec claude --resume <session-id>'`). The `--login` still sources the profile before `-c` runs, so `claude` resolves from the user's real PATH; `exec` makes bash *become* claude, so the PTY's lifetime **is** the claude process's lifetime — `running`/`exited` fall straight out of the PTY with no child-process tracking. Deliberate consequence: when claude exits, the session ends rather than dropping to a prompt — the rail models Claude sessions, not shells; if I want a shell, I open a shell session.
- **Session files live on disk** at `%USERPROFILE%\.claude\projects\<encoded-project-path>\<session-id>.jsonl` (the encoded path is the absolute project path with separators replaced by dashes). Useful for names/status, but note the key advantage below.
- **Status — keep it simple.** Because aRC *spawns* the sessions, it owns each PTY, so `running` / `exited` are known directly from the process. For the `waiting-for-input` signal, wire a lightweight Claude Code **hook** (Notification / Stop) that writes a small marker aRC watches. Target status set: `running`, `waiting`, `idle`, `exited` for Claude sessions; shell sessions are just `running` / `exited`. Don't over-model it.
- **Name & color:** name is a user-editable label per session (optionally seeded from the session's first prompt); color is app-assigned or user-picked. Persist both in the state JSON.
- **Persistence across restarts:** the PTY is a child of aRC, so closing aRC ends the process — but the Claude Code *session* persists on disk. On relaunch, reopen a session with `claude --resume <session-id>`. This gives tmux-like continuity **without tmux** (I'm deliberately off WSL/tmux).

## Verify before you rely on memory
Package names and Electron/node-pty rebuild details drift across versions. Confirm current `@xterm/*` and `node-pty` versions and the correct `@electron/rebuild` invocation for the Electron version we pin (check npm / official docs) before writing install steps.

## Build order (pause for my confirmation after each phase)

1. **Scaffold.** Electron + TS + **Svelte via `electron-vite`** (main / preload / renderer), secure `BrowserWindow` config, empty window that launches. Confirm it runs in dev (HMR) and as a build.
2. **One terminal.** node-pty ↔ xterm wired through IPC, running Git Bash. I can type, output renders, resize works, keystrokes/escape sequences pass through untouched. Get the native rebuild rock-solid here.
3. **Claude Code in it.** Run `claude` in the pane; confirm the full TUI renders cleanly and interactive features (rewind, slash commands, `/btw` — including its `c` copy-to-clipboard via OSC 52, the agent view — left-arrow detach, `/attach`, backgrounding, remote control, `--resume`) behave exactly as in Windows Terminal.
4. **Rail + multiple sessions.** Left rail lists sessions (name, color dot, status placeholder); click to focus its terminal; spawn-new of **either type** (Claude session or shell session) and close. Add the **light / dark / system** appearance toggle here, theming both rail and xterm palette.
5. **Real status.** PTY-derived `running`/`exited` plus the `waiting` signal (hook marker, or the supervisor's jobs-dir state — see open items).
6. **Persistence.** Save session type, names/colors/session-ids/working dirs/appearance mode to the state JSON. On relaunch: Claude sessions reopen via `claude --resume <id>`; shell sessions reopen as fresh shells with the same name/color/cwd (shells have no resume — that's fine).

## Open items — decide along the way (flagged, not decided)

These were flagged during planning; resolve each when its build phase arrives rather than up front:

- **Scoping the `waiting` hook — or skipping hooks entirely** — a Notification/Stop hook in `~/.claude/settings.json` fires for *every* Claude Code session on the machine, not just aRC's; it needs scoping (aRC-set env var, marker keyed by session-id), and writing to global Claude settings is invasive. **Investigate first:** Claude Code's supervisor already tracks per-session state (Working / Needs input / Completed / …) in `~/.claude/jobs/<id>/` — if aRC can read that, the `waiting` signal comes free, read-only, zero config injection. Strongly preferred if the format is stable enough. (Phase 5)
- **Agent view vs. the rail model** — left-arrow detach and `/attach` mean a single PTY can *switch* which Claude session it displays, and backgrounded sessions keep running under the supervisor even with no PTY attached. The rail should probably model *terminals* (PTYs aRC owns), not the machine-wide session graph — but then the rail's session-id label can drift after an `/attach`. Decide how much drift-tracking is worth it; lean minimal. (Phase 5/6)
- **New-session working directory** — how the user picks the project dir when spawning either session type: recent-dirs list, OS folder picker, or both. Keep it to one small affordance. (Phase 4)
- **PTY → session-id mapping** — resume requires knowing which session-id belongs to which spawned terminal; check whether `claude` accepts a caller-supplied id at launch before resorting to watching the projects dir. (Phase 6)
- **Remote-control verification** — should work by construction, but it's network/backend-dependent; verify explicitly from inside aRC. (Phase 3 checklist)
- **Single-instance lock** — second launch should focus the existing window (`requestSingleInstanceLock`). (Phase 1)
- **Terminal font** — a monospace with solid box-drawing/glyph coverage; and per-session dot colors must stay legible in both GitHub palettes. (Phase 2/4)
- **Packaging / installer** — an installed app (electron-builder) is wanted, but explicitly **not v1**. Run from local build until then; add packaging as its own post-v1 phase. (Post-v1)

## Definition of done (v1)
One window. Rail of sessions — Claude Code sessions with name, color, and live status, plus plain shell sessions for everything else — so no other terminal window needs to exist. Click a session to drive it. Spawn (either type), close, and resume. Nothing on the out-of-scope list. That's it — ship it and stop.

---

**Start by restating this plan in your own words, listing any assumptions or open questions, and proposing the Phase 1 project structure. Then wait for my go-ahead.**
