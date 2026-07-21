import type { AgentKind } from './types'

/**
 * Command typed into the pane's shell after it starts.
 * null = plain shell pane, nothing to run.
 * resume relaunches the agent's previous conversation in that cwd.
 */
const YOLO_FLAGS: Record<string, string> = {
  claude: '--dangerously-skip-permissions',
  codex: '--dangerously-bypass-approvals-and-sandbox'
}

export function buildAgentCommand(
  kind: AgentKind,
  flags: string,
  resume: boolean,
  yolo = false
): string | null {
  const extra = flags.trim()
  switch (kind) {
    case 'claude': {
      const parts = ['claude']
      if (yolo) parts.push(YOLO_FLAGS.claude)
      if (resume) parts.push('--continue')
      if (extra) parts.push(extra)
      return parts.join(' ')
    }
    case 'codex': {
      const yoloPart = yolo ? ` ${YOLO_FLAGS.codex}` : ''
      // No reliable per-folder session check for codex — fall back to a
      // fresh session in the shell if resume finds nothing.
      if (resume) {
        return `codex${yoloPart} resume --last || codex${yoloPart}${extra ? ' ' + extra : ''}`
      }
      return `codex${yoloPart}${extra ? ' ' + extra : ''}`
    }
    case 'shell':
      return null
  }
}
