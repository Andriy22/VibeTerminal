import { callsign } from './callsigns'
import type { WorkspaceConfig } from './types'

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  )
}

export interface PanePlacement {
  paneId: string
  /** Path of the worktree relative to the repo root, or null = main checkout. */
  worktreeDir: string | null
  /** Branch created for the worktree, or null = main checkout / no worktree. */
  branch: string | null
}

export const WORKTREES_DIR = '.worktrees'
/** Multi-repo mode: per-agent mirror folders live here. */
export const AGENTS_DIR = '.agents'

/** Worktree dir for the pane at `index`, named by its callsign. */
export function worktreeSpec(index: number): { worktreeDir: string } {
  return { worktreeDir: `${WORKTREES_DIR}/${callsign(index)}` }
}

/**
 * Decide where each pane runs.
 * - The first pane (alpha) always runs in the main checkout.
 * - Shell panes always run in the main checkout.
 * - Single repo + worktrees: agent panes get .worktrees/<callsign>, detached
 *   at the base branch — same state, no extra branches.
 * - Multi-repo (config.repos non-empty) + worktrees: agent panes get an
 *   .agents/<callsign> mirror with a detached worktree of every repo.
 */
export function planPlacements(
  config: Pick<WorkspaceConfig, 'name' | 'panes' | 'useWorktrees' | 'repos'>
): PanePlacement[] {
  const multi = (config.repos?.length ?? 0) > 0
  return config.panes.map((pane, i) => {
    const isAgent = pane.kind === 'claude' || pane.kind === 'codex'
    if (i === 0 || !config.useWorktrees || !isAgent) {
      return { paneId: pane.id, worktreeDir: null, branch: null }
    }
    if (multi) {
      return {
        paneId: pane.id,
        worktreeDir: `${AGENTS_DIR}/${callsign(i)}`,
        branch: null
      }
    }
    return { paneId: pane.id, ...worktreeSpec(i), branch: null }
  })
}
