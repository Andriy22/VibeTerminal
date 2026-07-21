import { MessageChannelMain, utilityProcess, type UtilityProcess } from 'electron'
import { EventEmitter } from 'events'
import { join } from 'path'
import type { HostControlMessage, HostEventMessage } from '../shared/types'

/**
 * Forks and supervises the pty host utility process.
 *
 * Emits:
 *  - 'pty-exited' (ptyId, exitCode)  — a pty process ended
 *  - 'pty-cwd' (ptyId, cwd)          — a pane's shell changed directory
 *  - 'host-crashed'                  — host died; it has been restarted with a
 *                                      fresh renderer port, panes must respawn
 *  - 'renderer-port' (MessagePortMain) — port to forward to the renderer
 */
export class PtyHostManager extends EventEmitter {
  private host: UtilityProcess | null = null
  private stopped = false

  start(): void {
    this.stopped = false
    const host = utilityProcess.fork(join(__dirname, 'ptyHost.js'), [], {
      serviceName: 'vibeterminal-pty-host'
    })
    this.host = host

    host.on('message', (msg: HostEventMessage) => {
      if (msg.type === 'exited') this.emit('pty-exited', msg.ptyId, msg.exitCode)
      else if (msg.type === 'cwd') this.emit('pty-cwd', msg.ptyId, msg.cwd)
    })

    host.on('exit', () => {
      if (this.stopped) return
      // Crash: restart and hand out a new renderer port; workspaces respawn.
      this.start()
      this.emit('host-crashed')
    })

    this.connectRenderer()
  }

  /** Create a fresh main<->renderer channel through the host. */
  connectRenderer(): void {
    if (!this.host) return
    const { port1, port2 } = new MessageChannelMain()
    this.host.postMessage({ type: 'init' }, [port1])
    this.emit('renderer-port', port2)
  }

  send(msg: HostControlMessage): void {
    this.host?.postMessage(msg)
  }

  stop(): void {
    this.stopped = true
    this.host?.kill()
    this.host = null
  }
}
