import { mount } from 'svelte'
// Self-hosted Google Material Symbols (outlined set only) — bundled locally,
// no CDN (CSP forbids remote fonts, and the app must work offline).
import 'material-symbols/outlined.css'
// The app-chrome UI font (see .shell in App.svelte) — self-hosted the same
// way, latin subset, the three weights the UI actually uses (400 body, 600
// labels/headers, 700 preview bold/headings). system-ui stays as the fallback
// for non-latin session titles and folder paths.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
// The bundled terminal fonts (the Settings picker's non-native choices),
// self-hosted the same way — latin subset, 400 + 700 (xterm draws ANSI bold
// from the 700 face). The native choices (Cascadia Mono, Consolas) need no
// import. See theme.ts's FONTS and the kickoff doc's resolved terminal-font item.
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/fira-code/latin-400.css'
import '@fontsource/fira-code/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app')! })

export default app
