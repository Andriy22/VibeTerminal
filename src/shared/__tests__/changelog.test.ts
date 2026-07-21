import { describe, expect, it } from 'vitest'
import { parseChangelog } from '../changelog'

const SAMPLE = `# Changelog

All notable changes to VibeTerminal are documented here.

## [0.2.0] — 2026-07-21

### Added
- Isolation mode choice per workspace: **Shared checkout** or **Worktree per agent**.
- **Branch off (⑂)** on every pane: types \`.worktrees/<task>\` into the terminal.

### Reworked
- Panes are plain sessions: \`git worktree list\` is the single source of truth.

### Fixed
- Diff ranges no longer shift when you switch branches.

### Removed
- Multi-repo mirror mode.

## [0.1.1] — 2026-07-21

Initial public release: multi-agent terminal workspaces, shared project memory,
usage meters, dictation, themes, and a built-in files & diff view.
`

describe('parseChangelog', () => {
  it('parses releases newest-first with version and date', () => {
    const releases = parseChangelog(SAMPLE)
    expect(releases.map((r) => r.version)).toEqual(['0.2.0', '0.1.1'])
    expect(releases[0].date).toBe('2026-07-21')
  })

  it('groups bullets under their section headings in file order', () => {
    const [latest] = parseChangelog(SAMPLE)
    expect(latest.sections.map((s) => s.title)).toEqual([
      'Added',
      'Reworked',
      'Fixed',
      'Removed'
    ])
    expect(latest.sections[0].items).toHaveLength(2)
    expect(latest.sections[3].items).toEqual(['Multi-repo mirror mode.'])
  })

  it('keeps inline markdown raw in items', () => {
    const [latest] = parseChangelog(SAMPLE)
    expect(latest.sections[0].items[1]).toBe(
      '**Branch off (⑂)** on every pane: types `.worktrees/<task>` into the terminal.'
    )
  })

  it('captures a plain paragraph release as a note, joining wrapped lines', () => {
    const releases = parseChangelog(SAMPLE)
    expect(releases[1].sections).toEqual([])
    expect(releases[1].note).toBe(
      'Initial public release: multi-agent terminal workspaces, shared project memory, usage meters, dictation, themes, and a built-in files & diff view.'
    )
  })

  it('handles an Unreleased heading without a date', () => {
    const releases = parseChangelog('## [Unreleased]\n\n### Added\n- New thing\n')
    expect(releases[0].version).toBe('Unreleased')
    expect(releases[0].date).toBeNull()
    expect(releases[0].sections[0].items).toEqual(['New thing'])
  })

  it('appends indented continuation lines to the previous bullet', () => {
    const releases = parseChangelog(
      '## [1.0.0] — 2026-01-01\n\n### Fixed\n- A bug that was\n  quite long to describe.\n'
    )
    expect(releases[0].sections[0].items).toEqual([
      'A bug that was quite long to describe.'
    ])
  })

  it('ignores preamble and returns empty for empty input', () => {
    expect(parseChangelog('# Changelog\n\nJust a preamble.\n')).toEqual([])
    expect(parseChangelog('')).toEqual([])
  })
})
