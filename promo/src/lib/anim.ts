/**
 * Shared motion helpers.
 *
 * Everything the promo animates goes through these so the whole video shares
 * one set of easings — and so no scene reaches for Math.random()/Date.now(),
 * which would make renders non-deterministic.
 */

import { interpolate, Easing, spring } from 'remotion'

/** The house easing: fast out, settle in. Used for nearly every transition. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1)
/** Symmetric ease for camera moves, which look wrong with an aggressive out. */
export const EASE_CAM = Easing.bezier(0.65, 0, 0.35, 1)

/** 0→1 over [start, start+dur], clamped, house-eased. */
export function ramp(
  frame: number,
  start: number,
  dur: number,
  easing = EASE,
): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  })
}

/** Fade in, hold, fade out — for anything with a lifetime. */
export function pulse(
  frame: number,
  start: number,
  dur: number,
  fade = 10,
): number {
  return interpolate(
    frame,
    [start, start + fade, start + dur - fade, start + dur],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE },
  )
}

/** Springy entrance — a touch of overshoot, no bounce. */
export function pop(frame: number, start: number, fps: number): number {
  return spring({
    frame: frame - start,
    fps,
    config: { damping: 18, mass: 0.7, stiffness: 140 },
  })
}

/** Staggered entrance for lists/grids: item `i` starts `gap` frames later. */
export function stagger(
  frame: number,
  start: number,
  i: number,
  gap = 5,
  dur = 22,
): number {
  return ramp(frame, start + i * gap, dur)
}

/** Rounds to a whole pixel — avoids sub-pixel text shimmer between frames. */
export const px = (n: number): number => Math.round(n)

/**
 * Deterministic pseudo-random in [0,1) from an integer seed.
 * Same generator the app's memory graph uses for its jitter.
 */
export function seeded(i: number): number {
  return ((i * 9301 + 49297) % 233280) / 233280
}
