import { powerSaveBlocker } from 'electron'

// KEEP AWAKE (2026-09-25): while the app runs, and the setting is on, the
// machine does not IDLE-sleep — so an agent left working over lunch is still
// working after it. Electron's powerSaveBlocker, not an FFI call to
// SetThreadExecutionState: on Windows Chromium takes the same hold through the
// kernel's power-request API (it shows up under SYSTEM: in an elevated
// `powercfg /requests`), it needs no admin rights and writes nothing to the
// power plans, and the OS drops it when the process exits — so a crash leaves
// nothing behind. On macOS it is an IOPM assertion, same contract.
//
// 'prevent-app-suspension' holds the SYSTEM only; the display still blanks on
// its own timer (a blank screen costs the agent nothing). It prevents idle sleep
// and nothing else: Start → Sleep, the power button and a closed lid still sleep
// the machine, because the user asked for those.
let blockerId: number | null = null

export function setKeepAwake(on: boolean): void {
  if (on && blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-app-suspension')
  } else if (!on && blockerId !== null) {
    powerSaveBlocker.stop(blockerId)
    blockerId = null
  }
}
