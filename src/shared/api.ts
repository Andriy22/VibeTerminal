import type {
  AgentKind,
  ChangeGroup,
  FsEntry,
  GitInfo,
  GitScan,
  PathSuggestion,
  ReadFileResult,
  Settings,
  UsageSnapshot,
  WorkspaceSnapshot,
  WorktreeStatus
} from './types'
import type { MemoryNote, MemoryNoteMeta, MemorySearchHit } from './memoryFiles'

export interface WorkspaceDraftDto {
  name: string
  path: string
  panes: { kind: AgentKind }[]
  baseBranch: string | null
  gridCols?: number | null
  yolo?: boolean
  claudeFlags?: string
  codexFlags?: string
}

/** API the preload script exposes to the renderer as window.vibe */
export interface VibeApi {
  suggestPaths: (input: string) => Promise<PathSuggestion[]>
  expandPath: (input: string) => Promise<string>
  statPath: (input: string) => Promise<{ isDirectory: boolean }>
  gitInfo: (path: string) => Promise<GitInfo>
  gitScan: (path: string) => Promise<GitScan>
  pickFolder: () => Promise<string | null>

  snapshot: () => Promise<WorkspaceSnapshot[]>
  createWorkspace: (draft: WorkspaceDraftDto) => Promise<string>
  launchWorkspace: (id: string) => Promise<void>
  closeWorkspace: (id: string, remove: string[]) => Promise<void>
  deleteWorkspace: (id: string, remove: string[]) => Promise<void>
  renameWorkspace: (id: string, name: string) => Promise<void>
  setGridCols: (id: string, cols: number | null) => Promise<void>
  setWorkspaceColor: (id: string, color: string | null) => Promise<void>
  setYolo: (id: string, yolo: boolean) => Promise<void>
  setGroupColor: (path: string, color: string | null) => Promise<void>
  getGroupColors: () => Promise<Record<string, string>>
  revealWorkspace: (id: string) => Promise<void>
  getAppVersion: () => Promise<string>
  getUsage: () => Promise<UsageSnapshot>
  transcribe: (audio: ArrayBuffer) => Promise<{ text?: string; error?: string }>
  getDictationSource: () => Promise<'manual' | 'codex' | 'none'>

  memoryNotes: (workspaceId: string) => Promise<{
    scopes: { key: string; label: string }[]
    notes: MemoryNoteMeta[]
  }>
  memoryRead: (workspaceId: string, noteId: string) => Promise<MemoryNote | null>
  memorySearch: (workspaceId: string, query: string) => Promise<MemorySearchHit[]>
  memoryDelete: (workspaceId: string, noteId: string) => Promise<boolean>
  memoryReveal: (workspaceId: string) => Promise<void>

  listDir: (dir: string) => Promise<FsEntry[]>
  readFile: (path: string, encoding?: string) => Promise<ReadFileResult>
  writeFile: (
    path: string,
    content: string,
    encoding: string,
    eol: 'lf' | 'crlf'
  ) => Promise<void>
  gitChanges: (workspaceId: string) => Promise<ChangeGroup[]>
  gitFileDiff: (
    workspaceId: string,
    dir: string,
    file: string,
    mode: string
  ) => Promise<string>
  worktreeStatus: (id: string) => Promise<WorktreeStatus[]>
  addPane: (id: string, kind: AgentKind) => Promise<void>
  removePane: (id: string, paneId: string) => Promise<void>
  restartPane: (id: string, paneId: string) => Promise<void>

  getSettings: () => Promise<Settings>
  setSettings: (settings: Settings) => Promise<void>

  requestPtyPort: () => Promise<void>
  onWorkspacesChanged: (callback: () => void) => () => void
}
