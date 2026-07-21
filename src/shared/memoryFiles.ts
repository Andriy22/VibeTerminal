import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'

export interface MemoryNoteMeta {
  scope: string
  id: string
  title: string
  tags: string[]
  updated: string
  /** ids referenced with [[links]] in the body. */
  links: string[]
}

export interface MemoryNote extends MemoryNoteMeta {
  content: string
}

function noteSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'note'
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

function parseNote(scope: string, id: string, raw: string): MemoryNote {
  const meta: MemoryNote = {
    scope,
    id,
    title: id,
    tags: [],
    updated: '',
    links: [],
    content: raw
  }
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (match) {
    meta.content = raw.slice(match[0].length)
    for (const line of match[1].split('\n')) {
      const sep = line.indexOf(':')
      if (sep < 0) continue
      const key = line.slice(0, sep).trim()
      const value = line.slice(sep + 1).trim()
      if (key === 'title') meta.title = value
      else if (key === 'updated') meta.updated = value
      else if (key === 'tags') {
        meta.tags = value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      }
    }
  }
  for (const match of meta.content.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].trim()
    if (target && !meta.links.includes(target)) meta.links.push(target)
  }
  return meta
}

function scopeDir(root: string, scope: string): string {
  return join(root, scope)
}

export function listNotes(root: string, scopes: string[]): MemoryNoteMeta[] {
  const notes: MemoryNoteMeta[] = []
  for (const scope of scopes) {
    const dir = scopeDir(root, scope)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      try {
        const note = parseNote(
          scope,
          file.slice(0, -3),
          readFileSync(join(dir, file), 'utf8')
        )
        notes.push({
          scope: note.scope,
          id: note.id,
          title: note.title,
          tags: note.tags,
          updated: note.updated,
          links: note.links
        })
      } catch {
        // unreadable note — skip
      }
    }
  }
  notes.sort((a, b) => b.updated.localeCompare(a.updated))
  return notes
}

export function readNote(root: string, scopes: string[], id: string): MemoryNote | null {
  for (const scope of scopes) {
    const file = join(scopeDir(root, scope), `${id}.md`)
    if (!existsSync(file)) continue
    try {
      return parseNote(scope, id, readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}

export function writeNote(
  root: string,
  scope: string,
  input: { id?: string; title: string; content: string; tags?: string[] }
): MemoryNoteMeta {
  const dir = scopeDir(root, scope)
  mkdirSync(dir, { recursive: true })
  // Explicit id = update in place; otherwise a fresh slugged id.
  const id = input.id?.trim() || noteSlug(input.title)
  const updated = new Date().toISOString()
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean)
  const raw = `---\ntitle: ${input.title}\ntags: ${tags.join(', ')}\nupdated: ${updated}\n---\n${input.content.trim()}\n`
  writeFileSync(join(dir, `${id}.md`), raw)
  return { scope, id, title: input.title, tags, updated, links: [] }
}

/** Delete a note by id across the given scopes. Returns true if removed. */
export function deleteNote(root: string, scopes: string[], id: string): boolean {
  for (const scope of scopes) {
    const file = join(scopeDir(root, scope), `${id}.md`)
    if (existsSync(file)) {
      unlinkSync(file)
      return true
    }
  }
  return false
}

export interface MemorySearchHit extends MemoryNoteMeta {
  snippet: string
}

export function searchNotes(
  root: string,
  scopes: string[],
  query: string
): MemorySearchHit[] {
  const needle = query.toLowerCase()
  const hits: MemorySearchHit[] = []
  for (const scope of scopes) {
    const dir = scopeDir(root, scope)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      try {
        const note = parseNote(
          scope,
          file.slice(0, -3),
          readFileSync(join(dir, file), 'utf8')
        )
        const haystack = `${note.title}\n${note.tags.join(' ')}\n${note.content}`
        const index = haystack.toLowerCase().indexOf(needle)
        if (index < 0) continue
        const start = Math.max(0, index - 80)
        hits.push({
          scope: note.scope,
          id: note.id,
          title: note.title,
          tags: note.tags,
          updated: note.updated,
          links: note.links,
          snippet: haystack.slice(start, index + needle.length + 120).replace(/\n+/g, ' ')
        })
      } catch {
        // skip
      }
    }
  }
  return hits.slice(0, 30)
}
