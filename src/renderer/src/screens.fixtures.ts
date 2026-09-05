// Real Claude Code 2.1.261 screens, captured from a live ConPTY session and
// fed through a headless xterm — the same buffer shape Terminal.svelte scans.
// Generated, not hand-typed: only the filesystem paths are neutralised (no
// detection rule reads them). These are the ground truth screen.ts is written
// against; if Claude Code's TUI moves, re-capture rather than adjust the rules
// to fit a guess.

export interface Fixture {
  title: string
  lines: string[]
}

export const IDLE: Fixture = {
  title: '✳ Claude Code',
  lines: [
    '',
    ' ▐▛███▛█   Claude Code v2.1.261',
    '▝▜██████▀  Opus 5 (1M context) with xhigh effort · Claude Max',
    '  ▝▝ ▝▝    ~\\projects\\demo',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    '❯',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    '  fresh1788598511182 Opus 5 (1M context)                                                       /rc',
    '  ⏸ manual mode on · ← for agents'
  ]
}

export const WORKING: Fixture = {
  title: '◑ Git version check',
  lines: [
    '',
    ' ▐▛███▛█   Claude Code v2.1.261',
    '▝▜██████▀  Opus 5 (1M context) with xhigh effort · Claude Max',
    '  ▝▝ ▝▝    ~\\projects\\demo',
    '',
    '',
    '❯ run this bash command and tell me the output: git --version',
    '',
    '  Showing git version',
    '  ⎿  $ git --version',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '· Booping… (2s · ↓ 10 tokens)',
    '                                                                                 ◉ xhigh · /effort',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    '❯',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    '  capture Opus 5 (1M context)                                                                  /rc',
    '  ⏸ manual mode on · ← for agents'
  ]
}

export const BLOCKED_PERMISSION: Fixture = {
  title: '✳ Agent-race-control package version',
  lines: [
    '',
    ' ▐▛███▛█   Claude Code v2.1.261',
    '▝▜██████▀  Opus 5 (1M context) with xhigh effort · Claude Max',
    '  ▝▝ ▝▝    ~\\projects\\demo',
    '',
    '',
    '❯ read the file D:\\projects\\demo\\package.json and tell me its version',
    '',
    "● I'll read that file.",
    '',
    '● Reading D:\\projects\\demo\\package.json',
    '  ⎿  D:\\projects\\demo\\package.json',
    '',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    ' Read file',
    '',
    '  Read(D:\\projects\\demo\\package.json)',
    '',
    ' Do you want to proceed?',
    ' ❯ 1. Yes',
    '   2. Yes, allow reading from /d/projects/demo during this session',
    '   3. No',
    '',
    ' Esc to cancel · Tab to amend',
    '',
    '',
    '',
    '',
    '',
    ''
  ]
}

export const BLOCKED_TRUST: Fixture = {
  title: 'claude',
  lines: [
    '',
    '────────────────────────────────────────────────────────────────────────────────────────────────────',
    ' Accessing workspace:',
    '',
    ' C:\\projects\\demo',
    ' demo',
    '',
    ' Quick safety check: Is this a project you created or one you trust? (Like your own code, a',
    " well-known open source project, or work from your team). If not, take a moment to review what's in",
    ' this folder first.',
    '',
    " Claude Code'll be able to read, edit, and execute files here.",
    '',
    ' Security guide',
    '',
    ' ❯ No, exit',
    '   Yes, I trust this folder',
    '',
    ' Enter to confirm · Esc to cancel',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ]
}
