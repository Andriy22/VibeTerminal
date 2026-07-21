import type { AgentKind } from './types'

export const WORKTREES_DIR = '.worktrees'

/** One entry of `git worktree list --porcelain`. branch = short name, null = detached. */
export interface WorktreeEntry {
  path: string
  head: string | null
  branch: string | null
}

export function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = []
  let current: WorktreeEntry | null = null
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), head: null, branch: null }
      entries.push(current)
    } else if (!current) {
      continue
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length)
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    }
  }
  return entries
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  )
}

/**
 * Text typed into a pane to start on-demand isolation. Agent panes get plain
 * English (the agent runs git itself); shell panes get the literal command.
 */
export function branchOffInstruction(
  kind: AgentKind,
  name: string,
  base: string | null
): string {
  const dir = `${WORKTREES_DIR}/${name}`
  if (kind === 'shell') {
    return `git worktree add ${dir} -b ${name}${base ? ` ${base}` : ''} && cd ${dir}`
  }
  return (
    `Create a git worktree at ${dir} with a new branch ${name}` +
    `${base ? ` based on ${base}` : ''}, then cd into it and do all further work in that worktree.`
  )
}

/** Drop config fields from the removed eager-worktree / multi-repo model. */
export function stripDeadWorkspaceFields(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const { useWorktrees: _useWorktrees, repos: _repos, ...rest } = raw
  return rest
}
