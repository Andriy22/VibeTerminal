export const CALLSIGNS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliett',
  'kilo',
  'lima'
]

/** Human name for the pane at `index` (0-based): 0 → alpha, 1 → bravo … */
export function callsign(index: number): string {
  return CALLSIGNS[index] ?? `agent-${index + 1}`
}
