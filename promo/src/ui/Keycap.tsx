/**
 * Keycap and waveform visuals for the dictation beat.
 */

import React from 'react'
import { MONO, Skin } from '../theme'
import { seeded } from '../lib/anim'

export const Keycap: React.FC<{
  skin: Skin
  keys: string[]
  /** 0–1 press depth. */
  press: number
  opacity?: number
}> = ({ skin, keys, press, opacity = 1 }) => (
  <div style={{ display: 'flex', gap: 10, opacity }}>
    {keys.map((k) => (
      <div
        key={k}
        style={{
          minWidth: 62,
          height: 62,
          display: 'grid',
          placeItems: 'center',
          padding: '0 14px',
          borderRadius: 12,
          fontFamily: MONO,
          fontSize: 26,
          fontWeight: 600,
          color: press > 0.5 ? skin.accentContrast : skin.text,
          background: press > 0.5 ? skin.accent : 'rgba(255,255,255,0.08)',
          border: `1px solid ${skin.border}`,
          boxShadow:
            press > 0.5
              ? `0 2px 0 rgba(0,0,0,0.3)`
              : `0 ${5 - press * 3}px 0 rgba(0,0,0,0.35)`,
          transform: `translateY(${press * 3}px)`,
          backdropFilter: 'blur(18px)',
        }}
      >
        {k}
      </div>
    ))}
  </div>
)

/**
 * Live-ish audio waveform. Bars are a deterministic function of frame and bar
 * index — no randomness, so the same frame always renders the same wave.
 */
export const Waveform: React.FC<{
  skin: Skin
  frame: number
  bars?: number
  width?: number
  height?: number
  /** 0–1 overall amplitude, so it can rise and fall with the take. */
  amplitude?: number
}> = ({ skin, frame, bars = 34, width = 360, height = 64, amplitude = 1 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      width,
      height,
      justifyContent: 'center',
    }}
  >
    {Array.from({ length: bars }, (_, i) => {
      // Two out-of-phase sines plus a per-bar seed reads as speech, not a synth.
      const wave =
        Math.sin(frame * 0.24 + i * 0.55) * 0.5 +
        Math.sin(frame * 0.11 + i * 1.3) * 0.3 +
        seeded(i + frame) * 0.2
      const h = Math.max(4, Math.abs(wave) * height * amplitude)
      return (
        <span
          key={i}
          style={{
            width: 5,
            height: h,
            borderRadius: 3,
            background: skin.accent,
            opacity: 0.55 + Math.abs(wave) * 0.45,
          }}
        />
      )
    })}
  </div>
)
