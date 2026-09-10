import { makeProject } from '@motion-canvas/core'

// The app's own faces: Inter for chrome text, JetBrains Mono for terminal
// flavor — both already in the app's font pickers, bundled from fontsource.
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
// The wordmark face: the repo logo is "agent race control" in Orbitron 700
// (the README carries it as outlined-path SVGs; the trailer sets it live).
import '@fontsource/orbitron/700.css'
// The icon font the app itself uses (tower glyphs in the mock frames).
import 'material-symbols/outlined.css'

import intro from './scenes/intro?scene'
import tower from './scenes/tower?scene'
import status from './scenes/status?scene'
import fidelity from './scenes/fidelity?scene'
import panes from './scenes/panes?scene'
import worktrees from './scenes/worktrees?scene'
import control from './scenes/control?scene'
import outro from './scenes/outro?scene'

// Eight beats in thirty seconds: the name, the tower, the status dot, the
// fidelity rule, the four panes, the worktree workflow, the settings, and
// what survives a restart.
export default makeProject({
  scenes: [intro, tower, status, fidelity, panes, worktrees, control, outro]
})
