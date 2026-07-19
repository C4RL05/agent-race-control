// Mutation testing — measures whether the unit suite actually KILLS bugs, not
// just that it executes lines. Scope is exactly the pure-logic modules that
// have tests (see CLAUDE.md); mutating anything else would be 100% survived
// noise. Runs the existing Vitest config as-is. Dev-only, never packaged.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/main/transcript.ts', 'src/main/git.ts', 'src/renderer/src/sessions.svelte.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  clearTextReporter: { allowColor: false },
  thresholds: { high: 80, low: 60, break: null }
}
