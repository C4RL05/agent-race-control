# Agent Race Control

Minimal Electron + Svelte terminal cockpit for Claude Code on native Windows: one window, a **timing tower** of sessions (Claude + plain Git Bash shells; named after the F1 broadcast graphic, "tower" in code), one terminal pane. **`docs/agent-race-control-kickoff.md` is the living spec** — every decision is recorded there; fold new decisions into it before implementing.

## Two non-negotiable ethos rules

1. **Minimal.** Check every feature idea against the doc's out-of-scope list (no git/PR/kanban/graphs/themes/DB). When tempted, flag it instead of building it.
2. **Full-fidelity Claude Code.** The unmodified `claude` CLI runs in a real ConPTY. Never intercept, rewrite, or steer the byte stream. If it works in Windows Terminal but not here, it's our bug. Blessed deviations (all documented): `--session-id`/`--settings` spawn flags, user-initiated `/color` and `/rename` typing (injected only at the idle prompt — never while a dialog is open), the Ctrl+=/−/0 zoom keys, dev-only F12, and the dev-only `ARC_USERDATA` userData override (screenshot harness scratch profile — ignored when packaged).

## Commands

- `npm run dev` — electron-vite dev with HMR (main/preload changes need an app restart; renderer is hot)
- `npm run build` / `npm run preview` — production build / run it
- `npm run dist` — build + NSIS installer into `dist/` (`npm run dist:dir` for the unpacked smoke-test build; `npx electron scripts/make-icon.mjs` regenerates `build/icon.ico` from the same canvas drawing the app uses)
- `npm run typecheck` — `tsc` (main/preload) + `svelte-check` (renderer)
- `npm run test` — Vitest, **unit tests for pure logic only** (transcript reducer + path encoding, title/status/preview-cache helpers). No component tests, no E2E — UI verification is running the app. Tests `vi.mock('electron')` per file; the svelte plugin in `vitest.config.ts` lets them import runes modules directly.
- `npm run format` — Prettier (config locks in the existing style; `*.md` and the lockfile are ignored)
- `npm run screenshots` — build + `scripts/screenshot.mjs`: stages the doc scene in a scratch profile (`ARC_USERDATA`) and writes `images/arc-hero-{dark,light}.png` + `arc-preview.png`. Real claudes, real keystrokes, synthetic hook POSTs for status variety; a short scripted conversation on a fresh run, reruns resume free (delete `.screenshot-profile/` to restage — required after editing the prompts)

## Architecture

- `src/main/` — `index.ts` (window, zoom, menus-off, IPC), `pty.ts` (node-pty spawn/registry; session types + resume + env scrubbing), `bash.ts` (Git Bash discovery — VS Code's algorithm, never PATH-resolve bash.exe), `status.ts` (localhost HTTP server receiving per-session hook POSTs), `state.ts` (state JSON in userData)
- `src/preload/index.ts` — the only renderer↔main bridge (`window.arc`), keep it minimal and explicit
- `src/renderer/src/` — Svelte 5 runes: `App.svelte` (tower, menus, filter, DnD), `Terminal.svelte` (xterm wiring), `sessions.svelte.ts` (session/folder store + persistence), `theme.ts` (GitHub palettes — exact Primer hexes, don't tweak by eye)

## Gotchas that cost real time (don't relearn these)

- **node-pty ≥1.1 is Node-API with shipped prebuilds — no `@electron/rebuild`, ever.** The npm tarball can't even be gyp-rebuilt (missing winpty files). Never leave a `build/` dir inside `node_modules/node-pty` (loader prefers it over prebuilds). Packaged builds must keep `asarUnpack: node_modules/node-pty/**` (electron-builder.yml) — the prebuilds can't be loaded or spawned from inside the asar.
- **Scrub `CLAUDECODE`/`CLAUDE_CODE_*`/`CLAUDE_EFFORT`… from spawned env** (`pty.ts`). If the app is launched from inside a Claude Code session, leaked markers make spawned claudes act as nested children — which **silently disables transcript persistence** (no resume). Fidelity = fresh terminal, not launcher ancestry.
- **Status comes from hooks over HTTP**, injected per-session via `--settings <userData>/arc-hooks.json` → token-guarded localhost server. Observability only — always answer `200 {}`. Never write to the user's `~/.claude/settings.json`. The `~/.claude/jobs/` dir is background-agents only; foreground sessions never appear there. Hooks are blind to user interrupts (documented: `Stop` fires only on completed turns; nothing fires on dialog dismissal), so the renderer nudges status from observed keystrokes (`nudgeStatusFromKey` in `sessions.svelte.ts`) — hooks stay authoritative. The 60s `idle_prompt` Notification (the idle nag) is deliberately dropped — mapping it to waiting was a false amber; `waiting` comes from `PermissionRequest` (instant), with other Notification types as the safety net (`permission_prompt` trails ~6s).
- **Resume:** we pin `--session-id <uuid>` at spawn; on restore, `--resume` only if the transcript `~/.claude/projects/<cwd-encoded>/<uuid>.jsonl` exists, else fresh with the same id (a never-prompted session writes no transcript; resuming it errors).
- **Transcript dir encoding dashes EVERY non-alphanumeric** in the cwd — dots, spaces, underscores (verified empirically; a `[\\/:]`-only regex silently broke preview *and* resume for dotted paths). `transcriptPath()` in `transcript.ts` is the single owner of the encoding and honors `CLAUDE_CONFIG_DIR`.
- **Version pins are load-bearing:** `@sveltejs/vite-plugin-svelte` 6.x + Vite 7 (electron-vite 5 rejects Vite 8); TypeScript 5.9 (svelte-check crashes on TS 7); Electron pinned exact.
- **Dev restarts: kill the whole `npm run dev` tree, not just `electron.exe`.** Orphaned vite/electron-vite servers accumulate and can leave the next window invisibly alive (GPU-cache contention; there's a `did-finish-load` show-fallback in main, but don't rely on it).
- Keyboard: the app must not shadow terminal keystrokes. The default Electron menu is removed for this reason — don't reintroduce it.

## Workflow with Carlos

Phase/sign-off style: discuss → record the decision in the kickoff doc → implement → he tests visually before commit. Commit when he says so; he sometimes wants pending work split into separate logical commits. Verify package versions and CLI behavior empirically (npm registry, live probes) before writing them into docs or code — memory drifts, and it has been wrong here before.
