/**
 * Frame-driven text typing.
 *
 * Returns the substring visible at `frame` — pure, so scrubbing backwards in
 * the studio shows exactly what a forward render produces.
 */

export interface Typed {
  text: string
  done: boolean
  /** True on alternating 8-frame beats while typing, for a blinking caret. */
  caret: boolean
}

export function typeOut(
  full: string,
  frame: number,
  start: number,
  cps = 26,
  fps = 30,
): Typed {
  const elapsed = Math.max(0, frame - start)
  const chars = Math.floor((elapsed / fps) * cps)
  const shown = Math.min(full.length, chars)
  return {
    text: full.slice(0, shown),
    done: shown >= full.length,
    caret: Math.floor(frame / 8) % 2 === 0,
  }
}

/** Frames needed to type `text` at `cps` — lets scenes lay out without magic numbers. */
export function typeDuration(text: string, cps = 26, fps = 30): number {
  return Math.ceil((text.length / cps) * fps)
}

/**
 * Reveals a list of lines one at a time, `gap` frames apart.
 * Returns how many lines are visible at `frame`.
 */
export function revealLines(
  frame: number,
  start: number,
  count: number,
  gap = 9,
): number {
  if (frame < start) return 0
  return Math.min(count, Math.floor((frame - start) / gap) + 1)
}
