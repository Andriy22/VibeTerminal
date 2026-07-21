import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Settings, WorkspaceConfig } from '../shared/types'
import { stripDeadWorkspaceFields } from '../shared/worktrees'

interface StoreData {
  workspaces: WorkspaceConfig[]
  settings: Settings
  /** Accent color per project folder path. */
  groupColors: Record<string, string>
}

const DEFAULT_SETTINGS: Settings = {
  claudeFlags: '',
  codexFlags: '',
  shell: process.env.SHELL || '/bin/zsh',
  theme: 'vibe-dark',
  glass: 'standard',
  usageDisplay: 'both',
  openaiApiKey: '',
  dictationHotkey: 'Meta+Shift+KeyD',
  memoryEnabled: true
}

export class Store {
  private file: string
  data: StoreData

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'vibeterminal.json')
    this.data = this.load()
  }

  private load(): StoreData {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'))
      return {
        workspaces: (Array.isArray(raw.workspaces) ? raw.workspaces : []).map(
          (w: Record<string, unknown>) =>
            stripDeadWorkspaceFields(w) as unknown as WorkspaceConfig
        ),
        settings: { ...DEFAULT_SETTINGS, ...raw.settings },
        groupColors:
          raw.groupColors && typeof raw.groupColors === 'object' ? raw.groupColors : {}
      }
    } catch {
      return { workspaces: [], settings: { ...DEFAULT_SETTINGS }, groupColors: {} }
    }
  }

  save(): void {
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    renameSync(tmp, this.file)
  }

  getWorkspace(id: string): WorkspaceConfig | undefined {
    return this.data.workspaces.find((w) => w.id === id)
  }

  upsertWorkspace(config: WorkspaceConfig): void {
    const index = this.data.workspaces.findIndex((w) => w.id === config.id)
    if (index >= 0) this.data.workspaces[index] = config
    else this.data.workspaces.push(config)
    this.save()
  }

  deleteWorkspace(id: string): void {
    this.data.workspaces = this.data.workspaces.filter((w) => w.id !== id)
    this.save()
  }
}
