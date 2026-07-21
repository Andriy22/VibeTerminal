import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '../shared/types'
import type { VibeApi, WorkspaceDraftDto } from '../shared/api'

// MessagePorts can't cross the context bridge — relay them to the main world
// via window.postMessage, which supports transferables.
ipcRenderer.on('pty-port', (event) => {
  window.postMessage({ type: 'vibeterminal:pty-port' }, '*', event.ports)
})

const api: VibeApi = {
  suggestPaths: (input) => ipcRenderer.invoke('path:suggest', input),
  expandPath: (input) => ipcRenderer.invoke('path:expand', input),
  statPath: (input) => ipcRenderer.invoke('path:stat', input),
  gitInfo: (path) => ipcRenderer.invoke('git:info', path),
  gitScan: (path) => ipcRenderer.invoke('git:scan', path),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),

  snapshot: () => ipcRenderer.invoke('ws:snapshot'),
  createWorkspace: (draft: WorkspaceDraftDto) => ipcRenderer.invoke('ws:create', draft),
  launchWorkspace: (id) => ipcRenderer.invoke('ws:launch', id),
  closeWorkspace: (id, removeWorktrees) =>
    ipcRenderer.invoke('ws:close', id, removeWorktrees),
  deleteWorkspace: (id, removeWorktrees) =>
    ipcRenderer.invoke('ws:delete', id, removeWorktrees),
  renameWorkspace: (id, name) => ipcRenderer.invoke('ws:rename', id, name),
  setGridCols: (id, cols) => ipcRenderer.invoke('ws:set-grid', id, cols),
  setWorkspaceColor: (id, color) => ipcRenderer.invoke('ws:set-color', id, color),
  setYolo: (id, yolo) => ipcRenderer.invoke('ws:set-yolo', id, yolo),
  setGroupColor: (path, color) => ipcRenderer.invoke('group:set-color', path, color),
  getGroupColors: () => ipcRenderer.invoke('group:colors'),
  revealWorkspace: (id) => ipcRenderer.invoke('ws:reveal', id),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getUsage: () => ipcRenderer.invoke('usage:get'),
  transcribe: (audio) => ipcRenderer.invoke('speech:transcribe', audio),
  getDictationSource: () => ipcRenderer.invoke('speech:source'),
  memoryNotes: (workspaceId) => ipcRenderer.invoke('memory:notes', workspaceId),
  memoryRead: (workspaceId, noteId) =>
    ipcRenderer.invoke('memory:read', workspaceId, noteId),
  memorySearch: (workspaceId, query) =>
    ipcRenderer.invoke('memory:search', workspaceId, query),
  memoryDelete: (workspaceId, noteId) =>
    ipcRenderer.invoke('memory:delete', workspaceId, noteId),
  memoryReveal: (workspaceId) => ipcRenderer.invoke('memory:reveal', workspaceId),
  listDir: (dir) => ipcRenderer.invoke('fs:list', dir),
  readFile: (path, encoding) => ipcRenderer.invoke('fs:read', path, encoding),
  writeFile: (path, content, encoding, eol) =>
    ipcRenderer.invoke('fs:write', path, content, encoding, eol),
  gitChanges: (workspaceId) => ipcRenderer.invoke('git:changes', workspaceId),
  gitFileDiff: (workspaceId, dir, file, mode) =>
    ipcRenderer.invoke('git:file-diff', workspaceId, dir, file, mode),
  dirtyWorktrees: (id) => ipcRenderer.invoke('ws:dirty-worktrees', id),
  addPane: (id, kind) => ipcRenderer.invoke('ws:add-pane', id, kind),
  removePane: (id, paneId) => ipcRenderer.invoke('ws:remove-pane', id, paneId),
  restartPane: (id, paneId) => ipcRenderer.invoke('ws:restart-pane', id, paneId),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Settings) => ipcRenderer.invoke('settings:set', settings),

  requestPtyPort: () => ipcRenderer.invoke('pty:request-port'),
  onWorkspacesChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('workspaces-changed', listener)
    return () => {
      ipcRenderer.removeListener('workspaces-changed', listener)
    }
  }
}

contextBridge.exposeInMainWorld('vibe', api)
