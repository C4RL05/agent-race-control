import { existsSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'

// Locate Git Bash following VS Code's terminalProfiles.ts algorithm.
// Never PATH-resolve bash.exe directly — on Windows that can hit the WSL stub
// (WindowsApps\bash.exe) or the legacy WSL launcher (System32\bash.exe).
export function findGitBash(): string | null {
  const roots = new Set<string>()

  // 1. Derive the install root from git.exe on PATH (git.exe has no WSL
  //    doppelganger, and it's the Git the user actually uses).
  //    git.exe on PATH lives at <root>\cmd\git.exe.
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (dir && existsSync(join(dir, 'git.exe'))) {
      roots.add(resolve(dir, '..'))
      break
    }
  }

  // 2. Standard install locations.
  for (const parent of [
    process.env['ProgramW6432'],
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env['LOCALAPPDATA'] && join(process.env['LOCALAPPDATA'], 'Programs')
  ]) {
    if (parent) roots.add(join(parent, 'Git'))
  }

  // 3. Scoop installs.
  const home = process.env['USERPROFILE']
  if (home) {
    roots.add(join(home, 'scoop', 'apps', 'git', 'current'))
    roots.add(join(home, 'scoop', 'apps', 'git-with-openssh', 'current'))
  }

  // bin\bash.exe first — the wrapper that sets up the MSYS environment.
  // (Never git-bash.exe: it spawns its own mintty window.)
  for (const root of roots) {
    for (const rel of [join('bin', 'bash.exe'), join('usr', 'bin', 'bash.exe')]) {
      const candidate = join(root, rel)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}
