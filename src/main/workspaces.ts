import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import type {
  AgentKind,
  PaneRuntime,
  RepoChoice,
  WorkspaceConfig,
  WorkspaceSnapshot
} from '../shared/types'
import { buildAgentCommand } from '../shared/commands'
import { callsign } from '../shared/callsigns'
import {
  AGENTS_DIR,
  planPlacements,
  worktreeSpec,
  WORKTREES_DIR,
  type PanePlacement
} from '../shared/worktreePlan'
import {
  addWorktree,
  branchChangedFiles,
  changedFiles,
  ensureExcluded,
  ensureRepo,
  fileDiff,
  fileDiffRange,
  getGitInfo,
  isDirty,
  pruneWorktrees,
  removeWorktree
} from './git'
import type { ChangedFile, ChangeGroup } from '../shared/types'
import type { PtyHostManager } from './ptyHostManager'
import type { Store } from './store'
import {
  memoryLaunchArgs,
  MIRROR_AGENTS_MD,
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
  useWorktrees: boolean
  baseBranch: string | null
  repos?: RepoChoice[]
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
      useWorktrees: draft.useWorktrees,
      baseBranch: draft.baseBranch,
      repos: draft.repos,
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
    const placements = planPlacements(config)
    const multi = (config.repos?.length ?? 0) > 0
    let mainBranch: string | null = null

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

    if (config.useWorktrees && resolve(config.path) === homedir()) {
      throw new Error(
        'Refusing to manage worktrees in your home directory — pick a project folder or disable worktrees.'
      )
    }

    if (config.useWorktrees && multi) {
      for (const placement of placements) {
        if (placement.worktreeDir) await this.createAgentMirror(config, placement)
      }
    } else if (config.useWorktrees) {
      await ensureRepo(config.path)
      ensureExcluded(config.path, `${WORKTREES_DIR}/`)
      await pruneWorktrees(config.path)
      const info = await getGitInfo(config.path)
      mainBranch = info.branch
      const base = config.baseBranch || info.branch || 'HEAD'
      const created: string[] = []
      try {
        for (const placement of placements) {
          if (!placement.worktreeDir) continue
          const dir = join(config.path, placement.worktreeDir)
          if (existsSync(dir)) continue // reuse the worktree from a previous run
          await addWorktree(config.path, placement.worktreeDir, base)
          created.push(placement.worktreeDir)
        }
      } catch (error) {
        // Roll back worktrees created during this failed launch.
        for (const dir of created) {
          await removeWorktree(config.path, dir).catch(() => {})
        }
        throw error
      }
    } else {
      const info = await getGitInfo(config.path)
      mainBranch = info.branch
    }

    const panes = new Map<string, PaneRuntime>()
    this.runtime.set(id, panes)
    for (let i = 0; i < config.panes.length; i++) {
      this.spawnPane(config, config.panes[i], placements[i], resume, mainBranch, panes)
    }

    config.hasRun = true
    config.wasRunning = true
    config.lastLaunchedAt = Date.now()
    this.store.upsertWorkspace(config)
    this.notify()
  }

  /**
   * Multi-repo isolation: build .agents/<callsign>/ containing a worktree of
   * every repo (all on the agent's branch) plus symlinks to shared non-repo
   * files, so one agent works across all repos without conflicts.
   */
  private async createAgentMirror(
    config: WorkspaceConfig,
    placement: PanePlacement
  ): Promise<void> {
    const agentDir = join(config.path, placement.worktreeDir!)
    mkdirSync(agentDir, { recursive: true })
    // The mirror root is not a git repo, so this guidance file is invisible
    // to git; codex reads AGENTS.md from its cwd upward.
    try {
      const agentsMd = join(agentDir, 'AGENTS.md')
      if (!existsSync(agentsMd) || !readFileSync(agentsMd, 'utf8').includes('VibeTerminal v3')) {
        writeFileSync(agentsMd, MIRROR_AGENTS_MD)
      }
    } catch {
      // best-effort
    }
    for (const repo of config.repos ?? []) {
      const repoRoot = join(config.path, repo.dir)
      const target = join(agentDir, repo.dir)
      if (existsSync(target)) continue // reuse from a previous run
      const info = await getGitInfo(repoRoot)
      const base = repo.baseBranch || info.branch || 'HEAD'
      await addWorktree(repoRoot, target, base)
    }
    for (const entry of readdirSync(config.path)) {
      if (entry === AGENTS_DIR || entry === WORKTREES_DIR || entry === '.git') continue
      if (entry === '.DS_Store') continue
      if ((config.repos ?? []).some((r) => r.dir === entry)) continue
      const link = join(agentDir, entry)
      if (existsSync(link)) continue
      try {
        symlinkSync(join(config.path, entry), link)
      } catch {
        // broken/duplicate symlink — non-fatal
      }
    }
  }

  private spawnPane(
    config: WorkspaceConfig,
    pane: { id: string; kind: AgentKind },
    placement: PanePlacement,
    resume: boolean,
    mainBranch: string | null,
    panes: Map<string, PaneRuntime>
  ): void {
    const cwd = placement.worktreeDir
      ? join(config.path, placement.worktreeDir)
      : config.path
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
      branch: placement.branch ?? mainBranch,
      status: 'running'
    })
  }

  /** After a pty host crash: respawn every pane that was running, resuming agents. */
  private respawnAllRunning(): void {
    for (const [workspaceId, panes] of this.runtime) {
      const config = this.store.getWorkspace(workspaceId)
      if (!config) continue
      const placements = planPlacements(config)
      for (let i = 0; i < config.panes.length; i++) {
        const pane = config.panes[i]
        const existing = panes.get(pane.id)
        if (existing?.status !== 'running') continue
        this.spawnPane(config, pane, placements[i], true, existing.branch, panes)
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

    const isAgent = kind === 'claude' || kind === 'codex'
    const multi = (config.repos?.length ?? 0) > 0
    let placement: PanePlacement = { paneId: pane.id, worktreeDir: null, branch: null }
    if (config.useWorktrees && isAgent && multi) {
      let index = config.panes.length - 1
      let dir = `${AGENTS_DIR}/${callsign(index)}`
      while (existsSync(join(config.path, dir))) {
        dir = `${AGENTS_DIR}/${callsign(++index)}`
      }
      placement = { paneId: pane.id, worktreeDir: dir, branch: null }
      await this.createAgentMirror(config, placement)
    } else if (config.useWorktrees && isAgent) {
      let index = config.panes.length - 1
      let spec = worktreeSpec(index)
      while (existsSync(join(config.path, spec.worktreeDir))) {
        spec = worktreeSpec(++index)
      }
      placement = { paneId: pane.id, ...spec, branch: null }
      const info = await getGitInfo(config.path)
      const base = config.baseBranch || info.branch || 'HEAD'
      await addWorktree(config.path, placement.worktreeDir!, base)
    }

    const info = await getGitInfo(config.path)
    this.spawnPane(config, pane, placement, false, info.branch, panes)
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
    const index = config.panes.findIndex((p) => p.id === paneId)
    if (index < 0) return
    const placements = planPlacements(config)
    this.spawnPane(config, config.panes[index], placements[index], true, runtime.branch, panes)
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

  /**
   * Changes grouped by checkout: the main repo(s) plus every agent worktree.
   * All checkouts are queried in parallel and empty ones are dropped —
   * a multi-repo workspace with several mirrors spawns dozens of git calls.
   */
  async gitChanges(id: string): Promise<ChangeGroup[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const placements = planPlacements(config)
    const callsignOf = (dir: string): string => dir.split('/').pop() ?? dir
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

    if ((config.repos?.length ?? 0) > 0) {
      const infos = await Promise.all(
        config.repos!.map((repo) => getGitInfo(join(config.path, repo.dir)))
      )
      config.repos!.forEach((repo, i) => {
        job(
          repo.dir,
          `${repo.dir} — main`,
          infos[i].branch,
          null,
          join(config.path, repo.dir)
        )
      })
      for (const placement of placements) {
        if (!placement.worktreeDir) continue
        config.repos!.forEach((repo, i) => {
          const dir = `${placement.worktreeDir}/${repo.dir}`
          const abs = join(config.path, dir)
          if (!existsSync(abs)) return
          const base = repo.baseBranch || infos[i].branch
          job(
            dir,
            `${callsignOf(placement.worktreeDir!)} · ${repo.dir}`,
            base ? `detached @ ${base}` : null,
            base,
            abs
          )
        })
      }
      return (await Promise.all(jobs)).filter((g): g is ChangeGroup => g !== null)
    }

    const rootInfo = await getGitInfo(config.path)
    const embeddedDirs: string[] = []
    if (rootInfo.isRepo) {
      try {
        for (const entry of readdirSync(config.path, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (entry.name === WORKTREES_DIR || entry.name === AGENTS_DIR) continue
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
    }
    for (const placement of placements) {
      if (!placement.worktreeDir) continue
      const abs = join(config.path, placement.worktreeDir)
      if (!existsSync(abs)) continue
      const base = config.baseBranch || rootInfo.branch
      job(
        placement.worktreeDir,
        callsignOf(placement.worktreeDir),
        base ? `detached @ ${base}` : null,
        base,
        abs
      )
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

  async dirtyWorktrees(id: string): Promise<string[]> {
    const config = this.store.getWorkspace(id)
    if (!config) return []
    const multi = (config.repos?.length ?? 0) > 0
    const dirty: string[] = []
    for (const placement of planPlacements(config)) {
      if (!placement.worktreeDir) continue
      if (multi) {
        for (const repo of config.repos ?? []) {
          const dir = join(config.path, placement.worktreeDir, repo.dir)
          if (existsSync(dir) && (await isDirty(dir))) {
            dirty.push(`${placement.worktreeDir}/${repo.dir}`)
          }
        }
      } else {
        const dir = join(config.path, placement.worktreeDir)
        if (existsSync(dir) && (await isDirty(dir))) dirty.push(placement.worktreeDir)
      }
    }
    return dirty
  }

  async close(id: string, options: { removeWorktrees: boolean }): Promise<void> {
    const config = this.store.getWorkspace(id)
    const panes = this.runtime.get(id)
    if (panes) {
      for (const pane of panes.values()) {
        if (pane.status === 'running') this.ptyHost.send({ type: 'kill', ptyId: pane.ptyId })
      }
      this.runtime.delete(id)
    }
    if (config) {
      if (options.removeWorktrees && config.useWorktrees) {
        const multi = (config.repos?.length ?? 0) > 0
        for (const placement of planPlacements(config)) {
          if (!placement.worktreeDir) continue
          const dir = join(config.path, placement.worktreeDir)
          if (!existsSync(dir)) continue
          if (multi) {
            for (const repo of config.repos ?? []) {
              const target = join(dir, repo.dir)
              if (existsSync(target)) {
                await removeWorktree(join(config.path, repo.dir), target).catch(() => {})
              }
            }
            // remove leftover symlinks and the mirror folder itself
            rmSync(dir, { recursive: true, force: true })
          } else {
            await removeWorktree(config.path, placement.worktreeDir).catch(() => {})
          }
        }
        if (multi) {
          for (const repo of config.repos ?? []) {
            await pruneWorktrees(join(config.path, repo.dir))
          }
          rmSync(join(config.path, AGENTS_DIR), { recursive: true, force: true })
        } else {
          await pruneWorktrees(config.path)
        }
      }
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
      await this.close(id, { removeWorktrees: false })
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

  async deleteWorkspace(id: string, removeWorktrees: boolean): Promise<void> {
    await this.close(id, { removeWorktrees })
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

  private findPaneByPtyId(ptyId: string): PaneRuntime | null {
    for (const panes of this.runtime.values()) {
      for (const pane of panes.values()) {
        if (pane.ptyId === ptyId) return pane
      }
    }
    return null
  }
}
