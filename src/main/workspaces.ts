import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join, relative, resolve } from 'path'
import { randomUUID } from 'crypto'
import type {
  AgentKind,
  IsolationMode,
  PaneRuntime,
  WorkspaceConfig,
  WorkspaceSnapshot,
  WorktreeStatus
} from '../shared/types'
import { buildAgentCommand } from '../shared/commands'
import { callsign } from '../shared/callsigns'
import { eagerPlacements, WORKTREES_DIR } from '../shared/worktrees'
import {
  addWorktreeDetached,
  branchChangedFiles,
  branchExists,
  changedFiles,
  ensureExcluded,
  fileDiff,
  fileDiffRange,
  deleteBranchSafe,
  getGitInfo,
  isDirty,
  isMerged,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
  resolveDefaultBranch
} from './git'
import type { ChangedFile, ChangeGroup } from '../shared/types'
import type { PtyHostManager } from './ptyHostManager'
import type { Store } from './store'
import {
  memoryLaunchArgs,
  resolveWorkspaceMemory,
  type MemoryLaunchArgs,
  type WorkspaceMemory
} from './memory'

const INSTALL_HINTS: Record<string, string> = {
  claude: 'npm install -g @anthropic-ai/claude-code',
  codex: 'npm install -g @openai/codex'
}

/**
 * Claude Code keeps per-folder conversations in ~/.claude/projects/<encoded-cwd>.
 * Only pass --continue when one actually exists, otherwise start fresh —
 * `claude --continue` errors out in a folder with no history (e.g. a brand
 * new worktree).
 */
function hasClaudeConversation(cwd: string): boolean {
  const encoded = cwd.replace(/[^A-Za-z0-9]/g, '-')
  try {
    return readdirSync(join(homedir(), '.claude', 'projects', encoded)).some((f) =>
      f.endsWith('.jsonl')
    )
  } catch {
    return false
  }
}

export interface WorkspaceDraft {
  name: string
  path: string
  panes: { kind: AgentKind }[]
  baseBranch: string | null
  isolation?: IsolationMode
  gridCols?: number | null
  yolo?: boolean
  claudeFlags?: string
  codexFlags?: string
}

export class Workspaces {
  private runtime = new Map<string, Map<string, PaneRuntime>>()
  private memory = new Map<string, { scopes: WorkspaceMemory; args: MemoryLaunchArgs }>()

  constructor(
    private store: Store,
    private ptyHost: PtyHostManager,
    private notify: () => void
  ) {
    ptyHost.on('pty-exited', (ptyId: string, exitCode: number) => {
      const pane = this.findPaneByPtyId(ptyId)
      if (pane) {
        pane.status = 'exited'
        pane.exitCode = exitCode
        this.notify()
      }
    })
    ptyHost.on('host-crashed', () => {
      this.respawnAllRunning()
    })
    ptyHost.on('pty-cwd', (ptyId: string, cwd: string) => {
      void this.updatePaneCwd(ptyId, cwd)
    })
  }

  snapshot(): WorkspaceSnapshot[] {
    return this.store.data.workspaces.map((config) => {
      const panes = this.runtime.get(config.id)
      return {
        config,
        running: !!panes && panes.size > 0,
        panes: panes ? [...panes.values()] : []
      }
    })
  }

  async createAndLaunch(draft: WorkspaceDraft): Promise<string> {
    const duplicate = this.store.data.workspaces.find(
      (w) =>
        w.path === draft.path &&
        w.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
    )
    if (duplicate) {
      throw new Error(
        `A workspace named “${draft.name}” already exists for this folder — pick a different name.`
      )
    }
    const config: WorkspaceConfig = {
      id: randomUUID(),
      name: draft.name,
      path: draft.path,
      panes: draft.panes.map((p) => ({ id: randomUUID(), kind: p.kind })),
      // Diff base, pinned once here — never re-inferred from the checkout later.
      baseBranch: draft.baseBranch || (await resolveDefaultBranch(draft.path)),
      isolation: draft.isolation ?? 'shared',
      gridCols: draft.gridCols ?? null,
      yolo: draft.yolo ?? false,
      claudeFlags: draft.claudeFlags,
      codexFlags: draft.codexFlags,
      hasRun: false,
      wasRunning: false
    }
    this.store.upsertWorkspace(config)
    await this.launch(config.id)
    return config.id
  }

