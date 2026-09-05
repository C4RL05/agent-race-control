// Screen-scan status detection — the ALTERNATE technique for the status dot,
// opt-in in Settings (`ui.statusSource === 'screen'`). The default channels
// (turn-boundary hooks + the `claude agents --json` floor) are untouched and
// stay the default; this reads the one thing they cannot: what the session
// actually looks like right now.
//
// The technique is herdr's (https://github.com/herdrdev/herdr, Apache-2.0):
// a prioritised rule set matched against REGIONS of the rendered screen plus
// the OSC title, highest-priority match wins. Their priority numbers are kept
// verbatim below so the two rule sets can be diffed against each other. What
// is ported is the technique and the glyph classes; the regions and rules are
// re-derived here against screens captured from Claude Code 2.1.261 (see the
// fixtures in screen.test.ts — every rule below was matched against a real
// capture unless its comment says otherwise).
//
// Two facts from those captures decide the whole design:
//
//   1. The OSC title alone separates working from not-working. It leads with a
//      half-circle spinner frame while a turn runs ("◐ Claude Code") and with
//      ✳ when it is not ("✳ Claude Code").
//   2. The title CANNOT see blocked. A session sitting on a permission dialog
//      still reports "✳ <name>" — the idle glyph. Only the screen shows the
//      dialog, which is why the title's idle rule is ranked below every screen
//      rule (250 against 840–980) and the screen scan earns its keep.
//
// Everything here is pure and read-only: a snapshot of xterm's buffer in, a
// state out. It never writes to the terminal and never touches the byte stream.

export type ScreenState = 'running' | 'waiting' | 'idle'

export interface ScreenInput {
  // The live terminal title (OSC 0/2) — the same string the tower shows.
  title: string
  // The rendered viewport, top row first, tabs/trailing blanks already
  // collapsed by xterm's translateToString.
  lines: string[]
}

// --- glyph classes (verified against 2.1.261 captures) ---

// The title spinner while a turn runs: braille frames (U+2800–U+28FF) on older
// builds, half-circles (U+25D0–U+25D3) on current ones. Captured: "◐ Claude
// Code", "◑ Glob src and summarize pty.ts", for the whole turn and only then.
const TITLE_WORKING = /^[⠀-⣿◐-◓] /

// The settled title glyph, ✳ U+2733 — "✳ Claude Code". Weak on purpose: it is
// equally what a BLOCKED session reports, so it ranks last.
const TITLE_IDLE = /^✳ /

// The in-progress activity line's leading frame. Captured cycling through
// exactly these six: ✶ ✻ ✽ * ✢ · — herdr's class, confirmed unchanged.
const WORK_FRAME = '\\u002A\\u00B7\\u2722\\u2736\\u273B\\u273D'

// "✽ Baking… (7s · ↓ 338 tokens · thought for 5s)". The ellipsis plus an
// elapsed-time parenthetical is what separates a RUNNING line from a finished
// one ("✻ Brewed for 2s · done 9:50"), which carries neither.
const WORKING_LINE = new RegExp(`^\\s*[${WORK_FRAME}]\\s+\\S.*…(?:\\s+\\(\\d+[smh](?:\\s|·)|\\s*$)`)

// The mode footer gains "esc to interrupt" while a turn runs. Captured idle as
// "⏵⏵ auto mode on (shift+tab to cycle) · ← for agents" and "⏸ manual mode on
// · ← for agents" — so the interrupt hint, not the glyph, is load-bearing.
const WORKING_FOOTER = /^\s*[⏸⏵].*esc to interrupt(?:\s|·|$)/i

// A dialog's numbered option row: "❯ 1. Yes", "  2. No".
const NUMBERED_OPTION_ROW = /^\s*❯?\s*\d+\.\s*\S/

// The prompt box's input line — a ❯ with nothing structural after it.
const PROMPT_LINE = /^\s*❯/

// --- regions ---

// A box border: a run of ─ that is either the whole line or at least three
// characters long (herdr's test, kept as-is).
function isHorizontalRule(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const run = /^─+/.exec(trimmed)
  if (!run) return false
  return trimmed.slice(run[0].length).trim() === '' || run[0].length >= 3
}

// From the first of the last `count` non-empty lines to the end — blanks in
// between included, so a rule can still see the shape around them.
function bottomNonEmptyLines(lines: string[], count: number): string[] {
  const indices: number[] = []
  for (let i = lines.length - 1; i >= 0 && indices.length < count; i--) {
    if (lines[i].trim()) indices.push(i)
  }
  const start = indices.at(-1)
  return start === undefined ? [] : lines.slice(start)
}

