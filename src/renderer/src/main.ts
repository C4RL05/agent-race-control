import { mount } from 'svelte'
// Self-hosted Google Material Symbols (outlined set only) — bundled locally,
// no CDN (CSP forbids remote fonts, and the app must work offline).
import 'material-symbols/outlined.css'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app')! })

export default app
