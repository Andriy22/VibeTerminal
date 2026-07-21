import { useEffect, useRef, useState } from 'react'
import type { AgentKind, GitInfo } from '@shared/types'
import { useApp } from '../store'
import { kindSummary, nextKind } from '../kinds'
import PathInput from './PathInput'
import PreviewGrid from './PreviewGrid'
import Icon from './Icon'
import Segmented from './Segmented'
import { IlloAgents, IlloApp, IlloBranches, IlloTools } from './Illustrations'

const COUNTS = [1, 2, 4, 6, 8]
const COL_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Auto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' }
]

const STEPS = [
  {
    label: 'Folder',
    icon: 'folder',
    desc: 'Where your agents will work, and what to call the workspace.',
    illo: <IlloApp />,
    tips: [
      'Type an absolute path like in a shell — Tab and ↑↓ complete folders.',
      'Git is detected automatically — repo or plain folder, nothing is created for you.',
      'The same folder can host several workspaces with different names.'
    ]
  },
  {
    label: 'Layout',
    icon: 'grid',
    desc: 'How many agents, of which kind, arranged how.',
    illo: <IlloAgents />,
    tips: [
      'Every agent gets a callsign: alpha, bravo, charlie…',
      'Click a preview cell to switch it between claude, codex and plain shell.',
      'Auto grid keeps panes two columns wide so agent TUIs stay readable.'
    ]
  },
  {
    label: 'Branches',
    icon: 'branch',
    desc: 'Which branch diffs and reviews compare against.',
    illo: <IlloBranches />,
    tips: [
      'Everything runs in your real checkout until you say otherwise.',
      'Branch off any pane into .worktrees/<task> when work needs isolation.',
      'Diffs always compare against the base branch you pick here.'
    ]
  },
  {
    label: 'Launch',
    icon: 'check',
    desc: 'Confirm the setup and launch your agents.',
    illo: <IlloTools />,
    tips: [
      'Per-workspace flags override the defaults from Settings.',
      'YOLO mode removes every permission prompt — fastest, but the agents act unsupervised.',
      'Everything here can be changed later; grid even live from the top bar.'
    ]
  }
]

