/**
 * Top-level edit: mounts each beat over its frame range from script.ts, plus
 * the caption track and the optional music bed.
 */

import React from 'react'
import {
  AbsoluteFill,
  Html5Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { Beat, BEATS, BeatId, beat } from './script'
import { makeSkin } from './theme'
import { Caption } from './ui/Caption'
import { pulse } from './lib/anim'
import { Hook } from './scenes/Hook'
import { Launcher } from './scenes/Launcher'
import { Customization } from './scenes/Customization'
import { Limits } from './scenes/Limits'
import { Memory } from './scenes/Memory'
import { Dictation } from './scenes/Dictation'
import { Outro } from './scenes/Outro'

const SCENES: Record<BeatId, React.FC> = {
  hook: Hook,
  launcher: Launcher,
  customization: Customization,
  limits: Limits,
  memory: Memory,
  dictation: Dictation,
  outro: Outro,
}

const skin = makeSkin('vibe-dark', 'standard')

/**
 * Captions render above every scene so a modal can never clip them.
 * `offset` shifts the whole track, which is what lets a single beat be
 * previewed in isolation with its own captions still correctly timed.
 */
const CaptionTrack: React.FC<{ beats: Beat[]; offset?: number }> = ({
  beats,
  offset = 0,
}) => {
  const frame = useCurrentFrame()

  return (
    <>
      {beats.flatMap((b) =>
        b.captions.map((c) => {
          const amount = pulse(frame, b.from + c.at - offset, c.dur, 10)
          if (amount <= 0.001) return null
          return (
            <Caption
              key={`${b.id}-${c.at}`}
              skin={skin}
              caption={c}
              amount={amount}
            />
          )
        }),
      )}
    </>
  )
}

export const Promo: React.FC<{ music?: boolean }> = ({ music = false }) => (
  <AbsoluteFill style={{ background: '#05070a' }}>
    {BEATS.map((b) => {
      const Scene = SCENES[b.id]
      return (
        <Sequence key={b.id} from={b.from} durationInFrames={b.dur} name={b.id}>
          <Scene />
        </Sequence>
      )
    })}

    <CaptionTrack beats={BEATS} />

    {music && <Html5Audio src={staticFile('music.mp3')} volume={0.55} />}
  </AbsoluteFill>
)

/**
 * A single beat, starting at frame 0 — for scrubbing and stills while building,
 * without sitting through the whole minute.
 */
export const BeatPreview: React.FC<{ beatId: BeatId }> = ({ beatId }) => {
  const b = beat(beatId)
  const Scene = SCENES[beatId]

  return (
    <AbsoluteFill style={{ background: '#05070a' }}>
      <Scene />
      <CaptionTrack beats={[b]} offset={b.from} />
    </AbsoluteFill>
  )
}
