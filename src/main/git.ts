import { execFile } from 'child_process'
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { GitInfo, GitScan, RepoInfo } from '../shared/types'
import { parseWorktreeList, type WorktreeEntry } from '../shared/worktrees'

const execFileAsync = promisify(execFile)

export class GitError extends Error {
  constructor(args: string[], stderr: string) {
    super(`git ${args.join(' ')} failed: ${stderr.trim()}`)
    this.name = 'GitError'
  }
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd })
    return stdout.trim()
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? String(error)
    throw new GitError(args, stderr)
  }
}

async function tryGit(cwd: string, ...args: string[]): Promise<string | null> {
  try {
    return await git(cwd, ...args)
  } catch {
    return null
  }
}

export async function getGitInfo(path: string): Promise<GitInfo> {
  const inside = await tryGit(path, 'rev-parse', '--is-inside-work-tree')
  if (inside !== 'true') {
    return { isRepo: false, branch: null, branches: [], hasCommits: false }
  }
  const branch = await tryGit(path, 'branch', '--show-current')
  const hasCommits = (await tryGit(path, 'rev-parse', '--verify', 'HEAD')) !== null
  const branchList = await tryGit(path, 'branch', '--format=%(refname:short)')
  return {
    isRepo: true,
    branch: branch || null,
    branches: branchList ? branchList.split('\n').filter(Boolean) : [],
    hasCommits
  }
}

/**
 * Inspect a folder: a repo itself, a container of child repos, or neither.
 * Embedded child repos win over the parent being a repo: git doesn't track
 * embedded repo contents, so worktrees of such a parent would be empty —
 * per-repo mirrors are the only isolation that actually contains the code.
 */
export async function scanGit(path: string): Promise<GitScan> {
  const info = await getGitInfo(path)
  const repos: RepoInfo[] = []
  try {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      if (!existsSync(join(path, entry.name, '.git'))) continue
      const child = await getGitInfo(join(path, entry.name))
      if (child.isRepo) {
        repos.push({ dir: entry.name, branch: child.branch, branches: child.branches })
      }
    }
  } catch {
    // unreadable folder — treat as no repos
  }
  repos.sort((a, b) => a.dir.localeCompare(b.dir))
  if (repos.length > 0) return { kind: 'multi', info, repos }
  if (info.isRepo) return { kind: 'repo', info, repos: [] }
  return { kind: 'none', info, repos }
}

/** Make sure `path` is a git repo with at least one commit (worktrees need one). */
export async function ensureRepo(path: string): Promise<void> {
  const info = await getGitInfo(path)
  if (!info.isRepo) await git(path, 'init')
  if (!info.hasCommits) {
    const head = await tryGit(path, 'rev-parse', '--verify', 'HEAD')
    if (head === null) {
      await git(path, 'commit', '--allow-empty', '-m', 'init (vibeterminal)')
    }
  }
}

/** Keep .worktrees/ out of git status without touching the project's .gitignore. */
export function ensureExcluded(repoPath: string, pattern: string): void {
  const excludeFile = join(repoPath, '.git', 'info', 'exclude')
  try {
    const current = existsSync(excludeFile) ? readFileSync(excludeFile, 'utf8') : ''
    if (!current.split('\n').includes(pattern)) {
      appendFileSync(excludeFile, `\n${pattern}\n`)
    }
  } catch {
    // .git may be a file (worktree/submodule) — non-fatal, status just gets noisy
  }
}

/**
 * Detached worktree at the base branch's commit — same code state, no new
 * branch (git forbids the same branch in two worktrees). Commits made inside
 * are preserved via HEAD/reflog until a branch is created for them.
 */
export async function addWorktree(
  repoPath: string,
  dir: string,
  base: string
): Promise<void> {
  await git(repoPath, 'worktree', 'add', '--detach', dir, base)
}

export async function removeWorktree(repoPath: string, dir: string): Promise<void> {
  await git(repoPath, 'worktree', 'remove', '--force', dir)
}

export async function pruneWorktrees(repoPath: string): Promise<void> {
  await tryGit(repoPath, 'worktree', 'prune')
}

