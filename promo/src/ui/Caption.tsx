/**
 * Lower-third caption. These are the video's subtitles — burned in, so the
 * promo reads with sound off (which is how it autoplays nearly everywhere).
 *
 * Keywords render in the accent colour and technical tokens in the mono font,
 * both declared per-caption in script.ts.
 */

import React from 'react'
import { Caption as CaptionSpec } from '../script'
import { MONO, Skin, UI } from '../theme'

/** Splits text so `hi` and `mono` substrings can be styled independently. */
function segment(
  text: string,
  hi: string[],
  mono: string[],
): { text: string; hi: boolean; mono: boolean }[] {
  const marks = [
    ...hi.map((t) => ({ t, hi: true, mono: false })),
    ...mono.map((t) => ({ t, hi: false, mono: true })),
  ].filter((m) => m.t && text.includes(m.t))

  if (marks.length === 0) return [{ text, hi: false, mono: false }]

  // Longest first, so "git worktree" wins over a nested "git".
  marks.sort((a, b) => b.t.length - a.t.length)

  let parts: { text: string; hi: boolean; mono: boolean }[] = [
    { text, hi: false, mono: false },
  ]
  for (const mark of marks) {
    const next: typeof parts = []
    for (const part of parts) {
      if (part.hi || part.mono || !part.text.includes(mark.t)) {
        next.push(part)
        continue
      }
      const chunks = part.text.split(mark.t)
      chunks.forEach((chunk, i) => {
        if (chunk) next.push({ text: chunk, hi: false, mono: false })
        if (i < chunks.length - 1)
          next.push({ text: mark.t, hi: mark.hi, mono: mark.mono })
      })
    }
    parts = next
  }
  return parts
}

interface Props {
  skin: Skin
  caption: CaptionSpec
  /** 0–1 visibility, from the caption's own fade envelope. */
  amount: number
}

export const Caption: React.FC<Props> = ({ skin, caption, amount }) => {
  const parts = segment(caption.text, caption.hi ?? [], caption.mono ?? [])

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 96,
        display: 'grid',
        placeItems: 'center',
        opacity: amount,
        transform: `translateY(${(1 - amount) * 12}px)`,
      }}
    >
      <div
        style={{
          fontFamily: UI,
          fontSize: 42,
          fontWeight: 600,
          letterSpacing: -0.4,
          color: '#ffffff',
          textAlign: 'center',
          padding: '14px 34px',
          borderRadius: 14,
          background: 'rgba(8,10,13,0.62)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          maxWidth: 1400,
        }}
      >
        {parts.map((p, i) => (
          <span
            key={i}
            style={{
              color: p.hi ? skin.accent : undefined,
              fontFamily: p.mono ? MONO : undefined,
              fontSize: p.mono ? 38 : undefined,
            }}
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  )
}
