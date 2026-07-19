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
  // Branch state — "is this feature safe to merge/close?" at a glance.
  // dirty: uncommitted or untracked changes in this worktree. ahead/behind:
  // commit counts vs `base` — the branch's upstream when set, else the repo's
  // default base (origin/HEAD → main → master, never the branch itself), so a
  // worktree feature branch reads as unmerged work / needs-rebase. All
  // fail-open per-field: unknown → false/0/''.
  dirty: boolean
  ahead: number
  behind: number
  base: string
}

const NON_REPO: GitInfo = {
  isRepo: false,
  repoRoot: '',
  repoName: '',
  worktreeName: '',
  branch: '',
  dirty: false,
  ahead: 0,
  behind: 0,
  base: ''
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

// The `git status --porcelain=v2 --branch` reduction: the `# branch.*`
// headers carry the upstream name and its ahead/behind counts; ANY non-header
// line is a change entry (modified, staged, untracked, unmerged — all count
// as dirty for "safe to close?"). Pure and exported for the unit tests.
export function parseStatusV2(out: string): {
  dirty: boolean
  ahead: number
  behind: number
  upstream: string
} {
  let dirty = false
  let ahead = 0
  let behind = 0
  let upstream = ''
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length).trim()
    } else if (line.startsWith('# branch.ab ')) {
      const counts = /\+(\d+) -(\d+)/.exec(line)
      if (counts) {
        ahead = Number(counts[1])
        behind = Number(counts[2])
      }
    } else if (line && !line.startsWith('#')) {
      dirty = true
    }
  }
  return { dirty, ahead, behind, upstream }
}

// The comparison base for a branch with no upstream — never the branch itself
// (comparing main to main is noise, not signal). LOCAL main/master is
// preferred over origin/HEAD deliberately: ahead-of-local-main answers
// "merged yet? safe to delete?" in a merge-locally workflow, whereas
// origin/HEAD would inflate a feature's count with main's own unpushed
// commits and keep reading ahead after a local merge. origin/HEAD is the
// fallback for repos whose default branch has another name. '' = no base.
async function defaultBase(cwd: string, branch: string): Promise<string> {
  for (const candidate of ['main', 'master']) {
    if (candidate === branch) continue
    const exists = await git(cwd, ['rev-parse', '--verify', '--quiet', candidate]).catch(() => '')
    if (exists) return candidate
  }
  const originHead = await git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(
    () => ''
  )
  if (originHead && originHead !== branch) {
    // origin/HEAD can dangle (pruned or re-named remote branch): the symref
    // read succeeds while its target is gone, and rev-list against it would
    // fail into silent no-counts — only trust a target that resolves.
    const resolves = await git(cwd, ['rev-parse', '--verify', '--quiet', originHead]).catch(
      () => ''
    )
    if (resolves) return originHead
  }
  return ''
}

// One worktree as `git worktree list --porcelain` reports it. branch is the
// short name ('' when detached); locked covers both live sessions and stale
// locks left by killed ones.
export interface WorktreeEntry {
  path: string
  branch: string
  locked: boolean
}

// Read-only list of a repo's worktrees for the repo card's reopen menu —
// fetched on menu open, never polled. Same fail-open contract as getGitInfo:
// any error, timeout, or non-repo resolves to [], never a throw.
export async function listWorktrees(repoRoot: string): Promise<WorktreeEntry[]> {
  try {
    const out = await git(repoRoot, ['worktree', 'list', '--porcelain'])
    const entries: WorktreeEntry[] = []
    for (const block of out.split(/\n{2,}/)) {
      let path = ''
      let branch = ''
      let locked = false
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim()
        else if (line.startsWith('branch '))
          branch = line
            .slice('branch '.length)
            .trim()
            .replace(/^refs\/heads\//, '')
        else if (line === 'locked' || line.startsWith('locked ')) locked = true
      }
      if (path) entries.push({ path, branch, locked })
    }
    return entries
  } catch {
    return []
  }
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
    // Branch state, each step best-effort on top of the identity above: a
    // slow/failed status just leaves the row unadorned, never un-repos it.
    let dirty = false
    let ahead = 0
    let behind = 0
    let base = ''
    const status = await git(cwd, ['status', '--porcelain=v2', '--branch']).catch(() => null)
    if (status !== null) {
      const parsed = parseStatusV2(status)
      dirty = parsed.dirty
      if (parsed.upstream) {
        base = parsed.upstream
        ahead = parsed.ahead
        behind = parsed.behind
      } else {
        const fallback = await defaultBase(cwd, branch)
        if (fallback) {
          // "<only-in-base>\t<only-in-HEAD>" — i.e. behind, then ahead.
          const counts = await git(cwd, [
            'rev-list',
            '--left-right',
            '--count',
            `${fallback}...HEAD`
          ]).catch(() => '')
          const [b, a] = counts.split(/\s+/).map(Number)
          if (Number.isFinite(a) && Number.isFinite(b)) {
            base = fallback
            behind = b
            ahead = a
          }
        }
      }
    }
    return {
      isRepo: true,
      repoRoot,
      repoName: basename(repoRoot),
      worktreeName: basename(worktreeRoot),
      branch,
      dirty,
      ahead,
      behind,
      base
    }
  } catch {
    return NON_REPO
  }
}
