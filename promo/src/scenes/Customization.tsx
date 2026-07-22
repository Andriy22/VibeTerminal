/**
 * Beat 3 — appearance.
 *
 * Settings opens on the Appearance tab, and picking a theme card restyles the
 * entire window behind the modal, live. Then the glass segmented control walks
 * Off → Subtle → Standard → Heavy and the desktop blurs through the chrome.
 *
 * The whole scene re-derives its skin from (themeId, glassId) each frame, which
 * is exactly how the real app works — one token rewrite restyles everything.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import {
  GLASS_LEVELS,
  L,
  MONO,
  makeSkin,
  Skin,
  THEMES,
  UI,
} from '../theme'
import { PANES, USAGE_METERS } from '../data'
import { AppShell } from '../ui/AppShell'
import { Modal, PanelHead, FieldLabel } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import { ramp, stagger } from '../lib/anim'

/** Theme changes, relative to the beat. */
const THEME_CUES: { at: number; id: string }[] = [
  { at: 0, id: 'vibe-dark' },
  { at: 54, id: 'tokyo-night' },
  { at: 86, id: 'dracula' },
  { at: 118, id: 'github-light' },
  { at: 150, id: 'vibe-dark' },
]

/** Glass changes, relative to the beat. */
const GLASS_CUES: { at: number; id: string }[] = [
  { at: 0, id: 'standard' },
  { at: 186, id: 'off' },
  { at: 214, id: 'subtle' },
  { at: 242, id: 'standard' },
  { at: 270, id: 'heavy' },
]

const cueAt = (cues: { at: number; id: string }[], frame: number): string => {
  let id = cues[0].id
  for (const c of cues) if (frame >= c.at) id = c.id
  return id
}

const TABS = [
  { id: 'appearance', icon: 'palette', label: 'Appearance' },
  { id: 'agents', icon: 'terminal', label: 'Agents' },
  { id: 'usage', icon: 'gauge', label: 'Usage limits' },
  { id: 'dictation', icon: 'mic', label: 'Dictation' },
  { id: 'memory', icon: 'memory', label: 'Memory' },
]

const ThemeCard: React.FC<{
  skin: Skin
  theme: (typeof THEMES)[number]
  selected: boolean
  entrance: number
}> = ({ skin, theme, selected, entrance }) => (
  <div
    style={{
      height: 78,
      borderRadius: 11,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: theme.bg,
      border: `2px solid ${selected ? skin.accent : skin.border}`,
      boxShadow: selected ? `0 0 0 3px ${skin.accent}33` : undefined,
      opacity: entrance,
      transform: `translateY(${(1 - entrance) * 8}px) scale(${selected ? 1.02 : 1})`,
    }}
  >
    <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
      {theme.name}
    </span>
    <span style={{ display: 'flex', gap: 5 }}>
      {theme.swatches.map((c, i) => (
        <span
          key={i}
          style={{ width: 16, height: 6, borderRadius: 3, background: c }}
        />
      ))}
    </span>
  </div>
)

export const Customization: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const themeId = cueAt(THEME_CUES, frame)
  const glassId = cueAt(GLASS_CUES, frame)
  const skin = makeSkin(themeId, glassId)

  // Shifts the desktop gradient with the theme so the backdrop moves too.
  const hue = THEMES.findIndex((t) => t.id === themeId) * 14

  const open = ramp(frame, 6, 16) * (1 - ramp(frame, durationInFrames - 22, 16))
  const glassIndex = GLASS_LEVELS.findIndex((g) => g.id === glassId)

  const darkThemes = THEMES.filter((t) => t.appearance === 'dark')
  const lightThemes = THEMES.filter((t) => t.appearance === 'light')

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppShell
        skin={skin}
        hue={hue}
        meters={USAGE_METERS}
        gearLit={ramp(frame, 0, 12)}
        paneEntrances={PANES.map(() => 1)}
      >
        <Modal skin={skin} open={open} width={1060} height={640}>
          {/* tab rail */}
          <nav
            style={{
              width: 250,
              flex: 'none',
              padding: '26px 16px',
              borderRight: `1px solid ${skin.border}`,
              background: skin.surfaceSoft,
              fontFamily: UI,
            }}
          >
            <h2
              style={{
                fontSize: 24,
                margin: '0 0 20px 12px',
                color: skin.text,
                fontWeight: 600,
              }}
            >
              Settings
            </h2>
            {TABS.map((t) => {
              const active = t.id === 'appearance'
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '11px 12px',
                    borderRadius: 9,
                    marginBottom: 3,
                    fontSize: 16,
                    color: active ? skin.text : skin.textDim,
                    background: active ? skin.surfaceStrong : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span style={{ color: active ? skin.accent : skin.textDim }}>
                    <Icon name={t.icon} size={18} />
                  </span>
                  {t.label}
                </div>
              )
            })}
          </nav>

          {/* panel */}
          <div style={{ flex: 1, padding: '26px 28px', fontFamily: UI, minWidth: 0 }}>
            <PanelHead
              skin={skin}
              title="Appearance"
              desc="Theme and glass — restyles the whole app instantly."
            />

            <FieldLabel skin={skin}>Theme — dark</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {darkThemes.map((t, i) => (
                <ThemeCard
                  key={t.id}
                  skin={skin}
                  theme={t}
                  selected={t.id === themeId}
                  entrance={stagger(frame, 14, i, 3, 14)}
                />
              ))}
            </div>

            <FieldLabel skin={skin}>Theme — light</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {lightThemes.map((t, i) => (
                <ThemeCard
                  key={t.id}
                  skin={skin}
                  theme={t}
                  selected={t.id === themeId}
                  entrance={stagger(frame, 20, i, 3, 14)}
                />
              ))}
            </div>

            <FieldLabel skin={skin}>Glass effect</FieldLabel>
            <div
              style={{
                display: 'inline-flex',
                padding: 4,
                gap: 3,
                borderRadius: 11,
                background: skin.inputBg,
                border: `1px solid ${skin.border}`,
              }}
            >
              {GLASS_LEVELS.map((g, i) => (
                <span
                  key={g.id}
                  style={{
                    padding: '9px 22px',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: i === glassIndex ? 600 : 400,
                    color: i === glassIndex ? skin.accentContrast : skin.textDim,
                    background: i === glassIndex ? skin.accent : 'transparent',
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 15, color: skin.textDim }}>
              Transparency and blur of the window — Off is fully opaque, Heavy is
              mostly desktop.
            </div>

            <div
              style={{
                marginTop: 22,
                fontFamily: MONO,
                fontSize: L.font.tiny,
                color: skin.textDim,
                opacity: 0.75,
              }}
            >
              blur: {GLASS_LEVELS[glassIndex].blur}px · surface alpha:{' '}
              {GLASS_LEVELS[glassIndex].surface}
            </div>
          </div>
        </Modal>
      </AppShell>
    </div>
  )
}
