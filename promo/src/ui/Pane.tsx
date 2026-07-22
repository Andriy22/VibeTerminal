/**
 * A terminal pane and the grid that holds them.
 * Header layout mirrors src/renderer/src/components/TerminalPane.tsx:203-240 —
 * activity dot, kind glyph + label, callsign, branch, then ⑂ ⊞ ✕.
 */

import React from 'react'
import { KIND, L, MONO, Skin, STATUS } from '../theme'
import { PaneSpec } from '../data'

const ACTIVITY: Record<PaneSpec['activity'], string> = {
  idle: '#6e7681',
  working: STATUS.ok,
  attention: STATUS.warn,
}

interface PaneProps {
  skin: Skin
  pane: PaneSpec
  /** How many body lines are visible — drives the "streaming output" feel. */
  visibleLines?: number
  focused?: boolean
  /** 0–1 entrance. */
  entrance?: number
  /** Appended to the body, e.g. dictated text landing in the focused pane. */
  extraLine?: { text: string; caret?: boolean } | null
  /** Pulses the border when the pane receives dictated text. */
  glow?: number
}

export const Pane: React.FC<PaneProps> = ({
  skin,
  pane,
  visibleLines,
  focused,
  entrance = 1,
  extraLine,
  glow = 0,
}) => {
  const meta = KIND[pane.kind]
  const shown = visibleLines ?? pane.lines.length

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        overflow: 'hidden',
        background: skin.paneBg,
        border: `1px solid ${focused || glow ? meta.color + '77' : skin.border}`,
        borderTop: `2px solid ${meta.color}`,
        opacity: entrance,
        transform: `translateY(${(1 - entrance) * 18}px) scale(${0.985 + entrance * 0.015})`,
        boxShadow: glow ? `0 0 0 ${glow * 3}px ${meta.color}33` : undefined,
      }}
    >
      <header
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
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ACTIVITY[pane.activity],
            boxShadow:
              pane.activity !== 'idle'
                ? `0 0 8px ${ACTIVITY[pane.activity]}`
                : undefined,
          }}
        />
        <span
          style={{ color: meta.color, fontSize: L.font.tiny, fontWeight: 600 }}
        >
          {meta.symbol} {meta.label}
        </span>
        <span style={{ fontSize: L.font.tiny, color: skin.textDim }}>
          {pane.callsign}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            color: skin.textDim,
            opacity: 0.75,
          }}
        >
          {pane.branch}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, color: skin.textDim, fontSize: 14 }}>
          <span>⑂</span>
          <span>⊞</span>
          <span>✕</span>
        </span>
      </header>

      <div
        style={{
          flex: 1,
          padding: '12px 14px',
          fontFamily: MONO,
          fontSize: 15,
          lineHeight: 1.55,
          color: skin.text,
          overflow: 'hidden',
        }}
      >
        {pane.lines.slice(0, shown).map((line, i) => (
          <div
            key={i}
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
            {line.text || ' '}
          </div>
        ))}
        {extraLine && (
          <div style={{ color: meta.color, whiteSpace: 'pre' }}>
            {extraLine.text}
            {extraLine.caret && (
              <span style={{ background: meta.color, color: skin.paneBg }}>
                {' '}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

interface GridProps {
  skin: Skin
  panes: PaneSpec[]
  cols?: number
  /** Per-pane entrance progress. */
  entrances?: number[]
  /** Per-pane visible line counts. */
  visibleLines?: number[]
  focusedIndex?: number
  extraLine?: { index: number; text: string; caret?: boolean } | null
  glowIndex?: { index: number; amount: number } | null
  /** 0–1 opacity of the app's "No agents running" state, over the grid. */
  emptyState?: number
}

export const PaneGrid: React.FC<GridProps> = ({
  skin,
  panes,
  cols = 2,
  entrances,
  visibleLines,
  focusedIndex,
  extraLine,
  glowIndex,
  emptyState = 0,
}) => (
  <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
        padding: 14,
        minHeight: 0,
      }}
    >
      {panes.map((p, i) => (
        <Pane
          key={p.callsign}
          skin={skin}
          pane={p}
          entrance={entrances ? (entrances[i] ?? 1) : 1}
          visibleLines={visibleLines ? visibleLines[i] : undefined}
          focused={focusedIndex === i}
          extraLine={extraLine && extraLine.index === i ? extraLine : null}
          glow={glowIndex && glowIndex.index === i ? glowIndex.amount : 0}
        />
      ))}
    </div>

    {emptyState > 0.01 && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          opacity: emptyState,
        }}
      >
        <div style={{ fontSize: 46, letterSpacing: 10, color: skin.textDim }}>
          ✳ ⬡ ❯
        </div>
        <div style={{ fontSize: 20, color: skin.textDim }}>No agents running.</div>
      </div>
    )}
  </div>
)
