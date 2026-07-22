/**
 * All the fictional content the promo shows, in one place.
 *
 * Keeping it here (rather than inline in scenes) means the workspace names,
 * repo path and agent callsigns stay consistent from beat to beat — the video
 * reads as one continuous session rather than unrelated screenshots.
 * Every timestamp is a literal: no Date.now(), so renders are deterministic.
 */

import { Kind } from './theme'

export const REPO_PATH = '~/code/orbital'
export const REPO_NAME = 'orbital'
export const BASE_BRANCH = 'main'

export interface WorkspaceRow {
  name: string
  color: string
  kinds: Kind[]
  running: boolean
  active?: boolean
}

/** Sidebar tree: folder groups, each holding workspaces. */
export const SIDEBAR_GROUPS: { folder: string; items: WorkspaceRow[] }[] = [
  {
    folder: 'orbital',
    items: [
      {
        name: 'auth refactor',
        color: '#d97757',
        kinds: ['claude', 'claude', 'codex', 'shell'],
        running: true,
        active: true,
      },
      {
        name: 'billing',
        color: '#56b6c2',
        kinds: ['claude', 'codex'],
        running: true,
      },
    ],
  },
  {
    folder: 'telemetry',
    items: [
      {
        name: 'ingest rewrite',
        color: '#b083f0',
        kinds: ['claude', 'claude', 'shell'],
        running: false,
      },
    ],
  },
  {
    folder: 'dotfiles',
    items: [
      { name: 'nvim', color: '#57ab5a', kinds: ['shell'], running: false },
    ],
  },
]

export interface PaneSpec {
  kind: Kind
  callsign: string
  branch: string
  activity: 'idle' | 'working' | 'attention'
  /** Terminal body lines. `t` = tinted with the agent hue, `d` = dim. */
  lines: { text: string; tone?: 't' | 'd' }[]
}

/** The 2×2 grid shown for most of the video. */
export const PANES: PaneSpec[] = [
  {
    kind: 'claude',
    callsign: 'alpha',
    branch: 'main',
    activity: 'working',
    lines: [
      { text: '✳ Claude Code', tone: 't' },
      { text: '' },
      { text: '> refactor the auth module to use the new', tone: 'd' },
      { text: '  session store', tone: 'd' },
      { text: '' },
      { text: '● Reading src/auth/session.ts' },
      { text: '● Edited src/auth/session.ts', tone: 't' },
      { text: '  +48  -12' },
      { text: '● Running tests…' },
    ],
  },
  {
    kind: 'claude',
    callsign: 'bravo',
    branch: '.worktrees/bravo',
    activity: 'working',
    lines: [
      { text: '✳ Claude Code', tone: 't' },
      { text: '' },
      { text: '> write tests for the token refresh path', tone: 'd' },
      { text: '' },
      { text: '● Created src/auth/refresh.test.ts', tone: 't' },
      { text: '● 14 tests passing' },
      { text: '  ✓ refreshes before expiry' },
      { text: '  ✓ retries once on 401' },
      { text: '● Committing…' },
    ],
  },
  {
    kind: 'codex',
    callsign: 'charlie',
    branch: '.worktrees/charlie',
    activity: 'attention',
    lines: [
      { text: '⬡ codex', tone: 't' },
      { text: '' },
      { text: '> migrate the config loader to zod', tone: 'd' },
      { text: '' },
      { text: 'thinking…' },
      { text: 'apply patch to src/config/load.ts?', tone: 't' },
      { text: '  [y] yes  [n] no  [a] always' },
      { text: '' },
      { text: '▌' },
    ],
  },
  {
    kind: 'shell',
    callsign: 'delta',
    branch: 'main',
    activity: 'idle',
    lines: [
      { text: '❯ git worktree list', tone: 'd' },
      { text: '~/code/orbital          a3f21c9 [main]' },
      { text: '.worktrees/bravo        a3f21c9 (detached)' },
      { text: '.worktrees/charlie      a3f21c9 (detached)' },
      { text: '' },
      { text: '❯ git status --short', tone: 'd' },
      { text: ' M src/auth/session.ts' },
      { text: '?? src/auth/refresh.test.ts' },
      { text: '❯ ▌' },
    ],
  },
]

