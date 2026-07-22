/**
 * Beat 7 — the lockup.
 *
 * The window recedes and blurs behind the mark, tagline and repo URL.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { MONO, makeSkin, UI } from '../theme'
import { PANES, USAGE_METERS } from '../data'
import { AppShell } from '../ui/AppShell'
import { ramp, pop } from '../lib/anim'

const skin = makeSkin('vibe-dark', 'standard')

export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const recede = ramp(frame, 0, 34)
  const mark = pop(frame, 12, fps)
  const name = ramp(frame, 22, 18)
  const tagline = ramp(frame, 32, 18)
  const url = ramp(frame, 44, 18)
  const fadeOut = 1 - ramp(frame, durationInFrames - 16, 16)

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${1 - recede * 0.1})`,
          filter: `blur(${recede * 14}px)`,
          opacity: 1 - recede * 0.72,
        }}
      >
        <AppShell
          skin={skin}
          paneEntrances={PANES.map(() => 1)}
          meters={USAGE_METERS}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          fontFamily: UI,
        }}
      >
        <div
          style={{
            fontSize: 96,
            color: skin.accent,
            transform: `scale(${mark})`,
            textShadow: `0 0 60px ${skin.accent}66`,
            lineHeight: 1,
          }}
        >
          ✳
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -1.6,
            color: '#ffffff',
            opacity: name,
            transform: `translateY(${(1 - name) * 12}px)`,
          }}
        >
          VibeTerminal
        </div>
        <div
          style={{
            fontSize: 30,
            color: skin.textDim,
            opacity: tagline,
            transform: `translateY(${(1 - tagline) * 10}px)`,
          }}
        >
          Multi-agent terminal workspace manager
        </div>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            opacity: url,
            transform: `translateY(${(1 - url) * 10}px)`,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 24,
              color: skin.text,
              padding: '12px 22px',
              borderRadius: 11,
              border: `1px solid ${skin.border}`,
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            github.com/Andriy22/VibeTerminal
          </span>
        </div>
        <div
          style={{
            fontSize: 19,
            color: skin.textDim,
            opacity: url,
            letterSpacing: 0.4,
          }}
        >
          macOS · MIT · open source
        </div>
      </div>
    </div>
  )
}
