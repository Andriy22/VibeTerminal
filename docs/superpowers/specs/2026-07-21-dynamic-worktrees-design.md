# Dynamic worktrees: sessions first, isolation on demand

**Date:** 2026-07-21
**Status:** Approved (design), pending implementation plan

## Problem

The current isolation model eagerly provisions a **detached** git worktree per agent
pane at workspace launch (`git worktree add --detach`, `src/main/git.ts`). This causes
the exact failures observed in practice:

1. **Detached HEAD everywhere.** Agent worktrees have no branch, so
   `git branch --show-current` is empty, agent commits are reachable only via
   reflog, and review tooling has no branch to anchor a diff range to.
2. **Floating diff base.** `gitChanges` re-infers the base as "the branch currently
   checked out in the main checkout" at query time. Switching branches in the main
   checkout silently changes every other pane's diff range — this is what made a
   code review show the wrong range.
3. **Forced isolation.** Isolation is a launch-time, all-or-nothing decision, but the
   actual workflow is dynamic: most work happens directly on the current branch, and
   a separate branch is only needed when a second parallel task starts.

Competitor products confirm the simpler model: panes are just agent sessions in a
folder (task title, live cwd, model/context in the footer); isolation is not imposed
by the app.

## Decisions

- **Panes are plain sessions.** No launch-time worktree provisioning. Every pane
  spawns in the workspace folder on whatever branch is checked out.
- **Isolation is created on demand by the agent, never by the app.** The app may
  *type an instruction* into a pane's terminal, but `git worktree add` is always
  executed by the agent/shell in that pane. The app performs no git writes for
  isolation (the only git mutations left are explicit user-triggered cleanup, and
  the launch-time niceties `worktree prune` + `.git/info/exclude` maintenance).
- **Git is the single source of truth.** Worktrees and their branches are
  *discovered* via `git worktree list --porcelain`, never tracked in app state.
- **Real branches, pinned base.** On-demand worktrees are created with
  `-b <branch>` (never `--detach`). The diff base is the workspace's `baseBranch`,
  resolved once at workspace creation and stored in config — never re-inferred
  from the main checkout's current branch. Diffs use three-dot `base...HEAD`
  (merge-base semantics), so the range stays correct as base advances.
- **Multi-repo mode is removed entirely** (user does not use it): `.agents/`
  mirrors, `repos` / `RepoChoice` config, per-repo diff plumbing, symlink logic,
  `MIRROR_AGENTS_MD`.

## Design

### 1. Launch & pane lifecycle (`src/main/workspaces.ts`)

- `launch()` spawns every pane with `cwd = config.path`. The worktree provisioning
  block, `planPlacements`, and `createAgentMirror` are deleted.
- Launch keeps two read-adjacent niceties when the folder is a repo:
  `pruneWorktrees()` (drops stale registrations) and
  `ensureExcluded('.worktrees/')` (keeps status clean).
- `addPane()` no longer creates worktrees; it just spawns a session in the
  workspace folder.
- Claude resume detection (`hasClaudeConversation`) keys off the spawn cwd as today.

### 2. On-demand isolation ("Branch off…")

- **Primary flow:** the user asks the agent in plain language; nothing app-side.
- **Affordance:** a "Branch off…" action in the pane header menu. The user enters a
  task name; the app slugifies/validates it and types into that pane's pty:
  - Agent panes (claude/codex), plain English:
    `Create a git worktree at .worktrees/<name> with a new branch <name> based on
    <base>, then cd into it and do all further work there.`
  - Shell panes, the literal command:
    `git worktree add .worktrees/<name> -b <name> <base> && cd .worktrees/<name>`
- `<base>` is the workspace `baseBranch` (see §4). The affordance is disabled with
  a hint when the folder is not a repo or has no commits.

### 3. Discovery & live pane state

- New `listWorktrees(repoPath)` in `src/main/git.ts` parses
  `git worktree list --porcelain` → `{ path, head, branch | null (detached) }[]`.
- The pty host reports each pane's **live cwd** (cwd of the shell process, via
  `lsof` on macOS), refreshed on a slow interval while running and on demand when
  the Files/diff view opens. `PaneRuntime` gains `liveCwd`; the pane footer shows
  `dir · branch`, where branch comes from matching `liveCwd` against the discovered
  worktree list (or the main checkout's current branch).
- The static `PanePlacement` / stored pane→worktree mapping is deleted.

### 4. Diff & review correctness (`gitChanges`)

- Groups: the main checkout plus every worktree discovered under the workspace
  folder (legacy `.worktrees/<callsign>` and `.agents` leftovers included).
- Main checkout group: current branch, `git status` changes (as today).
- Worktree groups: label = branch name (or directory name when detached, marked
  "detached"), changes = `git status` + committed `base...HEAD` files.
- `base` = `config.baseBranch`, resolved **once** at workspace creation:
  `origin/HEAD` → short branch name, else the currently checked-out branch, else
  `main`. Stored in config, editable in workspace settings. If the stored base no
  longer exists, worktree groups degrade to status-only changes with a visible
  warning instead of a wrong range.
- Embedded child repos keep their discovery-based reporting (unchanged).
- `dirtyWorktrees()` derives from `listWorktrees` + `isDirty` per worktree under
  the workspace folder.

### 5. Cleanup (close dialog)

- The close dialog lists worktrees discovered under the workspace folder, each with
  dirty/clean and merged/unmerged (vs base) badges. Clean+merged ones are
  pre-checked; dirty ones are unchecked with a warning.
- Removing a checked worktree runs `git worktree remove` (`--force` only for
  worktrees the user explicitly checked despite the dirty warning) and offers
  `git branch -d` (safe delete only) for its merged branch.
- This is the only remaining app-side destructive git operation, and it is always
  explicitly user-triggered.

### 6. Config & migration

- Removed from `WorkspaceConfig` / `WorkspaceDraft`: `useWorktrees`, `repos`.
  Removed types: `RepoChoice`, `PanePlacement`. The store strips dead fields when
  loading old data.
- Launcher UI: the worktree toggle and multi-repo chooser are removed; the base
  branch picker remains, relabeled as the **diff base**.
- Existing detached `.worktrees/<callsign>` and `.agents/` folders are not touched
  on upgrade: they appear in the diff view (as detached) and in the close dialog
  for removal.
- `slugify` moves out of `worktreePlan.ts` (which is deleted) into a shared util.

### 7. Error handling

- Branch names are slugified and validated before any instruction is sent.
- Non-repo folders / repos without commits: "Branch off…" disabled with a hint
  (no auto `git init` — the app no longer creates repos).
- Missing base branch: status-only diffs + warning label (never a wrong range).
- `lsof` cwd lookup failures fall back to the spawn cwd.

### 8. Testing

- Unit tests: `listWorktrees` porcelain parser (branch, detached, prunable
  entries), base-branch resolution order, instruction builder (agent vs shell,
  escaping), store migration stripping dead fields.
- Deleted with the code: `worktreePlan.ts` placement tests.

## Out of scope (future, competitor-inspired)

- Task-titled panes (rename pane after its task / first prompt).
- Per-pane resume / start-fresh chips.
- Merge-back / PR actions in the UI.
