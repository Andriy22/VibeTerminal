/**
 * Workspace sidebar — brand, search, the folder→workspace tree, footer tools.
 * Mirrors src/renderer/src/components/Sidebar.tsx at video scale.
 */

import React from 'react'
import { KIND, L, MONO, Skin, UI } from '../theme'
import { SIDEBAR_GROUPS } from '../data'
import { Icon } from './Icon'

const ToolButton: React.FC<{
  skin: Skin
  name: string
  primary?: boolean
  lit?: number
}> = ({ skin, name, primary, lit = 0 }) => (
  <div
    style={{
      width: 34,
      height: 34,
      borderRadius: 9,
      display: 'grid',
      placeItems: 'center',
      color: primary ? skin.accentContrast : skin.textDim,
      background: primary
        ? skin.accent
        : lit
          ? `rgba(255,255,255,${0.05 + lit * 0.1})`
          : 'transparent',
      border: `1px solid ${primary ? 'transparent' : skin.border}`,
    }}
  >
    <Icon name={name} size={19} />
  </div>
)

interface Props {
  skin: Skin
  /** Name of the workspace drawn as selected. */
  activeName?: string
  /** 0–1 highlight on the footer gear, for the Settings hand-off. */
  gearLit?: number
  /** Entrance progress for the workspace rows, 0–1 each. */
  rowsIn?: number[]
}

export const Sidebar: React.FC<Props> = ({
  skin,
  activeName = 'auth refactor',
  gearLit = 0,
  rowsIn,
}) => {
  let rowIndex = -1

  return (
    <aside
      style={{
        width: L.sidebar,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        background: skin.surface,
        borderRight: `1px solid ${skin.border}`,
        fontFamily: UI,
      }}
    >
      {/* brand */}
      <div
        style={{
          height: L.topbar,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px 0 100px', // clears the traffic lights
          borderBottom: `1px solid ${skin.border}`,
        }}
      >
        <span style={{ color: skin.accent, fontSize: 19 }}>✳</span>
        <span style={{ fontSize: L.font.body, fontWeight: 600, color: skin.text }}>
          VibeTerminal
        </span>
        <span
          style={{
            fontSize: L.font.tiny,
            fontFamily: MONO,
            color: skin.textDim,
            border: `1px solid ${skin.border}`,
            borderRadius: 6,
            padding: '2px 6px',
          }}
        >
          v0.3.0
        </span>
      </div>

      {/* search row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 12px 10px',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            borderRadius: 9,
            background: skin.inputBg,
            border: `1px solid ${skin.border}`,
            color: skin.textDim,
          }}
        >
          <Icon name="search" size={17} />
          <span style={{ fontSize: L.font.small }}>Search workspaces</span>
        </div>
        <ToolButton skin={skin} name="sort" />
        <ToolButton skin={skin} name="plus" primary />
      </div>

      {/* tree */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 8px' }}>
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.folder} style={{ marginBottom: 6 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 6px',
                color: skin.textDim,
                fontSize: L.font.tiny,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              <span style={{ display: 'grid', placeItems: 'center' }}>
                <Icon name="chevronDown" size={13} />
              </span>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  border: `1.5px solid ${skin.textDim}`,
                }}
              />
              <span style={{ fontWeight: 600 }}>{group.folder}</span>
              <span style={{ opacity: 0.6 }}>{group.items.length}</span>
            </div>

            {group.items.map((w) => {
              rowIndex += 1
              const active = w.name === activeName
              const entrance = rowsIn ? (rowsIn[rowIndex] ?? 1) : 1
              return (
                <div
                  key={w.name}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    height: 40,
                    padding: '0 10px 0 12px',
                    marginBottom: 3,
                    borderRadius: 9,
                    background: active ? skin.surfaceStrong : 'transparent',
                    border: `1px solid ${active ? skin.border : 'transparent'}`,
                    opacity: entrance,
                    transform: `translateX(${(1 - entrance) * -14}px)`,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 4,
                      top: 9,
                      bottom: 9,
                      width: 3,
                      borderRadius: 2,
                      background: w.color,
                      opacity: w.running ? 1 : 0.35,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: L.font.small,
                      color: active ? skin.text : skin.textDim,
                      fontWeight: active ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {w.name}
                  </span>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {w.kinds.map((k, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 14,
                          color: KIND[k].color,
                          opacity: w.running ? 1 : 0.4,
                        }}
                      >
                        {KIND[k].symbol}
                      </span>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* footer */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: `1px solid ${skin.border}`,
        }}
      >
        <ToolButton skin={skin} name="gear" lit={gearLit} />
        <ToolButton skin={skin} name="sparkles" />
      </div>
    </aside>
  )
}
