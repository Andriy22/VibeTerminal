/**
 * Beat 4 — plan usage.
 *
 * The camera pushes into the top-right meter cluster while both meters count
 * up to their real values, crossing the app's own 50% warn and 80% danger
 * thresholds on the way. The hover card then expands with the detail.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { L, makeSkin } from '../theme'
import { PANES, USAGE } from '../data'
import { AppShell } from '../ui/AppShell'
import { UsageTooltip } from '../ui/UsageMeter'
import { Camera } from '../lib/camera'
import { ramp, EASE_CAM } from '../lib/anim'

const skin = makeSkin('vibe-dark', 'standard')

/** The meter cluster's rect on the canvas — what the camera pushes into. */
const METER_RECT = {
  x: L.window.x + L.window.w - 560,
  y: L.window.y,
  w: 540,
  h: L.topbar + 210,
}

export const Limits: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Push in, hold, pull back out so the next beat starts wide again.
  const push =
    ramp(frame, 6, 34, EASE_CAM) - ramp(frame, durationInFrames - 30, 26, EASE_CAM)

  // Bars count up from a low starting point to the real figures.
  const fill = ramp(frame, 20, 64)
  const claude5h = 12 + (USAGE.claude.fiveHour - 12) * fill
  const claudeWk = 20 + (USAGE.claude.weekly - 20) * fill
  const codex5h = 15 + (USAGE.codex.fiveHour - 15) * fill
  const codexWk = 24 + (USAGE.codex.weekly - 24) * fill

  const tooltip = ramp(frame, 96, 18) - ramp(frame, durationInFrames - 44, 16)

  const meters = [
    {
      kind: 'claude' as const,
      windows: [
        { label: '5h', value: claude5h },
        { label: 'wk', value: claudeWk },
      ],
    },
    {
      kind: 'codex' as const,
      windows: [
        { label: '5h', value: codex5h },
        { label: 'wk', value: codexWk },
      ],
    },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Camera rect={METER_RECT} amount={push} padding={70} maxScale={2.1}>
        <AppShell
          skin={skin}
          meters={meters}
          meterFocus={push}
          paneEntrances={PANES.map(() => 1)}
          topBarExtra={
            tooltip > 0.01 ? (
              <div style={{ position: 'absolute', right: 210, top: L.topbar + 10 }}>
                <UsageTooltip
                  skin={skin}
                  kind="claude"
                  fiveHour={claude5h}
                  weekly={claudeWk}
                  plan={USAGE.claude.plan}
                  resetsAt={USAGE.claude.resetsAt}
                  weeklyResetsAt={USAGE.claude.weeklyResetsAt}
                  open={tooltip}
                />
              </div>
            ) : null
          }
        />
      </Camera>
    </div>
  )
}
