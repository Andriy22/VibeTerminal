import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangedFile, ChangeGroup, WorkspaceSnapshot } from '@shared/types'
import { highlightCode } from '../highlight'
import Icon from './Icon'

interface DiffLine {
  kind: 'add' | 'del' | 'context' | 'hunk' | 'meta'
  oldNo: number | null
  newNo: number | null
  text: string
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  for (const line of raw.split('\n')) {
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('+++') || line.startsWith('---')) {
      lines.push({ kind: 'meta', oldNo: null, newNo: null, text: line })
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldNo = parseInt(match[1], 10)
        newNo = parseInt(match[2], 10)
      }
      lines.push({ kind: 'hunk', oldNo: null, newNo: null, text: line })
    } else if (line.startsWith('+')) {
      lines.push({ kind: 'add', oldNo: null, newNo: newNo++, text: line.slice(1) })
    } else if (line.startsWith('-')) {
      lines.push({ kind: 'del', oldNo: oldNo++, newNo: null, text: line.slice(1) })
    } else if (line.startsWith('\\')) {
      lines.push({ kind: 'meta', oldNo: null, newNo: null, text: line })
    } else {
      lines.push({ kind: 'context', oldNo: oldNo++, newNo: newNo++, text: line.slice(1) })
    }
  }
  return lines
}

function statusColor(status: string): string {
  if (status === 'D') return 'var(--danger)'
  if (status === 'A' || status === '??') return 'var(--ok)'
  return 'var(--warn)'
}

export default function DiffView({
  workspace
}: {
  workspace: WorkspaceSnapshot
}): JSX.Element {
  const [groups, setGroups] = useState<ChangeGroup[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<{ group: ChangeGroup; file: ChangedFile } | null>(
    null
  )
  const [diff, setDiff] = useState<DiffLine[] | null>(null)

  // Per-line highlighting keyed by the selected file's language.
  const highlightedDiff = useMemo(() => {
    if (!diff || !selected) return null
    return diff.map((line) =>
      line.kind === 'add' || line.kind === 'del' || line.kind === 'context'
        ? highlightCode(line.text, selected.file.path)
        : null
    )
  }, [diff, selected])

  const load = useCallback(async () => {
    const result = await window.vibe.gitChanges(workspace.config.id)
    setGroups(result)
  }, [workspace.config.id])

  useEffect(() => {
    void load()
  }, [load])

  const total = groups.reduce((sum, g) => sum + g.changes.length, 0)

  const open = async (group: ChangeGroup, file: ChangedFile): Promise<void> => {
    setSelected({ group, file })
    const mode = file.committed ? `committed:${group.base ?? 'HEAD'}` : file.status
    const raw = await window.vibe.gitFileDiff(
      workspace.config.id,
      group.dir,
      file.path,
      mode
    )
    setDiff(raw ? parseDiff(raw) : [])
  }

  const toggle = (dir: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  return (
    <div className="subview">
      <div className="files-tree diff-side">
        <div className="subview-toolbar">
          <span className="dim">
            {total} change{total === 1 ? '' : 's'} · {groups.length} checkout
            {groups.length === 1 ? '' : 's'}
          </span>
          <button className="tool-button" title="Refresh" onClick={() => void load()}>
            ⟳
          </button>
        </div>
        <div className="tree-scroll">
          {groups.length === 0 && (
            <div className="sidebar-empty">Working tree clean — no changes.</div>
          )}
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.dir)
            return (
              <div className="change-group" key={group.dir || 'root'}>
                <button className="change-group-head" onClick={() => toggle(group.dir)}>
                  <span className="tree-chevron">
                    <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={11} />
                  </span>
                  <span className="tree-icon" style={{ color: 'var(--codex)' }}>
                    <Icon name="branch" size={12} />
                  </span>
                  <span className="change-group-label" title={group.dir || '/'}>
                    {group.label}
                  </span>
                  {group.branch && (
                    <span className="change-group-branch" title={group.branch}>
                      {group.branch}
                    </span>
                  )}
                  <span className="change-group-count">{group.changes.length}</span>
                </button>
                {!isCollapsed &&
                  group.changes.map((file) => {
                    const key = `${group.dir}/${file.path}`
                    const active =
                      selected &&
                      selected.group.dir === group.dir &&
                      selected.file.path === file.path
                    return (
                      <button
                        key={key}
                        className={`tree-row ${active ? 'active' : ''}`}
                        style={{ paddingLeft: 24 }}
                        title={file.path}
                        onClick={() => void open(group, file)}
                      >
                        <span
                          className="tree-status"
                          style={{ color: statusColor(file.status), marginLeft: 0 }}
                        >
                          {file.status === '??' ? 'U' : file.status}
                        </span>
                        <span className="tree-name diff-path">{file.path}</span>
                        {file.committed && (
                          <span className="diff-committed" title="Committed on this branch (not merged to base)">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="file-editor">
        {!selected ? (
          <div className="empty-state">
            <div className="empty-mark">
              <Icon name="branch" size={26} />
            </div>
            <p className="dim">Select a changed file to see its diff.</p>
          </div>
        ) : diff === null ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : diff.length === 0 ? (
          <div className="empty-state">
            <p className="dim">No textual diff (binary or identical).</p>
          </div>
        ) : (
          <>
            <div className="editor-head">
              <span className="editor-name">
                {selected.file.path}
                <span className="dim"> · {selected.group.label}</span>
                {selected.file.committed && (
                  <span className="dim"> · committed vs {selected.group.base}</span>
                )}
              </span>
            </div>
            <div className="diff-scroll">
              {diff.map((line, i) =>
                line.kind === 'meta' ? null : (
                  <div key={i} className={`diff-line ${line.kind}`}>
                    <span className="diff-gutter">{line.oldNo ?? ''}</span>
                    <span className="diff-gutter">{line.newNo ?? ''}</span>
                    <span className="diff-sign">
                      {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
                    </span>
                    {/* hljs-escaped HTML (or escapeHtml fallback); CSP blocks scripts */}
                    {highlightedDiff?.[i] != null ? (
                      <span
                        className="diff-text"
                        dangerouslySetInnerHTML={{ __html: highlightedDiff[i]! }}
                      />
                    ) : (
                      <span className="diff-text">{line.text}</span>
                    )}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
