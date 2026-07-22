/**
 * Beat 6 — voice dictation.
 *
 * ⌘⇧D presses, the mic goes red and a waveform rides the take, the spinner
 * shows the Whisper round-trip, and the transcription types itself into the
 * focused pane. The focused pane is charlie (the codex one waiting on input),
 * so the dictated text lands somewhere that visibly needed an answer.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { L, makeSkin, UI } from '../theme'
import { DICTATION_TEXT, PANES, USAGE_METERS } from '../data'
import { AppShell } from '../ui/AppShell'
import { Keycap, Waveform } from '../ui/Keycap'
import { ramp, pulse } from '../lib/anim'
import { typeOut } from '../lib/typing'

const skin = makeSkin('vibe-dark', 'standard')

const PRESS_AT = 10
const RECORD_AT = 26
const RECORD_END = 118
const TRANSCRIBE_END = 150
const FOCUSED = 2 // charlie — the codex pane waiting on approval

export const Dictation: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const press = pulse(frame, PRESS_AT, 22, 5)
  const keycaps = pulse(frame, PRESS_AT - 8, 48, 10)

  const state: 'idle' | 'recording' | 'transcribing' =
    frame >= RECORD_AT && frame < RECORD_END
      ? 'recording'
      : frame >= RECORD_END && frame < TRANSCRIBE_END
        ? 'transcribing'
        : 'idle'

  // Amplitude rises as the phrase starts and tails off at the end.
  const amplitude =
    ramp(frame, RECORD_AT, 14) * (1 - ramp(frame, RECORD_END - 18, 18))

  const micLevel =
    state === 'recording'
      ? Math.abs(Math.sin(frame * 0.28)) * amplitude
      : state === 'transcribing'
        ? (frame - RECORD_END) / 30
        : 0

  const typed = typeOut(DICTATION_TEXT, frame, TRANSCRIBE_END + 4, 30, fps)
  const landed = frame >= TRANSCRIBE_END
  const glow = pulse(frame, TRANSCRIBE_END, 60, 14)

  const overlay = pulse(frame, RECORD_AT - 6, RECORD_END - RECORD_AT + 40, 14)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppShell
        skin={skin}
        paneEntrances={PANES.map(() => 1)}
        meters={USAGE_METERS}
        focusedIndex={FOCUSED}
        mic={{ state, level: micLevel }}
        extraLine={
          landed
            ? { index: FOCUSED, text: `> ${typed.text}`, caret: !typed.done }
            : null
        }
        glowIndex={{ index: FOCUSED, amount: glow }}
      />

      {/* Keycaps — shown just long enough to read the shortcut. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 210,
          display: 'grid',
          placeItems: 'center',
          opacity: keycaps,
          transform: `translateY(${(1 - keycaps) * 10}px)`,
        }}
      >
        <Keycap skin={skin} keys={['⌘', '⇧', 'D']} press={press} />
      </div>

      {/* Recording HUD */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 330,
          display: 'grid',
          placeItems: 'center',
          opacity: overlay,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '22px 40px',
            borderRadius: 18,
            background: 'rgba(8,10,13,0.72)',
            border: `1px solid ${skin.border}`,
            backdropFilter: 'blur(22px)',
            boxShadow: '0 26px 70px rgba(0,0,0,0.5)',
            fontFamily: UI,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: state === 'transcribing' ? skin.accent : '#f47067',
                boxShadow: `0 0 ${10 + micLevel * 12}px ${
                  state === 'transcribing' ? skin.accent : '#f47067'
                }`,
              }}
            />
            <span style={{ fontSize: L.font.body, color: '#ffffff', fontWeight: 600 }}>
              {state === 'transcribing' ? 'Transcribing…' : 'Listening'}
            </span>
          </div>
          <Waveform
            skin={skin}
            frame={frame}
            amplitude={state === 'transcribing' ? 0.12 : amplitude}
          />
          <span style={{ fontSize: 15, color: skin.textDim }}>
            {state === 'transcribing'
              ? 'Whisper · openai'
              : 'press ⌘⇧D again to stop'}
          </span>
        </div>
      </div>
    </div>
  )
}
