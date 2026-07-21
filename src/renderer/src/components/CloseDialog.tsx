import { useApp } from '../store'

export default function CloseDialog(): JSX.Element {
  const closing = useApp((s) => s.closing)!
  const setClosing = useApp((s) => s.setClosing)
  const snapshot = useApp((s) => s.snapshot)
  const toast = useApp((s) => s.toast)

  const workspace = snapshot.find((w) => w.config.id === closing.workspaceId)
  const hasWorktrees = workspace?.config.useWorktrees ?? false

  const close = async (removeWorktrees: boolean): Promise<void> => {
    setClosing(null)
    try {
      await window.vibe.closeWorkspace(closing.workspaceId, removeWorktrees)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setClosing(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Stop “{workspace?.config.name ?? 'workspace'}”</h2>
        <p className="dim">All agent processes in this workspace will be terminated.</p>

        {hasWorktrees && closing.dirty.length > 0 && (
          <div className="warn-box">
            Uncommitted changes in:
            <ul>
              {closing.dirty.map((dir) => (
                <li key={dir}>
                  <code>{dir}</code>
                </li>
              ))}
            </ul>
            Removing worktrees discards these changes. Commits stay recoverable in git.
          </div>
        )}

        <div className="modal-actions">
          <button className="mini-button" onClick={() => setClosing(null)}>
            Cancel
          </button>
          {hasWorktrees ? (
            <>
              <button className="mini-button" onClick={() => void close(false)}>
                Stop, keep worktrees
              </button>
              <button className="primary-button danger" onClick={() => void close(true)}>
                Stop, remove worktrees
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={() => void close(false)}>
              Stop workspace
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
