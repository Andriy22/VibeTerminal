/**
 * Plan-usage meter: agent glyph, one bar per window, worst-case percentage.
 * Thresholds match the app exactly — 50% warn, 80% danger
 * (src/renderer/src/components/WorkspaceView.tsx:71).
 */

import React from 'react'
import { Kind, KIND, L, MONO, Skin, STATUS } from '../theme'

const levelColor = (v: number): string =>
  v >= 80 ? STATUS.danger : v >= 50 ? STATUS.warn : STATUS.ok

interface Props {
  skin: Skin
  kind: Kind
  /** Percentages for the 5-hour and weekly windows. */
  windows: { label: string; value: number }[]
  /** 0–1 emphasis used when the camera pushes in on the meters. */
  focus?: number
}

export const UsageMeter: React.FC<Props> = ({
  skin,
  kind,
  windows,
  focus = 0,
}) => {
  const worst = Math.max(...windows.map((w) => w.value))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        borderRadius: 9,
        border: `1px solid ${focus ? skin.border : 'transparent'}`,
        background: focus
          ? `rgba(255,255,255,${0.04 + focus * 0.05})`
          : 'transparent',
      }}
    >
      <span style={{ color: KIND[kind].color, fontSize: 16 }}>
        {KIND[kind].symbol}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {windows.map((w) => (
          <span
            key={w.label}
            style={{
              width: 54,
              height: 5,
              borderRadius: 3,
              background: skin.dark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.max(4, Math.min(100, w.value))}%`,
                borderRadius: 3,
                background: levelColor(w.value),
              }}
            />
          </span>
        ))}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: L.font.tiny,
          color: worst >= 50 ? levelColor(worst) : skin.textDim,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(worst)}%
      </span>
    </div>
  )
}

/** The hover card the app shows over a meter — used in the Limits beat. */
export const UsageTooltip: React.FC<{
  skin: Skin
  kind: Kind
  fiveHour: number
  weekly: number
  plan: string
  resetsAt: string
  weeklyResetsAt: string
  /** 0–1 reveal. */
  open: number
}> = ({
  skin,
  kind,
  fiveHour,
  weekly,
  plan,
  resetsAt,
  weeklyResetsAt,
  open,
}) => (
  <div
    style={{
      width: 340,
      padding: '14px 16px',
      borderRadius: 12,
      background: skin.modalSurface,
      border: `1px solid ${skin.border}`,
      boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(24px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      opacity: open,
      transform: `translateY(${(1 - open) * -8}px) scale(${0.97 + open * 0.03})`,
      transformOrigin: 'top right',
      pointerEvents: 'none',
    }}
  >
    <strong style={{ fontSize: L.font.small, color: skin.text }}>
      {KIND[kind].label} usage limits
    </strong>
    <span style={{ fontSize: L.font.tiny, color: skin.textDim }}>
      5-hour session: {Math.round(fiveHour)}% · resets {resetsAt}
    </span>
    <span style={{ fontSize: L.font.tiny, color: skin.textDim }}>
      weekly limit: {Math.round(weekly)}% · resets {weeklyResetsAt}
    </span>
    <span style={{ fontSize: L.font.tiny, color: skin.textDim }}>
      plan: {plan}
    </span>
    <span
      style={{
        fontSize: L.font.tiny,
        color: STATUS.ok,
        borderTop: `1px solid ${skin.border}`,
        paddingTop: 7,
        marginTop: 2,
      }}
    >
      live from your {KIND[kind].label} account
    </span>
  </div>
)
