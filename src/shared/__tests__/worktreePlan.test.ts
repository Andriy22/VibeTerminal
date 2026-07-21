import { describe, expect, it } from 'vitest'
import { planPlacements, slugify } from '../worktreePlan'

const panes = (kinds: string[]) =>
  kinds.map((kind, i) => ({ id: `p${i + 1}`, kind: kind as 'claude' | 'codex' | 'shell' }))

describe('slugify', () => {
  it('normalizes names', () => {
    expect(slugify('My Cool App!')).toBe('my-cool-app')
    expect(slugify('  ---  ')).toBe('workspace')
  })
})

describe('planPlacements', () => {
  it('keeps the first pane in the main checkout', () => {
    const plan = planPlacements({
      name: 'demo',
      useWorktrees: true,
      panes: panes(['claude', 'claude', 'codex'])
    })
    expect(plan[0]).toEqual({ paneId: 'p1', worktreeDir: null, branch: null })
    expect(plan[1]).toEqual({
      paneId: 'p2',
      worktreeDir: '.worktrees/bravo',
      branch: null
    })
    expect(plan[2]).toEqual({
      paneId: 'p3',
      worktreeDir: '.worktrees/charlie',
      branch: null
    })
  })

  it('keeps shell panes in the main checkout', () => {
    const plan = planPlacements({
      name: 'demo',
      useWorktrees: true,
      panes: panes(['claude', 'shell', 'codex'])
    })
    expect(plan[1].worktreeDir).toBeNull()
    expect(plan[2].worktreeDir).toBe('.worktrees/charlie')
  })

  it('uses .agents mirrors for multi-repo workspaces', () => {
    const plan = planPlacements({
      name: 'demo',
      useWorktrees: true,
      repos: [
        { dir: 'repo1', baseBranch: null },
        { dir: 'repo2', baseBranch: 'develop' }
      ],
      panes: panes(['claude', 'claude', 'shell'])
    })
    expect(plan[0]).toEqual({ paneId: 'p1', worktreeDir: null, branch: null })
    expect(plan[1]).toEqual({
      paneId: 'p2',
      worktreeDir: '.agents/bravo',
      branch: null
    })
    expect(plan[2].worktreeDir).toBeNull()
  })

  it('uses no worktrees when disabled', () => {
    const plan = planPlacements({
      name: 'demo',
      useWorktrees: false,
      panes: panes(['claude', 'codex'])
    })
    expect(plan.every((p) => p.worktreeDir === null)).toBe(true)
  })
})
