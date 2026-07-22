import React from 'react'
import { Composition } from 'remotion'
import { BeatPreview, Promo } from './Promo'
import { BEATS, DURATION, FPS, HEIGHT, WIDTH } from './script'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ music: true }}
    />

    {/* One composition per beat, each starting at its own frame 0, so a single
        scene can be scrubbed or stilled without playing the whole 60 seconds. */}
    {BEATS.map((b) => (
      <Composition
        key={b.id}
        id={`beat-${b.id}`}
        component={BeatPreview}
        durationInFrames={b.dur}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ beatId: b.id }}
      />
    ))}
  </>
)