export default function LauncherModal(): JSX.Element {
  const openLauncher = useApp((s) => s.openLauncher)
  const setActive = useApp((s) => s.setActive)
  const snapshot = useApp((s) => s.snapshot)

  const [step, setStep] = useState(0)
  const [path, setPath] = useState('~/')
  const [expandedPath, setExpandedPath] = useState('')
  const [pathValid, setPathValid] = useState(false)
  const [scan, setScan] = useState<GitInfo | null>(null)
  const [count, setCount] = useState(4)
  const [kinds, setKinds] = useState<AgentKind[]>(Array(8).fill('claude'))
  const [cols, setCols] = useState<number | null>(null)
  const [baseBranch, setBaseBranch] = useState('')
  const [yolo, setYolo] = useState(false)
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [claudeFlags, setClaudeFlags] = useState('')
  const [codexFlags, setCodexFlags] = useState('')
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef(0)

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      const expanded = await window.vibe.expandPath(path.trim())
      const stat = await window.vibe.statPath(path.trim())
      setExpandedPath(expanded)
      setPathValid(stat.isDirectory)
      if (stat.isDirectory) {
        const result = await window.vibe.gitInfo(expanded)
        setScan(result)
        setBaseBranch('')
        if (!nameTouched) {
          setName(expanded.replace(/\/+$/, '').split('/').pop() ?? '')
        }
      } else {
        setScan(null)
      }
    }, 200)
    return () => window.clearTimeout(debounceRef.current)
  }, [path, nameTouched])

  const duplicate =
    pathValid &&
    snapshot.some(
      (w) =>
        w.config.path === expandedPath &&
        w.config.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
  const folderReady = pathValid && !!name.trim() && !duplicate

  const cycleKind = (index: number): void => {
    setKinds((prev) => prev.map((k, i) => (i === index ? nextKind(k) : k)))
  }

  const launch = async (): Promise<void> => {
    if (!folderReady || launching) return
    setLaunching(true)
    setError('')
    try {
      const id = await window.vibe.createWorkspace({
        name: name.trim(),
        path: expandedPath,
        panes: kinds.slice(0, count).map((kind) => ({ kind })),
        baseBranch: baseBranch || null,
        gridCols: cols,
        yolo,
        claudeFlags: claudeFlags.trim() || undefined,
        codexFlags: codexFlags.trim() || undefined
      })
      setActive(id)
      openLauncher(false)
    } catch (err) {
      setError(String((err as Error).message ?? err))
      setLaunching(false)
    }
  }

  const pickFolder = async (): Promise<void> => {
    const folder = await window.vibe.pickFolder()
    if (folder) setPath(folder)
  }

  const isolationLabel = scan?.isRepo
    ? 'shared checkout · branch off on demand'
    : 'shared folder (not a repo)'

  const stepInfo = STEPS[step]

  return (
    <div className="modal-backdrop" onMouseDown={() => openLauncher(false)}>
      <div className="modal launcher-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="stepper">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => {
                if (i < step || (i > step && folderReady)) setStep(i)
              }}
            >
              <span className="step-dot">
                <Icon name={i < step ? 'check' : s.icon} size={12} />
              </span>
              <span className="step-label">{s.label}</span>
              {i < STEPS.length - 1 && (
                <span className={`step-line ${i < step ? 'filled' : ''}`} />
              )}
            </div>
          ))}
        </div>

        <div className="launcher-columns">
          <div className="launcher-body launcher-step" key={`main-${step}`}>
            <div className="panel-head">
              <h3>{stepInfo.label}</h3>
              <p>{stepInfo.desc}</p>
            </div>

            {step === 0 && (
              <>
                <label className="field-label">Project folder</label>
                <div className="field-row">
                  <PathInput value={path} onChange={setPath} />
                  <button className="mini-button" onClick={() => void pickFolder()}>
                    Browse…
                  </button>
                </div>
                {!pathValid ? (
                  <div className="status-banner quiet">
                    Type an absolute path — Tab completes folders, like cd
                  </div>
                ) : scan?.isRepo ? (
                  <div className="status-banner good">
                    <Icon name="check" size={12} />
                    git repo
                    {scan.branch && (
                      <>
                        {' — branch '}
                        <code>{scan.branch}</code>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="status-banner caution">
                    not a git repo — agents share the folder without branch isolation
                  </div>
                )}

                <label className="field-label">Workspace name</label>
                <input
                  className="text-input"
                  value={name}
                  placeholder="Workspace name"
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameTouched(true)
                  }}
                />
                {duplicate && (
                  <div className="status-banner caution">
                    “{name.trim()}” already exists for this folder — pick another name
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <label className="field-label">Agents</label>
                <div className="count-chips">
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      className={`chip big ${count === n ? 'selected' : ''}`}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <span className="chip-summary">{kindSummary(kinds.slice(0, count))}</span>
                </div>
                <div className="count-chips cols-row">
                  <span className="inline-label">grid columns</span>
                  <Segmented options={COL_OPTIONS} value={cols} onChange={setCols} />
                </div>
                <PreviewGrid count={count} kinds={kinds} cols={cols} onCycle={cycleKind} />
                <div className="git-line dim">Click a cell to switch its agent type.</div>
              </>
            )}

            {step === 2 && (
              <>
                {scan?.isRepo && scan.branches.length > 0 ? (
                  <div className="field-row">
                    <label className="field-label inline">diff base branch</label>
                    <select
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                    >
                      <option value="">auto ({scan.branch ?? 'default'})</option>
                      {scan.branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="git-line dim">
                    Not a git repo — agents share the folder directly.
                  </div>
                )}
                <div className="git-line dim">
                  Agents work in your checkout. When two tasks overlap, hit ⑂ on a pane
                  (or just ask the agent) to branch off into an isolated worktree.
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="summary-card">
                  <div className="summary-row">
                    <span>workspace</span>
                    <strong>{name.trim() || '—'}</strong>
                  </div>
                  <div className="summary-row">
                    <span>folder</span>
                    <code>{expandedPath.replace(/^\/Users\/[^/]+/, '~')}</code>
                  </div>
                  <div className="summary-row">
                    <span>agents</span>
                    <strong>{kindSummary(kinds.slice(0, count))}</strong>
                  </div>
                  <div className="summary-row">
                    <span>grid</span>
                    <strong>{cols ? `${cols} columns` : 'auto (2-wide)'}</strong>
                  </div>
                  <div className="summary-row">
                    <span>isolation</span>
                    <strong>{isolationLabel}</strong>
                  </div>
                  <div className="summary-row">
                    <span>permissions</span>
                    <strong className={yolo ? 'warn' : ''}>
                      {yolo ? 'YOLO — no prompts, full access' : 'normal — agents ask first'}
                    </strong>
                  </div>
                </div>

                <label className={`yolo-card ${yolo ? 'armed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={yolo}
                    onChange={(e) => setYolo(e.target.checked)}
                  />
                  <span className="yolo-text">
                    <strong>YOLO mode</strong>
                    <span>
                      claude runs with <code>--dangerously-skip-permissions</code>, codex
                      with full access and no approvals. Fast, unsupervised — keep an eye
                      on the diff view.
                    </span>
                  </span>
                </label>

                <label className="field-label">claude flags — this workspace</label>
                <input
                  className="text-input mono"
                  value={claudeFlags}
                  placeholder="e.g. --model opus"
                  onChange={(e) => setClaudeFlags(e.target.value)}
                />
                <label className="field-label">codex flags — this workspace</label>
                <input
                  className="text-input mono"
                  value={codexFlags}
                  placeholder="e.g. --full-auto"
                  onChange={(e) => setCodexFlags(e.target.value)}
                />

                {error && <div className="error-line">{error}</div>}
              </>
            )}
          </div>

          <aside className="launcher-aside launcher-step" key={`aside-${step}`}>
            <div className="aside-illo">{stepInfo.illo}</div>
            <div className="aside-title">How it works</div>
            <ul className="aside-tips">
              {stepInfo.tips.map((tip, i) => (
                <li key={i} style={{ animationDelay: `${80 + i * 60}ms` }}>
                  {tip}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="settings-footer">
          <button className="mini-button" onClick={() => openLauncher(false)}>
            Cancel
          </button>
          <span className="footer-spacer" />
          {step > 0 && (
            <button className="mini-button icon-leading" onClick={() => setStep(step - 1)}>
              <Icon name="chevronLeft" size={12} /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="primary-button icon-trailing"
              disabled={!folderReady}
              onClick={() => setStep(step + 1)}
            >
              Next <Icon name="chevronRight" size={12} />
            </button>
          ) : (
            <button
              className={`primary-button ${yolo ? 'danger' : ''}`}
              disabled={!folderReady || launching}
              onClick={() => void launch()}
            >
              {launching
                ? 'Launching…'
                : `${yolo ? '⚡ ' : ''}Launch ${count} agent${count > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
