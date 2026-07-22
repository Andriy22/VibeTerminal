/**
 * Beat 5 — project memory (beta).
 *
 * The ◈ button opens the memory browser: notes list first, then the view
 * toggles to Graph and the nodes spring in with their [[links]] drawing
 * between them. Finally a note opens so the markdown is legible.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { L, MONO, makeSkin, UI } from '../theme'
import { MEMORY_NOTES, PANES, USAGE_METERS } from '../data'
import { AppShell } from '../ui/AppShell'
import { Modal } from '../ui/Modal'
import { MemoryGraph, ScopeLegend, scopeColor } from '../ui/MemoryGraph'
import { ramp, stagger } from '../lib/anim'
import { revealLines } from '../lib/typing'

const skin = makeSkin('vibe-dark', 'standard')

const SCOPES = ['orbital', 'project']
const GRAPH_AT = 108
const SELECT_AT = 196
const SELECTED_ID = 'session-store-choice'

const GRAPH_W = 700
const GRAPH_H = 430
/** The app's force constants are tuned for a 470×400 panel; this box is larger. */
const GRAPH_SPREAD = 1.7

export const Memory: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const open = ramp(frame, 8, 18) * (1 - ramp(frame, durationInFrames - 20, 16))
  const graphMode = frame >= GRAPH_AT
  const selected = frame >= SELECT_AT ? SELECTED_ID : undefined
  const note = MEMORY_NOTES.find((n) => n.id === SELECTED_ID)!

  const nodesIn = MEMORY_NOTES.map((_, i) => stagger(frame, GRAPH_AT + 6, i, 4, 18))
  const edgesIn = ramp(frame, GRAPH_AT + 34, 40)
  const bodyLines = note.body.split('\n')
  const shownBody = revealLines(frame, SELECT_AT + 10, bodyLines.length, 4)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppShell
        skin={skin}
        memoryLit={ramp(frame, 0, 12)}
        meters={USAGE_METERS}
        paneEntrances={PANES.map(() => 1)}
      >
        <Modal skin={skin} open={open} width={1280} height={660}>
          {/* left: search, list or graph */}
          <div
            style={{
              width: graphMode ? 760 : 460,
              flex: 'none',
              padding: '24px 22px',
              borderRight: `1px solid ${skin.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              fontFamily: UI,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: 24, margin: 0, color: skin.text, fontWeight: 600 }}>
                Memory
              </h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  color: skin.accent,
                  border: `1px solid ${skin.accent}66`,
                  background: `${skin.accent}18`,
                  borderRadius: 6,
                  padding: '3px 8px',
                }}
              >
                BETA
              </span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  display: 'inline-flex',
                  padding: 3,
                  gap: 2,
                  borderRadius: 9,
                  background: skin.inputBg,
                  border: `1px solid ${skin.border}`,
                }}
              >
                {['List', 'Graph'].map((v, i) => {
                  const active = (i === 1) === graphMode
                  return (
                    <span
                      key={v}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 7,
                        fontSize: 14,
                        fontWeight: active ? 600 : 400,
                        color: active ? skin.accentContrast : skin.textDim,
                        background: active ? skin.accent : 'transparent',
                      }}
                    >
                      {v}
                    </span>
                  )
                })}
              </span>
            </div>

            <div
              style={{
                height: 42,
                display: 'flex',
                alignItems: 'center',
                padding: '0 13px',
                borderRadius: 9,
                background: skin.inputBg,
                border: `1px solid ${skin.border}`,
                fontSize: 15,
                color: skin.textDim,
              }}
            >
              Search notes…
            </div>

            {graphMode ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <MemoryGraph
                  skin={skin}
                  notes={MEMORY_NOTES}
                  scopes={SCOPES}
                  width={GRAPH_W}
                  height={GRAPH_H}
                  nodesIn={nodesIn}
                  edgesIn={edgesIn}
                  selectedId={selected}
                  spread={GRAPH_SPREAD}
                />
                <ScopeLegend skin={skin} scopes={SCOPES} />
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {MEMORY_NOTES.map((n, i) => {
                  const t = stagger(frame, 26, i, 5, 18)
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '11px 13px',
                        borderRadius: 9,
                        border: `1px solid ${skin.border}`,
                        background: skin.inputBg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                        opacity: t,
                        transform: `translateY(${(1 - t) * 8}px)`,
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          fontSize: 16,
                          color: skin.text,
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: scopeColor(n.scope, SCOPES),
                          }}
                        />
                        {n.title}
                      </span>
                      <span style={{ fontSize: 13, color: skin.textDim, paddingLeft: 18 }}>
                        {n.scope}
                        {n.tags.length > 0 && ` · #${n.tags.join(' #')}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: L.font.tiny,
                color: skin.textDim,
                borderTop: `1px solid ${skin.border}`,
                paddingTop: 12,
              }}
            >
              <span>{MEMORY_NOTES.length} notes</span>
              <span
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: `1px solid ${skin.border}`,
                }}
              >
                Open folder
              </span>
            </div>
          </div>

          {/* right: note reader */}
          <div style={{ flex: 1, padding: '24px 26px', minWidth: 0, fontFamily: UI }}>
            {selected ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    paddingBottom: 14,
                    borderBottom: `1px solid ${skin.border}`,
                  }}
                >
                  <strong style={{ fontSize: 19, color: skin.text }}>{note.title}</strong>
                  <span style={{ fontSize: 13, color: skin.textDim }}>
                    {note.scope} · Jul 22, 14:08
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: MONO,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: skin.text,
                    margin: '16px 0 0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {bodyLines.slice(0, shownBody).join('\n')}
                </pre>
              </>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  color: skin.textDim,
                }}
              >
                <span style={{ fontSize: 54, color: skin.accent, opacity: 0.7 }}>◈</span>
                <span style={{ fontSize: 16 }}>Select a note to read it.</span>
              </div>
            )}
          </div>
        </Modal>
      </AppShell>
    </div>
  )
}
