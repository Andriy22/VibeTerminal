import { app } from 'electron'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { WorkspaceConfig } from '../shared/types'

const execFileAsync = promisify(execFile)

export interface MemoryScope {
  key: string
  label: string
}

export interface WorkspaceMemory {
  scopes: MemoryScope[]
  writeScope: string
}

export function memoryRoot(): string {
  const root = join(app.getPath('userData'), 'memory')
  mkdirSync(root, { recursive: true })
  return root
}

function hash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12)
}

async function tryGit(cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * Stable repo identity: normalized origin URL, else root-commit hash, else
 * path. Follows the repo across clones, moves, and worktrees.
 */
async function repoKey(repoPath: string): Promise<string> {
  const remote = await tryGit(repoPath, 'config', '--get', 'remote.origin.url')
  if (remote) {
    const normalized = remote
      .toLowerCase()
      .replace(/^[a-z+]+:\/\//, '')
      .replace(/^[^@]*@/, '')
      .replace(':', '/')
      .replace(/\.git\/?$/, '')
      .replace(/\/+$/, '')
    return `repo-${hash(normalized)}`
  }
  const roots = await tryGit(repoPath, 'rev-list', '--max-parents=0', 'HEAD')
  if (roots) {
    const first = roots.split('\n').pop()!.trim()
    return `repo-${hash(first)}`
  }
  return `repo-p${hash(repoPath)}`
}

interface GroupMeta {
  name: string
  path: string
  members: string[]
}

/** Group scopes whose membership includes any of the given repo keys. */
function matchingGroups(root: string, repoKeys: string[]): MemoryScope[] {
  const matches: MemoryScope[] = []
  try {
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('group-')) continue
      const metaFile = join(root, entry, 'meta.json')
      if (!existsSync(metaFile)) continue
      try {
        const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as GroupMeta
        if (meta.members?.some((m) => repoKeys.includes(m))) {
          matches.push({ key: entry, label: `${meta.name} (project)` })
        }
      } catch {
        // corrupt meta — skip
      }
    }
  } catch {
    // no memory root yet
  }
  return matches
}

export async function resolveWorkspaceMemory(
  config: WorkspaceConfig
): Promise<WorkspaceMemory> {
  const root = memoryRoot()
  const scopes: MemoryScope[] = []
  const repoKeys: string[] = []

  if ((config.repos?.length ?? 0) > 0) {
    for (const repo of config.repos!) {
      const key = await repoKey(join(config.path, repo.dir))
      repoKeys.push(key)
      scopes.push({ key, label: repo.dir })
    }
    const groupKey = `group-${hash(config.path)}`
    const groupDir = join(root, groupKey)
    mkdirSync(groupDir, { recursive: true })
    const meta: GroupMeta = {
      name: config.path.split('/').pop() || config.path,
      path: config.path,
      members: repoKeys
    }
    writeFileSync(join(groupDir, 'meta.json'), JSON.stringify(meta, null, 2))
    scopes.push({ key: groupKey, label: `${meta.name} (project)` })
    // cross-repo knowledge is the default for multi-repo workspaces
    return { scopes, writeScope: groupKey }
  }

  const key = await repoKey(config.path)
  repoKeys.push(key)
  scopes.push({ key, label: config.path.split('/').pop() || config.path })
  for (const group of matchingGroups(root, repoKeys)) {
    if (!scopes.some((s) => s.key === group.key)) scopes.push(group)
  }
  return { scopes, writeScope: key }
}

export interface MemoryLaunchArgs {
  claude: string
  codex: string
}

/**
 * Build per-agent CLI additions that connect the vibememory MCP server.
 * The server runs on Electron's own binary in Node mode.
 */
