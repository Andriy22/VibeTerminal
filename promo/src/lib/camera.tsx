/**
 * Virtual camera.
 *
 * The promo is shot as one continuous take: the app window never leaves the
 * screen, and beats "cut" by pushing the camera into the region they're about.
 * <Camera> maps a rect in canvas coordinates to fill the frame, interpolating
 * between identity (amount 0) and fully focused (amount 1).
 */

import React from 'react'
import { WIDTH, HEIGHT } from '../script'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  /** Region to push into, in 1920×1080 canvas coordinates. */
  rect: Rect
  /** 0 = wide shot, 1 = rect fills the frame. */
  amount: number
  /** Breathing room around the rect once focused, in canvas px. */
  padding?: number
  /** Never zoom past this, so text doesn't turn to mush. */
  maxScale?: number
  children: React.ReactNode
}

export const Camera: React.FC<Props> = ({
  rect,
  amount,
  padding = 40,
  maxScale = 2.6,
  children,
}) => {
  const w = rect.w + padding * 2
  const h = rect.h + padding * 2
  const target = Math.min(maxScale, Math.min(WIDTH / w, HEIGHT / h))

  const scale = 1 + (target - 1) * amount

  // The focal point travels from the canvas centre (wide shot) to the rect's
  // centre (focused); the translation is then whatever puts that point in the
  // middle of the frame. At amount 0 this collapses to the exact identity.
  const fx = WIDTH / 2 + (rect.x + rect.w / 2 - WIDTH / 2) * amount
  const fy = HEIGHT / 2 + (rect.y + rect.h / 2 - HEIGHT / 2) * amount

  // Clamp so the scaled canvas always covers the frame. Without this, focusing
  // a rect near an edge (the top-right meters, say) pans empty space into view.
  const clamp = (v: number, span: number): number =>
    Math.min(0, Math.max(span - span * scale, v))
  const tx = clamp(WIDTH / 2 - fx * scale, WIDTH)
  const ty = clamp(HEIGHT / 2 - fy * scale, HEIGHT)

  return (
    <div
      style={{
        position: 'absolute',
        width: WIDTH,
        height: HEIGHT,
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}