// Everything below the last box border. A dialog renders under one; the idle
// prompt box renders between two, so this is empty-ish for a settled session.
function afterLastHorizontalRule(lines: string[]): string[] {
  let last = -1
  for (let i = 0; i < lines.length; i++) if (isHorizontalRule(lines[i])) last = i
  return lines.slice(last + 1)
}

// The input box's body: the SECOND border counting back from the bottom is its
// top edge, and the body runs to the next border. Absent (null) whenever there
// are not two borders left on screen — which is exactly the case while a
// permission dialog is up, and is why a dialog can never read as the prompt.
function promptBoxBody(lines: string[]): string[] | null {
  let seen = 0
  let top = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isHorizontalRule(lines[i])) {
      seen++
      if (seen === 2) {
        top = i
        break
      }
    }
  }
  if (top === -1) return null
  const rest = lines.slice(top + 1)
  const end = rest.findIndex(isHorizontalRule)
  return end === -1 ? rest : rest.slice(0, end)
}

// --- predicates ---

const lower = (lines: string[]): string => lines.join('\n').toLowerCase()
const hasLine = (lines: string[], re: RegExp): boolean => lines.some((line) => re.test(line))

// herdr `transcript_viewer` (1000) and `model_picker_menu` (900): overlays that
// are neither working nor blocked. Not individually captured — carried across
// on herdr's authority, because both would otherwise read as a dialog and paint
// a false amber. They resolve to "no opinion", herdr's skip_state_update.
function isTranscriptViewer(lines: string[]): boolean {
  return lower(bottomNonEmptyLines(lines, 3)).includes('showing detailed transcript')
}

function isModelPicker(lines: string[]): boolean {
  const text = lower(lines)
  return text.includes('select model') && text.includes('enter to set as default')
}

// herdr `live_blocked_form` (980) + `bash_permission_prompt` (850) +
// `generic_permission_prompt` (840), which all land on the same colour here.
// Captured twice on 2.1.261: the workspace-trust form ("Enter to confirm · Esc
// to cancel" over "❯ No, exit") and a Read permission dialog ("Do you want to
// proceed?" over "❯ 1. Yes" with "Esc to cancel · Tab to amend"). The shared
// invariant is a cancel footer plus a selectable answer — a settled prompt box
// has neither.
function isBlocked(lines: string[]): boolean {
  const region = afterLastHorizontalRule(lines)
  const text = lower(region)
  if (!text.includes('esc to cancel') && !text.includes('enter to confirm')) return false
  return (
    text.includes('do you want to proceed?') ||
    text.includes('enter to confirm') ||
    text.includes('tab to amend') ||
    hasLine(region, NUMBERED_OPTION_ROW) ||
    (text.includes('enter to select') && text.includes('to navigate'))
  )
}

// herdr `live_turn_working` (970).
function isWorking(lines: string[]): boolean {
  const region = bottomNonEmptyLines(lines, 12)
  return hasLine(region, WORKING_LINE) || hasLine(region, WORKING_FOOTER)
}

// herdr `live_prompt_box` (950): a ❯ inside the input box and nothing in it
// that belongs to a dialog.
function isIdlePrompt(lines: string[]): boolean {
  const body = promptBoxBody(lines)
  if (!body || !hasLine(body, PROMPT_LINE)) return false
  const text = lower(body)
  return !(
    text.includes('enter to select') ||
    text.includes('esc to cancel') ||
    text.includes('to navigate')
  )
}

// --- codex ------------------------------------------------------------------
//
// Same engine, different rule set, ported from herdr's codex manifest
// (version 2026.09.05.1). Codex is the easier of the two, and for a reason
// worth stating: its title carries ALL THREE states, where Claude's cannot see
// blocked. Measured on codex-cli 0.153.4 from a live ConPTY —
//
//   working  "⠹ my-project"   a braille spinner leads the title, all turn
//   idle     "my-project"     the bare working-directory basename
//
// — and herdr has the third, "Action Required" in the title while codex waits
// on you. That one is carried across on their authority rather than captured
// here; the screen rules below are the fallback if it ever fails to appear.
//
// Note the title is the DIRECTORY, not the conversation: two codex rows in one
// folder are indistinguishable by title, which is why the tower gets a codex
// row's name from the session index instead (main/codex.ts).

const CODEX_TITLE_BLOCKED = /action required/i
const CODEX_TITLE_WORKING = /(?:^| )[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏](?: |$)/