/** All checkouts of the repo, from `git worktree list --porcelain`. */
export async function listWorktrees(repoPath: string): Promise<WorktreeEntry[]> {
  const output = await tryGit(repoPath, 'worktree', 'list', '--porcelain')
  return output ? parseWorktreeList(output) : []
}

/** Default branch: origin/HEAD if set, else the currently checked-out branch. */
export async function resolveDefaultBranch(repoPath: string): Promise<string | null> {
  const originHead = await tryGit(
    repoPath,
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD'
  )
  if (originHead) return originHead.replace(/^origin\//, '')
  return (await tryGit(repoPath, 'branch', '--show-current')) || null
}

export async function branchExists(repoPath: string, branch: string): Promise<boolean> {
  const ref = await tryGit(
    repoPath,
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`
  )
  return ref !== null
}

/** true when `ref` is fully contained in `base` (safe to delete). */
export async function isMerged(
  repoPath: string,
  ref: string,
  base: string
): Promise<boolean> {
  try {
    await git(repoPath, 'merge-base', '--is-ancestor', ref, base)
    return true
  } catch {
    return false
  }
}

/** `git branch -d` — safe delete only; silently no-ops when git refuses. */
export async function deleteBranchSafe(repoPath: string, branch: string): Promise<void> {
  await tryGit(repoPath, 'branch', '-d', branch)
}

export async function isDirty(dir: string): Promise<boolean> {
  const status = await tryGit(dir, 'status', '--porcelain')
  return status !== null && status.length > 0
}

/** Changed files from `git status --porcelain` (both staged and unstaged). */
export async function changedFiles(
  repoPath: string
): Promise<{ path: string; status: string }[]> {
  // -uall lists untracked files individually instead of collapsing directories
  const output = await tryGit(repoPath, 'status', '--porcelain', '-uall')
  if (!output) return []
  const changes: { path: string; status: string }[] = []
  for (const line of output.split('\n')) {
    if (line.length < 4) continue
    const x = line[0]
    const y = line[1]
    let path = line.slice(3)
    const arrow = path.indexOf(' -> ')
    if (arrow >= 0) path = path.slice(arrow + 4)
    if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1)
    const status = x === '?' ? '??' : y !== ' ' ? y : x
    changes.push({ path, status })
  }
  return changes
}

/** Files committed on this branch but not in base: `git diff --name-status base...HEAD`. */
export async function branchChangedFiles(
  repoPath: string,
  base: string
): Promise<{ path: string; status: string }[]> {
  const output = await tryGit(repoPath, 'diff', '--name-status', `${base}...HEAD`)
  if (!output) return []
  const changes: { path: string; status: string }[] = []
  for (const line of output.split('\n')) {
    const parts = line.split('\t')
    if (parts.length < 2) continue
    changes.push({ path: parts[parts.length - 1], status: parts[0][0] })
  }
  return changes
}

/** Diff of one file committed on this branch vs base. */
export async function fileDiffRange(
  repoPath: string,
  file: string,
  base: string
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', `${base}...HEAD`, '--', file],
      { cwd: repoPath, maxBuffer: 4 * 1024 * 1024 }
    )
    return stdout
  } catch {
    return ''
  }
}

/** Unified diff for one file vs HEAD; untracked files diff against /dev/null. */
export async function fileDiff(
  repoPath: string,
  file: string,
  untracked: boolean
): Promise<string> {
  if (untracked) {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['diff', '--no-index', '--', '/dev/null', file],
        { cwd: repoPath, maxBuffer: 4 * 1024 * 1024 }
      )
      return stdout
    } catch (error) {
      // git diff --no-index exits 1 when files differ — stdout still has the diff
      const stdout = (error as { stdout?: string }).stdout
      if (stdout) return stdout
      return ''
    }
  }
  try {
    const { stdout } = await execFileAsync('git', ['diff', 'HEAD', '--', file], {
      cwd: repoPath,
      maxBuffer: 4 * 1024 * 1024
    })
    return stdout
  } catch {
    return ''
  }
}
