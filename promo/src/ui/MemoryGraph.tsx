/**
 * The memory graph view.
 *
 * The layout is ported from src/renderer/src/components/MemoryModal.tsx:12-67:
 * same seeded jitter, same force-relaxation loop, so it settles the same way
 * and is identical on every render.
 *
 * The one deviation: repulsion and link rest-length scale with `spread`. The
 * app's constants are tuned for its 470×400 panel; dropped into the promo's
 * much larger box they leave the nodes balled up in the middle with their
 * labels overlapping.
 */

import React from 'react'
import { MemoryNote } from '../data'
import { L, MONO, Skin } from '../theme'

const SCOPE_COLORS = ['#d97757', '#56b6c2', '#539bf5', '#b083f0', '#ec6cb9']

export const scopeColor = (scope: string, scopes: string[]): string =>
  SCOPE_COLORS[scopes.indexOf(scope) % SCOPE_COLORS.length]

interface Node extends MemoryNote {
  x: number
  y: number
}

export function layoutGraph(
  notes: MemoryNote[],
  width: number,
  height: number,
  spread = 1,
): Node[] {
  const nodes: Node[] = notes.map((note, i) => {
    const angle = (i / Math.max(1, notes.length)) * Math.PI * 2
    const jitter = ((i * 9301 + 49297) % 233280) / 233280
    const radius = Math.min(width, height) * (0.22 + jitter * 0.14)
    return {
      ...note,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    }
  })
  const index = new Map(nodes.map((n) => [n.id, n]))
  const edges: [Node, Node][] = []
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
        const force = (2600 * spread * spread) / d2
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
      const pull = (d - 110 * spread) * 0.015
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

interface Props {
  skin: Skin
  notes: MemoryNote[]
  scopes: string[]
  width: number
  height: number
  /** Per-node entrance, 0–1. */
  nodesIn: number[]
  /** 0–1 across all edges — they draw themselves in. */
  edgesIn: number
  selectedId?: string
  /** Scales the force constants for boxes larger than the app's panel. */
  spread?: number
}

export const MemoryGraph: React.FC<Props> = ({
  skin,
  notes,
  scopes,
  width,
  height,
  nodesIn,
  edgesIn,
  selectedId,
  spread = 1,
}) => {
  const nodes = layoutGraph(notes, width, height, spread)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const edges = nodes.flatMap((node, ni) =>
    node.links
      .filter((t) => byId.has(t))
      .map((t) => ({ from: node, to: byId.get(t)!, key: `${node.id}->${t}`, ni })),
  )

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {edges.map((e, i) => {
        // Each edge draws over its own slice of the overall progress.
        const slice = edges.length > 1 ? i / (edges.length - 1) : 0
        const local = Math.max(0, Math.min(1, (edgesIn - slice * 0.5) / 0.5))
        return (
          <line
            key={e.key}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.from.x + (e.to.x - e.from.x) * local}
            y2={e.from.y + (e.to.y - e.from.y) * local}
            stroke={skin.textDim}
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        )
      })}
      {nodes.map((node, i) => {
        const t = nodesIn[i] ?? 1
        const r = (7 + Math.min(4, node.links.length * 1.5)) * 1.4
        const selected = node.id === selectedId
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            opacity={t}
          >
            {selected && (
              <circle
                r={r * 1.9}
                fill="none"
                stroke={scopeColor(node.scope, scopes)}
                strokeOpacity={0.4}
                strokeWidth={2}
              />
            )}
            <circle
              r={r * t}
              fill={scopeColor(node.scope, scopes)}
              stroke={selected ? skin.text : 'none'}
              strokeWidth={selected ? 2 : 0}
            />
            {/* Painted twice: a dark stroke underneath keeps the label legible
                where it crosses an edge line. */}
            <text
              y={r + 20}
              textAnchor="middle"
              fontSize={14}
              fontFamily={MONO}
              stroke={skin.theme.pane}
              strokeWidth={4}
              strokeLinejoin="round"
              opacity={0.9}
            >
              {node.title.length > 20 ? `${node.title.slice(0, 19)}…` : node.title}
            </text>
            <text
              y={r + 20}
              textAnchor="middle"
              fill={selected ? skin.text : skin.textDim}
              fontSize={14}
              fontFamily={MONO}
            >
              {node.title.length > 20 ? `${node.title.slice(0, 19)}…` : node.title}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Scope legend shown under the graph. */
export const ScopeLegend: React.FC<{
  skin: Skin
  scopes: string[]
}> = ({ skin, scopes }) => (
  <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
    {scopes.map((s) => (
      <span
        key={s}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: L.font.tiny,
          color: skin.textDim,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: scopeColor(s, scopes),
          }}
        />
        {s}
      </span>
    ))}
  </div>
)
