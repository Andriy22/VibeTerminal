import { useState } from 'react'
import { useApp } from '../store'

export default function CloseDialog(): JSX.Element {
  const closing = useApp((s) => s.closing)!
  const setClosing = useApp((s) => s.setClosing)
  const snapshot = useApp((s) => s.snapshot)
  const toast = useApp((s) => s.toast)
  const workspace = snapshot.find((w) => w.config.id === closing.workspaceId)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(closing.worktrees.filter((w) => !w.dirty && w.merged).map((w) => w.dir))
  )

  const toggle = (dir: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  const close = async (remove: string[]): Promise<void> => {
    setClosing(null)
    try {
      await window.vibe.closeWorkspace(closing.workspaceId, remove)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setClosing(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Stop “{workspace?.config.name ?? 'workspace'}”</h2>
        <p className="dim">All agent processes in this workspace will be terminated.</p>

        {closing.worktrees.length > 0 && (
          <div className="worktree-list">
            <p className="dim">Worktrees in this workspace — check to remove:</p>
            {closing.worktrees.map((w) => (
              <label className="check-row" key={w.dir}>
                <input
                  type="checkbox"
                  checked={selected.has(w.dir)}
                  onChange={() => toggle(w.dir)}
                />
                <code>{w.dir}</code>
                <span className="dim">
                  {w.branch ?? 'detached'}
                  {w.merged ? ' · merged' : ' · not merged'}
                  {w.dirty ? ' · UNCOMMITTED CHANGES' : ''}
                </span>
              </label>
            ))}
            {closing.worktrees.some((w) => w.dirty && selected.has(w.dir)) && (
              <div className="warn-box">
                Removing a worktree with uncommitted changes discards them. Commits stay
                recoverable in git.
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="mini-button" onClick={() => setClosing(null)}>
            Cancel
          </button>
          <button className="mini-button" onClick={() => void close([])}>
            Stop only
          </button>
          {selected.size > 0 && (
            <button
              className="primary-button danger"
              onClick={() => void close([...selected])}
            >
              Stop + remove {selected.size} worktree{selected.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
