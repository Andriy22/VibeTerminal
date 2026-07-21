/** One `### Heading` block inside a release. */
export interface ReleaseSection {
  title: string
  items: string[]
}

/** One `## [version] — date` block of CHANGELOG.md. */
export interface Release {
  version: string
  date: string | null
  /** Prose paragraph for releases written without sections (e.g. 0.1.1). */
  note: string | null
  sections: ReleaseSection[]
}

const RELEASE_HEAD = /^##\s*\[([^\]]+)\](?:\s*[—–-]\s*(\S.*))?$/
const SECTION_HEAD = /^###\s+(\S.*)$/

/**
 * Parse CHANGELOG.md into releases, newest-first (file order).
 * Tolerates a missing date (Unreleased), prose-only releases, and
 * bullet text wrapped onto indented continuation lines.
 */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = []
  let release: Release | null = null
  let section: ReleaseSection | null = null

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd()

    const releaseMatch = RELEASE_HEAD.exec(line)
    if (releaseMatch) {
      release = {
        version: releaseMatch[1].trim(),
        date: releaseMatch[2]?.trim() ?? null,
        note: null,
        sections: []
      }
      releases.push(release)
      section = null
      continue
    }
    if (!release) continue

    const sectionMatch = SECTION_HEAD.exec(line)
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), items: [] }
      release.sections.push(section)
      continue
    }

    if (line.startsWith('- ')) {
      if (!section) {
        section = { title: '', items: [] }
        release.sections.push(section)
      }
      section.items.push(line.slice(2).trim())
      continue
    }

    const text = line.trim()
    if (!text) continue
    if (section && section.items.length > 0 && /^\s/.test(raw)) {
      section.items[section.items.length - 1] += ` ${text}`
    } else if (!section) {
      release.note = release.note ? `${release.note} ${text}` : text
    }
  }

  return releases.filter((r) => r.note !== null || r.sections.length > 0)
}
