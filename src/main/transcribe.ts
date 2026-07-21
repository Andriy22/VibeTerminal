import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface TranscribeResult {
  text?: string
  error?: string
}

/** The platform API key codex's OAuth login mints into ~/.codex/auth.json. */
function codexAccountKey(): string | null {
  try {
    const raw = JSON.parse(readFileSync(join(homedir(), '.codex', 'auth.json'), 'utf8'))
    const key = raw?.OPENAI_API_KEY
    return typeof key === 'string' && key.trim() ? key.trim() : null
  } catch {
    return null
  }
}

export type DictationSource = 'manual' | 'codex' | 'none'

/** Which key dictation will use: manual settings key wins, else codex login. */
export function dictationSource(settingsKey: string): DictationSource {
  if (settingsKey.trim()) return 'manual'
  if (codexAccountKey()) return 'codex'
  return 'none'
}

/** Speech-to-text via OpenAI Whisper — manual key or the codex login's key. */
export async function transcribe(
  audio: ArrayBuffer,
  settingsKey: string
): Promise<TranscribeResult> {
  const apiKey = settingsKey.trim() || codexAccountKey() || ''
  if (!apiKey) {
    return {
      error:
        'No dictation key — log into codex (`codex login`) or add an OpenAI API key in Settings.'
    }
  }
  try {
    const form = new FormData()
    form.append('model', 'whisper-1')
    form.append('file', new Blob([audio], { type: 'audio/webm' }), 'speech.webm')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      body: form,
      signal: AbortSignal.timeout(30000)
    })
    if (!res.ok) {
      return { error: `Transcription failed (HTTP ${res.status}) — check your API key.` }
    }
    const data = (await res.json()) as { text?: string }
    return { text: typeof data.text === 'string' ? data.text.trim() : '' }
  } catch (error) {
    return { error: `Transcription failed: ${(error as Error).message}` }
  }
}
