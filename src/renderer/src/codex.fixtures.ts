// Real Codex 0.153.4 screens, captured from a live ConPTY session through a
// headless xterm — the same buffer shape Terminal.svelte scans. Generated, not
// hand-typed; only paths and the throwaway directory name are neutralised.
//
// Note what the title is: the WORKING DIRECTORY's basename, never the
// conversation. That is why the tower gets a codex row's name from the session
// index instead, and why two codex rows in one folder would otherwise be
// indistinguishable.

import type { Fixture } from './screens.fixtures'

export const CODEX_WORKING: Fixture = {
  title: '⠇ demo',
  lines: [
    '│                                                      │',
    '│ model:     gpt-6-astra low   /model to change        │',
    '│ directory: ~\\projects\\demo │',
    '╰──────────────────────────────────────────────────────╯',
    '',
    '  Tip: This is GPT-6, a new generation of intelligence. Astra is state-of-the-art in coding,',
    '  computer use, science, and professional work. Give it a hard problem, a half-formed idea, or',
    "  anything you've been meaning to build. See where it takes you.",
    '',
    '',
    '› write a haiku about terminals, then count from 1 to 20 slowly',
    '',
    '',
    '• Session renamed to write a haiku about terminals, then. To resume this session run codex resume,',
    'then select write a haiku about terminals, then (01a071a8-ea46-7622-9fe7-c4b504c6debf)',
    '',
    '• Soft green letters glow',
    '  Commands ripple through the dark',
    '  The prompt waits for dawn',
    '',
    '  1',
    '',
    '• 2',
    '',
    '• Working (20s • esc to interrupt)',
    '',
    '',
    '› Ask Codex to do anything',
    '',
    '  gpt-6-astra low · ~\\projects\\demo'
  ]
}

export const CODEX_IDLE: Fixture = {
  title: 'demo',
  lines: [
    '╭──────────────────────────────────────────────────────╮',
    '│ >_ OpenAI Codex (v0.153.4)                           │',
    '│                                                      │',
    '│ model:     gpt-6-astra low   /model to change        │',
    '│ directory: ~\\projects\\demo │',
    '╰──────────────────────────────────────────────────────╯',
    '',
    '  Tip: This is GPT-6, a new generation of intelligence. Astra is state-of-the-art in coding,',
    '  computer use, science, and professional work. Give it a hard problem, a half-formed idea, or',
    "  anything you've been meaning to build. See where it takes you.",
    '',
    '',
    '› write a haiku about terminals, then count from 1 to 20 slowly',
    '',
    '',
    '',
    '› Ask Codex to do anything',
    '',
    '  gpt-6-astra low · ~\\projects\\demo',
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
