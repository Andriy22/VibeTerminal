import { describe, expect, it } from 'vitest'
import {
  branchOffInstruction,
  parseWorktreeList,
  slugify,
  stripDeadWorkspaceFields
} from '../worktrees'

const PORCELAIN = `worktree /Users/me/proj
HEAD 111aaa
branch refs/heads/main

worktree /Users/me/proj/.worktrees/fix-login
HEAD 222bbb
branch refs/heads/fix-login

worktree /Users/me/proj/.worktrees/bravo
HEAD 333ccc
detached

worktree /Users/me/proj/.worktrees/stale
HEAD 444ddd
branch refs/heads/stale
prunable gitdir file points to non-existent location
`

describe('parseWorktreeList', () => {
  it('parses main, branch, and detached entries', () => {
    const entries = parseWorktreeList(PORCELAIN)
    expect(entries).toEqual([
      { path: '/Users/me/proj', head: '111aaa', branch: 'main' },
      {
        path: '/Users/me/proj/.worktrees/fix-login',
        head: '222bbb',
        branch: 'fix-login'
      },
      { path: '/Users/me/proj/.worktrees/bravo', head: '333ccc', branch: null },
      { path: '/Users/me/proj/.worktrees/stale', head: '444ddd', branch: 'stale' }
    ])
  })

  it('returns [] for empty output', () => {
    expect(parseWorktreeList('')).toEqual([])
  })
})

describe('slugify', () => {
  it('normalizes names', () => {
    expect(slugify('Fix Login!')).toBe('fix-login')
    expect(slugify('  ---  ')).toBe('workspace')
  })
})

describe('branchOffInstruction', () => {
  it('builds an English instruction for agent panes', () => {
    expect(branchOffInstruction('claude', 'fix-login', 'main')).toBe(
      'Create a git worktree at .worktrees/fix-login with a new branch fix-login based on main, then cd into it and do all further work in that worktree.'
    )
  })

  it('omits the base clause when base is null', () => {
    expect(branchOffInstruction('codex', 'fix-login', null)).toBe(
      'Create a git worktree at .worktrees/fix-login with a new branch fix-login, then cd into it and do all further work in that worktree.'
    )
  })

  it('builds a literal command for shell panes', () => {
    expect(branchOffInstruction('shell', 'fix-login', 'main')).toBe(
      'git worktree add .worktrees/fix-login -b fix-login main && cd .worktrees/fix-login'
    )
    expect(branchOffInstruction('shell', 'fix-login', null)).toBe(
      'git worktree add .worktrees/fix-login -b fix-login && cd .worktrees/fix-login'
    )
  })
})

describe('stripDeadWorkspaceFields', () => {
  it('removes useWorktrees and repos, keeps everything else', () => {
    expect(
      stripDeadWorkspaceFields({
        id: 'x',
        useWorktrees: true,
        repos: [{ dir: 'a', baseBranch: null }],
        baseBranch: 'main'
      })
    ).toEqual({ id: 'x', baseBranch: 'main' })
  })
})
