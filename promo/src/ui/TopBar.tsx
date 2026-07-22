/**
 * Workspace top bar: title + path, the Terminals/Files/Changes switch, and the
 * right-hand tool cluster (usage meters, memory, mic, grid, add pane).
 * Mirrors src/renderer/src/components/WorkspaceView.tsx.
 */

import React from 'react'
import { Kind, L, MONO, Skin, UI } from '../theme'
import { Icon } from './Icon'
import { UsageMeter } from './UsageMeter'

const Tool: React.FC<{
  skin: Skin
  name: string
  primary?: boolean
  lit?: number
  children?: React.ReactNode
}> = ({ skin, name, primary, lit = 0, children }) => (
  <div
    style={{
      position: 'relative',
      width: 36,
      height: 36,
      borderRadius: 9,
      display: 'grid',
      placeItems: 'center',
      color: primary ? skin.accentContrast : skin.textDim,
      background: primary
        ? skin.accent
        : lit
          ? `rgba(255,255,255,${0.05 + lit * 0.12})`
          : 'transparent',
      border: `1px solid ${primary || lit ? 'transparent' : skin.border}`,
      boxShadow: lit ? `0 0 0 ${lit * 2}px ${skin.accent}44` : undefined,
    }}
  >
    {children ?? <Icon name={name} size={19} />}
  </div>
)

const Segmented: React.FC<{ skin: Skin; options: string[]; active: number }> = ({
  skin,
  options,
  active,
}) => (
  <div
    style={{
      display: 'flex',
      padding: 3,
      gap: 2,
      borderRadius: 10,
      background: skin.inputBg,
      border: `1px solid ${skin.border}`,
    }}
  >
    {options.map((o, i) => (
      <span
        key={o}
        style={{
          padding: '5px 14px',
          borderRadius: 7,
          fontSize: L.font.tiny,
          color: i === active ? skin.text : skin.textDim,
          background: i === active ? skin.surfaceStrong : 'transparent',
          fontWeight: i === active ? 600 : 400,
        }}
      >
        {o}
      </span>
    ))}
  </div>
)

interface Props {
  skin: Skin
  name: string
  path: string
  color: string
  yolo?: boolean
  meters?: { kind: Kind; windows: { label: string; value: number }[] }[]
  /** 0–1 emphasis on the meter cluster. */
  meterFocus?: number
  /** 0–1 emphasis on the ◈ memory button. */
  memoryLit?: number
  /** Mic state for the dictation beat. */
  mic?: { state: 'idle' | 'recording' | 'transcribing'; level?: number }
  /** Extra nodes anchored to the bar (tooltips, menus). */
  children?: React.ReactNode
}

export const TopBar: React.FC<Props> = ({
  skin,
  name,
  path,
  color,
  yolo,
  meters = [],
  meterFocus = 0,
  memoryLit = 0,
  mic = { state: 'idle' },
  children,
}) => (
  <header
    style={{
      position: 'relative',
      // Above the pane grid, so tooltips and menus anchored here aren't
      // painted over by the panes that come later in the DOM.
      zIndex: 5,
      height: L.topbar,
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 16px 0 22px',
      borderBottom: `1px solid ${skin.border}`,
      background: skin.surfaceSoft,
      fontFamily: UI,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
        }}
      />
      <span style={{ fontSize: L.font.body, fontWeight: 600, color: skin.text }}>
        {name}
      </span>
      {yolo && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: '#f47067',
            border: '1px solid #f4706755',
            background: '#f4706718',
            borderRadius: 6,
            padding: '2px 7px',
          }}
        >
          YOLO
        </span>
      )}
      <span
        style={{ fontFamily: MONO, fontSize: L.font.tiny, color: skin.textDim }}
      >
        {path}
      </span>
    </div>

    <Segmented skin={skin} options={['Terminals', 'Files', 'Changes']} active={0} />

    <div
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {meters.map((m) => (
        <UsageMeter
          key={m.kind}
          skin={skin}
          kind={m.kind}
          windows={m.windows}
          focus={meterFocus}
        />
      ))}
      {meters.length > 0 && (
        <span
          style={{
            width: 1,
            height: 22,
            background: skin.border,
            margin: '0 2px',
          }}
        />
      )}
      <Tool skin={skin} name="info" />
      <Tool skin={skin} name="memory" lit={memoryLit} />
      <Tool skin={skin} name="mic" lit={mic.state !== 'idle' ? 1 : 0}>
        {mic.state === 'recording' ? (
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: '#f47067',
              transform: `scale(${1 + (mic.level ?? 0) * 0.35})`,
              boxShadow: `0 0 ${8 + (mic.level ?? 0) * 14}px #f4706799`,
            }}
          />
        ) : mic.state === 'transcribing' ? (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: `2px solid ${skin.border}`,
              borderTopColor: skin.accent,
              transform: `rotate(${(mic.level ?? 0) * 360}deg)`,
            }}
          />
        ) : undefined}
      </Tool>
      <Tool skin={skin} name="grid" />
      <Tool skin={skin} name="plus" primary />
    </div>

    {children}
  </header>
)
