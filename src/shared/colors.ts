/** Accent palette for workspaces and groups — matches the app's agent hues. */
export const WORKSPACE_COLORS = [
  '#d97757', // coral
  '#56b6c2', // teal
  '#539bf5', // blue
  '#b083f0', // purple
  '#ec6cb9', // magenta
  '#57ab5a', // green
  '#c69026', // amber
  '#f47067', // red
  '#76e3ea', // cyan
  '#8b939d' // slate
]

/** Stable auto color for a workspace with no explicit color. */
export function autoColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return WORKSPACE_COLORS[hash % WORKSPACE_COLORS.length]
}

/** Explicit workspace color → group color → stable auto color. */
export function effectiveColor(
  config: { id: string; path: string; color?: string | null },
  groupColors: Record<string, string>
): string {
  return config.color ?? groupColors[config.path] ?? autoColor(config.id)
}
