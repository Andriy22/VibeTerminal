import { useState } from 'react'
import { useApp } from '../store'

export default function DeleteDialog(): JSX.Element {
  const deleting = useApp((s) => s.deleting)!
  const setDeleting = useApp((s) => s.setDeleting)
  const snapshot = useApp((s) => s.snapshot)
  const toast = useApp((s) => s.toast)
  const workspace = snapshot.find((w) => w.config.id === deleting.workspaceId)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(deleting.worktrees.filter((w) => !w.dirty && w.merged).map((w) => w.dir))
  )

  const toggle = (dir: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  const remove = async (removeDirs: string[]): Promise<void> => {
    setDeleting(null)
    try {
      await window.vibe.deleteWorkspace(deleting.workspaceId, removeDirs)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setDeleting(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Delete “{workspace?.config.name ?? 'workspace'}”</h2>
        <p className="dim">
          Running agents are terminated and the workspace is removed from the list. The
          project folder itself is never touched.
        </p>

        {deleting.worktrees.length > 0 && (
          <div className="worktree-list">
            <p className="dim">Worktrees in this workspace — check to remove:</p>
            {deleting.worktrees.map((w) => (
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
            {deleting.worktrees.some((w) => w.dirty && selected.has(w.dir)) && (
              <div className="warn-box">
                Removing a worktree with uncommitted changes discards them. Commits stay
                recoverable in git.
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="mini-button" onClick={() => setDeleting(null)}>
            Cancel
          </button>
          <button className="primary-button danger" onClick={() => void remove([])}>
            Delete only
          </button>
          {selected.size > 0 && (
            <button
              className="primary-button danger"
              onClick={() => void remove([...selected])}
            >
              Delete + remove {selected.size} worktree{selected.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
