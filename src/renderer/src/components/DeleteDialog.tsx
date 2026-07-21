import { useApp } from '../store'

export default function DeleteDialog(): JSX.Element {
  const deleting = useApp((s) => s.deleting)!
  const setDeleting = useApp((s) => s.setDeleting)
  const snapshot = useApp((s) => s.snapshot)
  const toast = useApp((s) => s.toast)

  const workspace = snapshot.find((w) => w.config.id === deleting.workspaceId)
  const hasWorktrees = workspace?.config.useWorktrees ?? false

  const remove = async (removeWorktrees: boolean): Promise<void> => {
    setDeleting(null)
    try {
      await window.vibe.deleteWorkspace(deleting.workspaceId, removeWorktrees)
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

        {hasWorktrees && deleting.dirty.length > 0 && (
          <div className="warn-box">
            Uncommitted changes in:
            <ul>
              {deleting.dirty.map((dir) => (
                <li key={dir}>
                  <code>{dir}</code>
                </li>
              ))}
            </ul>
            Removing worktrees discards these changes. Commits stay recoverable in git.
          </div>
        )}

        <div className="modal-actions">
          <button className="mini-button" onClick={() => setDeleting(null)}>
            Cancel
          </button>
          {hasWorktrees ? (
            <>
              <button className="mini-button" onClick={() => void remove(false)}>
                Delete, keep worktrees
              </button>
              <button className="primary-button danger" onClick={() => void remove(true)}>
                Delete + remove worktrees
              </button>
            </>
          ) : (
            <button className="primary-button danger" onClick={() => void remove(false)}>
              Delete workspace
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
