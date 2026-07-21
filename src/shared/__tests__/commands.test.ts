import { describe, expect, it } from 'vitest'
import { buildAgentCommand } from '../commands'

describe('buildAgentCommand', () => {
  it('builds claude commands', () => {
    expect(buildAgentCommand('claude', '', false)).toBe('claude')
    expect(buildAgentCommand('claude', '--model opus', false)).toBe('claude --model opus')
    expect(buildAgentCommand('claude', '--model opus', true)).toBe(
      'claude --continue --model opus'
    )
  })

  it('builds codex commands', () => {
    expect(buildAgentCommand('codex', '', false)).toBe('codex')
    expect(buildAgentCommand('codex', '--full-auto', false)).toBe('codex --full-auto')
    expect(buildAgentCommand('codex', '--full-auto', true)).toBe(
      'codex resume --last || codex --full-auto'
    )
  })

  it('returns null for shell panes', () => {
    expect(buildAgentCommand('shell', '', false)).toBeNull()
  })

  it('adds yolo flags for both agents', () => {
    expect(buildAgentCommand('claude', '', false, true)).toBe(
      'claude --dangerously-skip-permissions'
    )
    expect(buildAgentCommand('claude', '', true, true)).toBe(
      'claude --dangerously-skip-permissions --continue'
    )
    expect(buildAgentCommand('codex', '', false, true)).toBe(
      'codex --dangerously-bypass-approvals-and-sandbox'
    )
    expect(buildAgentCommand('codex', '', true, true)).toBe(
      'codex --dangerously-bypass-approvals-and-sandbox resume --last || codex --dangerously-bypass-approvals-and-sandbox'
    )
  })
})
