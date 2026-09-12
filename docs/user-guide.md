# Agent Race Control — User Guide

The complete tour of the app. Every screenshot below follows your reading theme — view this page in dark mode and you'll see the dark app, in light mode the light app.

> New here? The [README](../README.md) is the short pitch; [`agent-race-control-kickoff.md`](agent-race-control-kickoff.md) is the design record. This page is the manual.

> **Platform:** everything below describes Windows, the primary platform. It all works on a Mac too — run from source, since there is no build to download — except the Mac *chrome*, which is unfinished: no application menu, and the keyboard table near the end is still the Windows chords. Each spot says so where it matters.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-hero-dark.png">
  <img alt="The app: timing tower on the left, terminal on the right" src="../images/arc-hero-light.png">
</picture>

## The window

One window, one taskbar icon. The **timing tower** on the left lists every session; the **terminal pane** on the right drives the one you clicked. Drag the divider between them to resize the tower (persisted). There are no other windows, panels, or docks — if you need another terminal, you spawn another row.

The name comes from the F1 broadcast graphic: a column of colored entries, each with a name and a live status, telling you the state of the whole race at a glance — then you click one to go on board.

## The timing tower

### Status dots

Every row leads with a status dot — traffic lights from *your* point of view:

| Dot | Meaning |
|---|---|
| 🔴 running | the agent is busy — nothing for you to do |
| 🟠 waiting (pulses) | the agent wants you: a permission prompt or a question |
| 🟠 delegating (steady) | the main turn is over, but its subagents are still working (Claude rows) |
| 🟢 idle | at the prompt — your turn |
| ⚪ shell | a live shell session (shells only run or exit) |
| faded | the process exited |

Amber twice, and the difference is the pulse: **pulsing means you are the blocker**, steady means work is still happening without you. The pulse is reserved for the one state that should catch your eye across the room.

