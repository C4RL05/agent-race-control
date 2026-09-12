// Restore the execute bit on node-pty's POSIX `spawn-helper`.
//
//   npm run fix-pty-perms
//
// WHY THIS EXISTS: node-pty 1.1.0 publishes its darwin prebuilds with the
// helper as `-rw-r--r--`. Verified against the tarball itself, not inferred —
// `npm pack node-pty@1.1.0` lists `prebuilds/darwin-arm64/spawn-helper` without
// the bit, and neither the package's `install` nor its `postinstall` script
// chmods it. On macOS node-pty `posix_spawnp`s that helper, which fails
// instantly without `+x`, and a terminal then renders a BLANK PANE WITH NO
// ERROR — there is nothing to print, because the shell never started. That
// symptom points nowhere near a file permission, which is why it is written
// down here rather than left to be re-discovered.
//
// So this is not a workaround for any --ignore-scripts policy: the bit was
// never in the package. It is a workaround for an upstream packaging bug, and
// the fix upstream has already landed — 1.2.0-beta ships the helper
// `-rwxr-xr-x`. DELETE THIS SCRIPT when node-pty is bumped to a release
// carrying the bit; the "nothing to do" branch below is what tells you it is
// safe to.
//
// It runs ahead of `dist`, not as a postinstall: electron-builder copies the
// file mode it finds in node_modules, so the chmod has to happen BEFORE
// packaging or the .app ships with blank terminals for every user.
//
// WINDOWS EXITS EARLY, and that is not the same as "there is nothing there".
// node-pty ships EVERY prebuild directory in one tarball on every host —
// verified on a Windows install, where prebuilds/ holds darwin-arm64,
// darwin-x64, win32-arm64 and win32-x64, and the darwin ones do carry
// spawn-helper without its bit. Left to run, this would chmod two files Windows
// never spawns, report "fixed 2 helpers", and make its own "nothing to do"
// signal — the one that says node-pty has been bumped and the script can be
// deleted — unreachable on the host most likely to run it. Windows chmod only
// toggles the read-only attribute anyway; it cannot write a POSIX mode.

import { chmodSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform === 'win32') {
  console.log('win32: the ConPTY prebuild has no spawn-helper. Nothing to do.')
  process.exit(0)
}

const HERE = dirname(fileURLToPath(import.meta.url))
const PREBUILDS = join(HERE, '..', 'node_modules', 'node-pty', 'prebuilds')

// The POSIX prebuilds that carry a helper. node-pty 1.1.0 ships no linux
// directory at all, so those two are listed against a future release rather
// than as something expected on disk — which is why an absent target is silent.
const TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64']

// A missing prebuilds dir means node-pty is not installed at all, which is the
// one condition worth failing on.
if (!existsSync(PREBUILDS)) {
  console.error('No node-pty prebuilds found. Run `npm install` first.')
  process.exit(1)
}

let changed = 0
let alreadyOk = 0

for (const platform of TARGETS) {
  const helper = join(PREBUILDS, platform, 'spawn-helper')
  if (!existsSync(helper)) continue
  // 0o111 is the three execute bits. Checked before writing so a run on an
  // already-good tree is silent about it rather than reporting work it did not
  // do.
  const mode = statSync(helper).mode
  if ((mode & 0o111) === 0o111) {
    alreadyOk++
    continue
  }
  chmodSync(helper, mode | 0o111)
  console.log(`  +x  ${platform}/spawn-helper`)
  changed++
}

console.log(
  changed > 0
    ? `Fixed ${changed} helper${changed === 1 ? '' : 's'}. The terminal can start a shell.`
    : `Nothing to do — every POSIX helper present is already executable (${alreadyOk}). ` +
        'If node-pty has been bumped past 1.1.0, this script may no longer be needed.'
)