/** Usage meters — percentages the Limits beat animates toward. */
export const USAGE = {
  claude: {
    fiveHour: 42,
    weekly: 68,
    plan: 'max20',
    resetsAt: '18:20',
    weeklyResetsAt: 'Mon 09:00',
  },
  codex: {
    fiveHour: 63,
    weekly: 81,
    plan: 'pro',
    resetsAt: '19:05',
    weeklyResetsAt: 'Thu 00:00',
  },
} as const

/**
 * Meters at their settled values, for every beat except Limits — which
 * animates its own numbers and so builds this shape itself.
 */
export const USAGE_METERS: {
  kind: Kind
  windows: { label: string; value: number }[]
}[] = [
  {
    kind: 'claude',
    windows: [
      { label: '5h', value: USAGE.claude.fiveHour },
      { label: 'wk', value: USAGE.claude.weekly },
    ],
  },
  {
    kind: 'codex',
    windows: [
      { label: '5h', value: USAGE.codex.fiveHour },
      { label: 'wk', value: USAGE.codex.weekly },
    ],
  },
]

export interface MemoryNote {
  id: string
  title: string
  scope: string
  tags: string[]
  links: string[]
  body: string
}

/** Notes for the Memory beat — links drive the graph edges. */
export const MEMORY_NOTES: MemoryNote[] = [
  {
    id: 'session-store-choice',
    title: 'Session store is Redis, not Postgres',
    scope: 'orbital',
    tags: ['auth', 'decision'],
    links: ['token-refresh-window', 'auth-module-layout'],
    // The app renders note content as a plain <pre>, so this is written as
    // prose rather than markdown — heavy ** and ` syntax would show literally.
    body: `Sessions live in Redis with a 30-day TTL, not in
Postgres.

Why: session reads happen on every request, and the
Postgres pool saturated at ~4k rps during the March
load test.

How to apply: anything session-shaped goes through
src/auth/session.ts — never write session rows
directly.

Related: [[token-refresh-window]]`,
  },
  {
    id: 'token-refresh-window',
    title: 'Refresh tokens 5 min before expiry',
    scope: 'orbital',
    tags: ['auth'],
    links: ['session-store-choice'],
    body: 'Refresh fires at T-5min, not on 401.',
  },
  {
    id: 'auth-module-layout',
    title: 'auth/ is split by protocol, not by layer',
    scope: 'orbital',
    tags: ['architecture'],
    links: ['session-store-choice'],
    body: 'oauth/, saml/, session/ — each owns its own routes.',
  },
  {
    id: 'zod-migration',
    title: 'Config validation is moving to zod',
    scope: 'orbital',
    tags: ['config'],
    links: ['auth-module-layout'],
    body: 'Incremental — loader first, then per-service schemas.',
  },
  {
    id: 'ci-flake-node22',
    title: 'CI flakes on node 22 come from node-pty',
    scope: 'project',
    tags: ['ci', 'gotcha'],
    links: ['zod-migration'],
    body: 'Rebuild native deps before the test job, not after.',
  },
  {
    id: 'release-cadence',
    title: 'Ship from main, tag on merge',
    scope: 'project',
    tags: ['release'],
    links: [],
    body: 'Every merge to main publishes a build.',
  },
  {
    id: 'no-barrel-files',
    title: 'No barrel files in src/',
    scope: 'orbital',
    tags: ['convention'],
    links: ['auth-module-layout'],
    body: 'They wreck tree-shaking and circular-import detection.',
  },
]

/** The phrase dictation transcribes into the focused pane. */
export const DICTATION_TEXT = 'refactor the auth module and add tests'