export function memoryLaunchArgs(
  workspaceId: string,
  memory: WorkspaceMemory
): MemoryLaunchArgs {
  const root = memoryRoot()
  const serverPath = join(__dirname, 'mcpMemory.js')
  const env = {
    ELECTRON_RUN_AS_NODE: '1',
    VIBE_MEMORY_ROOT: root,
    VIBE_MEMORY_SCOPES: memory.scopes.map((s) => s.key).join(','),
    VIBE_MEMORY_LABELS: memory.scopes.map((s) => s.label.replace(/,/g, ' ')).join(','),
    VIBE_MEMORY_WRITE: memory.writeScope
  }

  const mcpDir = join(app.getPath('userData'), 'mcp')
  mkdirSync(mcpDir, { recursive: true })
  const configPath = join(mcpDir, `${workspaceId}.json`)
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        mcpServers: {
          vibememory: { command: process.execPath, args: [serverPath], env }
        }
      },
      null,
      2
    )
  )

  const codexEnvTable = Object.entries(env)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ')
  const codex =
    `-c 'mcp_servers.vibememory.command="${process.execPath}"' ` +
    `-c 'mcp_servers.vibememory.args=["${serverPath}"]' ` +
    `-c 'mcp_servers.vibememory.env={${codexEnvTable}}'`

  // Forced awareness: tool availability alone is too easy to ignore.
  const prompt =
    'This project has persistent memory shared by all agents: the vibememory MCP tools. ' +
    'ALWAYS call memory_search (or memory_list) before starting significant work, and save durable ' +
    'learnings, decisions and gotchas with memory_write when you finish. The vibeterminal-memory ' +
    'skill has the full protocol.'

  return {
    claude: `--mcp-config "${configPath}" --append-system-prompt "${prompt}"`,
    codex
  }
}

export const SKILL_VERSION_EXPORT = 'v3'

/** Dropped into multi-repo mirror roots (not a git repo, so invisible to git). */
export const MIRROR_AGENTS_MD = `<!-- managed by VibeTerminal v3 -->
# Agent workspace

This folder is your isolated mirror: each subdirectory is a detached git
worktree of a real repo. Work normally; create a branch before finishing
so your commits are kept.

## Project memory — use it
This project has persistent memory shared by all agents via the vibememory
MCP tools. ALWAYS \`memory_search\` before significant work; save durable
learnings with \`memory_write\` when done. One fact per note; link with
[[note-id]] using ids the tools return.
`

const SKILL_VERSION = 'v3'
const MEMORY_GUIDE = `This project has persistent memory shared by all agents across sessions,
exposed through the vibememory MCP tools.

## When starting work
Call \`memory_search\` (or \`memory_list\` for an overview) with keywords from
the task before making significant changes — prior decisions, gotchas, and
architecture notes may already exist.

## When finishing work
If you learned something durable — a decision and its why, a gotcha, how a
subsystem actually works — save it with \`memory_write\`:
- One fact per note, with a specific title.
- IDs get a random suffix, so NEVER guess a [[note-id]] link: write the
  target note first, then reference the id the tool returned.
- To revise a note, pass its id to \`memory_write\` (updates in place —
  do not create duplicates). Delete obsolete or duplicate notes with
  \`memory_delete\`.
- Repo-specific facts → that repo's scope; cross-repo facts → the project scope.

Do not save things obvious from the code itself, transient state, or secrets.`

const SKILL_BODY = `---
name: vibeterminal-memory
description: MUST use at the start of any coding session where vibememory MCP tools are available (memory_search/memory_write in the tool list) - the project has a persistent memory graph shared by all agents. Search memory before starting ANY significant task; save durable learnings after finishing them.
---
<!-- managed by VibeTerminal ${SKILL_VERSION} -->

# VibeTerminal project memory

${MEMORY_GUIDE}
`

const CODEX_START = '<!-- vibeterminal-memory:start'
const CODEX_END = '<!-- vibeterminal-memory:end -->'
const CODEX_BLOCK = `${CODEX_START} ${SKILL_VERSION} -->
# VibeTerminal project memory (when vibememory MCP tools are available)

${MEMORY_GUIDE}
${CODEX_END}`

/** Teach both agents about memory: claude via a skill, codex via global AGENTS.md. */
export function installMemoryInstructions(): void {
  try {
    const dir = join(homedir(), '.claude', 'skills', 'vibeterminal-memory')
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file) || !readFileSync(file, 'utf8').includes(`VibeTerminal ${SKILL_VERSION}`)) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, SKILL_BODY)
    }
  } catch {
    // best-effort
  }
  try {
    const codexDir = join(homedir(), '.codex')
    if (existsSync(codexDir)) {
      const file = join(codexDir, 'AGENTS.md')
      const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
      if (!current.includes(`${CODEX_START} ${SKILL_VERSION}`)) {
        const startIdx = current.indexOf(CODEX_START)
        const endIdx = current.indexOf(CODEX_END)
        const cleaned =
          startIdx >= 0 && endIdx >= 0
            ? current.slice(0, startIdx) + current.slice(endIdx + CODEX_END.length)
            : current
        writeFileSync(file, `${cleaned.trimEnd()}\n\n${CODEX_BLOCK}\n`)
      }
    }
  } catch {
    // best-effort
  }
}
