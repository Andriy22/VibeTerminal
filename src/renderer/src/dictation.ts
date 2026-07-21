import { useApp } from './store'
import { ptyBridge } from './ptyBridge'

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []

function writeToFocusedPane(text: string): void {
  const app = useApp.getState()
  const focused = app.focusedPane
  const workspace = app.snapshot.find((w) => w.config.id === focused?.workspaceId)
  const runtime = workspace?.panes.find((p) => p.paneId === focused?.paneId)
  if (runtime && runtime.status === 'running') {
    ptyBridge.write(runtime.ptyId, text)
  } else {
    app.toast('No focused terminal — click a pane, then dictate.')
  }
}

export async function startDictation(): Promise<void> {
  const app = useApp.getState()
  if (app.micState !== 'idle') return
  if (!app.focusedPane) {
    app.toast('Click a terminal pane first — dictation types into the focused pane.')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    chunks = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      useApp.getState().setMicState('transcribing')
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const result = await window.vibe.transcribe(await blob.arrayBuffer())
        if (result.error) useApp.getState().toast(result.error)
        else if (result.text) writeToFocusedPane(result.text)
        else useApp.getState().toast('Nothing was heard — try again closer to the microphone.')
      } finally {
        useApp.getState().setMicState('idle')
      }
    }
    rec.start()
    recorder = rec
    app.setMicState('recording')
  } catch {
    app.toast('Microphone unavailable — check System Settings → Privacy → Microphone.')
  }
}

export function stopDictation(): void {
  recorder?.stop()
  recorder = null
}

export function toggleDictation(): void {
  const state = useApp.getState().micState
  if (state === 'idle') void startDictation()
  else if (state === 'recording') stopDictation()
}
