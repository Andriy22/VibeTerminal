import type { PtyInMessage, PtyOutMessage } from '@shared/types'
import { useApp } from './store'

type DataListener = (data: string) => void
type ExitListener = (exitCode: number) => void
type ProcListener = (name: string) => void

const HISTORY_LIMIT = 512 * 1024 // per pty, characters

/**
 * Owns the MessagePort to the pty host. Terminal panes subscribe by ptyId.
 * All output is kept in a per-pty rolling history and replayed on subscribe,
 * so panes that (re)mount after output arrived still render it.
 */
class PtyBridge {
  private port: MessagePort | null = null
  private dataListeners = new Map<string, DataListener>()
  private exitListeners = new Map<string, ExitListener>()
  private procListeners = new Map<string, ProcListener>()
  private procCache = new Map<string, string>()
  private history = new Map<string, { chunks: string[]; size: number }>()
  private activity = new Map<string, { last: number; bell: boolean; inOsc: boolean }>()

  /**
   * True only for REAL bells: OSC sequences (title updates etc.) are
   * terminated by BEL, and TUIs emit them constantly while working — those
   * must not count. Tracks OSC state across chunk boundaries.
   */
  private scanBell(info: { inOsc: boolean }, data: string): boolean {
    let bell = false
    for (let i = 0; i < data.length; i++) {
      const ch = data[i]
      if (info.inOsc) {
        if (ch === '\x07') info.inOsc = false
        else if (ch === '\x1b' && data[i + 1] === '\\') {
          info.inOsc = false
          i++
        }
      } else if (ch === '\x1b' && data[i + 1] === ']') {
        info.inOsc = true
        i++
      } else if (ch === '\x07') {
        bell = true
      }
    }
    return bell
  }
  private initialized = false

  init(): void {
    if (this.initialized) return
    this.initialized = true
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'vibeterminal:pty-port' && event.ports[0]) {
        this.adoptPort(event.ports[0])
      }
    })
    void window.vibe.requestPtyPort()

    // Activity states: streaming output = working; a bell since the user's
    // last keystroke = the agent wants attention; otherwise idle.
    window.setInterval(() => {
      const now = Date.now()
      const app = useApp.getState()
      for (const [ptyId, info] of this.activity) {
        // Streaming output always reads as working — a completion bell only
        // becomes "needs input" once the agent has actually gone quiet.
        const state =
          now - info.last < 2500 ? 'working' : info.bell ? 'attention' : 'idle'
        app.setPaneActivity(ptyId, state)
      }
    }, 1000)
  }

  private adoptPort(port: MessagePort): void {
    this.port?.close()
    this.port = port
    port.onmessage = (event: MessageEvent<PtyOutMessage>) => {
      const msg = event.data
      if (msg.type === 'data') {
        this.record(msg.ptyId, msg.data)
        const info =
          this.activity.get(msg.ptyId) ?? { last: 0, bell: false, inOsc: false }
        info.last = Date.now()
        if (this.scanBell(info, msg.data)) info.bell = true
        this.activity.set(msg.ptyId, info)
        this.dataListeners.get(msg.ptyId)?.(msg.data)
      } else if (msg.type === 'exit') {
        this.exitListeners.get(msg.ptyId)?.(msg.exitCode)
      } else if (msg.type === 'proc') {
        this.procCache.set(msg.ptyId, msg.name)
        this.procListeners.get(msg.ptyId)?.(msg.name)
        useApp.getState().setPaneProc(msg.ptyId, msg.name)
      }
    }
    port.start?.()
  }

  private record(ptyId: string, data: string): void {
    let entry = this.history.get(ptyId)
    if (!entry) {
      entry = { chunks: [], size: 0 }
      this.history.set(ptyId, entry)
    }
    entry.chunks.push(data)
    entry.size += data.length
    while (entry.size > HISTORY_LIMIT && entry.chunks.length > 1) {
      entry.size -= entry.chunks[0].length
      entry.chunks.shift()
    }
  }

  hasHistory(ptyId: string): boolean {
    return (this.history.get(ptyId)?.size ?? 0) > 0
  }

  subscribe(
    ptyId: string,
    onData: DataListener,
    onExit: ExitListener,
    onProc?: ProcListener
  ): () => void {
    this.dataListeners.set(ptyId, onData)
    this.exitListeners.set(ptyId, onExit)
    if (onProc) {
      this.procListeners.set(ptyId, onProc)
      const cached = this.procCache.get(ptyId)
      if (cached) onProc(cached)
    }
    const entry = this.history.get(ptyId)
    if (entry) for (const chunk of entry.chunks) onData(chunk)
    return () => {
      if (this.dataListeners.get(ptyId) === onData) this.dataListeners.delete(ptyId)
      if (this.exitListeners.get(ptyId) === onExit) this.exitListeners.delete(ptyId)
      if (onProc && this.procListeners.get(ptyId) === onProc) {
        this.procListeners.delete(ptyId)
      }
    }
  }

  /** Drop history for ptys that no longer exist (e.g. removed panes). */
  forget(ptyId: string): void {
    this.history.delete(ptyId)
  }

  private send(msg: PtyInMessage): void {
    this.port?.postMessage(msg)
  }

  write(ptyId: string, data: string): void {
    const info = this.activity.get(ptyId)
    if (info) info.bell = false // user responded — attention satisfied
    this.send({ type: 'write', ptyId, data })
  }

  resize(ptyId: string, cols: number, rows: number): void {
    this.send({ type: 'resize', ptyId, cols, rows })
  }

  /** Nudge the pty with a double SIGWINCH so full-screen TUIs repaint. */
  kick(ptyId: string): void {
    this.send({ type: 'kick', ptyId })
  }
}

export const ptyBridge = new PtyBridge()