// "• Working (39s • esc to interrupt)" — captured verbatim. The interrupt hint
// is what separates a running turn from the same line left on screen after one.
const CODEX_WORKING_LINE = /^[•◦]\s+Working \([^)]*esc to interrupt\)(?: · .*)?$/

// Codex's composer marker, the ›. Everything below the last one is the live
// exchange; a dialog renders there.
const CODEX_PROMPT_LINE = /^\s*›/

function afterLastPromptMarker(lines: string[]): string[] {
  let last = -1
  for (let i = 0; i < lines.length; i++) if (CODEX_PROMPT_LINE.test(lines[i])) last = i
  return last === -1 ? lines : lines.slice(last + 1)
}

function codexBlocked(lines: string[]): boolean {
  const region = lower(afterLastPromptMarker(lines))
  const whole = lower(lines)
  return (
    // herdr `live_strong_blocker` (900)
    region.includes('press enter to confirm or esc to cancel') ||
    region.includes('enter to submit answer') ||
    region.includes('enter to submit all') ||
    region.includes('allow command?') ||
    // herdr `trust_directory` (950) — a fresh folder asks before doing anything
    (whole.includes('do you trust the contents of this directory?') &&
      lower(lines.slice(0, 20)).includes('you are in')) ||
    // herdr `startup_update` (950) — an update prompt holds the session shut
    (whole.includes('update available!') && whole.includes('press enter to continue')) ||
    // herdr `weak_blocker` (600)
    whole.includes('[y/n]') ||
    whole.includes('yes (y)')
  )
}

function codexStatus(input: ScreenInput): ScreenState | null {
  const { title, lines } = input
  if (CODEX_TITLE_BLOCKED.test(title)) return 'waiting' // 1100
  if (CODEX_TITLE_WORKING.test(title)) return 'running' // 1050
  // herdr `transcript_viewer` (1000) — scrolled back through history.
  if (lower(lines).includes('↑/↓ to scroll') && lower(lines).includes('q to quit')) return null
  if (codexBlocked(lines)) return 'waiting' // 950 / 900 / 600
  if (hasLine(bottomNonEmptyLines(lines, 3), CODEX_WORKING_LINE)) return 'running' // 500
  // herdr `osc_title_idle` (100): ANY title that is neither of the two above.
  // Deliberately weak and deliberately last — it is the absence of evidence,
  // not evidence. It still beats returning null, because for codex a settled
  // title is the normal resting state.
  if (title.trim()) return 'idle'
  return null
}

// --- entry point ------------------------------------------------------------

function claudeStatus(input: ScreenInput): ScreenState | null {
  if (TITLE_WORKING.test(input.title)) return 'running' // 1100
  if (isTranscriptViewer(input.lines)) return null // 1000
  if (isBlocked(input.lines)) return 'waiting' // 980 / 850 / 840
  if (isWorking(input.lines)) return 'running' // 970
  if (isIdlePrompt(input.lines)) return 'idle' // 950
  if (isModelPicker(input.lines)) return null // 900
  if (TITLE_IDLE.test(input.title)) return 'idle' // 250
  return null
}

/**
 * Classify one session from its rendered screen. Returns null for "no opinion",
 * which is the whole safety story: an agent's TUI moves, and when it moves far
 * enough that no rule matches, the dot holds its last value instead of
 * guessing. A stale dot is recoverable; a confidently wrong one is what the
 * status rewrite spent three attempts undoing.
 *
 * Rules are evaluated in herdr's priority order, highest first. Which set runs
 * is the only thing the caller has to know.
 */
export function screenStatus(
  input: ScreenInput,
  kind: 'claude' | 'codex' = 'claude'
): ScreenState | null {
  return kind === 'codex' ? codexStatus(input) : claudeStatus(input)
}

// Exported for the tests only — the regions are where a port like this goes
// wrong, and they are worth pinning independently of the rules built on them.
export const __regions = {
  isHorizontalRule,
  bottomNonEmptyLines,
  afterLastHorizontalRule,
  promptBoxBody
}

// The unported rules, recorded so the gap is a decision rather than an
// oversight: `btw_overlay_working` (an open /btw overlay counted as working —
// unverifiable here, and it collides with issue #6's Esc ambiguity),
// `background_agents_working`, `background_mcp_task_working`,
// `dynamic_workflow_prompt`, `mcp_elicitation_prompt`, and
// `legacy_no_prompt_blocker` (a broad pre-manifest catch-all). Also dropped:
// `osc_progress_idle` — Claude Code 2.1.261 emitted ZERO OSC 9;4 sequences
// across every capture, so the rule would be dead code here.
