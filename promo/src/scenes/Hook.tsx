/**
 * Beat 1 — the problem.
 *
 * Four loose terminal windows drift over the desktop, overlapping and hiding
 * each other, then snap into the VibeTerminal grid. The four windows carry the
 * same content the panes will hold a second later, so the snap reads as "these
 * became that" rather than a cut to something new.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { KIND, L, MONO, makeSkin, themeById } from '../theme'
import { PANES } from '../data'
import { Desktop, TrafficLights } from '../ui/Window'
import { ramp, EASE, EASE_CAM } from '../lib/anim'

const skin = makeSkin('vibe-dark', 'standard')

/** Where each loose window starts — overlapping, deliberately messy. */
const SCATTER = [
  { x: 180, y: 120, w: 780, h: 460, rot: -2.2 },
  { x: 520, y: 300, w: 760, h: 470, rot: 1.6 },
  { x: 900, y: 150, w: 800, h: 450, rot: -1.1 },
  { x: 700, y: 520, w: 820, h: 440, rot: 2.4 },
]

/** Where they land: the 2×2 grid inside the app window. */
const GRID_PAD = 14
const GRID_TOP = L.window.y + L.topbar + GRID_PAD
const GRID_LEFT = L.window.x + L.sidebar + GRID_PAD
const CELL_W = (L.window.w - L.sidebar - GRID_PAD * 2 - 12) / 2
const CELL_H = (L.window.h - L.topbar - GRID_PAD * 2 - 12) / 2

const target = (i: number): { x: number; y: number; w: number; h: number } => ({
  x: GRID_LEFT + (i % 2) * (CELL_W + 12),
  y: GRID_TOP + Math.floor(i / 2) * (CELL_H + 12),
  w: CELL_W,
  h: CELL_H,
})

export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Windows drift apart, then collapse into the grid over the last third.
  const drift = ramp(frame, 0, 96, EASE)
  const snap = ramp(frame, 104, 56, EASE_CAM)
  // The app window fades up underneath as the loose ones land.
  const shellIn = ramp(frame, 118, 40)
  const out = 1 - ramp(frame, durationInFrames - 12, 12)

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Desktop skin={skin} />

      {/* The app window materialising under the collapsing terminals. */}
      <div
        style={{
          position: 'absolute',
          left: L.window.x,
          top: L.window.y,
          width: L.window.w,
          height: L.window.h,
          borderRadius: L.window.radius,
          background: skin.appBg,
          backdropFilter: `blur(${skin.blur}px) saturate(160%)`,
          border: `1px solid ${skin.border}`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
          opacity: shellIn,
        }}
      >
        <div
          style={{
            height: L.topbar,
            borderBottom: `1px solid ${skin.border}`,
            background: skin.surfaceSoft,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
          }}
        >
          <TrafficLights />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: L.topbar,
            bottom: 0,
            width: L.sidebar,
            background: skin.surface,
            borderRight: `1px solid ${skin.border}`,
          }}
        />
      </div>

      {SCATTER.map((start, i) => {
        const end = target(i)
        const dx = start.x + (i - 1.5) * 26 * drift
        const dy = start.y + (i % 2 === 0 ? -1 : 1) * 18 * drift

        const x = dx + (end.x - dx) * snap
        const y = dy + (end.y - dy) * snap
        const w = start.w + (end.w - start.w) * snap
        const h = start.h + (end.h - start.h) * snap
        const rot = start.rot * (1 - snap)

        const pane = PANES[i]
        const meta = KIND[pane.kind]

        return (
          <div
            key={pane.callsign}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: h,
              transform: `rotate(${rot}deg)`,
              transformOrigin: 'center',
              borderRadius: 12 - snap * 2,
              overflow: 'hidden',
              // Fully opaque: four stacked translucent terminals turn each
              // other's text into mush. They only need to look like glass once
              // they've landed, and the beat cuts away before that matters.
              background: themeById('vibe-dark').pane,
              border: `1px solid ${skin.border}`,
              borderTop: `2px solid ${meta.color}`,
              boxShadow: `0 ${30 - snap * 22}px ${70 - snap * 50}px rgba(0,0,0,${0.5 - snap * 0.3})`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                height: L.paneHeader,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 11px',
                background: skin.surfaceSoft,
                borderBottom: `1px solid ${skin.border}`,
              }}
            >
              {/* Loose windows wear traffic lights; they fade as panes take over. */}
              <span style={{ opacity: 1 - snap, display: 'flex', gap: 6 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                  <span
                    key={c}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: c,
                    }}
                  />
                ))}
              </span>
              <span
                style={{
                  color: meta.color,
                  fontSize: L.font.tiny,
                  fontWeight: 600,
                }}
              >
                {meta.symbol} {meta.label}
              </span>
              <span style={{ fontSize: L.font.tiny, color: skin.textDim, opacity: snap }}>
                {pane.callsign}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px 14px',
                fontFamily: MONO,
                fontSize: 15,
                lineHeight: 1.55,
                overflow: 'hidden',
              }}
            >
              {pane.lines.map((line, li) => (
                <div
                  key={li}
                  style={{
                    color:
                      line.tone === 't'
                        ? meta.color
                        : line.tone === 'd'
                          ? skin.textDim
                          : skin.text,
                    whiteSpace: 'pre',
                  }}
                >
                  {line.text || ' '}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
