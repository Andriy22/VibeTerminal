/**
 * vibememory — MCP stdio server giving agents access to the project memory
 * graph. Spawned by VibeTerminal per workspace with:
 *   VIBE_MEMORY_ROOT    memory root directory
 *   VIBE_MEMORY_SCOPES  comma list of visible scope keys (search/read)
 *   VIBE_MEMORY_LABELS  comma list of human labels matching SCOPES
 *   VIBE_MEMORY_WRITE   default scope for new notes
 */
import { createInterface } from 'readline'
import {
  deleteNote,
  listNotes,
  readNote,
  searchNotes,
  writeNote
} from '../shared/memoryFiles'

const ROOT = process.env.VIBE_MEMORY_ROOT ?? ''
const SCOPES = (process.env.VIBE_MEMORY_SCOPES ?? '').split(',').filter(Boolean)
const LABELS = (process.env.VIBE_MEMORY_LABELS ?? '').split(',').filter(Boolean)
const WRITE_SCOPE = process.env.VIBE_MEMORY_WRITE ?? SCOPES[0] ?? ''

function label(scope: string): string {
  const index = SCOPES.indexOf(scope)
  return index >= 0 && LABELS[index] ? LABELS[index] : scope
}

const TOOLS = [
  {
    name: 'memory_search',
    description:
      'Search this project\'s persistent memory graph (markdown notes with [[links]]). Use before starting significant tasks to recall decisions, gotchas, and prior work.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Text to search for' } },
      required: ['query']
    }
  },
  {
    name: 'memory_list',
    description: 'List all notes in the project memory graph (titles, tags, scopes).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'memory_read',
    description: 'Read a memory note by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'memory_write',
    description:
      'Save a durable learning, decision, or gotcha to project memory — or update an existing note by passing its id. One fact per note. IDs are assigned with a random suffix, so to cross-link notes with [[note-id]], write the target note first and use the id this tool returns. Optional scope: a repo scope for repo-specific facts, the project scope for cross-repo facts.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        id: {
          type: 'string',
          description: 'Existing note id to update in place (omit to create a new note)'
        },
        scope: { type: 'string', description: `One of: ${SCOPES.join(', ')}` }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'memory_delete',
    description:
      'Delete a memory note by id — use for duplicates or notes that turned out wrong.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  }
]

function callTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'memory_search': {
      const hits = searchNotes(ROOT, SCOPES, String(args.query ?? ''))
      if (hits.length === 0) return 'No matching notes.'
      return hits
        .map((h) => `[${h.id}] ${h.title} (${label(h.scope)})\n  …${h.snippet}…`)
        .join('\n')
    }
    case 'memory_list': {
      const notes = listNotes(ROOT, SCOPES)
      if (notes.length === 0) return 'Memory is empty for this project.'
      return notes
        .map((n) => `[${n.id}] ${n.title} (${label(n.scope)})${n.tags.length ? ` #${n.tags.join(' #')}` : ''}`)
        .join('\n')
    }
    case 'memory_read': {
      const note = readNote(ROOT, SCOPES, String(args.id ?? ''))
      if (!note) return `No note with id ${String(args.id)}.`
      return `# ${note.title}\nscope: ${label(note.scope)}  tags: ${note.tags.join(', ')}\n\n${note.content}`
    }
    case 'memory_write': {
      const requestedId = args.id ? String(args.id) : undefined
      let scope = String(args.scope ?? WRITE_SCOPE)
      if (requestedId) {
        // Updating: find the note's actual scope so the file is replaced, not forked.
        const existing = readNote(ROOT, SCOPES, requestedId)
        if (!existing) return `No note with id ${requestedId} to update.`
        scope = existing.scope
      } else if (!SCOPES.includes(scope)) {
        return `Invalid scope. Use one of: ${SCOPES.join(', ')}`
      }
      const meta = writeNote(ROOT, scope, {
        id: requestedId,
        title: String(args.title ?? 'untitled'),
        content: String(args.content ?? ''),
        tags: Array.isArray(args.tags) ? args.tags.map(String) : []
      })
      return `${requestedId ? 'Updated' : 'Saved'} [${meta.id}] "${meta.title}" in ${label(scope)}. Reference it from other notes as [[${meta.id}]].`
    }
    case 'memory_delete': {
      const removed = deleteNote(ROOT, SCOPES, String(args.id ?? ''))
      return removed
        ? `Deleted note ${String(args.id)}.`
        : `No note with id ${String(args.id)}.`
    }
    default:
      return `Unknown tool ${name}`
  }
}

function send(message: unknown): void {
  process.stdout.write(JSON.stringify(message) + '\n')
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  if (!line.trim()) return
  let request: { id?: number | string; method?: string; params?: Record<string, unknown> }
  try {
    request = JSON.parse(line)
  } catch {
    return
  }
  const { id, method, params } = request
  try {
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion:
            (params?.protocolVersion as string | undefined) ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'vibememory', version: '1.0.0' }
        }
      })
    } else if (method === 'notifications/initialized') {
      // no response for notifications
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} })
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    } else if (method === 'tools/call') {
      const name = String((params?.name as string) ?? '')
      const args = (params?.arguments as Record<string, unknown>) ?? {}
      const text = callTool(name, args)
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } })
    } else if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method ${method}` } })
    }
  } catch (error) {
    if (id !== undefined) {
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: (error as Error).message }
      })
    }
  }
})
