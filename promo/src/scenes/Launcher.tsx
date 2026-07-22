/**
 * Beat 2 — the launcher wizard.
 *
 * Walks all four steps (Folder → Layout → Isolation → Launch), then the modal
 * dismisses and the grid fills in behind it. Step timings live in STEPS below
 * and are relative to the beat, so the whole wizard retimes with the beat's
 * duration in script.ts.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { KIND, Kind, MONO, makeSkin, UI } from '../theme'
import { BASE_BRANCH, PANES, REPO_NAME, REPO_PATH, USAGE_METERS } from '../data'
import { AppShell } from '../ui/AppShell'
import { Modal, PanelHead, FieldLabel } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import { ramp, pop, stagger } from '../lib/anim'
import { typeOut } from '../lib/typing'

const skin = makeSkin('vibe-dark', 'standard')

const STEPS = [
  { at: 8, label: 'Folder', icon: 'folder', desc: 'Where your agents will work, and what to call the workspace.' },
  { at: 104, label: 'Layout', icon: 'grid', desc: 'How many agents, of which kind, arranged how.' },
  { at: 196, label: 'Isolation', icon: 'branch', desc: 'How agents are isolated, and which branch diffs compare against.' },
  { at: 274, label: 'Launch', icon: 'check', desc: 'Confirm the setup and launch your agents.' },
]

const MODAL_W = 1180
const MODAL_H = 660

const currentStep = (frame: number): number => {
  let step = 0
  STEPS.forEach((s, i) => {
    if (frame >= s.at) step = i
  })
  return step
}

const Stepper: React.FC<{ step: number }> = ({ step }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      padding: '20px 28px 0',
      position: 'relative',
    }}
  >
    {STEPS.map((s, i) => {
      const done = i < step
      const active = i === step
      return (
        <React.Fragment key={s.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: done || active ? skin.accent : 'transparent',
                color: done || active ? skin.accentContrast : skin.textDim,
                border: `1.5px solid ${done || active ? skin.accent : skin.border}`,
              }}
            >
              <Icon name={done ? 'check' : s.icon} size={15} />
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: active ? 600 : 400,
                color: active ? skin.text : skin.textDim,
              }}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span
              style={{
                flex: 1,
                height: 2,
                margin: '0 14px',
                borderRadius: 2,
                background: skin.border,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: i < step ? '100%' : '0%',
                  background: skin.accent,
                }}
              />
            </span>
          )}
        </React.Fragment>
      )
    })}
  </div>
)

const Aside: React.FC<{ title: string; tips: string[]; frame: number; since: number }> = ({
  title,
  tips,
  frame,
  since,
}) => (
  <aside
    style={{
      width: 340,
      flex: 'none',
      padding: '28px 26px',
      borderLeft: `1px solid ${skin.border}`,
      background: skin.surfaceSoft,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 600, color: skin.text }}>{title}</div>
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {tips.map((tip, i) => {
        const t = stagger(frame, since + 6, i, 6, 18)
        return (
          <li
            key={tip}
            style={{
              fontSize: 15,
              lineHeight: 1.5,
              color: skin.textDim,
              display: 'flex',
              gap: 10,
              opacity: t,
              transform: `translateY(${(1 - t) * 8}px)`,
            }}
          >
            <span style={{ color: skin.accent }}>·</span>
            {tip}
          </li>
        )
      })}
    </ul>
  </aside>
)

/** Mini grid preview on the Layout step. */
const PreviewGrid: React.FC<{ kinds: Kind[]; frame: number }> = ({ kinds, frame }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10,
      marginTop: 14,
      height: 220,
    }}
  >
    {kinds.map((k, i) => {
      const t = stagger(frame, STEPS[1].at + 10, i, 5, 16)
      return (
        <div
          key={i}
          style={{
            borderRadius: 9,
            border: `1px solid ${skin.border}`,
            borderTop: `2px solid ${KIND[k].color}`,
            background: skin.paneBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            fontSize: 17,
            color: KIND[k].color,
            opacity: t,
            transform: `scale(${0.94 + t * 0.06})`,
          }}
        >
          <span style={{ fontSize: 20 }}>{KIND[k].symbol}</span>
          {KIND[k].label}
        </div>
      )
    })}
  </div>
)

