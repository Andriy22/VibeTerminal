/**
 * The edit. Every frame number in the video comes from here.
 *
 * Retiming the promo means editing this file only — scenes read their own
 * duration from their beat and lay out internally in relative frames, so
 * nothing downstream hardcodes an absolute frame.
 */

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export interface Caption {
  /** Frames after the beat starts. */
  at: number
  dur: number
  text: string
  /** Substrings rendered in the accent colour. */
  hi?: string[]
  /** Substrings rendered in the mono font (paths, flags, commands). */
  mono?: string[]
}

export interface Beat {
  id: BeatId
  from: number
  dur: number
  captions: Caption[]
}

export type BeatId =
  | 'hook'
  | 'launcher'
  | 'customization'
  | 'limits'
  | 'memory'
  | 'dictation'
  | 'outro'

export const BEATS: Beat[] = [
  {
    id: 'hook',
    from: 0,
    dur: 180,
    captions: [
      { at: 24, dur: 66, text: 'Four agents. Four terminal tabs.' },
      {
        at: 96,
        dur: 72,
        text: 'One just overwrote the others.',
        hi: ['overwrote'],
      },
    ],
  },
  {
    id: 'launcher',
    from: 180,
    dur: 390,
    captions: [
      { at: 30, dur: 82, text: 'Point it at a folder.' },
      {
        at: 130,
        dur: 90,
        text: 'Pick how many agents — and which kind.',
        hi: ['how many'],
      },
      {
        at: 238,
        dur: 96,
        text: 'Each one isolated in its own git worktree.',
        hi: ['isolated'],
        mono: ['git worktree'],
      },
    ],
  },
  {
    id: 'customization',
    from: 570,
    dur: 330,
    captions: [
      { at: 24, dur: 96, text: 'Ten themes, applied live.', hi: ['live'] },
      {
        at: 140,
        dur: 96,
        text: 'Glass all the way through.',
        hi: ['Glass'],
      },
    ],
  },
  {
    id: 'limits',
    from: 900,
    dur: 240,
    captions: [
      {
        at: 24,
        dur: 90,
        text: 'Your plan limits, live in the top bar.',
        hi: ['live'],
      },
      {
        at: 126,
        dur: 90,
        text: 'So you see the wall before you hit it.',
        hi: ['before'],
      },
    ],
  },
  {
    id: 'memory',
    from: 1140,
    dur: 300,
    captions: [
      { at: 24, dur: 90, text: 'Agents forget. This one doesn’t.' },
      {
        at: 126,
        dur: 96,
        text: 'One memory graph, shared by every agent.',
        hi: ['shared by every agent'],
      },
      {
        at: 234,
        dur: 60,
        text: 'Searchable, linked, and it survives restarts.',
        hi: ['survives restarts'],
      },
    ],
  },
  {
    id: 'dictation',
    from: 1440,
    dur: 240,
    captions: [
      {
        at: 24,
        dur: 90,
        text: 'Hit the hotkey and just talk.',
        hi: ['just talk'],
      },
      {
        at: 132,
        dur: 90,
        text: 'It types into whichever pane has focus.',
        hi: ['focus'],
      },
    ],
  },
  {
    id: 'outro',
    from: 1680,
    dur: 120,
    captions: [],
  },
]

export const DURATION = BEATS.reduce((end, b) => Math.max(end, b.from + b.dur), 0)

export const beat = (id: BeatId): Beat => {
  const found = BEATS.find((b) => b.id === id)
  if (!found) throw new Error(`Unknown beat: ${id}`)
  return found
}
