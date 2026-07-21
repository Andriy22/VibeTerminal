/**
 * PTY host — runs as an Electron utilityProcess so a crash here can't take
 * down the main process. Owns every node-pty instance.
 *
 * Channels:
 *  - process.parentPort: control messages from main (spawn/kill, init port)
 *  - rendererPort (MessagePort from main): write/resize in, data/exit out
 */
import * as pty from 'node-pty'
import { execFile } from 'child_process'
import type { MessagePortMain } from 'electron'
import type { HostControlMessage, PtyInMessage } from '../shared/types'

interface ParentPort {
  on(
    event: 'message',
    listener: (e: { data: unknown; ports: MessagePortMain[] }) => void
  ): void
  postMessage(message: unknown): void
}
const parentPort = (process as unknown as { parentPort: ParentPort }).parentPort

interface Session {
  pty: pty.IPty
  initialCommand: string | null
  commandSent: boolean
  shellReady: boolean
  resized: boolean
  fallbackElapsed: boolean
  lastProc: string
  tty: string | null
}

/**
 * Type the agent command only once the shell has printed its prompt AND the
 * pane has applied its real size (or a fallback timeout passed). Writing
 * before the resize makes the shell re-echo the command over itself.
 */
function maybeRunCommand(session: Session): void {
  if (session.commandSent || !session.initialCommand || !session.shellReady) return
  if (!session.resized && !session.fallbackElapsed) return
  session.commandSent = true
  const command = session.initialCommand
  setTimeout(() => {
    try {
      session.pty.write(command + '\r')
    } catch {
      // pty exited before the command could be sent
    }
  }, 120)
}

const sessions = new Map<string, Session>()
let rendererPort: MessagePortMain | null = null

function sendToRenderer(message: unknown): void {
  rendererPort?.postMessage(message)
}

/**
 * What's really running in a pane. The foreground process name alone lies:
 * Claude Code retitles itself to its version string and codex's node MCP
 * children can hold the foreground — so scan every command on the pane's
 * tty and look for the agents anywhere in that list.
 */
setInterval(() => {
  for (const [ptyId, session] of sessions) {
    if (!session.tty) {
      // spawn-time resolution can race shell startup — keep retrying, and
      // report the foreground name meanwhile so the header is never stuck
      execFile('ps', ['-o', 'tty=', '-p', String(session.pty.pid)], (error, stdout) => {
        if (error || !sessions.has(ptyId)) return
        const tty = stdout.trim()
        if (tty && tty !== '??') session.tty = tty
      })
      try {
        const name = session.pty.process
        if (name && name !== session.lastProc) {
          session.lastProc = name
          sendToRenderer({ type: 'proc', ptyId, name })
        }
      } catch {
        // pty mid-exit
      }
      continue
    }
    execFile('ps', ['-t', session.tty, '-o', 'command='], (error, stdout) => {
      if (!sessions.has(ptyId)) return
      let name = ''
      if (!error) {
        const commands = stdout.toLowerCase()
        if (/(^|[/\s])codex([\s]|$)/m.test(commands)) name = 'codex'
        else if (/(^|[/\s])claude([\s]|$)/m.test(commands)) name = 'claude'
      }
      if (!name) {
        try {
          name = session.pty.process || 'shell'
        } catch {
          return
        }
      }
      if (name && name !== session.lastProc) {
        session.lastProc = name
        sendToRenderer({ type: 'proc', ptyId, name })
      }
    })
  }
}, 2500)

function spawn(msg: Extract<HostControlMessage, { type: 'spawn' }>): void {
  const proc = pty.spawn(msg.shell, msg.args, {
    name: 'xterm-256color',
    cols: msg.cols,
    rows: msg.rows,
    cwd: msg.cwd,
    env: msg.env
  })

  const session: Session = {
    pty: proc,
    initialCommand: msg.initialCommand,
    commandSent: false,
    shellReady: false,
    resized: false,
    fallbackElapsed: false,
    lastProc: '',
    tty: null
  }
  sessions.set(msg.ptyId, session)

  // Resolve the pane's controlling tty once — the poll scans processes on it.
  execFile('ps', ['-o', 'tty=', '-p', String(proc.pid)], (error, stdout) => {
    if (!error && sessions.has(msg.ptyId)) {
      const tty = stdout.trim()
      if (tty && tty !== '??') session.tty = tty
    }
  })

  proc.onData((data) => {
    if (!session.shellReady) {
      session.shellReady = true
      setTimeout(() => {
        session.fallbackElapsed = true
        maybeRunCommand(session)
      }, 1000)
      maybeRunCommand(session)
    }
    sendToRenderer({ type: 'data', ptyId: msg.ptyId, data })
  })

  proc.onExit(({ exitCode }) => {
    sessions.delete(msg.ptyId)
    sendToRenderer({ type: 'exit', ptyId: msg.ptyId, exitCode })
    parentPort.postMessage({ type: 'exited', ptyId: msg.ptyId, exitCode })
  })
}

function handleControl(msg: HostControlMessage): void {
  switch (msg.type) {
    case 'spawn':
      spawn(msg)
      break
    case 'kill':
      sessions.get(msg.ptyId)?.pty.kill()
      break
  }
}

function handleRendererMessage(msg: PtyInMessage): void {
  const session = sessions.get(msg.ptyId)
  if (!session) return
  if (msg.type === 'write') session.pty.write(msg.data)
  else if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
    session.pty.resize(msg.cols, msg.rows)
    session.resized = true
    maybeRunCommand(session)
  } else if (msg.type === 'kick') {
    // Double SIGWINCH: full-screen TUIs (claude/codex) repaint, which
    // restores content after the renderer reloads and loses its buffer.
    const { cols, rows } = session.pty
    session.pty.resize(cols + 1, rows)
    setTimeout(() => {
      try {
        session.pty.resize(cols, rows)
      } catch {
        // pty may have exited between the two resizes
      }
    }, 60)
  }
}

parentPort.on('message', (event) => {
  const msg = event.data as HostControlMessage | { type: 'init' }
  if (msg.type === 'init') {
    rendererPort = event.ports[0]
    rendererPort.on('message', (portEvent) => {
      handleRendererMessage(portEvent.data as PtyInMessage)
    })
    rendererPort.start()
    return
  }
  handleControl(msg)
})
