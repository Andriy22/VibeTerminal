import type { AgentKind } from '@shared/types'

export const KIND_META: Record<AgentKind, { label: string; symbol: string; color: string }> = {
  claude: { label: 'claude', symbol: '✳', color: 'var(--claude)' },
  codex: { label: 'codex', symbol: '⬡', color: 'var(--codex)' },
  shell: { label: 'shell', symbol: '❯', color: 'var(--shell)' }
}

export const KIND_CYCLE: AgentKind[] = ['claude', 'codex', 'shell']

export function nextKind(kind: AgentKind): AgentKind {
  return KIND_CYCLE[(KIND_CYCLE.indexOf(kind) + 1) % KIND_CYCLE.length]
}

/** Live kind from the detected foreground process, falling back to config. */
export function detectKind(
  procName: string | null | undefined,
  fallback: AgentKind
): { kind: AgentKind; label: string } {
  if (!procName) return { kind: fallback, label: KIND_META[fallback].label }
  const name = procName.toLowerCase().replace(/^-/, '')
  if (name.includes('claude')) return { kind: 'claude', label: 'claude' }
  if (name.includes('codex')) return { kind: 'codex', label: 'codex' }
  return { kind: 'shell', label: name }
}

export function kindSummary(kinds: AgentKind[]): string {
  const counts = new Map<AgentKind, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return KIND_CYCLE.filter((k) => counts.has(k))
    .map((k) => `${counts.get(k)} ${KIND_META[k].label}`)
    .join(' · ')
}
