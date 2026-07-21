import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FsEntry, ReadFileResult, WorkspaceSnapshot } from '@shared/types'
import { useApp } from '../store'
import { highlightCode } from '../highlight'
import Icon from './Icon'

const ICON_BY_EXT: Record<string, { icon: string; color: string }> = {
  ts: { icon: 'code', color: '#539bf5' },
  tsx: { icon: 'code', color: '#539bf5' },
  js: { icon: 'code', color: '#c69026' },
  jsx: { icon: 'code', color: '#c69026' },
  py: { icon: 'code', color: '#57ab5a' },
  rb: { icon: 'code', color: '#f47067' },
  go: { icon: 'code', color: '#56b6c2' },
  rs: { icon: 'code', color: '#d97757' },
  css: { icon: 'braces', color: '#b083f0' },
  scss: { icon: 'braces', color: '#b083f0' },
  html: { icon: 'code', color: '#f47067' },
  json: { icon: 'braces', color: '#c69026' },
  md: { icon: 'doc', color: '#8b939d' },
  txt: { icon: 'doc', color: '#8b939d' },
  yml: { icon: 'gear', color: '#8b939d' },
  yaml: { icon: 'gear', color: '#8b939d' },
  toml: { icon: 'gear', color: '#8b939d' },
  sh: { icon: 'terminal', color: '#57ab5a' },
  zsh: { icon: 'terminal', color: '#57ab5a' },
  png: { icon: 'image', color: '#b083f0' },
  jpg: { icon: 'image', color: '#b083f0' },
  jpeg: { icon: 'image', color: '#b083f0' },
  gif: { icon: 'image', color: '#b083f0' },
  svg: { icon: 'image', color: '#b083f0' },
  lock: { icon: 'box', color: '#8b939d' }
}

function fileIcon(name: string): { icon: string; color: string } {
  if (name === 'package.json') return { icon: 'box', color: '#d97757' }
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ICON_BY_EXT[ext] ?? { icon: 'file', color: 'var(--text-dim)' }
}

function statusColor(status: string): string {
  if (status === 'D') return 'var(--danger)'
  if (status === 'A' || status === '??') return 'var(--ok)'
  return 'var(--warn)'
}

const ENCODINGS = ['utf8', 'utf8-bom', 'utf16le', 'utf16be', 'latin1']

interface TreeProps {
  root: string
  rel: string
  depth: number
  changes: Map<string, string>
  selected: string | null
  onOpen: (rel: string) => void
}

