import { useEffect, useRef, useState } from 'react'
import { callsign } from '@shared/callsigns'
import { effectiveColor, WORKSPACE_COLORS } from '@shared/colors'
import { useApp } from '../store'
import { detectKind, KIND_META } from '../kinds'
import Icon from './Icon'

function Swatches({
  current,
  onPick
}: {
  current: string | null
  onPick: (color: string | null) => void
}): JSX.Element {
  return (
    <div className="menu-swatches">
      {WORKSPACE_COLORS.map((color) => (
        <button
          key={color}
          className={`swatch ${current === color ? 'selected' : ''}`}
          style={{ background: color }}
          title={color}
          onClick={() => onPick(color)}
        />
      ))}
      <button className="swatch clear" title="Auto" onClick={() => onPick(null)}>
        ×
      </button>
    </div>
  )
}

export default function Sidebar(): JSX.Element {
  const snapshot = useApp((s) => s.snapshot)
  const activeId = useApp((s) => s.activeId)
  const setActive = useApp((s) => s.setActive)
  const openLauncher = useApp((s) => s.openLauncher)
  const openSettings = useApp((s) => s.openSettings)
  const setClosing = useApp((s) => s.setClosing)
  const toast = useApp((s) => s.toast)
  const groupColors = useApp((s) => s.groupColors)
  const paneProcs = useApp((s) => s.paneProcs)
  const paneActivity = useApp((s) => s.paneActivity)

  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('vt-sidebar-collapsed') === '1'
  )
  const [sortMode, setSortMode] = useState<'recent' | 'name'>(() =>
    localStorage.getItem('vt-sort') === 'name' ? 'name' : 'recent'
  )
  const [foldedGroups, setFoldedGroups] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [groupMenuFor, setGroupMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.vibe.getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    if (renaming) renameInputRef.current?.select()
  }, [renaming])

  const toggleCollapsed = (): void => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('vt-sidebar-collapsed', next ? '1' : '')
  }

  const toggleSort = (): void => {
    const next = sortMode === 'recent' ? 'name' : 'recent'
    setSortMode(next)
    localStorage.setItem('vt-sort', next)
  }

  const toggleGroup = (path: string): void => {
    setFoldedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const visible = snapshot.filter(
    (w) =>
      w.config.name.toLowerCase().includes(query.toLowerCase()) ||
      w.config.path.toLowerCase().includes(query.toLowerCase())
  )

  const groups = new Map<string, typeof visible>()
  for (const w of visible) {
    const list = groups.get(w.config.path) ?? []
    list.push(w)
    groups.set(w.config.path, list)
  }
  const latest = (items: typeof visible): number =>
    Math.max(...items.map((w) => w.config.lastLaunchedAt ?? 0))
  const folderName = (path: string): string => path.split('/').pop() || path
  const sortedGroups = [...groups.entries()].sort((a, b) =>
    sortMode === 'name'
      ? folderName(a[0]).localeCompare(folderName(b[0]))
      : latest(b[1]) - latest(a[1])
  )
  for (const [, items] of sortedGroups) {
    items.sort((a, b) =>
      sortMode === 'name'
        ? a.config.name.localeCompare(b.config.name)
        : (b.config.lastLaunchedAt ?? 0) - (a.config.lastLaunchedAt ?? 0)
    )
  }

  const launch = async (id: string): Promise<void> => {
    setActive(id)
    try {
      await window.vibe.launchWorkspace(id)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  const requestClose = async (id: string): Promise<void> => {
    const worktrees = await window.vibe.worktreeStatus(id)
    setClosing({ workspaceId: id, worktrees })
  }

  const remove = async (id: string): Promise<void> => {
    setMenuFor(null)
    const worktrees = await window.vibe.worktreeStatus(id)
    useApp.getState().setDeleting({ workspaceId: id, worktrees })
  }

  const startRename = (id: string, current: string): void => {
    setMenuFor(null)
    setRenaming(id)
    setRenameValue(current)
  }

  const commitRename = async (): Promise<void> => {
    if (renaming && renameValue.trim()) {
      await window.vibe.renameWorkspace(renaming, renameValue.trim())
    }
    setRenaming(null)
  }

  if (collapsed) {
    return (
      <aside className="sidebar rail">
        <div className="rail-top">
          <span className="brand-mark">✳</span>
          <button
            className="tool-button"
            title="Expand sidebar"
            onClick={toggleCollapsed}
          >
            <Icon name="panelLeft" size={14} />
          </button>
          <button
            className="tool-button primary"
            title="New workspace"
            onClick={() => openLauncher(true)}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        <div className="rail-list">
          {snapshot.map((w) => (
            <button
              key={w.config.id}
              className={`rail-dot ${w.config.id === activeId ? 'active' : ''} ${
                w.running ? '' : 'stopped'
              }`}
              style={{ background: effectiveColor(w.config, groupColors) }}
              title={`${w.config.name}${w.running ? '' : ' (stopped)'}`}
              onClick={() =>
                w.running ? setActive(w.config.id) : void launch(w.config.id)
              }
            />
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className="tool-button"
            title="Settings"
            onClick={() => openSettings(true)}
          >
            <Icon name="gear" size={14} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">✳</span>
        <span className="brand-name">VibeTerminal</span>
        {version && <span className="brand-version">v{version}</span>}
        <button
          className="tool-button brand-collapse"
          title="Collapse sidebar"
          onClick={toggleCollapsed}
        >
          <Icon name="panelLeft" size={14} />
        </button>
      </div>

      <div className="sidebar-head">
        <div className="search-box">
          <Icon name="search" size={13} />
          <input
            placeholder="Search workspaces"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="tool-button"
          title={`Sorted by ${sortMode === 'recent' ? 'recent activity' : 'name'} — click to switch`}
          onClick={toggleSort}
        >
          <Icon name="sort" size={13} />
        </button>
        <button
          className="tool-button primary"
          title="New workspace"
          onClick={() => openLauncher(true)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="sidebar-list">
        {visible.length === 0 && (
          <div className="sidebar-empty">
            {snapshot.length === 0
              ? 'No workspaces yet. Create one to launch your agents.'
              : 'No workspaces match the search.'}
          </div>
        )}
        {sortedGroups.map(([path, items]) => {
          const folded = foldedGroups.has(path)
          return (
            <div className="ws-group" key={path}>
              <div
                className="ws-group-head"
                title={path}
                onClick={() => toggleGroup(path)}
              >
                <span className="tree-chevron">
                  <Icon name={folded ? 'chevronRight' : 'chevronDown'} size={10} />
                </span>
                <button
                  className={`group-dot ${groupColors[path] ? '' : 'unset'}`}
                  style={
                    groupColors[path] ? { background: groupColors[path] } : undefined
                  }
                  title="Group color"
                  onClick={(e) => {
                    e.stopPropagation()
                    setGroupMenuFor(groupMenuFor === path ? null : path)
                  }}
                />
                <span className="ws-group-name">{folderName(path)}</span>
                <span className="ws-group-count">{items.length}</span>
                {groupMenuFor === path && (
                  <>
                    <div
                      className="menu-backdrop"
                      onClick={(e) => {
                        e.stopPropagation()
                        setGroupMenuFor(null)
                      }}
                    />
                    <div className="ws-menu group-menu" onClick={(e) => e.stopPropagation()}>
                      <div className="menu-label">Group color — all workspaces here</div>
                      <Swatches
                        current={groupColors[path] ?? null}
                        onPick={(color) => {
                          setGroupMenuFor(null)
                          void window.vibe.setGroupColor(path, color)
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
              {!folded &&
                items.map((w) => {
                  const id = w.config.id
                  const color = effectiveColor(w.config, groupColors)
                  return (
                    <div
                      key={id}
                      className={`ws-item ${id === activeId ? 'active' : ''}`}
                      onClick={() => (w.running ? setActive(id) : void launch(id))}
                    >
                      <span
                        className={`ws-color ${w.running ? '' : 'stopped'}`}
                        style={{ background: color }}
                      />
                      <div className="ws-item-top">
                        {renaming === id ? (
                          <input
                            ref={renameInputRef}
                            className="ws-rename"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitRename()
                              if (e.key === 'Escape') setRenaming(null)
                            }}
                            onBlur={() => void commitRename()}
                          />
                        ) : (
                          <span
                            className="ws-name"
                            title="Double-click to rename"
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              startRename(id, w.config.name)
                            }}
                          >
                            {w.config.name}
                          </span>
                        )}
                        {w.running &&
                          w.panes.some((rt) => paneActivity[rt.ptyId] === 'attention') && (
                            <span className="ws-bell" title="An agent needs your input">
                              <Icon name="bell" size={11} />
                            </span>
                          )}
                        <span className="ws-dots">
                          {w.config.panes.map((p, i) => {
                            const runtime = w.panes.find((r) => r.paneId === p.id)
                            const live = detectKind(
                              runtime ? paneProcs[runtime.ptyId] : null,
                              p.kind
                            )
                            return (
                              <span
                                key={p.id}
                                className={`ws-glyph ${w.running ? '' : 'stopped'}`}
                                style={{ color: KIND_META[live.kind].color }}
                                title={`${callsign(i)} · ${live.label}`}
                              >
                                {KIND_META[live.kind].symbol}
                              </span>
                            )
                          })}
                        </span>
                        <div className="ws-actions" onClick={(e) => e.stopPropagation()}>
                          {w.running ? (
                            <button
                              className="icon-mini"
                              title="Stop workspace"
                              onClick={() => void requestClose(id)}
                            >
                              ◼
                            </button>
                          ) : (
                            <button
                              className="icon-mini"
                              title="Start workspace"
                              onClick={() => void launch(id)}
                            >
                              ▶
                            </button>
                          )}
                          <button
                            className="icon-mini"
                            title="More actions"
                            onClick={() => setMenuFor(menuFor === id ? null : id)}
                          >
                            ⋯
                          </button>
                        </div>
                      </div>

                      {menuFor === id && (
                        <>
                          <div className="menu-backdrop" onClick={() => setMenuFor(null)} />
                          <div className="ws-menu" onClick={(e) => e.stopPropagation()}>
                            <div className="menu-label">Workspace color</div>
                            <Swatches
                              current={w.config.color ?? null}
                              onPick={(color) => {
                                setMenuFor(null)
                                void window.vibe.setWorkspaceColor(id, color)
                              }}
                            />
                            <div className="menu-sep" />
                            <button onClick={() => startRename(id, w.config.name)}>
                              Rename
                            </button>
                            <button
                              onClick={() => {
                                setMenuFor(null)
                                void window.vibe.revealWorkspace(id)
                              }}
                            >
                              Open in Finder
                            </button>
                            {w.running && (
                              <button
                                onClick={() => {
                                  setMenuFor(null)
                                  void requestClose(id)
                                }}
                              >
                                Stop workspace
                              </button>
                            )}
                            <button
                              className={w.config.yolo ? '' : 'menu-danger'}
                              onClick={() => {
                                setMenuFor(null)
                                void window.vibe.setYolo(id, !w.config.yolo)
                              }}
                            >
                              {w.config.yolo
                                ? 'Disable YOLO mode'
                                : '⚡ Enable YOLO mode'}
                              {w.running ? ' & relaunch' : ''}
                            </button>
                            <div className="menu-sep" />
                            <button
                              className="menu-danger"
                              onClick={() => void remove(id)}
                            >
                              Delete workspace
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

      <div className="sidebar-foot">
        <button
          className="tool-button"
          title="Settings"
          onClick={() => openSettings(true)}
        >
          <Icon name="gear" size={14} />
        </button>
      </div>
    </aside>
  )
}
