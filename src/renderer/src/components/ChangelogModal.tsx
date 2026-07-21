import { useEffect } from 'react'
import { parseChangelog } from '@shared/changelog'
import changelogSource from '../../../../CHANGELOG.md?raw'
import { useApp } from '../store'

const RELEASES = parseChangelog(changelogSource)

/** Chip color per section heading — unknown headings stay neutral. */
const CATEGORY_CLASS: Record<string, string> = {
  added: 'added',
  fixed: 'fixed',
  reworked: 'reworked',
  removed: 'removed'
}

/** Render the `**bold**`, `*italic*` and `` `code` `` spans of a changelog line. */
function inline(text: string): JSX.Element[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

export default function ChangelogModal(): JSX.Element {
  const openChangelog = useApp((s) => s.openChangelog)

  useEffect(() => {
    void window.vibe.getAppVersion().then((v) => {
      localStorage.setItem('vt-changelog-seen', v)
    })
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={() => openChangelog(false)}>
      <div className="modal changelog-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="changelog-head">
          <h2>What’s new</h2>
          <span className="dim">Every release, at a glance.</span>
          <span className="pane-spacer" />
          <button className="mini-button" onClick={() => openChangelog(false)}>
            Close
          </button>
        </div>

        <div className="changelog-body">
          {RELEASES.length === 0 && (
            <div className="empty-state">
              <div className="empty-mark">✦</div>
              <p className="dim">No releases documented yet.</p>
            </div>
          )}
          {RELEASES.map((release, index) => (
            <section className="changelog-release" key={release.version}>
              <div className="changelog-release-head">
                <span className="changelog-version">
                  {release.version === 'Unreleased'
                    ? 'Unreleased'
                    : `v${release.version}`}
                </span>
                {index === 0 && <span className="changelog-latest">Latest</span>}
                {release.date && <span className="changelog-date">{release.date}</span>}
              </div>

              {release.note && <p className="changelog-note">{inline(release.note)}</p>}

              {release.sections.map((section) => (
                <div
                  className={`changelog-section ${
                    CATEGORY_CLASS[section.title.toLowerCase()] ?? ''
                  }`}
                  key={section.title || 'general'}
                >
                  {section.title && (
                    <span className="changelog-cat">{section.title}</span>
                  )}
                  <ul>
                    {section.items.map((item, i) => (
                      <li key={i}>{inline(item)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