function TreeDir({ root, rel, depth, changes, selected, onOpen }: TreeProps): JSX.Element {
  const [entries, setEntries] = useState<FsEntry[] | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    void window.vibe.listDir(rel ? `${root}/${rel}` : root).then(setEntries)
  }, [root, rel])

  if (!entries) return <></>

  const dirHasChanges = (dirRel: string): boolean => {
    for (const key of changes.keys()) {
      if (key.startsWith(dirRel + '/')) return true
      // inside a collapsed untracked directory entry ("newdir/")
      if (key.endsWith('/') && (dirRel + '/').startsWith(key)) return true
    }
    return false
  }

  const statusFor = (rel: string): string | undefined => {
    const direct = changes.get(rel)
    if (direct) return direct
    for (const [key, status] of changes) {
      if (key.endsWith('/') && rel.startsWith(key)) return status
    }
    return undefined
  }

  return (
    <>
      {entries.map((entry) => {
        const entryRel = rel ? `${rel}/${entry.name}` : entry.name
        if (entry.dir) {
          const open = expanded.has(entry.name)
          return (
            <div key={entryRel}>
              <button
                className="tree-row"
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(entry.name)) next.delete(entry.name)
                    else next.add(entry.name)
                    return next
                  })
                }
              >
                <span className="tree-chevron">
                  <Icon name={open ? 'chevronDown' : 'chevronRight'} size={11} />
                </span>
                <span className="tree-icon" style={{ color: '#8ca0b3' }}>
                  <Icon name="folderIcon" size={13} />
                </span>
                <span className="tree-name">{entry.name}</span>
                {dirHasChanges(entryRel) && <span className="tree-changed-dot" />}
              </button>
              {open && (
                <TreeDir
                  root={root}
                  rel={entryRel}
                  depth={depth + 1}
                  changes={changes}
                  selected={selected}
                  onOpen={onOpen}
                />
              )}
            </div>
          )
        }
        const meta = fileIcon(entry.name)
        const status = statusFor(entryRel)
        return (
          <button
            key={entryRel}
            className={`tree-row ${selected === entryRel ? 'active' : ''}`}
            style={{ paddingLeft: 8 + depth * 14 + 15 }}
            onClick={() => onOpen(entryRel)}
          >
            <span className="tree-icon" style={{ color: meta.color }}>
              <Icon name={meta.icon} size={13} />
            </span>
            <span
              className="tree-name"
              style={status ? { color: statusColor(status) } : undefined}
            >
              {entry.name}
            </span>
            {status && (
              <span className="tree-status" style={{ color: statusColor(status) }}>
                {status === '??' ? 'U' : status}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

export default function FilesView({
  workspace
}: {
  workspace: WorkspaceSnapshot
}): JSX.Element {
  const root = workspace.config.path
  const toast = useApp((s) => s.toast)
  const [changes, setChanges] = useState<Map<string, string>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<ReadFileResult | null>(null)
  const [content, setContent] = useState('')
  const [eol, setEol] = useState<'lf' | 'crlf'>('lf')
  const [dirty, setDirty] = useState(false)
  const [treeKey, setTreeKey] = useState(0)
  const saveRef = useRef<() => void>(() => {})
  const highlightRef = useRef<HTMLPreElement>(null)

  const highlighted = useMemo(
    () => (selected ? highlightCode(content, selected) : ''),
    [content, selected]
  )

  const loadChanges = useCallback(async () => {
    const groups = await window.vibe.gitChanges(workspace.config.id)
    const map = new Map<string, string>()
    for (const group of groups) {
      // the tree shows real checkouts only — agent copies live in Changes
      if (group.dir.includes('.worktrees') || group.dir.includes('.agents')) continue
      for (const change of group.changes) {
        if (change.committed) continue
        map.set(group.dir ? `${group.dir}/${change.path}` : change.path, change.status)
      }
    }
    setChanges(map)
  }, [workspace.config.id])

  useEffect(() => {
    void loadChanges()
  }, [loadChanges])

  const open = async (rel: string, encoding?: string): Promise<void> => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    const result = await window.vibe.readFile(`${root}/${rel}`, encoding)
    setSelected(rel)
    setFile(result)
    setContent(result.content ?? '')
    setEol(result.eol ?? 'lf')
    setDirty(false)
  }

  const save = async (): Promise<void> => {
    if (!selected || !file?.encoding) return
    try {
      await window.vibe.writeFile(`${root}/${selected}`, content, file.encoding, eol)
      setDirty(false)
      void loadChanges()
    } catch (error) {
      toast(`Save failed: ${(error as Error).message}`)
    }
  }
  saveRef.current = () => void save()

  return (
    <div className="subview">
      <div className="files-tree">
        <div className="subview-toolbar">
          <span className="dim">{root.split('/').pop()}</span>
          <button
            className="tool-button"
            title="Refresh tree and git status"
            onClick={() => {
              setTreeKey((k) => k + 1)
              void loadChanges()
            }}
          >
            ⟳
          </button>
        </div>
        <div className="tree-scroll" key={treeKey}>
          <TreeDir
            root={root}
            rel=""
            depth={0}
            changes={changes}
            selected={selected}
            onOpen={(rel) => void open(rel)}
          />
        </div>
      </div>

      <div className="file-editor">
        {!selected ? (
          <div className="empty-state">
            <div className="empty-mark">
              <Icon name="file" size={26} />
            </div>
            <p className="dim">Select a file to view or edit it.</p>
          </div>
        ) : file?.binary ? (
          <div className="empty-state">
            <p className="dim">
              Binary file · {((file.size ?? 0) / 1024).toFixed(1)} KB — not editable as
              text.
            </p>
          </div>
        ) : file?.error ? (
          <div className="empty-state">
            <p className="warn">{file.error}</p>
          </div>
        ) : (
          <>
            <div className="editor-head">
              <span className="editor-name">
                {selected}
                {dirty && <span className="editor-dirty">●</span>}
              </span>
              <span className="pane-spacer" />
              <select
                className="editor-encoding"
                value={eol}
                title="Line endings — converted on save"
                onChange={(e) => {
                  setEol(e.target.value as 'lf' | 'crlf')
                  setDirty(true)
                }}
              >
                <option value="lf">LF</option>
                <option value="crlf">CRLF</option>
              </select>
              <select
                className="editor-encoding"
                value={file?.encoding ?? 'utf8'}
                title="Reopen with encoding"
                onChange={(e) => void open(selected, e.target.value)}
              >
                {ENCODINGS.map((enc) => (
                  <option key={enc} value={enc}>
                    {enc}
                  </option>
                ))}
              </select>
              <button className="mini-button" disabled={!dirty} onClick={() => void save()}>
                Save ⌘S
              </button>
            </div>
            <div className="editor-wrap">
              {/* HTML is hljs output (escapes all source text) or escapeHtml fallback;
                  CSP additionally blocks any script execution in this renderer. */}
              <pre className="editor-highlight" aria-hidden ref={highlightRef}>
                <code dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
              </pre>
              <textarea
                className="editor-text"
                value={content}
                spellCheck={false}
                onChange={(e) => {
                  setContent(e.target.value)
                  setDirty(true)
                }}
                onScroll={(e) => {
                  const pre = highlightRef.current
                  if (pre) {
                    pre.scrollTop = e.currentTarget.scrollTop
                    pre.scrollLeft = e.currentTarget.scrollLeft
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault()
                    saveRef.current()
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
