import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { PaneConfig, PaneRuntime } from '@shared/types'
import { callsign } from '@shared/callsigns'
import { themeById, type TerminalTheme } from '@shared/themes'
import { ptyBridge } from '../ptyBridge'
import { useApp } from '../store'
import { detectKind, KIND_META } from '../kinds'

function xtermTheme(theme: TerminalTheme): Record<string, string> {
  return {
    background: 'rgba(0, 0, 0, 0)',
    cursorAccent: theme.appearance === 'dark' ? '#0e1114' : '#ffffff',
    ...theme.colors
  }
}

interface Props {
  workspaceId: string
  pane: PaneConfig
  paneIndex: number
  runtime: PaneRuntime
  visible: boolean
  maximized: boolean
}

export default function TerminalPane({
  workspaceId,
  pane,
  paneIndex,
  runtime,
  visible,
  maximized
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef(runtime.ptyId)
  const boundPtyIdRef = useRef<string | null>(null)
  const setMaximized = useApp((s) => s.setMaximized)
  const toast = useApp((s) => s.toast)
  const themeId = useApp((s) => s.settings?.theme)
  const procName = useApp((s) => s.paneProcs[runtime.ptyId] ?? null)
  const activity = useApp((s) => s.paneActivity[runtime.ptyId] ?? 'idle')
  const isFocused = useApp(
    (s) => s.focusedPane?.paneId === pane.id && s.focusedPane?.workspaceId === workspaceId
  )
  const micState = useApp((s) => s.micState)
  const theme = themeById(themeId)

  // Header follows what is ACTUALLY running in the pty, not the launch config —
  // users exit agents, drop to the shell, or start another agent manually.
  const detected = detectKind(procName, pane.kind)
  const meta = { ...KIND_META[detected.kind], label: detected.label }

  ptyIdRef.current = runtime.ptyId

  useEffect(() => {
    const term = new Terminal({
      fontFamily:
        '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, "Cascadia Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 10000,
      allowTransparency: true,
      theme: xtermTheme(themeById(useApp.getState().settings?.theme))
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current!)
    term.onData((data) => ptyBridge.write(ptyIdRef.current, data))
    termRef.current = term
    fitRef.current = fit
    return () => {
      term.dispose()
      termRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (Re)bind the pty stream — runs again when a pane is restarted or respawned.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    if (boundPtyIdRef.current !== null && boundPtyIdRef.current !== runtime.ptyId) {
      term.writeln('\r\n\x1b[2m── session restarted ──\x1b[0m')
    }
    boundPtyIdRef.current = runtime.ptyId
    const hadHistory = ptyBridge.hasHistory(runtime.ptyId)
    const unsubscribe = ptyBridge.subscribe(
      runtime.ptyId,
      (data) => term.write(data),
      () => {}
    )
    fitAndReport()
    // Nothing to replay (e.g. the renderer reloaded): ask the TUI to repaint.
    if (!hadHistory) ptyBridge.kick(runtime.ptyId)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.ptyId])

  const fitAndReport = (): void => {
    const container = containerRef.current
    const fit = fitRef.current
    const term = termRef.current
    if (!container || !fit || !term) return
    if (container.clientWidth < 40 || container.clientHeight < 40) return
    fit.fit()
    ptyBridge.resize(ptyIdRef.current, term.cols, term.rows)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fitAndReport)
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (visible) requestAnimationFrame(fitAndReport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, maximized])

  // Live theme switching from settings.
  useEffect(() => {
    const term = termRef.current
    if (term) term.options.theme = xtermTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id])

  const remove = async (): Promise<void> => {
    try {
      await window.vibe.removePane(workspaceId, pane.id)
    } catch (error) {
      toast(String((error as Error).message ?? error))
    }
  }

  const restart = async (): Promise<void> => {
    await window.vibe.restartPane(workspaceId, pane.id)
  }

  const branchLabel = runtime.branch ?? runtime.cwd.split('/').pop() ?? ''

  return (
    <section
      className={`pane ${maximized ? 'maximized' : ''} ${isFocused ? 'focused' : ''}`}
      style={
        { borderTopColor: meta.color, '--pane-accent': meta.color } as React.CSSProperties
      }
      onMouseDown={() => {
        termRef.current?.focus()
        useApp.getState().setFocusedPane({ workspaceId, paneId: pane.id })
      }}
    >
      <header
        className="pane-header"
        onDoubleClick={() => setMaximized(maximized ? null : pane.id)}
      >
        <span
          className={`activity-dot ${activity}`}
          title={
            activity === 'working'
              ? 'Working — streaming output'
              : activity === 'attention'
                ? 'Needs your input'
                : 'Idle'
          }
        />
        <span className="pane-kind" style={{ color: meta.color }}>
          {meta.symbol} {meta.label}
        </span>
        <span className="pane-callsign">{callsign(paneIndex)}</span>
        <span className="pane-branch">{branchLabel}</span>
        <span className="pane-spacer" />
        <button
          className="pane-button"
          title={maximized ? 'Restore grid' : 'Maximize pane'}
          onClick={() => setMaximized(maximized ? null : pane.id)}
        >
          {maximized ? '⊟' : '⊞'}
        </button>
        <button className="pane-button" title="Close pane" onClick={() => void remove()}>
          ✕
        </button>
      </header>
      <div className="pane-term" ref={containerRef} />
      {isFocused && micState !== 'idle' && (
        <div className={`pane-mic ${micState}`}>
          {micState === 'recording' ? (
            <>
              <span className="rec-dot" /> recording — speak now
            </>
          ) : (
            <>
              <span className="spinner" /> transcribing…
            </>
          )}
        </div>
      )}
      {runtime.status === 'exited' && (
        <div className="pane-overlay">
          <p>
            {callsign(paneIndex)} ({meta.label}) exited{' '}
            {runtime.exitCode !== undefined ? `(code ${runtime.exitCode})` : ''}
          </p>
          <div className="pane-overlay-actions">
            <button className="primary-button" onClick={() => void restart()}>
              Restart
            </button>
            <button className="mini-button" onClick={() => void remove()}>
              Remove pane
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
