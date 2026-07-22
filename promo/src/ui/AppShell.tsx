/**
 * The standing set: desktop, window, sidebar, top bar, pane grid.
 *
 * Nearly every beat is shot on this, with modals and overlays passed as
 * children — that's what makes the promo read as one continuous session
 * rather than a sequence of unrelated screens.
 */

import React from 'react'
import { Kind, L, Skin } from '../theme'
import { PANES, REPO_PATH } from '../data'
import { AppWindow, Desktop, TrafficLights } from './Window'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PaneGrid } from './Pane'

interface Props {
  skin: Skin
  meters?: { kind: Kind; windows: { label: string; value: number }[] }[]
  meterFocus?: number
  memoryLit?: number
  gearLit?: number
  mic?: { state: 'idle' | 'recording' | 'transcribing'; level?: number }
  paneEntrances?: number[]
  visibleLines?: number[]
  focusedIndex?: number
  extraLine?: { index: number; text: string; caret?: boolean } | null
  glowIndex?: { index: number; amount: number } | null
  /** 0–1 opacity of the "No agents running" state over the grid. */
  emptyState?: number
  /** Hue shift on the desktop gradient, for theme changes. */
  hue?: number
  /** Anchored to the top bar — tooltips and menus. */
  topBarExtra?: React.ReactNode
  /** Overlays the whole window — modals. */
  children?: React.ReactNode
}

export const AppShell: React.FC<Props> = ({
  skin,
  meters = [],
  meterFocus = 0,
  memoryLit = 0,
  gearLit = 0,
  mic,
  paneEntrances,
  visibleLines,
  focusedIndex,
  extraLine,
  glowIndex,
  emptyState = 0,
  hue = 0,
  topBarExtra,
  children,
}) => (
  <>
    <Desktop skin={skin} hue={hue} />
    <AppWindow skin={skin}>
      <Sidebar skin={skin} gearLit={gearLit} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <TopBar
          skin={skin}
          name="auth refactor"
          path={REPO_PATH}
          color="#d97757"
          meters={meters}
          meterFocus={meterFocus}
          memoryLit={memoryLit}
          mic={mic}
        >
          {topBarExtra}
        </TopBar>
        <PaneGrid
          skin={skin}
          panes={PANES}
          entrances={paneEntrances}
          visibleLines={visibleLines}
          focusedIndex={focusedIndex}
          extraLine={extraLine}
          glowIndex={glowIndex}
          emptyState={emptyState}
        />
      </div>

      {/* Traffic lights sit above the sidebar, as in the real hidden-inset bar. */}
      <div style={{ position: 'absolute', left: 20, top: (L.topbar - 15) / 2 }}>
        <TrafficLights />
      </div>

      {children}
    </AppWindow>
  </>
)
