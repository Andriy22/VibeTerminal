import type { AgentKind } from '@shared/types'
import { gridRows } from '@shared/layout'
import { callsign } from '@shared/callsigns'
import { KIND_META } from '../kinds'

interface Props {
  count: number
  kinds: AgentKind[]
  useWorktrees: boolean
  cols?: number | null
  onCycle: (index: number) => void
}

/** Miniature of the final grid. Click a cell to cycle claude → codex → shell. */
export default function PreviewGrid({
  count,
  kinds,
  useWorktrees,
  cols,
  onCycle
}: Props): JSX.Element {
  const rows = gridRows(count, cols ?? null)
  let index = 0
  return (
    <div className="preview-grid">
      {rows.map((rowCount, rowIdx) => {
        const start = index
        index += rowCount
        return (
          <div className="preview-row" key={rowIdx}>
            {Array.from({ length: rowCount }, (_, colIdx) => {
              const i = start + colIdx
              const kind = kinds[i]
              const meta = KIND_META[kind]
              const isAgent = kind !== 'shell'
              return (
                <button
                  key={i}
                  type="button"
                  className="preview-cell"
                  style={{ borderColor: meta.color, color: meta.color }}
                  title="Click to change agent type"
                  onClick={() => onCycle(i)}
                >
                  <span className="preview-symbol">{meta.symbol}</span>
                  <span className="preview-label">
                    {callsign(i)} · {meta.label}
                  </span>
                  <span className="preview-badge">
                    {i === 0
                      ? 'main checkout'
                      : useWorktrees && isAgent
                        ? 'worktree'
                        : '·'}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