export const Launcher: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const step = currentStep(frame)
  const since = STEPS[step].at

  // Modal opens, rides the whole wizard, then dismisses for the launch.
  const dismissAt = durationInFrames - 74
  const open = ramp(frame, 4, 18) * (1 - ramp(frame, dismissAt, 16))

  // Step 0 — path types in, then the git banner confirms.
  const path = typeOut(REPO_PATH, frame, STEPS[0].at + 10, 22, fps)
  const gitBanner = ramp(frame, STEPS[0].at + 46, 14)

  // Step 1 — agent count settles on 4; cells cycle kind.
  const counts = [1, 2, 4, 6, 8]
  const countSelected = counts.indexOf(4)
  const kinds: Kind[] =
    frame < STEPS[1].at + 44
      ? ['claude', 'claude', 'claude', 'claude']
      : frame < STEPS[1].at + 58
        ? ['claude', 'claude', 'codex', 'claude']
        : ['claude', 'claude', 'codex', 'shell']

  // Step 2 — worktree card selected a beat after arriving.
  const isoChoice = frame < STEPS[2].at + 30 ? 0 : 1

  // Step 3 — summary rows land one at a time, then the button arms.
  const summaryRows: [string, string][] = [
    ['workspace', 'auth refactor'],
    ['folder', REPO_PATH],
    ['agents', '3 claude · 1 codex'],
    ['grid', 'auto (2-wide)'],
    ['isolation', 'worktree per agent (detached @ main)'],
    ['permissions', 'normal — agents ask first'],
  ]
  const launchPress = ramp(frame, dismissAt - 12, 8)

  // Panes fill in behind once the modal is gone.
  const paneEntrances = PANES.map((_, i) => stagger(frame, dismissAt + 8, i, 7, 20))

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppShell
        skin={skin}
        paneEntrances={paneEntrances}
        emptyState={1 - ramp(frame, dismissAt, 20)}
        // Account-level, so they read even before anything is running — and
        // keeping them on every beat holds the top bar visually continuous.
        meters={USAGE_METERS}
      >
        <Modal skin={skin} open={open} width={MODAL_W} height={MODAL_H}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: UI }}>
            <Stepper step={step} />

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <div style={{ flex: 1, padding: '26px 28px', minWidth: 0 }}>
                <PanelHead skin={skin} title={STEPS[step].label} desc={STEPS[step].desc} />

                {step === 0 && (
                  <>
                    <FieldLabel skin={skin}>Project folder</FieldLabel>
                    <div
                      style={{
                        height: 46,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 14px',
                        borderRadius: 10,
                        background: skin.inputBg,
                        border: `1px solid ${skin.accent}`,
                        fontFamily: MONO,
                        fontSize: 17,
                        color: skin.text,
                      }}
                    >
                      {path.text}
                      {!path.done && path.caret && (
                        <span style={{ background: skin.accent, width: 9, height: 22, marginLeft: 2 }} />
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '10px 14px',
                        borderRadius: 9,
                        background: '#57ab5a18',
                        border: '1px solid #57ab5a44',
                        color: '#57ab5a',
                        fontSize: 15,
                        opacity: gitBanner,
                        transform: `translateY(${(1 - gitBanner) * 6}px)`,
                      }}
                    >
                      <Icon name="check" size={15} />
                      git repo — branch{' '}
                      <code style={{ fontFamily: MONO }}>{BASE_BRANCH}</code>
                    </div>

                    <FieldLabel skin={skin}>Workspace name</FieldLabel>
                    <div
                      style={{
                        height: 46,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 14px',
                        borderRadius: 10,
                        background: skin.inputBg,
                        border: `1px solid ${skin.border}`,
                        fontSize: 17,
                        color: gitBanner > 0.5 ? skin.text : skin.textDim,
                      }}
                    >
                      {gitBanner > 0.5 ? REPO_NAME : 'Workspace name'}
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <FieldLabel skin={skin}>Agents</FieldLabel>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {counts.map((n, i) => (
                        <span
                          key={n}
                          style={{
                            width: 52,
                            height: 44,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 10,
                            fontSize: 19,
                            fontWeight: 600,
                            color: i === countSelected ? skin.accentContrast : skin.textDim,
                            background: i === countSelected ? skin.accent : skin.inputBg,
                            border: `1px solid ${i === countSelected ? skin.accent : skin.border}`,
                          }}
                        >
                          {n}
                        </span>
                      ))}
                      <span style={{ marginLeft: 10, fontSize: 15, color: skin.textDim }}>
                        3 claude · 1 codex
                      </span>
                    </div>
                    <PreviewGrid kinds={kinds} frame={frame} />
                    <div style={{ marginTop: 12, fontSize: 14, color: skin.textDim }}>
                      Click a cell to switch its agent type.
                    </div>
                  </>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                    {[
                      { icon: 'folder', title: 'Shared checkout', sub: 'Branch off on demand with ⑂' },
                      { icon: 'branch', title: 'Worktree per agent', sub: 'Isolated from the start' },
                    ].map((card, i) => {
                      const selected = i === isoChoice
                      return (
                        <div
                          key={card.title}
                          style={{
                            flex: 1,
                            padding: '22px 20px',
                            borderRadius: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            background: selected ? `${skin.accent}14` : skin.inputBg,
                            border: `1.5px solid ${selected ? skin.accent : skin.border}`,
                            color: skin.text,
                            position: 'relative',
                          }}
                        >
                          {selected && (
                            <span
                              style={{
                                position: 'absolute',
                                top: 14,
                                right: 14,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: skin.accent,
                                color: skin.accentContrast,
                                display: 'grid',
                                placeItems: 'center',
                                transform: `scale(${pop(frame, STEPS[2].at + 30, fps)})`,
                              }}
                            >
                              <Icon name="check" size={13} />
                            </span>
                          )}
                          <span style={{ color: selected ? skin.accent : skin.textDim }}>
                            <Icon name={card.icon} size={24} />
                          </span>
                          <strong style={{ fontSize: 19 }}>{card.title}</strong>
                          <span style={{ fontSize: 15, color: skin.textDim }}>{card.sub}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {step === 3 && (
                  <div
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${skin.border}`,
                      background: skin.inputBg,
                      overflow: 'hidden',
                    }}
                  >
                    {summaryRows.map(([k, v], i) => {
                      const t = stagger(frame, STEPS[3].at + 6, i, 5, 16)
                      return (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '13px 18px',
                            borderBottom:
                              i < summaryRows.length - 1 ? `1px solid ${skin.border}` : 'none',
                            opacity: t,
                            transform: `translateX(${(1 - t) * -10}px)`,
                          }}
                        >
                          <span style={{ fontSize: 15, color: skin.textDim }}>{k}</span>
                          <strong
                            style={{
                              fontSize: 16,
                              color: skin.text,
                              fontFamily: k === 'folder' ? MONO : UI,
                              fontWeight: 600,
                            }}
                          >
                            {v}
                          </strong>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <Aside
                key={step}
                frame={frame}
                since={since}
                title={step === 2 ? 'Worktree per agent' : 'How it works'}
                tips={
                  [
                    [
                      'Type an absolute path like in a shell — Tab completes folders.',
                      'Git is detected automatically — repo or plain folder.',
                      'The same folder can host several workspaces.',
                    ],
                    [
                      'Every agent gets a callsign: alpha, bravo, charlie…',
                      'Click a preview cell to switch between claude, codex and shell.',
                      'Auto grid keeps panes two columns wide.',
                    ],
                    [
                      'alpha keeps the real checkout; bravo, charlie… get .worktrees/<callsign>.',
                      'Worktrees start detached at your base branch.',
                      'Diffs always compare against that base.',
                    ],
                    [
                      'Per-workspace flags override the defaults from Settings.',
                      'YOLO mode removes every permission prompt.',
                      'Everything here can be changed later.',
                    ],
                  ][step]
                }
              />
            </div>

            {/* footer */}
            <div
              style={{
                height: 74,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 26px',
                borderTop: `1px solid ${skin.border}`,
              }}
            >
              <span
                style={{
                  padding: '10px 18px',
                  borderRadius: 9,
                  fontSize: 15,
                  color: skin.textDim,
                  border: `1px solid ${skin.border}`,
                }}
              >
                Cancel
              </span>
              <span style={{ flex: 1 }} />
              {step > 0 && (
                <span
                  style={{
                    padding: '10px 18px',
                    borderRadius: 9,
                    fontSize: 15,
                    color: skin.textDim,
                    border: `1px solid ${skin.border}`,
                  }}
                >
                  ‹ Back
                </span>
              )}
              <span
                style={{
                  padding: '11px 22px',
                  borderRadius: 9,
                  fontSize: 16,
                  fontWeight: 600,
                  color: skin.accentContrast,
                  background: skin.accent,
                  transform: `scale(${1 - launchPress * 0.04})`,
                  boxShadow: `0 0 ${launchPress * 26}px ${skin.accent}88`,
                }}
              >
                {step === 3 ? 'Launch 4 agents' : 'Next ›'}
              </span>
            </div>
          </div>
        </Modal>
      </AppShell>
    </div>
  )
}