  async launch(id: string): Promise<void> {
    const config = this.store.getWorkspace(id)
    if (!config) throw new Error(`Unknown workspace ${id}`)
    if (this.runtime.get(id)?.size) return

    if (!existsSync(config.path)) {
      throw new Error(`Folder no longer exists: ${config.path}`)
    }

    const resume = config.hasRun

    // Project memory: resolve scopes and prepare the MCP wiring for agents.
    if (this.store.data.settings.memoryEnabled !== false) {
      try {
        const scopes = await resolveWorkspaceMemory(config)
        this.memory.set(id, { scopes, args: memoryLaunchArgs(id, scopes) })
      } catch {
        this.memory.delete(id)
      }
    } else {
      this.memory.delete(id)
    }

    const info = await getGitInfo(config.path)
    if (info.isRepo) {
      ensureExcluded(config.path, `${WORKTREES_DIR}/`)
      await pruneWorktrees(config.path)
    }
    const mainBranch = info.branch

    // Eager mode: provision the classic detached worktree per agent pane.
    const eager = config.isolation === 'worktrees' && info.isRepo && info.hasCommits
    const placements = eager
      ? eagerPlacements(config.panes)
      : config.panes.map(() => null)
    if (eager) {
      const base = config.baseBranch || info.branch || 'HEAD'
      const created: string[] = []
      try {
        for (const dir of placements) {
          if (!dir || existsSync(join(config.path, dir))) continue // reuse previous run
          await addWorktreeDetached(config.path, dir, base)
          created.push(dir)
        }
      } catch (error) {
        // Roll back worktrees created during this failed launch.
        for (const dir of created) {
          await removeWorktree(config.path, dir).catch(() => {})
        }
        throw error
      }
    }

    const panes = new Map<string, PaneRuntime>()
    this.runtime.set(id, panes)
    config.panes.forEach((pane, i) => {
      const dir = placements[i]
      this.spawnPane(
        config,
        pane,
        resume,
        dir ? join(config.path, dir) : config.path,
        dir ? 'detached' : mainBranch,
        panes
      )
    })

    config.hasRun = true
    config.wasRunning = true
    config.lastLaunchedAt = Date.now()
    this.store.upsertWorkspace(config)
    this.notify()
  }

  private spawnPane(
    config: WorkspaceConfig,
    pane: { id: string; kind: AgentKind },
    resume: boolean,
    cwd: string,
    branch: string | null,
    panes: Map<string, PaneRuntime>
  ): void {
    const ptyId = `${config.id}:${pane.id}:${randomUUID().slice(0, 8)}`
    const settings = this.store.data.settings
    const flags =
      pane.kind === 'claude'
        ? config.claudeFlags ?? settings.claudeFlags
        : config.codexFlags ?? settings.codexFlags
    const wantResume =
      resume && (pane.kind !== 'claude' || hasClaudeConversation(cwd))
    let agentCommand = buildAgentCommand(
      pane.kind,
      flags,
      wantResume,
      config.yolo ?? false
    )
    const memoryArgs = this.memory.get(config.id)?.args
    if (agentCommand && memoryArgs) {
      if (pane.kind === 'claude') {
        agentCommand = `${agentCommand} ${memoryArgs.claude}`
      } else if (pane.kind === 'codex') {
        // covers both invocations in `codex resume --last || codex`
        agentCommand = agentCommand.replace(/\bcodex\b/g, `codex ${memoryArgs.codex}`)
      }
    }
    // The printf wipes screen + scrollback first, so the typed launch command
    // never stays visible in the pane.
    const initialCommand = agentCommand
      ? `printf '\\033[2J\\033[3J\\033[H'; if command -v ${pane.kind} >/dev/null 2>&1; then ${agentCommand}; else echo "${pane.kind} CLI not found — install it with: ${INSTALL_HINTS[pane.kind]}"; fi`
      : null

    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') env[key] = value
    }
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'

