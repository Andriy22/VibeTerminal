import { useEffect, useMemo, useRef, useState } from 'react'
import type { MemoryNote, MemoryNoteMeta } from '@shared/memoryFiles'
import { WORKSPACE_COLORS } from '@shared/colors'
import { useApp } from '../store'
import Segmented from './Segmented'

interface GraphNode extends MemoryNoteMeta {
  x: number
  y: number
}

/** Deterministic force layout — no animation, just a settled arrangement. */
function layoutGraph(
  notes: MemoryNoteMeta[],
  width: number,
  height: number
): GraphNode[] {
  const nodes: GraphNode[] = notes.map((note, i) => {
    const angle = (i / Math.max(1, notes.length)) * Math.PI * 2
    const jitter = ((i * 9301 + 49297) % 233280) / 233280
    const radius = Math.min(width, height) * (0.22 + jitter * 0.14)
    return {
      ...note,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius
    }
  })
  const index = new Map(nodes.map((n) => [n.id, n]))
  const edges: [GraphNode, GraphNode][] = []
  for (const node of nodes) {
    for (const target of node.links) {
      const other = index.get(target)
      if (other && other !== node) edges.push([node, other])
    }
  }
  for (let iteration = 0; iteration < 220; iteration++) {
    for (const a of nodes) {
      for (const b of nodes) {
        if (a === b) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = Math.max(120, dx * dx + dy * dy)
        const force = 2600 / d2
        const d = Math.sqrt(d2)
        a.x += (dx / d) * force
        a.y += (dy / d) * force
      }
      a.x += (width / 2 - a.x) * 0.012
      a.y += (height / 2 - a.y) * 0.012
    }
    for (const [a, b] of edges) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const pull = (d - 110) * 0.015
      a.x += (dx / d) * pull
      a.y += (dy / d) * pull
      b.x -= (dx / d) * pull
      b.y -= (dy / d) * pull
    }
    for (const node of nodes) {
      node.x = Math.max(56, Math.min(width - 56, node.x))
      node.y = Math.max(30, Math.min(height - 34, node.y))
    }
  }
  return nodes
}

export default function MemoryModal(): JSX.Element {
  const openMemory = useApp((s) => s.openMemory)
  const activeId = useApp((s) => s.activeId)
  const toast = useApp((s) => s.toast)
  const [scopes, setScopes] = useState<{ key: string; label: string }[]>([])
  const [notes, setNotes] = useState<MemoryNoteMeta[]>([])
  const [view, setView] = useState<'list' | 'graph'>('list')
  const [query, setQuery] = useState('')
  const [matchIds, setMatchIds] = useState<Set<string> | null>(null)
  const [selected, setSelected] = useState<MemoryNote | null>(null)
  const debounceRef = useRef(0)

  const reload = async (): Promise<void> => {
    if (!activeId) return
    const result = await window.vibe.memoryNotes(activeId)
    setScopes(result.scopes)
    setNotes(result.notes)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    if (!query.trim() || !activeId) {
      setMatchIds(null)
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      const hits = await window.vibe.memorySearch(activeId, query.trim())
      setMatchIds(new Set(hits.map((h) => h.id)))
    }, 200)
    return () => window.clearTimeout(debounceRef.current)
  }, [query, activeId])

  const scopeLabel = (key: string): string =>
    scopes.find((s) => s.key === key)?.label ?? key
  const scopeColor = (key: string): string => {
    const index = scopes.findIndex((s) => s.key === key)
    return WORKSPACE_COLORS[(index + 10) % WORKSPACE_COLORS.length]
  }

  const visible = matchIds ? notes.filter((n) => matchIds.has(n.id)) : notes
  const graphSize = { width: 470, height: 400 }
  const graphNodes = useMemo(
    () => (view === 'graph' ? layoutGraph(visible, graphSize.width, graphSize.height) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, visible]
  )
  const nodeById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes])

  const open = async (id: string): Promise<void> => {
    if (!activeId) return
    setSelected(await window.vibe.memoryRead(activeId, id))
  }

  const removeSelected = async (): Promise<void> => {
    if (!activeId || !selected) return
    if (!confirm(`Delete note “${selected.title}”?`)) return
    const ok = await window.vibe.memoryDelete(activeId, selected.id)
    if (!ok) toast('Could not delete the note.')
    setSelected(null)
    await reload()
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => openMemory(false)}>
      <div className="modal memory-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className={`memory-side ${view === 'graph' ? 'wide' : ''}`}>
          <div className="memory-side-head">
            <h2>Memory</h2>
            <Segmented
              options={[
                { value: 'list' as const, label: 'List' },
                { value: 'graph' as const, label: 'Graph' }
              ]}
              value={view}
              onChange={setView}
            />
          </div>
          <input
            className="text-input"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {view === 'list' ? (
            <div className="memory-list">
              {visible.length === 0 && (
                <div className="sidebar-empty">
                  {notes.length === 0
                    ? 'No memory yet. Agents save notes here with the memory_write MCP tool as they work.'
                    : 'No notes match.'}
                </div>
              )}
              {visible.map((note) => (
                <button
                  key={`${note.scope}/${note.id}`}
                  className={`memory-item ${selected?.id === note.id ? 'active' : ''}`}
                  onClick={() => void open(note.id)}
                >
                  <span className="memory-title">
                    <span
                      className="memory-scope-dot"
                      style={{ background: scopeColor(note.scope) }}
                    />
                    {note.title}
                  </span>
                  <span className="memory-meta">
                    {scopeLabel(note.scope)}
                    {note.tags.length > 0 && ` · #${note.tags.join(' #')}`}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="memory-graph">
              {visible.length === 0 ? (
                <div className="sidebar-empty">No notes to graph.</div>
              ) : (
                <svg viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}>
                  {graphNodes.flatMap((node) =>
                    node.links
                      .filter((t) => nodeById.has(t))
                      .map((t) => {
                        const other = nodeById.get(t)!
                        return (
                          <line
                            key={`${node.id}->${t}`}
                            x1={node.x}
                            y1={node.y}
                            x2={other.x}
                            y2={other.y}
                            className="graph-edge"
                          />
                        )
                      })
                  )}
                  {graphNodes.map((node) => (
                    <g
                      key={node.id}
                      className={`graph-node ${selected?.id === node.id ? 'selected' : ''}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => void open(node.id)}
                    >
                      <circle r={7 + Math.min(4, node.links.length * 1.5)} fill={scopeColor(node.scope)} />
                      <text y={20}>
                        {node.title.length > 22 ? `${node.title.slice(0, 21)}…` : node.title}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
          )}

          <div className="memory-side-foot">
            <span className="dim">{notes.length} notes</span>
            <button
              className="mini-button"
              onClick={() => activeId && void window.vibe.memoryReveal(activeId)}
            >
              Open folder
            </button>
          </div>
        </div>

        <div className="memory-view">
          {selected ? (
            <>
              <div className="memory-view-head">
                <strong>{selected.title}</strong>
                <span className="dim">
                  {scopeLabel(selected.scope)}
                  {selected.updated &&
                    ` · ${new Date(selected.updated).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`}
                </span>
                <span className="pane-spacer" />
                <button className="mini-button danger" onClick={() => void removeSelected()}>
                  Delete
                </button>
              </div>
              <pre className="memory-content">{selected.content}</pre>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-mark">◈</div>
              <p className="dim">Select a note to read it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
