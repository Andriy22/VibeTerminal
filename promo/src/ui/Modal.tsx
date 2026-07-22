/**
 * Modal shell — dimmed backdrop plus a glass panel that scales in.
 * The launcher, settings and memory beats all mount inside this.
 */

import React from 'react'
import { Skin } from '../theme'

interface Props {
  skin: Skin
  /** 0–1: backdrop opacity and panel scale/offset. */
  open: number
  width: number
  height: number
  children: React.ReactNode
}

export const Modal: React.FC<Props> = ({ skin, open, width, height, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      background: `rgba(0,0,0,${0.5 * open})`,
      backdropFilter: `blur(${open * 3}px)`,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        width,
        height,
        display: 'flex',
        borderRadius: 16,
        overflow: 'hidden',
        background: skin.modalSurface,
        border: `1px solid ${skin.border}`,
        boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(30px) saturate(160%)',
        opacity: open,
        transform: `scale(${0.94 + open * 0.06}) translateY(${(1 - open) * 16}px)`,
      }}
    >
      {children}
    </div>
  </div>
)

/** Section heading used inside the launcher and settings panels. */
export const PanelHead: React.FC<{
  skin: Skin
  title: string
  desc: string
}> = ({ skin, title, desc }) => (
  <div style={{ marginBottom: 20 }}>
    <h3 style={{ fontSize: 24, fontWeight: 600, color: skin.text, margin: 0 }}>
      {title}
    </h3>
    <p style={{ fontSize: 16, color: skin.textDim, margin: '6px 0 0' }}>{desc}</p>
  </div>
)

export const FieldLabel: React.FC<{ skin: Skin; children: React.ReactNode }> = ({
  skin,
  children,
}) => (
  <div
    style={{
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      color: skin.textDim,
      margin: '18px 0 8px',
      fontWeight: 600,
    }}
  >
    {children}
  </div>
)
