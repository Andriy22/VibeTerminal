import { useEffect, useState } from 'react'
import type { AgentKind, AgentUsage, UsageDisplay, UsageSnapshot } from '@shared/types'
import { useApp } from '../store'
import { effectiveColor } from '@shared/colors'
import { KIND_META, KIND_CYCLE } from '../kinds'
import TerminalGrid from './TerminalGrid'
import MicButton from './MicButton'
import Icon from './Icon'
import Segmented from './Segmented'
import FilesView from './FilesView'
import DiffView from './DiffView'

const USAGE_POLL_MS = 5 * 60 * 1000

function formatAge(iso: string | null | undefined): string | null {
  if (!iso) return null
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return null
  const mins = Math.round((Date.now() - time) / 60000)
  if (mins < 10) return null
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatReset(iso: string | null | undefined, withDay: boolean): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const absolute = date.toLocaleString([], {
    ...(withDay ? { weekday: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit'
  })
  const minutes = Math.round((date.getTime() - Date.now()) / 60000)
  if (minutes <= 0) return absolute
  const relative =
    minutes < 60
      ? `${minutes}m`
      : minutes < 48 * 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${Math.round(minutes / (24 * 60))}d`
  return `${absolute} (in ${relative})`
}

function UsageMeter({
  kind,
  usage,
  mode
}: {
  kind: AgentKind
  usage: AgentUsage
  mode: UsageDisplay
}): JSX.Element | null {
  const meta = KIND_META[kind]
  const windows: { label: string; value: number }[] = []
  if (mode !== 'week' && usage.primary !== null)
    windows.push({ label: '5h', value: usage.primary })
  if (mode !== 'five_hour' && usage.secondary !== null)
    windows.push({ label: 'wk', value: usage.secondary })
  // The preferred window doesn't exist for this agent — show what does exist
  // instead of hiding the meter (e.g. codex plans with only a weekly limit).
  if (windows.length === 0) {
    if (usage.primary !== null) windows.push({ label: '5h', value: usage.primary })
    else if (usage.secondary !== null)
      windows.push({ label: 'wk', value: usage.secondary })
    else return null
  }
  const worst = Math.max(...windows.map((w) => w.value))
  const level = worst >= 80 ? 'danger' : worst >= 50 ? 'warn' : ''
  const primaryReset = formatReset(usage.primaryResetsAt, false)
  const secondaryReset = formatReset(usage.secondaryResetsAt, true)
  const age = formatAge(usage.asOf)
  return (
    <span className={`usage-meter ${level} ${usage.source === 'session-log' ? 'stale' : ''}`}>
      <span className="meter-glyph" style={{ color: meta.color }}>
        {meta.symbol}
      </span>
      <span className="meter-bars">
        {windows.map((w) => {
          const barLevel = w.value >= 80 ? 'danger' : w.value >= 50 ? 'warn' : 'ok'
          return (
            <span key={w.label} className="meter-bar">
              <span
                className={`meter-fill ${barLevel}`}
                style={{ width: `${Math.max(4, Math.min(100, w.value))}%` }}
              />
            </span>
          )
        })}
      </span>
      <span className="meter-value">{worst}%</span>
      <span className="usage-tooltip">
        <strong>{meta.label} usage limits</strong>
        {usage.primary !== null && (
          <span>
            5-hour session: {usage.primary}%{primaryReset ? ` · resets ${primaryReset}` : ''}
          </span>
        )}
        {usage.secondary !== null && (
          <span>
            weekly limit: {usage.secondary}%
            {secondaryReset ? ` · resets ${secondaryReset}` : ''}
          </span>
        )}
        {usage.planType && <span>plan: {usage.planType}</span>}
        <span className="usage-source">
          {usage.source === 'live'
            ? `live from your ${meta.label} account`
            : `stale — from the last ${meta.label} run${age ? ` · ${age}` : ''}`}
        </span>
      </span>
    </span>
  )
}

export default function WorkspaceView(): JSX.Element {
  const snapshot = useApp((s) => s.snapshot)
  const activeId = useApp((s) => s.activeId)
  const toast = useApp((s) => s.toast)
  const openLauncher = useApp((s) => s.openLauncher)
  const usageMode = useApp((s) => s.settings?.usageDisplay ?? 'both')
  const memoryEnabled = useApp((s) => s.settings?.memoryEnabled ?? true)
  const view = useApp((s) => s.workspaceView)
  const setView = useApp((s) => s.setWorkspaceView)
  const [addOpen, setAddOpen] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [usage, setUsage] = useState<UsageSnapshot | null>(null)

  useEffect(() => {
    let alive = true
    let retryTimer = 0
    let retries = 0
    const load = (): void => {
      void window.vibe.getUsage().then((u) => {
        if (!alive) return
        setUsage(u)
        // Stale (session-log) data usually means an agent is still refreshing
        // its token — re-poll quickly instead of waiting the full interval.
        const stale =
          u.codex?.source === 'session-log' || (u.claude && u.claude.source !== 'live')
        if (stale && retries < 5) {
          retries++
          retryTimer = window.setTimeout(load, 20_000)
        } else if (!stale) {
          retries = 0
        }
      })
    }
    load()
    const timer = window.setInterval(load, USAGE_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.clearTimeout(retryTimer)
    }
  }, [])

  const running = snapshot.filter((w) => w.running)
  const active = snapshot.find((w) => w.config.id === activeId)

  const addPane = async (kind: AgentKind): Promise<void> => {
    setAddOpen(false)
    if (!active) return
    try {
      await window.vibe.addPane(active.config.id, kind)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  return (
    <div className="workspace-view">
      <header className="topbar">
        <div className="topbar-title">
          {active ? (
            <>
              <span
                className="topbar-color"
                style={{
                  background: effectiveColor(active.config, useApp.getState().groupColors)
                }}
              />
              <span className="topbar-name">{active.config.name}</span>
              {active.config.yolo && (
                <span className="yolo-badge" title="YOLO mode — agents run without permission prompts">
                  YOLO
                </span>
              )}
              <span className="topbar-path">
                {active.config.path.replace(/^\/Users\/[^/]+/, '~')}
              </span>
            </>
          ) : (
            <span className="topbar-name dim">VibeTerminal</span>
          )}
        </div>
        {active && (
          <div className="view-switch">
            <Segmented
              options={[
                { value: 'term' as const, label: 'Terminals' },
                { value: 'files' as const, label: 'Files' },
                { value: 'diff' as const, label: 'Changes' }
              ]}
              value={view}
              onChange={setView}
            />
          </div>
        )}
        <div className="topbar-actions">
          {usage?.claude && (
            <UsageMeter kind="claude" usage={usage.claude} mode={usageMode} />
          )}
          {usage?.codex && (
            <UsageMeter kind="codex" usage={usage.codex} mode={usageMode} />
          )}
          {(usage?.claude || usage?.codex) && active && <span className="topbar-sep" />}
          <button
            className="tool-button"
            title="Feature tour"
            onClick={() => useApp.getState().openOnboarding(true)}
          >
            <Icon name="info" />
          </button>
          {active && memoryEnabled && (
            <button
              className="tool-button"
              title="Project memory — notes agents saved via MCP"
              onClick={() => useApp.getState().openMemory(true)}
            >
              <Icon name="memory" />
            </button>
          )}
          {active?.running && <MicButton />}
          {active?.running && (
            <div className="add-pane">
              <button
                className="tool-button"
                title={`Grid: ${active.config.gridCols ? `${active.config.gridCols} columns` : 'auto'}`}
                onClick={() => setGridOpen((v) => !v)}
              >
                <Icon name="grid" />
              </button>
              {gridOpen && (
                <div className="add-pane-menu">
                  {[null, 1, 2, 3, 4].map((cols) => (
                    <button
                      key={String(cols)}
                      onClick={() => {
                        setGridOpen(false)
                        void window.vibe.setGridCols(active.config.id, cols)
                      }}
                    >
                      {cols === null ? 'Auto (2-wide)' : `${cols} column${cols > 1 ? 's' : ''}`}
                      {(active.config.gridCols ?? null) === cols ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {active?.running && (
            <div className="add-pane">
              <button
                className="tool-button primary"
                title="Add pane"
                onClick={() => setAddOpen((v) => !v)}
              >
                <Icon name="plus" />
              </button>
              {addOpen && (
                <div className="add-pane-menu">
                  {KIND_CYCLE.map((kind) => (
                    <button key={kind} onClick={() => void addPane(kind)}>
                      <span style={{ color: KIND_META[kind].color }}>
                        {KIND_META[kind].symbol}
                      </span>{' '}
                      {KIND_META[kind].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="grids" style={{ display: view === 'term' ? undefined : 'none' }}>
        {running.map((w) => (
          <TerminalGrid key={w.config.id} workspace={w} visible={w.config.id === activeId} />
        ))}
        {running.length === 0 && (
          <div className="empty-state">
            <div className="empty-mark">✳ ◆ ❯</div>
            <p>No agents running.</p>
            <button className="primary-button" onClick={() => openLauncher(true)}>
              New workspace
            </button>
          </div>
        )}
      </div>
      {view === 'files' && active && <FilesView key={active.config.id} workspace={active} />}
      {view === 'diff' && active && <DiffView key={active.config.id} workspace={active} />}
    </div>
  )
}
