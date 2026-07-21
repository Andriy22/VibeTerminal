# Changelog

All notable changes to VibeTerminal are documented here.

## [0.2.0] — 2026-07-21

### Added
- Isolation mode choice per workspace: **Shared checkout** (default) or **Worktree per agent** (the classic detached mode) — picked in the launcher, with illustrated hover previews of how each works.
- **Branch off (⑂)** on every pane: types a worktree instruction into the agent's terminal (`.worktrees/<task>` on a real branch). The app never runs git writes for isolation — the agent does.
- Live pane tracking: each pane header shows the directory and branch its shell is *actually* in, updating as agents `cd` into worktrees.
- Per-worktree cleanup in the stop/delete dialogs, with dirty/merged badges per worktree; merged branches are safe-deleted together with their worktree.

### Reworked
- Panes are plain sessions: in shared mode nothing is provisioned at launch, and `git worktree list` is the single source of truth driving the diff view, pane labels, and cleanup.
- Launcher redesigned: progress-rail stepper with animated fill, isolation cards with hover-previewed illustrations in the side panel, staggered step transitions, and `prefers-reduced-motion` support.
- Multi-repo mirror mode (`.agents/` folders, per-repo branch pickers) removed — superseded by on-demand worktrees.

### Fixed
- Code-review and diff ranges no longer shift when you switch branches in the main checkout: the diff base is pinned at workspace creation and compared with merge-base semantics.
- Launcher hover tooltips no longer overlap the form or clip under the side panel.

## [0.1.1] — 2026-07-21

Initial public release: multi-agent terminal workspaces (Claude Code, Codex, shells), shared project memory, usage meters, dictation, themes, and a built-in files & diff view.
