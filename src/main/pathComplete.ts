import { readdirSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'
import type { PathSuggestion } from '../shared/types'

export function expandTilde(input: string): string {
  if (input === '~') return homedir()
  if (input.startsWith('~/')) return join(homedir(), input.slice(2))
  return input
}

/**
 * cd-style completion: given a partial absolute path, list matching
 * subdirectories. "/Users/me/Doc" → [/Users/me/Documents, ...];
 * "/Users/me/Documents/" → everything inside Documents.
 */
export function suggestPaths(rawInput: string): PathSuggestion[] {
  const input = expandTilde(rawInput.trim())
  if (!input.startsWith('/')) return []

  const endsWithSlash = input.endsWith('/')
  const parent = endsWithSlash ? input : dirname(input)
  const prefix = endsWithSlash ? '' : basename(input).toLowerCase()

  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name.toLowerCase().startsWith(prefix)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((entry) => ({ name: entry.name, path: join(parent, entry.name) }))
  } catch {
    return []
  }
}
