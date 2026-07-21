# Changelog

All notable changes to VibeTerminal are documented here.

<!--
This file is the single source of truth for the in-app "What's new" screen
(sparkle button next to Settings). Keep the format:
  ## [version] — YYYY-MM-DD
  ### Added | Fixed | Reworked | Removed
  - bullet (inline **bold**, *italic* and `code` are rendered)
-->

## [Unreleased]

### Added
- In-app changelog: a **What's new** screen next to Settings (and behind the version badge) showing what was added, fixed, reworked, and removed in every release — with an unread dot after each update.

### Reworked
- **What's new** list: the scroll edges fade, each retracting once you actually reach that end, and scrolling no longer chains into the workspace behind the modal.

### Fixed
- Every release's *Fixed* section escaped the **What's new** modal and pinned itself across the bottom of the window, staying put while the rest of the list scrolled: the category chip class was named after the heading, and `fixed` collided with Tailwind's `position: fixed` utility. Category classes are now prefixed (`cat-fixed`).

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
