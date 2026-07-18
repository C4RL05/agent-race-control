import { execFile } from 'node:child_process'
import { basename, dirname } from 'node:path'

// The app's first — and only — git subprocess: read-only observability for the
// tower's repo→branch tree (issue #5). It NEVER writes and NEVER blocks the UI:
// every call is fail-open — git missing, not a repo, a bare repo, or a wedged
// git all resolve to { isRepo: false }, never a throw and never a hang. This is
// display only; it does not create, switch, or delete anything (see the kickoff
// doc's out-of-scope note — branch *management* stays out, read-only *display*
// is in).

export interface GitInfo {
  isRepo: boolean
  // Repo identity: the parent of the SHARED git dir (`--git-common-dir`), so
  // every worktree of one repo yields the SAME repoRoot and groups together.
  // repoName is its basename.
  repoRoot: string
  repoName: string
  // The cwd's own worktree basename — differs from repoName for a linked
  // worktree, where it annotates the branch subfolder (`→ <worktreeName>`).
  worktreeName: string
  // Current branch (`--abbrev-ref HEAD`); detached HEAD → a short SHA.
  branch: string
}

const NON_REPO: GitInfo = {
  isRepo: false,
  repoRoot: '',
  repoName: '',
  worktreeName: '',
  branch: ''
}

// A short ceiling so a wedged git (a network filesystem, a credential prompt)
// can never stall the tower — the tree just stays flat until the next refresh.
const GIT_TIMEOUT_MS = 3000

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout.trim())
    })
  })
}

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  try {
    // One call for the common case: the absolute shared git dir, this cwd's
    // worktree root, and the branch (or "HEAD" when detached). `--abbrev-ref`
    // is a sticky rev-parse mode, so the detached short-SHA needs its own call
    // (verified: appending `--short HEAD` here re-prints the abbrev-ref, not
    // the SHA).
    const out = await git(cwd, [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
      '--show-toplevel',
      '--abbrev-ref',
      'HEAD'
    ])
    const [commonDir, worktreeRoot, head] = out.split('\n').map((line) => line.trim())
    // A bare repo (or any partial output) has no worktree — treat as non-git.
    if (!commonDir || !worktreeRoot) return NON_REPO
    // git prints POSIX separators even on Windows; dirname of "<repo>/.git" is
    // the main worktree root, shared across all of the repo's worktrees.
    const repoRoot = dirname(commonDir)
    let branch = head
    if (!branch || branch === 'HEAD') {
      // Detached — show a short SHA rather than a branch name. Best-effort:
      // an empty branch just leaves the subfolder unlabeled, never throws.
      branch = await git(cwd, ['rev-parse', '--short', 'HEAD']).catch(() => '')
    }
    return {
      isRepo: true,
      repoRoot,
      repoName: basename(repoRoot),
      worktreeName: basename(worktreeRoot),
      branch
    }
  } catch {
    return NON_REPO
  }
}
