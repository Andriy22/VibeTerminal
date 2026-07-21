import { execFile } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { AgentUsage, UsageSnapshot } from '../shared/types'

const execFileAsync = promisify(execFile)

/** Accepts 0-1 fractions or 0-100 percentages; returns rounded 0-100. */
function pct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const percent = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(percent)))
}

async function claudeAccessToken(): Promise<string | null> {
  try {
    const file = join(homedir(), '.claude', '.credentials.json')
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const token = raw?.claudeAiOauth?.accessToken
      if (typeof token === 'string' && token) return token
    }
  } catch {
    // fall through to keychain
  }
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-s',
      'Claude Code-credentials',
      '-w'
    ])
    const raw = JSON.parse(stdout.trim())
    const token = raw?.claudeAiOauth?.accessToken
    return typeof token === 'string' && token ? token : null
  } catch {
    return null
  }
}

/** Claude Code subscription rate limits via the OAuth usage endpoint. */
async function getClaudeUsage(): Promise<AgentUsage | null> {
  const token = await claudeAccessToken()
  if (!token) return null
  try {
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20'
      },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, { utilization?: number; resets_at?: string }>
    const five = data.five_hour
    const week = data.seven_day
    const primary = pct(five?.utilization)
    const secondary = pct(week?.utilization)
    if (primary === null && secondary === null) return null
    return {
      primary,
      secondary,
      primaryResetsAt: toIso(five?.resets_at),
      secondaryResetsAt: toIso(week?.resets_at),
      source: 'live'
    }
  } catch {
    return null
  }
}

function newestFile(dir: string, depth: number): { path: string; mtime: number } | null {
  let best: { path: string; mtime: number } | null = null
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of entries) {
    const full = join(dir, name)
    try {
      const stat = statSync(full)
      if (stat.isDirectory() && depth > 0) {
        const sub = newestFile(full, depth - 1)
        if (sub && (!best || sub.mtime > best.mtime)) best = sub
      } else if (stat.isFile() && name.endsWith('.jsonl')) {
        if (!best || stat.mtimeMs > best.mtime) best = { path: full, mtime: stat.mtimeMs }
      }
    } catch {
      // ignore unreadable entries
    }
  }
  return best
}

interface CodexAuth {
  accessToken: string
  accountId: string
}

function codexAuth(): CodexAuth | null {
  try {
    const raw = JSON.parse(
      readFileSync(join(homedir(), '.codex', 'auth.json'), 'utf8')
    )
    const accessToken = raw?.tokens?.access_token
    const accountId = raw?.tokens?.account_id
    if (typeof accessToken === 'string' && typeof accountId === 'string') {
      return { accessToken, accountId }
    }
  } catch {
    // not logged into codex
  }
  return null
}

interface CodexUsageWindow {
  used_percent?: number
  limit_window_seconds?: number
  reset_at?: number
}

/** Live codex rate limits from the same backend endpoint the codex CLI uses. */
async function getCodexUsageLive(): Promise<AgentUsage | null> {
  const auth = codexAuth()
  if (!auth) return null
  try {
    const res = await fetch('https://chatgpt.com/backend-api/codex/usage', {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'chatgpt-account-id': auth.accountId,
        originator: 'codex_cli_rs',
        'User-Agent': 'codex_cli_rs (vibeterminal)'
      },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      plan_type?: string
      rate_limit?: {
        primary_window?: CodexUsageWindow | null
        secondary_window?: CodexUsageWindow | null
      }
    }
    const usage: AgentUsage = {
      primary: null,
      secondary: null,
      primaryResetsAt: null,
      secondaryResetsAt: null,
      planType: typeof data.plan_type === 'string' ? data.plan_type : null,
      source: 'live'
    }
    const windows = [data.rate_limit?.primary_window, data.rate_limit?.secondary_window]
    for (const window of windows) {
      if (!window) continue
      const used = pct(window.used_percent)
      if (used === null) continue
      const seconds =
        typeof window.limit_window_seconds === 'number'
          ? window.limit_window_seconds
          : 604800
      const reset = toIso(window.reset_at)
      if (seconds > 86400) {
        if (usage.secondary === null) {
          usage.secondary = used
          usage.secondaryResetsAt = reset
        }
      } else if (usage.primary === null) {
        usage.primary = used
        usage.primaryResetsAt = reset
      }
    }
    if (usage.primary === null && usage.secondary === null) return null
    return usage
  } catch {
    return null
  }
}

function toIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  if (typeof value === 'string' && value) return value
  return null
}

interface CodexWindow {
  used_percent?: number
  window_minutes?: number
  resets_at?: number | string
}

/**
 * Codex writes rate_limits snapshots into its session logs; read the latest.
 * Windows are classified by window_minutes (≤ 1 day → short slot, else
 * weekly) — codex plans have changed window setups over time, e.g. dropping
 * the 5h window and keeping only the weekly one.
 */
function getCodexUsageFromLogs(): AgentUsage | null {
  const newest = newestFile(join(homedir(), '.codex', 'sessions'), 4)
  if (!newest) return null
  try {
    const lines = readFileSync(newest.path, 'utf8').trimEnd().split('\n')
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 200; i--) {
      if (!lines[i].includes('"rate_limits"')) continue
      const parsed = JSON.parse(lines[i])
      const limits = parsed?.payload?.rate_limits ?? parsed?.rate_limits
      if (!limits) continue

      const usage: AgentUsage = {
        primary: null,
        secondary: null,
        primaryResetsAt: null,
        secondaryResetsAt: null,
        planType: typeof limits.plan_type === 'string' ? limits.plan_type : null,
        asOf: toIso(parsed?.timestamp) ?? new Date(newest.mtime).toISOString(),
        source: 'session-log'
      }
      const windows: (CodexWindow | null | undefined)[] = [limits.primary, limits.secondary]
      for (let idx = 0; idx < windows.length; idx++) {
        const window = windows[idx]
        if (!window) continue
        const used = pct(window.used_percent)
        if (used === null) continue
        // Legacy snapshots without window_minutes: primary was 5h, secondary weekly.
        const minutes =
          typeof window.window_minutes === 'number'
            ? window.window_minutes
            : idx === 0
              ? 300
              : 10080
        const reset = toIso(window.resets_at)
        if (minutes > 1440) {
          if (usage.secondary === null) {
            usage.secondary = used
            usage.secondaryResetsAt = reset
          }
        } else if (usage.primary === null) {
          usage.primary = used
          usage.primaryResetsAt = reset
        }
      }
      if (usage.primary === null && usage.secondary === null) continue
      return usage
    }
  } catch {
    // unreadable/corrupt session file
  }
  return null
}

export async function getUsage(): Promise<UsageSnapshot> {
  const [claude, firstTry] = await Promise.all([getClaudeUsage(), getCodexUsageLive()])
  let codex = firstTry
  // A logged-in codex whose live fetch failed is usually a just-expired token
  // (the CLI refreshes it moments after launch) — retry once before falling
  // back to stale session logs.
  if (!codex && codexAuth()) {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    codex = await getCodexUsageLive()
  }
  return { claude, codex: codex ?? getCodexUsageFromLogs() }
}
