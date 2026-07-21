# Dynamic Worktrees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace eager detached-worktree-per-pane isolation with plain sessions plus agent-created branch worktrees on demand, with `git worktree list` as the single source of truth and diff bases pinned at workspace creation.

**Architecture:** All panes spawn in the workspace folder. Isolation happens when the user (directly or via a "Branch off…" affordance that types an instruction into the pane's pty) asks the agent to create a real-branch worktree. The main process only *reads* git state (`git worktree list --porcelain`, live pane cwd via `lsof`) and performs explicit user-triggered cleanup. Multi-repo mirror mode is deleted entirely.

**Tech Stack:** Electron (main + utilityProcess pty host + React renderer), TypeScript, node-pty, zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-dynamic-worktrees-design.md`

## Global Constraints

- The app NEVER runs a git write for isolation (no `git worktree add`, no `git init`, no branch creation). Allowed git mutations: `git worktree prune` at launch, `.git/info/exclude` maintenance, and user-triggered cleanup (`git worktree remove`, `git branch -d` — safe delete only, never `-D`).
- Diff base = `config.baseBranch`, resolved once at workspace creation (`origin/HEAD` → current branch → null), never re-inferred at query time. Committed diffs always use three-dot `base...HEAD`.
- On-demand worktrees live at `.worktrees/<name>` on branch `<name>` (created by the agent, never detached).
- Multi-repo mode (`repos`, `RepoChoice`, `.agents` mirrors, `scanGit`/`GitScan`/`RepoInfo`) is removed entirely.
- Test runner: `npm test` (vitest). Typecheck: `npm run typecheck`. Run both before every commit in tasks that touch TypeScript.
- macOS only (`lsof` is available; the pty host already shells out to `ps`).

---

### Task 1: Shared worktree helpers (pure, TDD)

**Files:**
- Create: `src/shared/worktrees.ts`
- Test: `src/shared/__tests__/worktrees.test.ts`

**Interfaces:**
- Consumes: `AgentKind` from `src/shared/types.ts`.
- Produces (later tasks import these exact names from `@shared/worktrees` / `../shared/worktrees`):
  - `WORKTREES_DIR = '.worktrees'`
  - `interface WorktreeEntry { path: string; head: string | null; branch: string | null }` (branch is the short name; `null` = detached)
  - `parseWorktreeList(output: string): WorktreeEntry[]`
  - `slugify(name: string): string` (moved copy of the one in `worktreePlan.ts`)
  - `branchOffInstruction(kind: AgentKind, name: string, base: string | null): string`
  - `stripDeadWorkspaceFields(raw: Record<string, unknown>): Record<string, unknown>`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/__tests__/worktrees.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../worktrees'` (the old `worktreePlan.test.ts` still passes).

- [ ] **Step 3: Write the implementation**

Create `src/shared/worktrees.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/shared/worktrees.ts src/shared/__tests__/worktrees.test.ts
git commit -m "feat: shared worktree helpers (porcelain parser, branch-off instruction)"
```

---

### Task 2: Git read helpers in main

**Files:**
- Modify: `src/main/git.ts`

**Interfaces:**
- Consumes: `parseWorktreeList`, `WorktreeEntry` from `../shared/worktrees`; existing `git`/`tryGit` helpers in the same file.
- Produces (exported from `src/main/git.ts`):
  - `listWorktrees(repoPath: string): Promise<WorktreeEntry[]>`
  - `resolveDefaultBranch(repoPath: string): Promise<string | null>`
  - `branchExists(repoPath: string, branch: string): Promise<boolean>`
  - `isMerged(repoPath: string, ref: string, base: string): Promise<boolean>`
  - `deleteBranchSafe(repoPath: string, branch: string): Promise<void>`

- [ ] **Step 1: Add the helpers**

In `src/main/git.ts`, add after `pruneWorktrees` (around line 121):

```ts
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
  const ref = await tryGit(repoPath, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)
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
```

Add the import at the top of the file:

```ts
import { parseWorktreeList, type WorktreeEntry } from '../shared/worktrees'
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: clean.
Run: `npm test` — Expected: PASS.

```bash
git add src/main/git.ts
git commit -m "feat: git read helpers — listWorktrees, resolveDefaultBranch, isMerged"
```

---

### Task 3: Live pane cwd tracking

**Files:**
- Modify: `src/shared/types.ts` (HostEventMessage, PaneRuntime)
- Modify: `src/ptyHost/index.ts` (lsof poll)
- Modify: `src/main/ptyHostManager.ts` (relay event)
- Modify: `src/main/workspaces.ts` (update runtime + resolve branch)
- Modify: `src/renderer/src/components/TerminalPane.tsx` (label)

**Interfaces:**
- Consumes: `listWorktrees` (Task 2), `getGitInfo` (existing).
- Produces: `PaneRuntime.liveCwd?: string`; host event `{ type: 'cwd'; ptyId: string; cwd: string }`; `PtyHostManager` emits `'pty-cwd' (ptyId, cwd)`. `PaneRuntime.branch` now stays live as agents cd around.

- [ ] **Step 1: Extend the shared types**

In `src/shared/types.ts`, change `HostEventMessage` (line 183) to:

```ts
/** Pty host → main */
export type HostEventMessage =
  | { type: 'exited'; ptyId: string; exitCode: number }
  | { type: 'cwd'; ptyId: string; cwd: string }
```

In `PaneRuntime` (line 43), add below `cwd`:

```ts
  /** Where the pane's shell actually is now (agents cd into worktrees). */
  liveCwd?: string
```

- [ ] **Step 2: Poll cwd in the pty host**

In `src/ptyHost/index.ts`:

Add `lastCwd: string | null` to the `Session` interface and `lastCwd: null` to the session literal in `spawn()`.

Inside the existing 2500ms `setInterval` loop body (after the tty-based `ps` scan, still inside `for (const [ptyId, session] of sessions)`), add:

```ts
    execFile(
      'lsof',
      ['-a', '-p', String(session.pty.pid), '-d', 'cwd', '-Fn'],
      (error, stdout) => {
        if (error || !sessions.has(ptyId)) return
        const line = stdout.split('\n').find((l) => l.startsWith('n'))
        const cwd = line?.slice(1)
        if (cwd && cwd !== session.lastCwd) {
          session.lastCwd = cwd
          parentPort.postMessage({ type: 'cwd', ptyId, cwd })
        }
      }
    )
```

Note: this tracks the top shell's cwd. It is `null`-safe on failure (falls back to spawn cwd downstream, per spec §7).

- [ ] **Step 3: Relay in PtyHostManager**

In `src/main/ptyHostManager.ts`, replace the `host.on('message', …)` body (line 26-28) with:

```ts
    host.on('message', (msg: HostEventMessage) => {
      if (msg.type === 'exited') this.emit('pty-exited', msg.ptyId, msg.exitCode)
      else if (msg.type === 'cwd') this.emit('pty-cwd', msg.ptyId, msg.cwd)
    })
```

Update the class doc comment to list `'pty-cwd' (ptyId, cwd)`.

- [ ] **Step 4: Update runtime in Workspaces**

In `src/main/workspaces.ts` constructor (after the `pty-exited` handler), add:

```ts
    ptyHost.on('pty-cwd', (ptyId: string, cwd: string) => {
      void this.updatePaneCwd(ptyId, cwd)
    })
```

Add these private methods (near `findPaneByPtyId`):

```ts
  /** A pane's shell moved — record it and re-resolve the branch it is on. */
  private async updatePaneCwd(ptyId: string, cwd: string): Promise<void> {
    for (const [workspaceId, panes] of this.runtime) {
      for (const pane of panes.values()) {
        if (pane.ptyId !== ptyId) continue
        if (pane.liveCwd === cwd) return
        pane.liveCwd = cwd
        const config = this.store.getWorkspace(workspaceId)
        if (config) pane.branch = await this.branchForCwd(config.path, cwd)
        this.notify()
        return
      }
    }
  }

  /** Branch shown for a cwd: matching worktree's branch, else the cwd's own branch. */
  private async branchForCwd(root: string, cwd: string): Promise<string | null> {
    const worktrees = await listWorktrees(root)
    const match = worktrees
      .filter((w) => cwd === w.path || cwd.startsWith(w.path + '/'))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (match) return match.branch ?? 'detached'
    return (await getGitInfo(cwd)).branch
  }
```

Add `listWorktrees` to the import from `./git`.

- [ ] **Step 5: Show it in the pane header**

In `src/renderer/src/components/TerminalPane.tsx`, replace line 157:

```ts
  const branchLabel = runtime.branch ?? runtime.cwd.split('/').pop() ?? ''
```

with:

```ts
  const paneCwd = runtime.liveCwd ?? runtime.cwd
  const branchLabel = runtime.branch ?? paneCwd.split('/').pop() ?? ''
```

and add a tooltip on the branch span (line 188):

```tsx
        <span className="pane-branch" title={paneCwd}>
          {branchLabel}
        </span>
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck` — Expected: clean.
Run: `npm test` — Expected: PASS.
Manual check: `npm run dev`, open a workspace, `cd /tmp` in a shell pane → within ~3s the header tooltip shows `/tmp`.

```bash
git add src/shared/types.ts src/ptyHost/index.ts src/main/ptyHostManager.ts src/main/workspaces.ts src/renderer/src/components/TerminalPane.tsx
git commit -m "feat: live pane cwd + branch tracking via pty host"
```

---

### Task 4: Sessions-first main process (remove eager provisioning)

**Files:**
- Modify: `src/main/workspaces.ts` (launch, spawnPane, addPane, gitChanges, dirtyWorktrees, close, createAndLaunch, restartPane, respawnAllRunning)
- Modify: `src/main/store.ts` (strip dead fields on load)
- Modify: `src/main/memory.ts` (drop multi-repo scope branch)
- Modify: `src/shared/types.ts` (make `useWorktrees` optional so the renderer still compiles until Tasks 6-8)

**Interfaces:**
- Consumes: `listWorktrees`, `resolveDefaultBranch`, `branchExists`, `removeWorktree`, `pruneWorktrees`, `ensureExcluded`, `getGitInfo`, `isDirty` from `./git`; `WORKTREES_DIR`, `stripDeadWorkspaceFields` from `../shared/worktrees`.
- Produces: `launch()` that never creates worktrees; `gitChanges()` grouped by discovered checkout with pinned base; `dirtyWorktrees()` discovery-based (Task 6 replaces its API); `close(id, { removeWorktrees: boolean })` interim behavior = remove ALL discovered worktrees under the workspace folder (Task 6 makes it per-worktree).

- [ ] **Step 1: Make removed config fields optional**

In `src/shared/types.ts` `WorkspaceConfig`, change `useWorktrees: boolean` to `useWorktrees?: boolean` (the `repos?: RepoChoice[]` line is already optional). Both are deleted for good in Task 8; this keeps old renderer code compiling meanwhile.

- [ ] **Step 2: Strip dead fields when the store loads**

In `src/main/store.ts` `load()`, replace the `workspaces:` line with:

```ts
        workspaces: (Array.isArray(raw.workspaces) ? raw.workspaces : []).map(
          (w: Record<string, unknown>) => stripDeadWorkspaceFields(w) as unknown as WorkspaceConfig
        ),
```

Import: `import { stripDeadWorkspaceFields } from '../shared/worktrees'`.

- [ ] **Step 3: Rewrite launch/spawn in workspaces.ts**

In `src/main/workspaces.ts`:

Replace the imports from `../shared/worktreePlan` and `./git` with:

```ts
import { WORKTREES_DIR } from '../shared/worktrees'
import {
  branchChangedFiles,
  branchExists,
  changedFiles,
  ensureExcluded,
  fileDiff,
  fileDiffRange,
  getGitInfo,
  isDirty,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
  resolveDefaultBranch
} from './git'
```

Remove the `callsign` import and the `MIRROR_AGENTS_MD` import (keep the other memory imports). Remove `symlinkSync`, `readFileSync`, `writeFileSync`, `mkdirSync` from the `fs` import if now unused (keep `existsSync`, `readdirSync`, `rmSync`).

In `WorkspaceDraft`, delete the `useWorktrees` and `repos` lines.

In `createAndLaunch()`, replace the `config` literal's `useWorktrees: draft.useWorktrees,` / `baseBranch: draft.baseBranch,` / `repos: draft.repos,` lines with:

```ts
      baseBranch:
        draft.baseBranch || (await resolveDefaultBranch(draft.path)),
```

Replace the whole body of `launch()` between the `existsSync` guard and the `const panes = new Map…` line (currently the memory block + worktree provisioning, lines ~161-214) with:

```ts
    const resume = config.hasRun

    // Project memory: resolve scopes and prepare the MCP wiring for agents.
    if (this.store.data.settings.memoryEnabled !== false) {
      try {
        const scopes = await resolveWorkspaceMemory(config)
        this.memory.set(id, { scopes, args: memoryLaunchArgs(id, scopes) })
      } catch {
        this.memory.delete(id)
      }
    } else {
      this.memory.delete(id)
    }

    const info = await getGitInfo(config.path)
    if (info.isRepo) {
      ensureExcluded(config.path, `${WORKTREES_DIR}/`)
      await pruneWorktrees(config.path)
    }
    const mainBranch = info.branch
```

Then the spawn loop becomes (placements are gone):

```ts
    const panes = new Map<string, PaneRuntime>()
    this.runtime.set(id, panes)
    for (const pane of config.panes) {
      this.spawnPane(config, pane, resume, mainBranch, panes)
    }
```

Delete `createAgentMirror()` entirely.

Change `spawnPane` signature to drop the placement:

```ts
  private spawnPane(
    config: WorkspaceConfig,
    pane: { id: string; kind: AgentKind },
    resume: boolean,
    mainBranch: string | null,
    panes: Map<string, PaneRuntime>
  ): void {
    const cwd = config.path
```

(the rest of the body is unchanged except the final runtime literal, which becomes)

```ts
    panes.set(pane.id, {
      paneId: pane.id,
      ptyId,
      cwd,
      liveCwd: cwd,
      branch: mainBranch,
      status: 'running'
    })
```

Simplify `respawnAllRunning()` and `restartPane()` — no placements:

```ts
  private respawnAllRunning(): void {
    for (const [workspaceId, panes] of this.runtime) {
      const config = this.store.getWorkspace(workspaceId)
      if (!config) continue
      for (const pane of config.panes) {
        const existing = panes.get(pane.id)
        if (existing?.status !== 'running') continue
        this.spawnPane(config, pane, true, existing.branch, panes)
      }
    }
    this.notify()
  }
```

```ts
  restartPane(id: string, paneId: string): void {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    const runtime = panes?.get(paneId)
    if (!config || !panes || !runtime || runtime.status === 'running') return
    const pane = config.panes.find((p) => p.id === paneId)
    if (!pane) return
    this.spawnPane(config, pane, true, runtime.branch, panes)
    this.notify()
  }
```

Simplify `addPane()`:

```ts
  async addPane(id: string, kind: AgentKind): Promise<void> {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    if (!config || !panes) throw new Error('Workspace is not running')

    const pane = { id: randomUUID(), kind }
    config.panes.push(pane)
    const info = await getGitInfo(config.path)
    this.spawnPane(config, pane, false, info.branch, panes)
    this.store.upsertWorkspace(config)
    this.notify()
  }
```

- [ ] **Step 4: Rewrite discovery-based gitChanges / dirtyWorktrees / close**

Add a private helper:

```ts
  /** Linked worktrees that live under the workspace folder (never the main checkout). */
  private async workspaceWorktrees(
    config: WorkspaceConfig
  ): Promise<{ dir: string; path: string; branch: string | null; head: string | null }[]> {
    const root = resolve(config.path)
    return (await listWorktrees(config.path))
      .filter((w) => resolve(w.path) !== root && resolve(w.path).startsWith(root + '/'))
      .map((w) => ({
        dir: relative(root, resolve(w.path)),
        path: w.path,
        branch: w.branch,
        head: w.head
      }))
  }
```

(add `relative` to the `path` import.)

Replace `gitChanges()` entirely:

```ts
  /**
   * Changes grouped by checkout: the main checkout, embedded child repos, and
   * every worktree discovered under the workspace folder. Committed changes in
   * worktrees are measured against the pinned baseBranch (three-dot, so the
   * range survives base moving forward). A missing base degrades to
   * status-only changes rather than a wrong range.
   */
  async gitChanges(id: string): Promise<ChangeGroup[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const rootInfo = await getGitInfo(config.path)
    const jobs: Promise<ChangeGroup | null>[] = []
    const job = (
      dir: string,
      label: string,
      branch: string | null,
      base: string | null,
      abs: string
    ): void => {
      jobs.push(
        this.checkoutChanges(abs, base).then((changes) =>
          changes.length > 0 ? { dir, label, branch, base, changes } : null
        )
      )
    }

    const embeddedDirs: string[] = []
    if (rootInfo.isRepo) {
      try {
        for (const entry of readdirSync(config.path, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (entry.name === WORKTREES_DIR || entry.name === '.agents') continue
          if (existsSync(join(config.path, entry.name, '.git'))) {
            embeddedDirs.push(entry.name)
          }
        }
      } catch {
        // unreadable root
      }
      jobs.push(
        this.checkoutChanges(config.path, null).then((changes) => {
          const cleaned = changes.filter(
            (c) => !embeddedDirs.some((d) => c.path === `${d}/` || c.path === d)
          )
          return cleaned.length > 0
            ? {
                dir: '',
                label: 'main checkout',
                branch: rootInfo.branch,
                base: null,
                changes: cleaned
              }
            : null
        })
      )
      for (const dir of embeddedDirs) {
        const abs = join(config.path, dir)
        jobs.push(
          Promise.all([getGitInfo(abs), this.checkoutChanges(abs, null)]).then(
            ([info, changes]) =>
              changes.length > 0
                ? { dir, label: `${dir} — main`, branch: info.branch, base: null, changes }
                : null
          )
        )
      }

      const baseOk =
        !!config.baseBranch && (await branchExists(config.path, config.baseBranch))
      for (const wt of await this.workspaceWorktrees(config)) {
        const base = baseOk ? config.baseBranch : null
        const label = wt.branch ?? `${wt.dir.split('/').pop()} (detached)`
        const warned = !baseOk && config.baseBranch ? `${label} — base missing` : label
        job(wt.dir, warned, wt.branch ?? 'detached', base, wt.path)
      }
    }
    return (await Promise.all(jobs)).filter((g): g is ChangeGroup => g !== null)
  }
```

Replace `dirtyWorktrees()`:

```ts
  async dirtyWorktrees(id: string): Promise<string[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const dirty: string[] = []
    for (const wt of await this.workspaceWorktrees(config)) {
      if (await isDirty(wt.path)) dirty.push(wt.dir)
    }
    return dirty
  }
```

Replace `close()` (interim: boolean still removes everything discovered; Task 6 makes it per-worktree):

```ts
  async close(id: string, options: { removeWorktrees: boolean }): Promise<void> {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    if (panes) {
      for (const pane of panes.values()) {
        if (pane.status === 'running') this.ptyHost.send({ type: 'kill', ptyId: pane.ptyId })
      }
      this.runtime.delete(id)
    }
    if (config) {
      if (options.removeWorktrees) {
        for (const wt of await this.workspaceWorktrees(config)) {
          await removeWorktree(config.path, wt.dir).catch(() => {})
        }
        await pruneWorktrees(config.path)
      }
      config.wasRunning = false
      this.store.upsertWorkspace(config)
    }
    this.notify()
  }
```

Delete the now-unused `checkoutChanges` multi-repo caller paths — `checkoutChanges` itself stays (used above). Remove the `rmSync` import if now unused.

- [ ] **Step 5: Drop the multi-repo branch from memory.ts**

In `src/main/memory.ts` `resolveWorkspaceMemory()`, delete the whole `if ((config.repos?.length ?? 0) > 0) { … }` block (lines 101-119). Delete the `MIRROR_AGENTS_MD` export (lines 192-205). Remove imports that become unused (`GroupMeta` writing stays — `matchingGroups` is still used for the single-repo path).

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck` — Expected: clean (renderer still compiles: `useWorktrees` is optional; `worktreePlan.ts` still exists for its old test until Task 8).
Run: `npm test` — Expected: PASS.
Manual check: `npm run dev` → new workspace with 2 claude panes → both panes' tooltips show the workspace folder itself; no `.worktrees/` is created.

```bash
git add src/main/workspaces.ts src/main/store.ts src/main/memory.ts src/shared/types.ts
git commit -m "feat: sessions-first launch — no eager worktrees, discovery-based git views"
```

---

### Task 5: "Branch off…" affordance

**Files:**
- Modify: `src/renderer/src/components/TerminalPane.tsx`

**Interfaces:**
- Consumes: `branchOffInstruction`, `slugify` from `@shared/worktrees`; `ptyBridge.write(ptyId, data)` (existing); `window.vibe.gitInfo(path)` (existing); workspace `config.path` / `config.baseBranch` from the zustand snapshot.
- Produces: a pane-header button that types the instruction into the pane. No new IPC.

- [ ] **Step 1: Add state + handler to TerminalPane**

In `src/renderer/src/components/TerminalPane.tsx` add imports:

```ts
import { useState } from 'react'
import { branchOffInstruction, slugify } from '@shared/worktrees'
```

(merge `useState` into the existing react import.)

Inside the component add:

```ts
  const [branchOffOpen, setBranchOffOpen] = useState(false)
  const [branchName, setBranchName] = useState('')
  const workspace = useApp((s) =>
    s.snapshot.find((w) => w.config.id === workspaceId)
  )

  const openBranchOff = async (): Promise<void> => {
    const path = workspace?.config.path
    if (!path) return
    const info = await window.vibe.gitInfo(path)
    if (!info.isRepo || !info.hasCommits) {
      toast('Branch off needs a git repo with at least one commit.')
      return
    }
    setBranchName('')
    setBranchOffOpen(true)
  }

  const submitBranchOff = (): void => {
    const name = slugify(branchName)
    if (!name || name === 'workspace') return
    const instruction = branchOffInstruction(
      pane.kind,
      name,
      workspace?.config.baseBranch ?? null
    )
    ptyBridge.write(runtime.ptyId, instruction)
    // Send Enter separately so agent TUIs treat the text as one pasted line.
    window.setTimeout(() => ptyBridge.write(runtime.ptyId, '\r'), 80)
    setBranchOffOpen(false)
    termRef.current?.focus()
  }
```

- [ ] **Step 2: Add the button and popover to the header JSX**

In the header, before the maximize button, add:

```tsx
        <button
          className="pane-button"
          title="Branch off — isolate this pane's work in a new worktree"
          onClick={() => void openBranchOff()}
        >
          ⑂
        </button>
```

Directly after `</header>`, add:

```tsx
      {branchOffOpen && (
        <div className="pane-branchoff">
          <input
            autoFocus
            className="text-input"
            placeholder="task name, e.g. fix-login"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitBranchOff()
              if (e.key === 'Escape') setBranchOffOpen(false)
            }}
          />
          <span className="dim">
            → {slugify(branchName) !== 'workspace' ? slugify(branchName) : '…'}
            {workspace?.config.baseBranch ? ` from ${workspace.config.baseBranch}` : ''}
          </span>
        </div>
      )}
```

- [ ] **Step 3: Style the popover**

In `src/renderer/src/styles.css`, add (match existing pane styling conventions):

```css
.pane-branchoff {
  position: absolute;
  top: 34px;
  right: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: var(--surface, rgba(20, 24, 28, 0.95));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}
```

(If `.pane` is not `position: relative` yet, add `position: relative` to it.)

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` — Expected: clean.
Manual check: `npm run dev` → shell pane → ⑂ → type `Fix Login` → Enter → the pane runs `git worktree add .worktrees/fix-login -b fix-login <base> && cd .worktrees/fix-login`; within ~3s the pane header shows `fix-login`. In a claude pane the English instruction lands in the composer and submits.

```bash
git add src/renderer/src/components/TerminalPane.tsx src/renderer/src/styles.css
git commit -m "feat: branch-off affordance — types worktree instruction into the pane"
```

---

### Task 6: Per-worktree cleanup dialogs

**Files:**
- Modify: `src/shared/types.ts` (add `WorktreeStatus`)
- Modify: `src/main/workspaces.ts` (`worktreeStatus()`, `close()`/`deleteWorkspace()` take dir lists)
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/shared/api.ts` (IPC signatures)
- Modify: `src/renderer/src/store.ts`, `src/renderer/src/components/Sidebar.tsx`, `CloseDialog.tsx`, `DeleteDialog.tsx`

**Interfaces:**
- Produces:
  - `interface WorktreeStatus { dir: string; branch: string | null; dirty: boolean; merged: boolean }` in `src/shared/types.ts`
  - `Workspaces.worktreeStatus(id: string): Promise<WorktreeStatus[]>`
  - `Workspaces.close(id, { remove: string[] })`, `Workspaces.deleteWorkspace(id, remove: string[])`
  - `VibeApi.worktreeStatus(id)`, `closeWorkspace(id, remove: string[])`, `deleteWorkspace(id, remove: string[])` — replaces `dirtyWorktrees` and the boolean flags.
  - Renderer store: `closing`/`deleting` become `{ workspaceId: string; worktrees: WorktreeStatus[] } | null`.

- [ ] **Step 1: Add the type and main-process methods**

`src/shared/types.ts`, after `ChangeGroup`:

```ts
/** One discovered worktree under the workspace folder, for the cleanup dialogs. */
export interface WorktreeStatus {
  dir: string
  branch: string | null
  dirty: boolean
  merged: boolean
}
```

`src/main/workspaces.ts` — replace `dirtyWorktrees()` with:

```ts
  async worktreeStatus(id: string): Promise<WorktreeStatus[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const base = config.baseBranch
    const result: WorktreeStatus[] = []
    for (const wt of await this.workspaceWorktrees(config)) {
      const ref = wt.branch ?? wt.head
      result.push({
        dir: wt.dir,
        branch: wt.branch,
        dirty: await isDirty(wt.path),
        merged: !!(ref && base) && (await isMerged(config.path, ref, base))
      })
    }
    return result
  }
```

Change `close()`'s options to `{ remove: string[] }`. At the top of the method (before panes are killed) add:

```ts
    const statuses = options.remove.length > 0 ? await this.worktreeStatus(id) : []
```

and replace the removal block with:

```ts
      for (const dir of options.remove) {
        const status = statuses.find((w) => w.dir === dir)
        await removeWorktree(config.path, dir).catch(() => {})
        if (status?.branch && status.merged) {
          await deleteBranchSafe(config.path, status.branch)
        }
      }
      if (options.remove.length > 0) await pruneWorktrees(config.path)
```

Add `WorktreeStatus` to the type imports from `'../shared/types'` in this file.

Change `deleteWorkspace(id, remove: string[])` and `setYolo`'s internal call to `this.close(id, { remove: [] })`. Import `deleteBranchSafe`, `isMerged` from `./git`.

- [ ] **Step 2: Rewire IPC**

`src/main/index.ts`:

```ts
  ipcMain.handle('ws:close', (_e, id: string, remove: string[]) =>
    workspaces.close(id, { remove })
  )
  ipcMain.handle('ws:delete', (_e, id: string, remove: string[]) =>
    workspaces.deleteWorkspace(id, remove)
  )
  ipcMain.handle('ws:worktree-status', (_e, id: string) => workspaces.worktreeStatus(id))
```

Delete the `ws:dirty-worktrees` handler.

`src/shared/api.ts` — replace `dirtyWorktrees` and the two signatures:

```ts
  closeWorkspace: (id: string, remove: string[]) => Promise<void>
  deleteWorkspace: (id: string, remove: string[]) => Promise<void>
  worktreeStatus: (id: string) => Promise<WorktreeStatus[]>
```

(import `WorktreeStatus` from `./types`.)

`src/preload/index.ts` — mirror:

```ts
  closeWorkspace: (id, remove) => ipcRenderer.invoke('ws:close', id, remove),
  deleteWorkspace: (id, remove) => ipcRenderer.invoke('ws:delete', id, remove),
  worktreeStatus: (id) => ipcRenderer.invoke('ws:worktree-status', id),
```

- [ ] **Step 3: Update renderer store and Sidebar**

`src/renderer/src/store.ts` — change both fields and setters:

```ts
  closing: { workspaceId: string; worktrees: WorktreeStatus[] } | null
  deleting: { workspaceId: string; worktrees: WorktreeStatus[] } | null
```

(import `WorktreeStatus` from `@shared/types`; setters' types follow.)

`src/renderer/src/components/Sidebar.tsx` — the two call sites (lines ~127 and ~133) become:

```ts
    const worktrees = await window.vibe.worktreeStatus(id)
    setClosing({ workspaceId: id, worktrees })
```

(and `setDeleting({ workspaceId: id, worktrees })` respectively). If the previous code skipped the dialog when nothing was dirty, keep that behavior but key it on `worktrees.length === 0` → call `closeWorkspace(id, [])` / `deleteWorkspace(id, [])` directly.

- [ ] **Step 4: Rebuild both dialogs around checkboxes**

`src/renderer/src/components/CloseDialog.tsx` — full replacement:

```tsx
import { useState } from 'react'
import { useApp } from '../store'

export default function CloseDialog(): JSX.Element {
  const closing = useApp((s) => s.closing)!
  const setClosing = useApp((s) => s.setClosing)
  const snapshot = useApp((s) => s.snapshot)
  const toast = useApp((s) => s.toast)
  const workspace = snapshot.find((w) => w.config.id === closing.workspaceId)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(closing.worktrees.filter((w) => !w.dirty && w.merged).map((w) => w.dir))
  )

  const toggle = (dir: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  const close = async (remove: string[]): Promise<void> => {
    setClosing(null)
    try {
      await window.vibe.closeWorkspace(closing.workspaceId, remove)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setClosing(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Stop “{workspace?.config.name ?? 'workspace'}”</h2>
        <p className="dim">All agent processes in this workspace will be terminated.</p>

        {closing.worktrees.length > 0 && (
          <div className="worktree-list">
            <p className="dim">Worktrees in this workspace — check to remove:</p>
            {closing.worktrees.map((w) => (
              <label className="check-row" key={w.dir}>
                <input
                  type="checkbox"
                  checked={selected.has(w.dir)}
                  onChange={() => toggle(w.dir)}
                />
                <code>{w.dir}</code>
                <span className="dim">
                  {w.branch ?? 'detached'}
                  {w.merged ? ' · merged' : ' · not merged'}
                  {w.dirty ? ' · UNCOMMITTED CHANGES' : ''}
                </span>
              </label>
            ))}
            {closing.worktrees.some((w) => w.dirty && selected.has(w.dir)) && (
              <div className="warn-box">
                Removing a worktree with uncommitted changes discards them. Commits stay
                recoverable in git.
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="mini-button" onClick={() => setClosing(null)}>
            Cancel
          </button>
          <button className="mini-button" onClick={() => void close([])}>
            Stop only
          </button>
          {selected.size > 0 && (
            <button
              className="primary-button danger"
              onClick={() => void close([...selected])}
            >
              Stop + remove {selected.size} worktree{selected.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

`src/renderer/src/components/DeleteDialog.tsx` — same structure with `deleting`, `setDeleting`, `window.vibe.deleteWorkspace`, heading `Delete “…”`, body copy "Running agents are terminated and the workspace is removed from the list. The project folder itself is never touched.", and buttons `Delete only` / `Delete + remove N worktrees`.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck` — Expected: clean.
Run: `npm test` — Expected: PASS.
Manual check: create a worktree via ⑂ in a shell pane, commit nothing, stop the workspace → dialog lists `.worktrees/<name>` unchecked (not merged); check it → worktree removed, branch kept (unmerged).

```bash
git add src/shared/types.ts src/shared/api.ts src/preload/index.ts src/main/index.ts src/main/workspaces.ts src/renderer/src/store.ts src/renderer/src/components/Sidebar.tsx src/renderer/src/components/CloseDialog.tsx src/renderer/src/components/DeleteDialog.tsx
git commit -m "feat: per-worktree cleanup with dirty/merged badges in close and delete dialogs"
```

---

### Task 7: Launcher and copy simplification

**Files:**
- Modify: `src/renderer/src/components/LauncherModal.tsx`
- Modify: `src/renderer/src/components/PreviewGrid.tsx`
- Modify: `src/renderer/src/components/Onboarding.tsx`
- Modify: `src/shared/api.ts` (`WorkspaceDraftDto`)

**Interfaces:**
- Consumes: `window.vibe.gitInfo` (existing; replaces `gitScan` usage).
- Produces: launcher without the worktree toggle / multi-repo UI; `WorkspaceDraftDto` without `useWorktrees`/`repos`.

- [ ] **Step 1: Simplify LauncherModal**

In `src/renderer/src/components/LauncherModal.tsx`:

- Replace `GitScan` state with `GitInfo`: `const [scan, setScan] = useState<GitInfo | null>(null)` fed by `window.vibe.gitInfo(expanded)`; delete `multi`, `repoBranches`, `useWorktrees` state and every branch of JSX referencing them (the multi banner, the mirror checkbox label, the per-repo branch selects, the `!useWorktrees` hint).
- Step 2 ("Isolation") becomes "Branches" — its entire body is just the base-branch select, now always visible for repos:

```tsx
            {step === 2 && (
              <>
                {scan?.isRepo && scan.branches.length > 0 ? (
                  <div className="field-row">
                    <label className="field-label inline">diff base branch</label>
                    <select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)}>
                      <option value="">
                        auto ({scan.branch ?? 'default'})
                      </option>
                      {scan.branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="git-line dim">
                    Not a git repo — agents share the folder directly.
                  </div>
                )}
                <div className="git-line dim">
                  Agents work in your checkout. When two tasks overlap, hit ⑂ on a pane
                  (or just ask the agent) to branch off into an isolated worktree.
                </div>
              </>
            )}
```

- STEPS copy: step 0 tips lose the `git init` / mirrors lines (`'Git is detected automatically — repo or plain folder.'`); step 2 becomes `{ label: 'Branches', icon: 'branch', desc: 'Which branch diffs and reviews compare against.', illo: <IlloBranches />, tips: ['Everything runs in your real checkout until you say otherwise.', 'Branch off any pane into .worktrees/<task> when work needs isolation.', 'Diffs always compare against the base branch you pick here.'] }`; step 3 YOLO copy drops "worktree isolation is your safety net." → "Fast, unsupervised — keep an eye on the diff view."
- `isolationLabel` becomes:

```ts
  const isolationLabel = scan?.isRepo
    ? 'shared checkout · branch off on demand'
    : 'shared folder (not a repo)'
```

- The `createWorkspace` call drops `useWorktrees` and `repos`; the folder status banner's "not a git repo — git init runs on launch" becomes "not a git repo — agents share the folder without branch isolation"; `<PreviewGrid …>` loses `useWorktrees={useWorktrees}`.

- [ ] **Step 2: PreviewGrid, Onboarding, DTO**

- `src/renderer/src/components/PreviewGrid.tsx`: remove the `useWorktrees` prop and the `'worktree'` badge branch (line ~52) — every non-first cell now renders like the first (no placement badge).
- `src/renderer/src/components/Onboarding.tsx` line 29 body becomes: `'All agents start in your checkout. Branch any pane off into its own worktree (⑂, or just ask the agent) when parallel tasks would collide.'`
- `src/shared/api.ts`: delete `useWorktrees` and `repos` from `WorkspaceDraftDto` and the `RepoChoice` import.

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` — Expected: clean.
Manual check: launcher shows Folder → Layout → Branches → Launch; a repo folder offers the diff-base select; launch creates panes with no worktrees.

```bash
git add src/renderer/src/components/LauncherModal.tsx src/renderer/src/components/PreviewGrid.tsx src/renderer/src/components/Onboarding.tsx src/shared/api.ts
git commit -m "feat: launcher without eager isolation — diff-base step replaces worktree toggle"
```

---

### Task 8: Delete dead code and finish

**Files:**
- Delete: `src/shared/worktreePlan.ts`, `src/shared/__tests__/worktreePlan.test.ts`
- Modify: `src/shared/types.ts` (remove `useWorktrees`, `repos`, `RepoChoice`, `GitScan`, `RepoInfo`)
- Modify: `src/main/git.ts` (remove `scanGit`, `ensureRepo`, `addWorktree`)
- Modify: `src/main/index.ts` (remove `git:scan` handler + `scanGit` import)
- Modify: `src/shared/api.ts`, `src/preload/index.ts` (remove `gitScan`)

**Interfaces:**
- Consumes: everything migrated in Tasks 1-7.
- Produces: a tree with zero references to the old model. `grep -rn "useWorktrees\|planPlacements\|RepoChoice\|scanGit\|addWorktree\|MIRROR_AGENTS_MD\|createAgentMirror" src/` must return nothing.

- [ ] **Step 1: Delete files and dead exports**

```bash
git rm src/shared/worktreePlan.ts src/shared/__tests__/worktreePlan.test.ts
```

- `src/shared/types.ts`: delete the `RepoChoice` interface, the `useWorktrees?: boolean` and `repos?: RepoChoice[]` lines in `WorkspaceConfig`, and the `RepoInfo` + `GitScan` interfaces.
- `src/main/git.ts`: delete `scanGit`, `ensureRepo`, `addWorktree` and the now-unused `GitScan`/`RepoInfo` type imports.
- `src/main/index.ts`: delete the `git:scan` handler and `scanGit` import.
- `src/shared/api.ts` + `src/preload/index.ts`: delete `gitScan`.
- Fix any residual imports the typechecker flags (e.g. `AGENTS_DIR` references — the string literal `'.agents'` skips in `FilesView.tsx` and `gitChanges` stay as literals).

- [ ] **Step 2: Sweep for stragglers**

Run: `grep -rn "useWorktrees\|planPlacements\|RepoChoice\|scanGit\|addWorktree\|MIRROR_AGENTS_MD\|createAgentMirror\|\.agents/" src/ --include="*.ts" --include="*.tsx" | grep -v "'.agents'"`
Expected: no output (the two `'.agents'` directory-skip literals are the only allowed survivors).

- [ ] **Step 3: Full verification**

Run: `npm run typecheck` — Expected: clean.
Run: `npm test` — Expected: PASS (worktrees tests only).
Manual smoke (`npm run dev`): launch a 2-pane workspace in a repo → ⑂ one pane into `fix-x` → make a commit there → diff view shows a `fix-x` group with the committed file vs base → switch branches in the main checkout in the other pane → the `fix-x` group's range does NOT change → stop workspace, remove the worktree, merged branch offer appears only if merged.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove eager worktree and multi-repo machinery"
```