    this.ptyHost.send({
      type: 'spawn',
      ptyId,
      shell: settings.shell,
      args: ['-l'],
      cwd,
      env,
      cols: 80,
      rows: 24,
      initialCommand
    })

    panes.set(pane.id, {
      paneId: pane.id,
      ptyId,
      cwd,
      liveCwd: cwd,
      branch,
      status: 'running'
    })
  }

  /** After a pty host crash: respawn every pane that was running, resuming agents. */
  private respawnAllRunning(): void {
    for (const [workspaceId, panes] of this.runtime) {
      const config = this.store.getWorkspace(workspaceId)
      if (!config) continue
      for (const pane of config.panes) {
        const existing = panes.get(pane.id)
        if (existing?.status !== 'running') continue
        this.spawnPane(config, pane, true, existing.cwd, existing.branch, panes)
      }
    }
    this.notify()
  }

  async addPane(id: string, kind: AgentKind): Promise<void> {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    if (!config || !panes) throw new Error('Workspace is not running')

    const pane = { id: randomUUID(), kind }
    config.panes.push(pane)
    const info = await getGitInfo(config.path)
    const isAgent = kind === 'claude' || kind === 'codex'
    let cwd = config.path
    let branch = info.branch
    if (config.isolation === 'worktrees' && isAgent && info.isRepo && info.hasCommits) {
      // Next free callsign dir — never reuse an existing (possibly dirty) one.
      let index = config.panes.length - 1
      let dir = `${WORKTREES_DIR}/${callsign(index)}`
      while (existsSync(join(config.path, dir))) {
        dir = `${WORKTREES_DIR}/${callsign(++index)}`
      }
      const base = config.baseBranch || info.branch || 'HEAD'
      await addWorktreeDetached(config.path, dir, base)
      cwd = join(config.path, dir)
      branch = 'detached'
    }
    this.spawnPane(config, pane, false, cwd, branch, panes)
    this.store.upsertWorkspace(config)
    this.notify()
  }

  killPane(id: string, paneId: string): void {
    const runtime = this.runtime.get(id)?.get(paneId)
    if (runtime?.status === 'running') {
      this.ptyHost.send({ type: 'kill', ptyId: runtime.ptyId })
    }
  }

  /** Kill the pane's process and remove it from the workspace. */
  removePane(id: string, paneId: string): void {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    this.killPane(id, paneId)
    panes?.delete(paneId)
    if (config) {
      config.panes = config.panes.filter((p) => p.id !== paneId)
      this.store.upsertWorkspace(config)
    }
    if (panes && panes.size === 0) this.runtime.delete(id)
    this.notify()
  }

  restartPane(id: string, paneId: string): void {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    const runtime = panes?.get(paneId)
    if (!config || !panes || !runtime || runtime.status === 'running') return
    const pane = config.panes.find((p) => p.id === paneId)
    if (!pane) return
    // The pane's worktree may have been removed while it was down.
    const cwd = existsSync(runtime.cwd) ? runtime.cwd : config.path
    this.spawnPane(config, pane, true, cwd, runtime.branch, panes)
    this.notify()
  }

  /** Status + committed-vs-base changes for one checkout directory. */
  private async checkoutChanges(cwd: string, base: string | null): Promise<ChangedFile[]> {
    const [status, committed] = await Promise.all([
      changedFiles(cwd) as Promise<ChangedFile[]>,
      base ? branchChangedFiles(cwd, base) : Promise.resolve([])
    ])
    for (const change of committed) {
      if (!status.some((s) => s.path === change.path)) {
        status.push({ ...change, committed: true })
      }
    }
    return status
  }

  /** Linked worktrees that live under the workspace folder (never the main checkout). */
  private async workspaceWorktrees(
    config: WorkspaceConfig
  ): Promise<{ dir: string; path: string; branch: string | null; head: string | null }[]> {
    const root = resolve(config.path)
    return (await listWorktrees(config.path))
      .filter((w) => resolve(w.path) !== root && resolve(w.path).startsWith(root + '/'))
      .map((w) => ({
        dir: relative(root, resolve(w.path)),
        path: w.path,
        branch: w.branch,
        head: w.head
      }))
  }

  /**
   * Changes grouped by checkout: the main checkout, embedded child repos, and
   * every worktree discovered under the workspace folder. Committed changes in
   * worktrees are measured against the pinned baseBranch (three-dot, so the
   * range survives base moving forward). A missing base degrades to
   * status-only changes rather than a wrong range.
   */
  async gitChanges(id: string): Promise<ChangeGroup[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const rootInfo = await getGitInfo(config.path)
    const jobs: Promise<ChangeGroup | null>[] = []
    const job = (
      dir: string,
      label: string,
      branch: string | null,
      base: string | null,
      abs: string
    ): void => {
      jobs.push(
        this.checkoutChanges(abs, base).then((changes) =>
          changes.length > 0 ? { dir, label, branch, base, changes } : null
        )
      )
    }

    const embeddedDirs: string[] = []
    if (rootInfo.isRepo) {
      try {
        for (const entry of readdirSync(config.path, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (entry.name === WORKTREES_DIR || entry.name === '.agents') continue
          if (existsSync(join(config.path, entry.name, '.git'))) {
            embeddedDirs.push(entry.name)
          }
        }
      } catch {
        // unreadable root
      }
      jobs.push(
        this.checkoutChanges(config.path, null).then((changes) => {
          // embedded repos report separately — drop git's collapsed markers
          const cleaned = changes.filter(
            (c) => !embeddedDirs.some((d) => c.path === `${d}/` || c.path === d)
          )
          return cleaned.length > 0
            ? {
                dir: '',
                label: 'main checkout',
                branch: rootInfo.branch,
                base: null,
                changes: cleaned
              }
            : null
        })
      )
      for (const dir of embeddedDirs) {
        const abs = join(config.path, dir)
        jobs.push(
          Promise.all([getGitInfo(abs), this.checkoutChanges(abs, null)]).then(
            ([info, changes]) =>
              changes.length > 0
                ? { dir, label: `${dir} — main`, branch: info.branch, base: null, changes }
                : null
          )
        )
      }

      const baseOk =
        !!config.baseBranch && (await branchExists(config.path, config.baseBranch))
      for (const wt of await this.workspaceWorktrees(config)) {
        const base = baseOk ? config.baseBranch : null
        const label = wt.branch ?? `${wt.dir.split('/').pop()} (detached)`
        const warned = !baseOk && config.baseBranch ? `${label} — base missing` : label
        job(wt.dir, warned, wt.branch ?? 'detached', base, wt.path)
      }
    }
    return (await Promise.all(jobs)).filter((g): g is ChangeGroup => g !== null)
  }

  async gitFileDiff(
    id: string,
    dir: string,
    file: string,
    mode: string
  ): Promise<string> {
    const config = this.store.getWorkspace(id)
    if (!config) return ''
    const cwd = dir ? join(config.path, dir) : config.path
    if (mode.startsWith('committed:')) {
      return fileDiffRange(cwd, file, mode.slice('committed:'.length))
    }
    return fileDiff(cwd, file, mode === '??')
  }

  async workspaceMemory(id: string): Promise<WorkspaceMemory | null> {
    const cached = this.memory.get(id)
    if (cached) return cached.scopes
    const config = this.store.getWorkspace(id)
    if (!config) return null
    try {
      return await resolveWorkspaceMemory(config)
    } catch {
      return null
    }
  }

  async worktreeStatus(id: string): Promise<WorktreeStatus[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const base = config.baseBranch
    const result: WorktreeStatus[] = []
    for (const wt of await this.workspaceWorktrees(config)) {
      const ref = wt.branch ?? wt.head
      result.push({
        dir: wt.dir,
        branch: wt.branch,
        dirty: await isDirty(wt.path),
        merged: !!(ref && base) && (await isMerged(config.path, ref, base))
      })
    }
    return result
  }

  async close(id: string, options: { remove: string[] }): Promise<void> {
    const statuses = options.remove.length > 0 ? await this.worktreeStatus(id) : []
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    if (panes) {
      for (const pane of panes.values()) {
        if (pane.status === 'running') this.ptyHost.send({ type: 'kill', ptyId: pane.ptyId })
      }
      this.runtime.delete(id)
    }
    if (config) {
      for (const dir of options.remove) {
        const status = statuses.find((w) => w.dir === dir)
        await removeWorktree(config.path, dir).catch(() => {})
        if (status?.branch && status.merged) {
          await deleteBranchSafe(config.path, status.branch)
        }
      }
      if (options.remove.length > 0) await pruneWorktrees(config.path)
      config.wasRunning = false
      this.store.upsertWorkspace(config)
    }
    this.notify()
  }

  setGridCols(id: string, cols: number | null): void {
    const config = this.store.getWorkspace(id)
    if (!config) return
    config.gridCols = cols
    this.store.upsertWorkspace(config)
    this.notify()
  }

  /** Flip YOLO mode; relaunches a running workspace so agents pick it up. */
  async setYolo(id: string, yolo: boolean): Promise<void> {
    const config = this.store.getWorkspace(id)
    if (!config) return
    config.yolo = yolo
    this.store.upsertWorkspace(config)
    if (this.runtime.get(id)?.size) {
      await this.close(id, { remove: [] })
      await this.launch(id)
    }
    this.notify()
  }

  setColor(id: string, color: string | null): void {
    const config = this.store.getWorkspace(id)
    if (!config) return
    config.color = color
    this.store.upsertWorkspace(config)
    this.notify()
  }

  setGroupColor(path: string, color: string | null): void {
    if (color) this.store.data.groupColors[path] = color
    else delete this.store.data.groupColors[path]
    this.store.save()
    this.notify()
  }

  rename(id: string, name: string): void {
    const config = this.store.getWorkspace(id)
    if (!config || !name.trim()) return
    config.name = name.trim()
    this.store.upsertWorkspace(config)
    this.notify()
  }

  async deleteWorkspace(id: string, remove: string[]): Promise<void> {
    await this.close(id, { remove })
    this.store.deleteWorkspace(id)
    this.notify()
  }

  /** Auto-relaunch workspaces that were running when the app last quit. */
  async restoreSession(): Promise<void> {
    for (const config of this.store.data.workspaces) {
      if (config.wasRunning) {
        await this.launch(config.id).catch(() => {
          config.wasRunning = false
          this.store.upsertWorkspace(config)
        })
      }
    }
    this.notify()
  }

  /** Called on app quit: remember what was running for next start. */
  markShutdown(): void {
    for (const config of this.store.data.workspaces) {
      config.wasRunning = this.runtime.has(config.id)
    }
    this.store.save()
  }

  /** A pane's shell moved — record it and re-resolve the branch it is on. */
  private async updatePaneCwd(ptyId: string, cwd: string): Promise<void> {
    for (const [workspaceId, panes] of this.runtime) {
      for (const pane of panes.values()) {
        if (pane.ptyId !== ptyId) continue
        if (pane.liveCwd === cwd) return
        pane.liveCwd = cwd
        const config = this.store.getWorkspace(workspaceId)
        if (config) pane.branch = await this.branchForCwd(config.path, cwd)
        this.notify()
        return
      }
    }
  }

  /** Branch shown for a cwd: matching worktree's branch, else the cwd's own branch. */
  private async branchForCwd(root: string, cwd: string): Promise<string | null> {
    const worktrees = await listWorktrees(root)
    const match = worktrees
      .filter((w) => cwd === w.path || cwd.startsWith(w.path + '/'))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (match) return match.branch ?? 'detached'
    return (await getGitInfo(cwd)).branch
  }

  private findPaneByPtyId(ptyId: string): PaneRuntime | null {
    for (const panes of this.runtime.values()) {
      for (const pane of panes.values()) {
        if (pane.ptyId === ptyId) return pane
      }
    }
    return null
  }
}
