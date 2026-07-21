export type AgentKind = 'claude' | 'codex' | 'shell'

export interface PaneConfig {
  id: string
  kind: AgentKind
}

/** One repo inside a multi-repo workspace folder. */
export interface RepoChoice {
  /** Directory name relative to the workspace folder. */
  dir: string
  /** Branch worktrees are cut from. null = that repo's current branch. */
  baseBranch: string | null
}

export interface WorkspaceConfig {
  id: string
  name: string
  path: string
  panes: PaneConfig[]
  /** @deprecated dead field from the eager-worktree model — stripped on load. */
  useWorktrees?: boolean
  /** Branch worktrees are cut from. null = branch that was current at launch. */
  baseBranch: string | null
  /** Non-empty = multi-repo folder: agents get .agents/<callsign> mirrors. */
  repos?: RepoChoice[]
  /** Fixed grid column count. null/undefined = auto (2-column rows). */
  gridCols?: number | null
  /** Accent color. null/undefined = group color, else stable auto color. */
  color?: string | null
  /** YOLO mode: agents run with all permission prompts disabled. */
  yolo?: boolean
  lastLaunchedAt?: number
  claudeFlags?: string
  codexFlags?: string
  /** Agents have run at least once → relaunch with resume flags. */
  hasRun: boolean
  /** Was running when the app last quit → auto-relaunch on start. */
  wasRunning: boolean
}

export type PaneStatus = 'running' | 'exited'

export interface PaneRuntime {
  paneId: string
  ptyId: string
  cwd: string
  /** Where the pane's shell actually is now (agents cd into worktrees). */
  liveCwd?: string
  branch: string | null
  status: PaneStatus
  exitCode?: number
}

export interface WorkspaceSnapshot {
  config: WorkspaceConfig
  running: boolean
  panes: PaneRuntime[]
}

export type UsageDisplay = 'both' | 'five_hour' | 'week'

export interface Settings {
  claudeFlags: string
  codexFlags: string
  shell: string
  theme: string
  glass: string
  usageDisplay: UsageDisplay
  /** OpenAI API key used for voice dictation (Whisper). Stored locally. */
  openaiApiKey: string
  /** Toggle-dictation hotkey signature, e.g. "Meta+Shift+KeyD". '' = disabled. */
  dictationHotkey: string
  /** Project memory: MCP tools + graph. Applies to newly launched agents. */
  memoryEnabled: boolean
}

export interface AgentUsage {
  /** Percent used in the short window (~5h), 0-100. null = no such window. */
  primary: number | null
  /** Percent used in the long window (week), 0-100. null = no such window. */
  secondary: number | null
  primaryResetsAt?: string | null
  secondaryResetsAt?: string | null
  /** Subscription plan name when known (e.g. codex "plus"). */
  planType?: string | null
  /** When this data was produced — session-log data can be stale. */
  asOf?: string | null
  /** 'live' = fetched from an API now; 'session-log' = last agent run. */
  source: 'live' | 'session-log'
}

export interface UsageSnapshot {
  claude: AgentUsage | null
  codex: AgentUsage | null
}

export interface GitInfo {
  isRepo: boolean
  branch: string | null
  branches: string[]
  hasCommits: boolean
}

export interface RepoInfo {
  dir: string
  branch: string | null
  branches: string[]
}

/** Result of inspecting a folder chosen in the launcher. */
export interface GitScan {
  /** 'repo' = folder is a repo; 'multi' = contains child repos; 'none' = neither. */
  kind: 'repo' | 'multi' | 'none'
  info: GitInfo
  repos: RepoInfo[]
}

export interface PathSuggestion {
  path: string
  name: string
}

export interface FsEntry {
  name: string
  dir: boolean
}

export interface ReadFileResult {
  content?: string
  encoding?: string
  /** Detected line endings; content is normalized to LF for editing. */
  eol?: 'lf' | 'crlf'
  binary?: boolean
  size?: number
  error?: string
}

export interface ChangedFile {
  path: string
  /** Porcelain status: M, A, D, R, ?? etc. */
  status: string
  /** true = committed on this checkout's branch but not merged to base. */
  committed?: boolean
}

/** One checkout (main repo or agent worktree) with its changes. */
export interface ChangeGroup {
  /** Directory relative to the workspace root; '' = the root itself. */
  dir: string
  label: string
  branch: string | null
  /** Base branch that committed changes are measured against. */
  base: string | null
  changes: ChangedFile[]
}

/** Renderer → pty host (over MessagePort) */
export type PtyInMessage =
  | { type: 'write'; ptyId: string; data: string }
  | { type: 'resize'; ptyId: string; cols: number; rows: number }
  | { type: 'kick'; ptyId: string }

/** Pty host → renderer (over MessagePort) */
export type PtyOutMessage =
  | { type: 'data'; ptyId: string; data: string }
  | { type: 'exit'; ptyId: string; exitCode: number }
  | { type: 'proc'; ptyId: string; name: string }

/** Main → pty host (over utilityProcess channel) */
export type HostControlMessage =
  | {
      type: 'spawn'
      ptyId: string
      shell: string
      args: string[]
      cwd: string
      env: Record<string, string>
      cols: number
      rows: number
      initialCommand: string | null
    }
  | { type: 'kill'; ptyId: string }

/** Pty host → main */
export type HostEventMessage =
  | { type: 'exited'; ptyId: string; exitCode: number }
  | { type: 'cwd'; ptyId: string; cwd: string }
