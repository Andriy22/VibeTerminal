import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type MessagePortMain
} from 'electron'
import { existsSync, statSync } from 'fs'
import { join } from 'path'
import type { AgentKind, Settings } from '../shared/types'
import { getGitInfo } from './git'
import { suggestPaths, expandTilde } from './pathComplete'
import { listDir, readFileSmart, writeFileSmart } from './fsops'
import { PtyHostManager } from './ptyHostManager'
import { Store } from './store'
import { getUsage } from './usage'
import { dictationSource, transcribe } from './transcribe'
import { installMemoryInstructions, memoryRoot } from './memory'
import { deleteNote, listNotes, readNote, searchNotes } from '../shared/memoryFiles'
import { Workspaces, type WorkspaceDraft } from './workspaces'

app.setName('VibeTerminal')

let mainWindow: BrowserWindow | null = null
let pendingPort: MessagePortMain | null = null

const store = new Store()
const ptyHost = new PtyHostManager()
const workspaces = new Workspaces(store, ptyHost, () => {
  mainWindow?.webContents.send('workspaces-changed')
})

ptyHost.on('renderer-port', (port: MessagePortMain) => {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.postMessage('pty-port', null, [port])
    pendingPort = null
  } else {
    pendingPort = port
  }
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingPort && mainWindow) {
      mainWindow.webContents.postMessage('pty-port', null, [pendingPort])
      pendingPort = null
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('path:suggest', (_e, input: string) => suggestPaths(input))
  ipcMain.handle('path:expand', (_e, input: string) => expandTilde(input))
  ipcMain.handle('path:stat', (_e, input: string) => {
    try {
      return { isDirectory: statSync(expandTilde(input)).isDirectory() }
    } catch {
      return { isDirectory: false }
    }
  })
  ipcMain.handle('git:info', (_e, path: string) => getGitInfo(path))

  ipcMain.handle('dialog:pick-folder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('ws:snapshot', () => workspaces.snapshot())
  ipcMain.handle('ws:create', (_e, draft: WorkspaceDraft) =>
    workspaces.createAndLaunch(draft)
  )
  ipcMain.handle('ws:launch', (_e, id: string) => workspaces.launch(id))
  ipcMain.handle('ws:close', (_e, id: string, remove: string[]) =>
    workspaces.close(id, { remove })
  )
  ipcMain.handle('ws:delete', (_e, id: string, remove: string[]) =>
    workspaces.deleteWorkspace(id, remove)
  )
  ipcMain.handle('ws:worktree-status', (_e, id: string) => workspaces.worktreeStatus(id))
  ipcMain.handle('ws:rename', (_e, id: string, name: string) =>
    workspaces.rename(id, name)
  )
  ipcMain.handle('ws:set-grid', (_e, id: string, cols: number | null) =>
    workspaces.setGridCols(id, cols)
  )
  ipcMain.handle('ws:set-yolo', (_e, id: string, yolo: boolean) =>
    workspaces.setYolo(id, yolo)
  )
  ipcMain.handle('ws:set-color', (_e, id: string, color: string | null) =>
    workspaces.setColor(id, color)
  )
  ipcMain.handle('group:set-color', (_e, path: string, color: string | null) =>
    workspaces.setGroupColor(path, color)
  )
  ipcMain.handle('group:colors', () => store.data.groupColors)
  ipcMain.handle('ws:reveal', (_e, id: string) => {
    const config = store.getWorkspace(id)
    if (config) void shell.openPath(config.path)
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('usage:get', () => getUsage())
  ipcMain.handle('speech:transcribe', (_e, audio: ArrayBuffer) =>
    transcribe(audio, store.data.settings.openaiApiKey)
  )
  ipcMain.handle('speech:source', () =>
    dictationSource(store.data.settings.openaiApiKey)
  )

  ipcMain.handle('memory:notes', async (_e, id: string) => {
    const memory = await workspaces.workspaceMemory(id)
    if (!memory) return { scopes: [], notes: [] }
    const keys = memory.scopes.map((s) => s.key)
    return { scopes: memory.scopes, notes: listNotes(memoryRoot(), keys) }
  })
  ipcMain.handle('memory:read', async (_e, id: string, noteId: string) => {
    const memory = await workspaces.workspaceMemory(id)
    if (!memory) return null
    return readNote(memoryRoot(), memory.scopes.map((s) => s.key), noteId)
  })
  ipcMain.handle('memory:search', async (_e, id: string, query: string) => {
    const memory = await workspaces.workspaceMemory(id)
    if (!memory) return []
    return searchNotes(memoryRoot(), memory.scopes.map((s) => s.key), query)
  })
  ipcMain.handle('fs:list', (_e, dir: string) => listDir(dir))
  ipcMain.handle('fs:read', (_e, path: string, encoding?: string) =>
    readFileSmart(path, encoding)
  )
  ipcMain.handle(
    'fs:write',
    (_e, path: string, content: string, encoding: string, eol: string) => {
      writeFileSmart(path, content, encoding, eol)
    }
  )
  ipcMain.handle('git:changes', (_e, id: string) => workspaces.gitChanges(id))
  ipcMain.handle(
    'git:file-diff',
    (_e, id: string, repo: string, file: string, status: string) =>
      workspaces.gitFileDiff(id, repo, file, status)
  )

  ipcMain.handle('memory:delete', async (_e, id: string, noteId: string) => {
    const memory = await workspaces.workspaceMemory(id)
    if (!memory) return false
    return deleteNote(memoryRoot(), memory.scopes.map((s) => s.key), noteId)
  })
  ipcMain.handle('memory:reveal', async (_e, id: string) => {
    const memory = await workspaces.workspaceMemory(id)
    const dir = memory
      ? join(memoryRoot(), memory.writeScope)
      : memoryRoot()
    void shell.openPath(existsSync(dir) ? dir : memoryRoot())
  })
  ipcMain.handle('ws:add-pane', (_e, id: string, kind: AgentKind) =>
    workspaces.addPane(id, kind)
  )
  ipcMain.handle('ws:remove-pane', (_e, id: string, paneId: string) =>
    workspaces.removePane(id, paneId)
  )
  ipcMain.handle('ws:restart-pane', (_e, id: string, paneId: string) =>
    workspaces.restartPane(id, paneId)
  )

  ipcMain.handle('settings:get', () => store.data.settings)
  ipcMain.handle('settings:set', (_e, settings: Settings) => {
    store.data.settings = settings
    store.save()
  })

  ipcMain.handle('pty:request-port', () => {
    ptyHost.connectRenderer()
  })
}

app.whenReady().then(() => {
  // In dev the Electron binary's own icon/name are used — override the dock
  // icon at runtime. Packaged builds get both from electron-builder config.
  if (!app.isPackaged && process.platform === 'darwin') {
    try {
      app.dock.setIcon(join(app.getAppPath(), 'resources', 'icon.png'))
    } catch {
      // icon missing — non-fatal
    }
  }
  registerIpc()
  installMemoryInstructions()
  ptyHost.start()
  createWindow()
  void workspaces.restoreSession()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  workspaces.markShutdown()
  ptyHost.stop()
})

app.on('window-all-closed', () => {
  app.quit()
})
