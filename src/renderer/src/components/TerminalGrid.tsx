import type { WorkspaceSnapshot } from '@shared/types'
import { gridRows } from '@shared/layout'
import { useApp } from '../store'
import TerminalPane from './TerminalPane'

interface Props {
  workspace: WorkspaceSnapshot
  visible: boolean
}

export default function TerminalGrid({ workspace, visible }: Props): JSX.Element {
  const maximizedPane = useApp((s) => s.maximizedPane)
  const panes = workspace.config.panes
  const rows = gridRows(panes.length, workspace.config.gridCols ?? null)

  let index = 0
  return (
    <div className="terminal-grid" style={{ display: visible ? 'flex' : 'none' }}>
      {rows.map((count, rowIdx) => {
        const start = index
        index += count
        return (
          <div className="terminal-row" key={rowIdx}>
            {panes.slice(start, start + count).map((pane, colIdx) => {
              const runtime = workspace.panes.find((p) => p.paneId === pane.id)
              if (!runtime) return null
              const maximized = visible && maximizedPane === pane.id
              return (
                <TerminalPane
                  key={pane.id}
                  workspaceId={workspace.config.id}
                  pane={pane}
                  paneIndex={start + colIdx}
                  runtime={runtime}
                  visible={visible}
                  maximized={maximized}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
