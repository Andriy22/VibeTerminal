/**
 * The macOS app window: vibrancy backdrop, hidden-inset title bar, traffic
 * lights. Everything else in the UI kit renders inside it.
 *
 * Pure presentation — no useCurrentFrame() here or anywhere in ui/. Scenes read
 * the frame and pass plain numbers down, which keeps these components reusable
 * for stills and independently checkable.
 */

import React from 'react'
import { L, Skin } from '../theme'

/** Desktop behind the window — gives the glass something to blur. */
export const Desktop: React.FC<{ skin: Skin; hue?: number }> = ({
  skin,
  hue = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: skin.dark
        ? `radial-gradient(120% 90% at 18% 8%, hsl(${232 + hue} 42% 22%) 0%, hsl(${248 + hue} 46% 12%) 42%, #05070a 100%)`
        : `radial-gradient(120% 90% at 18% 8%, hsl(${210 + hue} 60% 88%) 0%, hsl(${222 + hue} 44% 74%) 45%, #b9c4d4 100%)`,
    }}
  >
    {/* A couple of soft blooms so the blur has structure to pick up. */}
    <div
      style={{
        position: 'absolute',
        left: '58%',
        top: '-12%',
        width: 900,
        height: 900,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${skin.accent}38 0%, transparent 62%)`,
        filter: 'blur(30px)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '-8%',
        top: '52%',
        width: 760,
        height: 760,
        borderRadius: '50%',
        background: skin.dark
          ? 'radial-gradient(circle, #56b6c229 0%, transparent 62%)'
          : 'radial-gradient(circle, #ffffff70 0%, transparent 62%)',
        filter: 'blur(30px)',
      }}
    />
  </div>
)

const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840']

export const TrafficLights: React.FC<{ dim?: boolean }> = ({ dim }) => (
  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
    {TRAFFIC.map((c) => (
      <div
        key={c}
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: dim ? 'rgba(255,255,255,0.16)' : c,
        }}
      />
    ))}
  </div>
)

interface WindowProps {
  skin: Skin
  /** Overrides the default window rect — used by the hook's scattered windows. */
  rect?: { x: number; y: number; w: number; h: number }
  radius?: number
  shadow?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const AppWindow: React.FC<WindowProps> = ({
  skin,
  rect = L.window,
  radius = L.window.radius,
  shadow = true,
  children,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: radius,
      overflow: 'hidden',
      background: skin.appBg,
      backdropFilter: skin.blur ? `blur(${skin.blur}px) saturate(160%)` : undefined,
      border: `1px solid ${skin.border}`,
      boxShadow: shadow
        ? '0 40px 120px rgba(0,0,0,0.55), 0 8px 28px rgba(0,0,0,0.4)'
        : undefined,
      display: 'flex',
      ...style,
    }}
  >
    {children}
    {/* Top highlight line — the specular edge real macOS windows have. */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        pointerEvents: 'none',
        boxShadow: `inset 0 1px 0 ${skin.highlight}`,
      }}
    />
  </div>
)
