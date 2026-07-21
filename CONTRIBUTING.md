# Contributing to VibeTerminal

Thanks for your interest in contributing! This document covers how to get a dev environment running, the conventions the codebase follows, and how to get your change merged.

## Getting set up

```bash
git clone https://github.com/Andriy22/VibeTerminal.git
cd VibeTerminal
npm install    # postinstall rebuilds node-pty against the Electron ABI
npm run dev    # launches the app with hot reload
```

You'll need macOS, Node.js 20+, and git. If `npm install` fails on `node-pty`, make sure the Xcode Command Line Tools are installed (`xcode-select --install`).

## Before you start coding

- **Bug fixes**: if there's no issue for it yet, [file one](https://github.com/Andriy22/VibeTerminal/issues/new?template=bug_report.yml) first — even if you fix it yourself five minutes later, the issue documents the problem for others.
- **Features**: [open a feature request](https://github.com/Andriy22/VibeTerminal/issues/new?template=feature_request.yml) and wait for a thumbs-up before building anything substantial. It's no fun to review (or reject) a large PR nobody discussed.
- **Small stuff** (typos, docs, obvious one-liners): just send the PR.

## Working on the code

### Architecture in one paragraph

The Electron **main process** (`src/main/`) owns workspace lifecycle, git worktrees, and settings. Terminals run in a separate **PTY host** utility process (`src/ptyHost/`) and stream I/O to the **renderer** (`src/renderer/`, React + Zustand + xterm.js) over a MessagePort. `src/mcpMemory/` is a standalone MCP stdio server that gives agents persistent project memory. Shared types and pure logic live in `src/shared/` — put anything testable there.

### Conventions

- TypeScript everywhere, strict mode. No `any` unless there's genuinely no alternative.
- Pure logic (planning, parsing, formatting) goes in `src/shared/` with unit tests next to it in `__tests__/`.
- Keep IPC handlers thin — real logic belongs in the classes in `src/main/`.
- Comments explain *why*, not *what*. Match the style you see around you.

### Verify before pushing

```bash
npm run typecheck   # both tsconfig projects must pass
npm test            # Vitest unit tests must pass
npm run dev         # manually verify your change in the running app
```

CI runs the same typecheck and tests on every pull request, and a merge to `main` triggers the release workflow that builds and publishes a DMG — so a red check on your PR blocks the release train for everyone.

## Submitting a pull request

1. Fork the repo and create a branch from `main` (`fix/pane-restart-crash`, `feat/linux-support`).
2. Make your change with focused commits and clear messages.
3. Fill in the PR template: what it does, how you tested it, screenshots for UI changes.
4. Link the issue it addresses ("Closes #12").

Small, focused PRs get reviewed quickly. A PR that mixes a feature with unrelated refactoring will be sent back to be split.

## Reporting issues

Use the issue forms — they ask for exactly the information needed to act on a report:

- 🐛 [Bug report](https://github.com/Andriy22/VibeTerminal/issues/new?template=bug_report.yml) — what happened, steps to reproduce, versions, logs.
- 💡 [Feature request](https://github.com/Andriy22/VibeTerminal/issues/new?template=feature_request.yml) — the problem first, then your proposed solution.
- 💬 [Discussions](https://github.com/Andriy22/VibeTerminal/discussions) — questions, ideas that aren't fully formed, show & tell.

Security issues: please don't open a public issue — email the address on the [author's GitHub profile](https://github.com/Andriy22) instead.

## Code of conduct

Be kind, be constructive, assume good intent. Harassment or personal attacks aren't tolerated in any project space.
