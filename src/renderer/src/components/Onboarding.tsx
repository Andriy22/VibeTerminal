import { useEffect, useState } from 'react'
import { useApp } from '../store'
import Icon from './Icon'
import {
  IlloAgents,
  IlloApp,
  IlloBranches,
  IlloMemory,
  IlloTools,
  IlloViews
} from './Illustrations'

/* Illustrations are pure SVG built from the theme's CSS variables,
   so they recolor with every theme. */

const SLIDES = [
  {
    title: 'Welcome to VibeTerminal',
    body: 'Mission control for coding agents: run fleets of claude and codex sessions side by side in one window — each in a real terminal, arranged in a grid you control.',
    illo: <IlloApp />
  },
  {
    title: 'Launch a workspace',
    body: 'Pick a folder, choose how many agents and which kind — every agent gets a callsign (alpha, bravo, charlie…). The launcher walks you through it step by step.',
    illo: <IlloAgents />
  },
  {
    title: 'Agents never collide',
    body: 'All agents start in your checkout. Branch any pane off into its own worktree (⑂, or just ask the agent) when parallel tasks would collide.',
    illo: <IlloBranches />
  },
  {
    title: 'Files & Changes, built in',
    body: 'Switch views in the top bar: browse and edit files with git-aware highlighting, or review diffs per checkout — including what each agent committed on its branch.',
    illo: <IlloViews />
  },
  {
    title: 'Shared project memory',
    body: 'Agents read and write a per-project memory graph over MCP — decisions and gotchas survive across sessions and follow the repo wherever it goes. Browse it via ◈.',
    illo: <IlloMemory />
  },
  {
    title: 'The little big things',
    body: 'Live Claude & Codex rate-limit meters, voice dictation into the focused pane (⌘⇧D), and eight themes with adjustable glass — all in the top bar and Settings.',
    illo: <IlloTools />
  }
]

export default function Onboarding(): JSX.Element {
  const openOnboarding = useApp((s) => s.openOnboarding)
  const [index, setIndex] = useState(0)
  const last = index === SLIDES.length - 1

  const close = (): void => {
    localStorage.setItem('vt-onboarded', '1')
    openOnboarding(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1)
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, last])

  const slide = SLIDES[index]

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal onboarding-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="onb-illustration" key={index}>
          {slide.illo}
        </div>
        <div className="onb-content">
          <h2>{slide.title}</h2>
          <p>{slide.body}</p>
        </div>
        <div className="onb-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`onb-dot ${i === index ? 'active' : ''}`}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className="settings-footer">
          <button className="mini-button" onClick={close}>
            Skip
          </button>
          <span className="footer-spacer" />
          {index > 0 && (
            <button className="mini-button icon-leading" onClick={() => setIndex(index - 1)}>
              <Icon name="chevronLeft" size={12} /> Back
            </button>
          )}
          {last ? (
            <button className="primary-button" onClick={close}>
              Get started
            </button>
          ) : (
            <button
              className="primary-button icon-trailing"
              onClick={() => setIndex(index + 1)}
            >
              Next <Icon name="chevronRight" size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
