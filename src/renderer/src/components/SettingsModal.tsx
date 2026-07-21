import { useEffect, useState } from 'react'
import type { Settings, UsageDisplay } from '@shared/types'
import { GLASS_LEVELS, THEMES, type TerminalTheme } from '@shared/themes'
import { eventToHotkey, formatHotkey } from '../hotkey'
import { useApp } from '../store'
import Icon from './Icon'
import Segmented from './Segmented'

const USAGE_MODES: { id: UsageDisplay; label: string }[] = [
  { id: 'both', label: '5h + weekly' },
  { id: 'five_hour', label: '5h only' },
  { id: 'week', label: 'Weekly only' }
]

const TABS = [
  {
    id: 'appearance',
    icon: 'palette',
    label: 'Appearance',
    desc: 'Theme and glass — restyles the whole app instantly.'
  },
  {
    id: 'agents',
    icon: 'terminal',
    label: 'Agents',
    desc: 'Default launch flags and the shell every pane starts with.'
  },
  {
    id: 'usage',
    icon: 'gauge',
    label: 'Usage limits',
    desc: 'How the rate-limit meters in the top bar read.'
  },
  {
    id: 'dictation',
    icon: 'mic',
    label: 'Dictation',
    desc: 'Speak instead of typing — transcription lands in the focused pane.'
  },
  {
    id: 'memory',
    icon: 'memory',
    label: 'Memory',
    desc: 'Persistent project knowledge shared by every agent, across sessions.'
  }
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsModal(): JSX.Element {
  const openSettings = useApp((s) => s.openSettings)
  const setSettingsState = useApp((s) => s.setSettingsState)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<TabId>('appearance')
  const [dictationSource, setDictationSource] = useState<'manual' | 'codex' | 'none'>(
    'none'
  )

  useEffect(() => {
    void window.vibe.getSettings().then(setSettings)
    void window.vibe.getDictationSource().then(setDictationSource)
  }, [])

  const save = async (): Promise<void> => {
    if (settings) {
      await window.vibe.setSettings(settings)
      setSettingsState(settings)
    }
    openSettings(false)
  }

  if (!settings) return <></>

  const themeCard = (t: TerminalTheme): JSX.Element => (
    <button
      key={t.id}
      type="button"
      className={`theme-card ${settings.theme === t.id ? 'selected' : ''}`}
      style={{ background: t.ui.bg }}
      onClick={() => setSettings({ ...settings, theme: t.id })}
    >
      <span className="theme-name" style={{ color: t.ui.text }}>
        {t.name}
      </span>
      <span className="theme-swatches">
        {[t.colors.red, t.colors.green, t.colors.yellow, t.colors.blue, t.colors.magenta].map(
          (c, i) => (
            <span key={i} style={{ background: c }} />
          )
        )}
      </span>
    </button>
  )

  return (
    <div className="modal-backdrop" onMouseDown={() => openSettings(false)}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-body">
          <nav className="settings-tabs">
            <h2>Settings</h2>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`settings-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="settings-tab-glyph">
                  <Icon name={t.icon} size={14} />
                </span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            <div className="panel-head">
              <h3>{TABS.find((t) => t.id === tab)!.label}</h3>
              <p>{TABS.find((t) => t.id === tab)!.desc}</p>
            </div>
            {tab === 'appearance' && (
              <>
                <label className="field-label">Theme — dark</label>
                <div className="theme-grid">
                  {THEMES.filter((t) => t.appearance === 'dark').map(themeCard)}
                </div>

                <label className="field-label">Theme — light</label>
                <div className="theme-grid">
                  {THEMES.filter((t) => t.appearance === 'light').map(themeCard)}
                </div>

                <label className="field-label">Glass effect</label>
                <Segmented
                  options={GLASS_LEVELS.map((g) => ({ value: g.id, label: g.name }))}
                  value={settings.glass}
                  onChange={(glass) => setSettings({ ...settings, glass })}
                />
                <div className="git-line dim">
                  Transparency and blur of the window — Off is fully opaque, Heavy is
                  mostly desktop.
                </div>
              </>
            )}

            {tab === 'agents' && (
              <>
                <label className="field-label">Default claude flags</label>
                <input
                  className="text-input mono"
                  value={settings.claudeFlags}
                  placeholder="e.g. --model opus"
                  onChange={(e) =>
                    setSettings({ ...settings, claudeFlags: e.target.value })
                  }
                />

                <label className="field-label">Default codex flags</label>
                <input
                  className="text-input mono"
                  value={settings.codexFlags}
                  placeholder="e.g. --full-auto"
                  onChange={(e) => setSettings({ ...settings, codexFlags: e.target.value })}
                />

                <label className="field-label">Shell</label>
                <input
                  className="text-input mono"
                  value={settings.shell}
                  onChange={(e) => setSettings({ ...settings, shell: e.target.value })}
                />
                <div className="git-line dim">
                  Login shell every pane starts with. Flags apply to newly launched
                  agents; per-workspace overrides win.
                </div>
              </>
            )}

            {tab === 'usage' && (
              <>
                <label className="field-label">Windows shown in the meters</label>
                <Segmented
                  options={USAGE_MODES.map((m) => ({ value: m.id, label: m.label }))}
                  value={settings.usageDisplay}
                  onChange={(usageDisplay) => setSettings({ ...settings, usageDisplay })}
                />
                <div className="git-line dim">
                  Claude and codex limits are read live from your local logins and
                  refresh every 5 minutes. If an agent has no 5-hour window, its weekly
                  number is shown instead.
                </div>
              </>
            )}

            {tab === 'dictation' && (
              <>
                <div className="git-line">
                  {dictationSource === 'codex' && !settings.openaiApiKey.trim() ? (
                    <span className="ok">
                      ✓ Using the key from your codex login automatically — no setup
                      needed.
                    </span>
                  ) : dictationSource === 'none' && !settings.openaiApiKey.trim() ? (
                    <span className="warn">
                      ⚠ No key found — run <code>codex login</code> or paste an API key
                      below.
                    </span>
                  ) : (
                    <span className="dim">Using the API key below.</span>
                  )}
                </div>

                <label className="field-label">OpenAI API key — optional override</label>
                <input
                  className="text-input mono"
                  type="password"
                  value={settings.openaiApiKey}
                  placeholder="sk-… (leave empty to use your codex login)"
                  onChange={(e) =>
                    setSettings({ ...settings, openaiApiKey: e.target.value })
                  }
                />
                <div className="git-line dim">
                  Transcription (Whisper) needs a platform key — ChatGPT-subscription
                  OAuth tokens only reach the codex chat backend, so the key minted by
                  your codex login is used instead. Stored locally on this Mac.
                </div>

                <label className="field-label">Hotkey</label>
                <input
                  className="text-input mono"
                  readOnly
                  value={
                    settings.dictationHotkey
                      ? formatHotkey(settings.dictationHotkey)
                      : 'disabled — click and press a combo'
                  }
                  onKeyDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      setSettings({ ...settings, dictationHotkey: '' })
                      return
                    }
                    const hotkey = eventToHotkey(e.nativeEvent)
                    if (hotkey) setSettings({ ...settings, dictationHotkey: hotkey })
                  }}
                />
                <div className="git-line dim">
                  Click the field and press a combo (needs a modifier, e.g. ⌘⇧D). Press
                  it anywhere to start dictating, again to stop. Backspace disables.
                </div>
              </>
            )}

            {tab === 'memory' && (
              <>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.memoryEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, memoryEnabled: e.target.checked })
                    }
                  />
                  Enable project memory
                </label>
                <div className="git-line dim">
                  Applies to agents launched after saving — running agents keep their
                  current connection.
                </div>

                <label className="field-label">How it works</label>
                <div className="memory-explainer">
                  <p>
                    Every project gets a <strong>graph of markdown notes</strong> stored
                    on this Mac (outside your repos). Notes are keyed by the repo's git
                    identity — its remote URL or first commit — so memory follows the
                    project across clones, moves, and worktrees.
                  </p>
                  <p>
                    Agents reach it through the <code>vibememory</code> MCP tools
                    (search, list, read, write, delete) injected into every claude and
                    codex launch. A managed skill (claude) and a global AGENTS.md note
                    (codex) teach them to search memory before big tasks and save
                    durable learnings after.
                  </p>
                  <p>
                    Multi-repo workspaces add a shared <em>project scope</em> on top of
                    each repo's own scope — open one repo alone later and you still see
                    both; an unrelated project sees nothing. Browse everything via ◈ in
                    the top bar, as a list or a link graph.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="mini-button" onClick={() => openSettings(false)}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