Where the dot comes from depends on the agent. A **Claude** row runs on two channels: Claude Code's own hook events, received over localhost, decide red and amber, while a once-a-second `claude agents --json` poll acts as a green floor so a session that quietly finished can't sit red. Both are pure observation — every hook is answered "carry on", and the poll never touches the terminal. A **Codex** row needs neither: its terminal title carries all three states on its own, so the app reads the screen instead (see [Status detection](#appearance) if you want Claude rows on that too).

One transition no channel reports is an interrupt, so the app also watches for **Ctrl+C** and greens the dot itself. Esc is deliberately *not* read: it dismisses a dialog, but it also closes Claude's `/btw` menu, and a keystroke that means two things can't be trusted with your status.

**Click a dot to flag it TODO** — a "come back to this one" marker. It's purely cosmetic and clears itself the next time the session's real status changes color.

The dot carries one other overlay: an **archived** row draws it as a ring instead of a disc, same color, hollow (see [The archive](#the-archive)).

### Cards

Sessions group into cards by where they run:

- **A plain folder card** — the directory's name, its sessions under it.
- **A repo card** — a git repository. All the repo's worktrees gather under one card, one **branch row** each (more under [Repo cards & worktrees](#repo-cards--worktrees) below).

Each card has a colored team stripe. Colors come from Claude Code's own `/color` vocabulary and are auto-assigned per directory; right-click a card title to change one. Click a card's name to **collapse** it to a single title row — a roll-up dot keeps showing the most urgent status inside; click again to expand.

Hovering a card title (or a branch row) reveals its spawn cluster: **new Claude session here**, **new Codex session here**, **new shell here**, **show in Explorer**.

### Reordering

Everything drags. Drag a card to reorder the groups; drag a row to reorder sessions within their card. A session's directory is a fact of its running process, so rows can't move between cards.

### The filter bar

The bar above the tower filters as you type — matching session names, conversation titles, and paths. The chip next to it filters by type (Claude sessions / shells / all types). Esc clears the text. The three buttons on the left spawn sessions — Claude, Codex, shell — each opening a menu of recent directories plus **Browse…**.

## Sessions

### Three types

- **Claude sessions** — the unmodified `claude` CLI in a real ConPTY (spawned as `bash --login -i -c 'exec claude'`; on a Mac the same `exec` line runs under your own login shell, which is the one difference). Everything the terminal has works by construction: rewind, `/btw`, agent view, plan mode, MCP, resume, hooks.
- **Codex sessions** — the unmodified `codex` CLI, in the same tower, the same folders, with the same dots, drag-and-drop and TODO flags. Its spawn line is shorter than Claude's, not longer: plain `codex`, or `codex resume <id>` when the app restores it, and nothing else. What it doesn't get is listed under [Where Codex differs](#where-codex-differs).
- **Shell sessions** — first-class shells for dev servers, builds, git: Git Bash on Windows, your login shell (`$SHELL`) on a Mac. Same tower, same rows, white dot.

### Where Codex differs

Everything about the app that isn't the CLI is shared. Four things are not, and each is a capability Codex genuinely lacks rather than a feature left out:

- **No fresh worktree at spawn.** Codex has no `--worktree` flag, and the app will not run git itself, so a repo card's new-worktree button stays Claude's.
- **No rename into the session, and no folder colour.** Both work by typing a slash command at the prompt, which Codex's composer wouldn't understand. A Codex row's name is a plain local label instead, seeded from Codex's own thread name once it picks one.
- **No Session tab.** That tab reads Claude's own session file and folds a Claude transcript for its numbers; none of it exists here, and a mostly-empty instrument panel is worse than no tab.
- **Its conversation id is discovered, not pinned.** Codex mints its own, so for the first second or so a new row is a working terminal with no preview yet. It arrives on its own.

It does get Terminal, Preview and Notes, the status dot, TODO, folders, drag-and-drop, duplicate, archive, close and **Relaunch**.

### Naming

Double-click a row's name to rename it.

- A **shell's** name is a plain local label ("dev server").
- A **Claude session's** name *is its conversation's name*: the rename types `/rename <name>` into the session for you, so the tower and Claude's own UI stay in sync. This only happens at an idle prompt — never while Claude is busy or a dialog is open. Untouched Claude sessions display their conversation title, live from the terminal title.
- A **Codex session's** name is local to the tower. Codex titles its window with the working directory, so every Codex row in one folder would otherwise read the same word; the app takes the thread name Codex writes to its own session index instead, and renaming replaces it here only.

### The context menu

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-session-menu-dark.png">
  <img alt="Right-clicking a session row" src="../images/arc-session-menu-light.png">
</picture>

Right-click a row:

- **Show in Explorer** / **Copy path** — the directory the session runs in.
- **Duplicate session** — same type, same directory, fresh process. Windows Terminal's "duplicate tab".
- **Rename** — the same rename double-clicking the name does.
- **Apply folder color** — types `/color <name>` so Claude's agent view matches the tower stripe. Claude rows only.
- **Relaunch session** — ends this session's process and brings the *same conversation* straight back up in a fresh one. For when the CLI has updated under you, or the TUI is wedged. The row keeps its place, its name, its TODO flag and its notes; only the process underneath is new. Agent rows only — a shell has no conversation to resume, and restarting one is a close and a new row.
- **Archive session** — files the row into its card's archive, below. The session carries on running.
- **Close session** — kills the process and removes the row.

### The archive

Archiving is the middle ground between leaving a session in your way and closing it. The row drops into a foldable list at the bottom of its card and everything else carries on: it keeps running, keeps its status, its TODO flag, its notes and its tabs, and clicking it still focuses its terminal. Nothing about the session itself changes — the CLI can't tell it has been archived.

A card holding archived rows grows a hairline separator, with an archive glyph and the count at its right end. Click it to unfold, click again to fold — the same gesture a card's name uses, and it starts **folded**, because getting a row out of the way is the whole point. Archived dots keep their color but are drawn as a **ring** rather than a disc, so a glance still tells you what the session is doing.

You can also **drag rows across the separator**. Drop one on a row in the other section to archive or unarchive it and place it exactly there; drop it on the separator itself to cross with no aiming, which is the only way that works when the far side is empty — so the separator appears on its own the moment you start dragging inside a card that has nothing archived yet. From the context menu there is no position to aim at, so *Archive session* files the row at the **top** of the archive and *Unarchive* returns it to the **bottom** of the live list.

Two things archiving deliberately does *not* do. A collapsed card's roll-up dot still counts archived sessions, so filing one away can never hide that it's blocked on a permission prompt — and if the session it's reporting is an archived one, that roll-up dot is drawn hollow too, so you know where to look. And a filter that matches an archived row opens the archive to show it, whatever its fold state — a search that can't find a session you know exists would be a bug, not decluttering.

### Closing and resuming

The **×** on a row closes the session the way closing a terminal window would — the process is killed, the row disappears. It does *not* type `/exit`, so the CLI's graceful-exit behaviors (like Claude Code's worktree cleanup) don't run; the conversation file stays in the agent's own history.

**Restarting the app restores the tower.** Agent rows reopen *into their conversations* — Claude with `--resume` against the id the app pinned at spawn, Codex with `codex resume` against the id it minted itself. Shells reopen fresh in their directory. Sessions that exited before the restart are gone — a session that ended is gone.

## Repo cards & worktrees

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-worktrees-dark.png">
  <img alt="A repo card: main plus two feature worktrees, with branch-state markers" src="../images/arc-worktrees-light.png">
</picture>

A repo card is the multi-feature cockpit: **one card per repo, one worktree per feature, as many sessions per feature as the job needs.** Each branch row shows the branch name, the worktree's folder name on the right, and state markers when there's something to know:

| Marker | Meaning |
|---|---|
| ● | uncommitted changes in that worktree |
| ↑n | commits ahead of the branch's base |
| ↓n | commits behind it |

Hover the row for the spelled-out version ("uncommitted changes · 1 ahead · 1 behind vs main"). The base is the branch's upstream if it has one, otherwise your local `main`/`master` — so ↑ answers *"is this merged into my main yet?"*, which is the question you're actually asking before closing a feature. Markers refresh when the window regains focus and whenever a session's turn ends — no polling.

### Starting a feature

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-worktree-new-dark.png">
  <img alt="Naming a fresh worktree on the repo card" src="../images/arc-worktree-new-light.png">
</picture>

The repo card's **➕ folder button** starts a Claude session in a **fresh worktree**: type a name and press Enter (blank lets Claude pick a name; Esc cancels). The app spawns `claude --worktree <name>` — **Claude Code creates the worktree** (`.claude/worktrees/<name>/`, on a new branch `worktree-<name>`), the app never touches git. The branch row appears immediately with the session parked on it; the first prompt confirms the real directory.

### Finishing a feature

Type `/exit` in the session. With nothing pending, **Claude Code removes the worktree itself** ("Cleaning up worktree — no pending changes"); with uncommitted changes it asks first. **The branch always survives** — merge it, then delete it whenever you like. Closing the row with × (or a crash) skips cleanup: the worktree stays on disk, *parked*.

### Reopening a parked worktree

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-reopen-dark.png">
  <img alt="The reopen menu listing parked worktrees" src="../images/arc-reopen-light.png">
</picture>

The card's **history button** lists the repo's worktrees that currently have no rows — kept at exit, stranded by ×, or made by hand. Pick one and a Claude session reopens there (a `.claude/worktrees/` worktree re-attaches Claude Code's create-and-clean-up lifecycle; any other worktree just gets a session in its directory). Committed work is preserved.

### Worth setting up per repo

- add `.claude/worktrees/` to `.gitignore`
- list env files (`.env`…) in a [`.worktreeinclude`](https://code.claude.com/docs/en/worktrees) so new worktrees get copies
- a worktree is a bare checkout — make `npm install` your first prompt, or automate it with a personal `WorktreeCreate` hook
- run plain `claude` once in a new repo first (worktrees need the trust dialog accepted)

## The pane tabs

A shell row is just a terminal. An agent row carries tabs above it:

| Tab | Claude | Codex |
|---|---|---|
| **Terminal** | ✅ | ✅ |
| **Preview** — the conversation, rendered | ✅ | ✅ |
| **Session** — the instrument panel | ✅ | — |
| **Notes** — a scratchpad | ✅ | ✅ |

All three of the non-terminal tabs are **read-only about the session**: none of them can write to it, and the terminal keeps running while you're on any of them. Each also remembers its own text size (see [Zoom](#appearance)).

### Preview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-preview-dark.png">
  <img alt="The read-only conversation preview" src="../images/arc-preview-light.png">
</picture>

A **read-only preview of the conversation**, rendered as markdown — headers, tables, bullets, code — straight from the transcript the CLI itself writes. It follows the conversation live, drops tool noise but keeps the code the agent writes (file listings, `+/-` tinted diffs), and its text is selectable — reading a long answer here beats scrolling xterm.

A file that was written or edited arrives as a **tab carrying its name**, folded. Click the tab to unfold the code and click it again to put it away — so a long listing never buries the conversation around it, and you still see at a glance which file was touched.

Pure observation: nothing is injected, the terminal byte stream is untouched, and flipping between Terminal and Preview is instant.

### Session

Everything the app knows about a running Claude session, as read-only labelled text: pid and working directory, the model and effort driving it, context and output tokens, turns and how long the last one took, compactions, queued prompts, subagents and background shells it started, which hooks ran and how slow they were, and Claude's own written summary of where it got to.

It exists because the status dot used to be **unverifiable by eye**. This tab puts the app's computed dot next to the poll's raw reading, and the hook-counted subagents next to the transcript-counted ones, so a disagreement is something you can watch rather than something you argue about. Counts here are labelled **open**, not running — a task whose completion was never written stays counted, and the poll line is the authority on whether anything is actually happening.

One control, and it only writes to the clipboard: **Copy all** puts the whole panel into a bug report as plain text, so the reading you paste is the reading you were looking at. It refreshes every couple of seconds and only while you're looking at it.

### Notes

A plain-text scratchpad per session — the original Notepad, not an editor. No markdown, no toolbar, no formatting, no export.

The text is a field on the session, which decides both of its behaviours: notes **survive a restart** with the row, and they **die when the row is closed**. A note is about *this* session, not about the directory. It stays loaded while you're on another tab, so your undo history and scroll position are still there when you come back.

## Appearance

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/arc-settings-dark.png">
  <img alt="The Settings modal" src="../images/arc-settings-light.png">
</picture>

The ☰ button opens Settings — one panel, three sections, closed with the ×, a click outside, or Escape.

**Appearance**

- **Theme** — GitHub Light / Dark / System, the exact Primer palettes. This themes the app's chrome and terminal colors; Claude Code's own rendering passes through untouched.
- **Color title glyph** — paints the leading emoji or symbol of a row's name by which glyph it is, so sessions you've named with one are pickable out of the list by colour.

**Status**

- **Status dot** — draws the dots at all. Off, the tower is names only and the column they sat in closes up.
- **Status RGB** — swaps the status dots' Primer tones for pure traffic-light red/amber/green.
- **Detection** — which technique colours the dot. **Hooks + poll** is the default and the better of the two: Claude Code's own turn-boundary events decide red and amber, with the agent poll as a green floor. **Screen** instead reads the session's own screen — its spinner, its prompt box, an open dialog. The line under it spells out whichever you've picked. The setting governs **Claude rows only**, because they are the ones with a choice; Codex rows always read the screen, since their terminal title reports all three states on its own.

**Fonts**

Three pickers — the terminal's monospace face (Cascadia Mono, Consolas, JetBrains Mono, Fira Code, IBM Plex Mono) and the sans faces for the app chrome and the preview. Each picker shows the face **in that face**, and unfolds to the whole list with every name likewise set in itself, so you're choosing by how it reads rather than by its name. Only one list is open at a time.

**Zoom** works two ways. `Ctrl+=` / `Ctrl+-` / `Ctrl+0` size the **whole window**, Windows-Terminal style. `Ctrl+wheel` over a pane sizes **just that pane** — the tower, the terminal, the Preview tab, the Session tab and the Notes tab each remember their own size, so you can read a transcript large while the tower stays small. The wheel moves in finer steps than the keys, two notches to each keypress, and reaches just as far either way. The terminal's share is a real font-size change: the grid reflows and the session is resized, exactly as in Windows Terminal. Pressing one of the window-zoom keys puts every pane back in step with the window.

## Keyboard & mouse

The app deliberately adds *no* muscle memory on top of Windows Terminal, and shadows nothing — every keystroke not listed here goes straight to the terminal:

| Input | Action |
|---|---|
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | copy / paste in the terminal |
| Right-click in the terminal | copy selection, else paste |
| Drop a file on the terminal | pastes the quoted path |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | zoom the whole window in / out / reset (and resync the panes) |
| `Ctrl+wheel` over a pane | zoom that pane alone |
| Double-click a row name | rename |
| Right-click a row | context menu |
| Click a status dot | toggle its TODO flag |
| Click a card name | collapse / expand the card |
| Click an archive separator | fold / unfold that card's archive |
| Drag a row across the separator | archive / unarchive it |

On a Mac these are still the Windows chords. `Cmd+C`, `Cmd+V`, `Cmd+=` and `Cmd+Q` are not wired yet and there is no application menu, so copy, paste and zoom want `Ctrl`. That is the next macOS pass, and it is the one place the app currently asks a Mac user to change habits.

## State

Everything lives in one human-readable JSON: `%APPDATA%\Agent Race Control\state.json`, or `~/Library/Application Support/Agent Race Control/state.json` on a Mac — sessions, groups, colors, theme, fonts, zoom, tower width. No database, no cloud. Delete it to start fresh. The app writes nothing else outside its own data directory: your `~/.claude/settings.json` is never touched (per-session hook settings are passed at spawn), and no git command is ever run against your repos — reading branch state excepted, worktree creation and cleanup are Claude Code's own doing.
